import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import pool, { initDB } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

// Middleware
app.use(cors());
app.use(express.json());

// Create HTTP server for Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [frontendOrigin, 'http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
  },
});

// Store connected users for socket tracking
const connectedUsers = new Map();
const userSocketCounts = new Map();

const setUserPresence = async (uid, isOnline) => {
  if (!uid) return;

  try {
    if (isOnline) {
      await pool.query('UPDATE users SET isOnline = TRUE WHERE uid = ?', [uid]);
      io.emit('user_presence', { uid, isOnline: true, lastSeenAt: null });
    } else {
      const lastSeenAt = new Date();
      await pool.query('UPDATE users SET isOnline = FALSE, lastSeenAt = ? WHERE uid = ?', [
        lastSeenAt,
        uid,
      ]);
      io.emit('user_presence', { uid, isOnline: false, lastSeenAt: lastSeenAt.toISOString() });
    }
  } catch (error) {
    console.error('Failed to update user presence:', error);
  }
};

const getDisplayNameForUser = async (conversationId, currentUid) => {
  const [rows] = await pool.query(
    `
      SELECT
        c.id,
        CASE
          WHEN c.createdByUid = ? THEN COALESCE(participant.displayName, participant.email)
          WHEN c.participantUid = ? THEN COALESCE(creator.displayName, creator.email)
          ELSE c.name
        END AS displayName
      FROM conversations c
      LEFT JOIN users creator ON creator.uid = c.createdByUid
      LEFT JOIN users participant ON participant.uid = c.participantUid
      WHERE c.id = ?
      LIMIT 1
    `,
    [currentUid, currentUid, conversationId]
  );

  return rows[0]?.displayName || null;
};

const emitMessageStatusUpdate = (payload) => {
  io.emit('message_status', payload);
};

// Auth Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/api/app-config', (req, res) => {
  res.json({
    appName: process.env.APP_NAME || 'iChat',
    appTagline: process.env.APP_TAGLINE || 'Secure Real-time Chat App',
  });
});

app.get('/api/users/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const currentUid = String(req.query.uid || '').trim();

  if (!q) {
    return res.json([]);
  }

  try {
    const likeQuery = `%${q}%`;
    const params = [likeQuery, likeQuery];
    let query = `
      SELECT uid, displayName, email, avatarUrl, isVerified
      FROM users
      WHERE (displayName LIKE ? OR email LIKE ?)
    `;

    if (currentUid) {
      query += ' AND uid <> ?';
      params.push(currentUid);
    }

    query += ' ORDER BY displayName ASC LIMIT 20';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

app.get('/api/users/:uid/status', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT uid, isOnline, lastSeenAt, avatarUrl FROM users WHERE uid = ? LIMIT 1',
      [req.params.uid]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = rows[0];
    const liveCount = userSocketCounts.get(user.uid) || 0;
    const isOnline = liveCount > 0 || !!user.isOnline;

    res.json({
      uid: user.uid,
      isOnline,
      lastSeenAt: isOnline ? null : user.lastSeenAt,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

// Conversation Routes
app.get('/api/conversations', async (req, res) => {
  const currentUid = String(req.query.uid || '').trim();

  try {
    const params = [];
    let visibilityFilter = '';

    if (currentUid) {
      visibilityFilter = 'WHERE c.createdByUid = ? OR c.participantUid = ?';
      params.push(currentUid, currentUid);
    }

    const [rows] = await pool.query(`
      SELECT
        c.id,
        CASE
          WHEN ? <> '' AND c.createdByUid = ? THEN COALESCE(participant.displayName, participant.email, c.name)
          WHEN ? <> '' AND c.participantUid = ? THEN COALESCE(creator.displayName, creator.email, c.name)
          ELSE c.name
        END AS name,
        creator.avatarUrl AS creatorAvatarUrl,
        participant.avatarUrl AS participantAvatarUrl,
        c.createdAt,
        c.createdByUid,
        c.participantUid,
        m.text AS lastMessage,
        m.timestamp AS timestamp
      FROM conversations c
      LEFT JOIN users creator ON creator.uid = c.createdByUid
      LEFT JOIN users participant ON participant.uid = c.participantUid
      LEFT JOIN messages m ON m.id = (
        SELECT m2.id
        FROM messages m2
        WHERE m2.conversationId = c.id
        ORDER BY m2.timestamp DESC
        LIMIT 1
      )
      ${visibilityFilter}
      ORDER BY COALESCE(m.timestamp, c.createdAt) DESC
    `, [currentUid, currentUid, currentUid, currentUid, ...params]);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.post('/api/conversations', async (req, res) => {
  const { creatorUid, participantUid } = req.body;

  if (!creatorUid || !participantUid) {
    return res.status(400).json({ error: 'creatorUid and participantUid are required' });
  }

  if (creatorUid === participantUid) {
    return res.status(400).json({ error: 'Cannot start a chat with yourself' });
  }

  try {
    const [userRows] = await pool.query(
      `
        SELECT uid, displayName, email, avatarUrl
        FROM users
        WHERE uid IN (?, ?) AND isVerified = TRUE
      `,
      [creatorUid, participantUid]
    );

    const creatorUser = userRows.find((u) => u.uid === creatorUid);
    const participantUser = userRows.find((u) => u.uid === participantUid);

    if (!creatorUser || !participantUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [existingRows] = await pool.query(
      `
        SELECT
          c.*,
          creator.avatarUrl AS creatorAvatarUrl,
          participant.avatarUrl AS participantAvatarUrl
        FROM conversations c
        LEFT JOIN users creator ON creator.uid = c.createdByUid
        LEFT JOIN users participant ON participant.uid = c.participantUid
        WHERE (createdByUid = ? AND participantUid = ?)
           OR (createdByUid = ? AND participantUid = ?)
        LIMIT 1
      `,
      [creatorUid, participantUid, participantUid, creatorUid]
    );

    if (existingRows.length > 0) {
      const displayName = await getDisplayNameForUser(existingRows[0].id, creatorUid);
      return res.json({ ...existingRows[0], name: displayName || existingRows[0].name });
    }

    const [result] = await pool.query(
      'INSERT INTO conversations (name, createdByUid, participantUid) VALUES (?, ?, ?)',
      [participantUser.displayName || participantUser.email, creatorUid, participantUid]
    );

    const [rows] = await pool.query(
      `
        SELECT
          c.*,
          creator.avatarUrl AS creatorAvatarUrl,
          participant.avatarUrl AS participantAvatarUrl
        FROM conversations c
        LEFT JOIN users creator ON creator.uid = c.createdByUid
        LEFT JOIN users participant ON participant.uid = c.participantUid
        WHERE c.id = ?
      `,
      [result.insertId]
    );
    const displayName = await getDisplayNameForUser(result.insertId, creatorUid);
    res.json({ ...rows[0], name: displayName || rows[0].name });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  const currentUid = String(req.query.uid || '').trim();

  try {
    const [convRows] = await pool.query(
      `
        SELECT
          c.*,
          CASE
            WHEN ? <> '' AND c.createdByUid = ? THEN COALESCE(participant.displayName, participant.email, c.name)
            WHEN ? <> '' AND c.participantUid = ? THEN COALESCE(creator.displayName, creator.email, c.name)
            ELSE c.name
          END AS name
          , creator.avatarUrl AS creatorAvatarUrl
          , participant.avatarUrl AS participantAvatarUrl
        FROM conversations c
        LEFT JOIN users creator ON creator.uid = c.createdByUid
        LEFT JOIN users participant ON participant.uid = c.participantUid
        WHERE c.id = ?
      `,
      [currentUid, currentUid, currentUid, currentUid, req.params.id]
    );

    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convRows[0];
    if (
      currentUid &&
      conversation.createdByUid &&
      conversation.participantUid &&
      conversation.createdByUid !== currentUid &&
      conversation.participantUid !== currentUid
    ) {
      return res.status(403).json({ error: 'Not allowed to view this conversation' });
    }

    const [msgRows] = await pool.query(
      'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC',
      [req.params.id]
    );
    res.json({ ...conversation, messages: msgRows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  const currentUid = String(req.query.uid || '').trim();

  try {
    const [convRows] = await pool.query('SELECT * FROM conversations WHERE id = ?', [req.params.id]);

    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convRows[0];
    if (
      currentUid &&
      conversation.createdByUid &&
      conversation.participantUid &&
      conversation.createdByUid !== currentUid &&
      conversation.participantUid !== currentUid
    ) {
      return res.status(403).json({ error: 'Not allowed to delete this conversation' });
    }

    await pool.query('DELETE FROM conversations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

app.post('/api/conversations/:id/messages', async (req, res) => {
  const { sender, text, senderUid } = req.body;

  if (!sender || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'sender and text are required' });
  }

  try {
    const [convRows] = await pool.query('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convRows[0];
    if (
      senderUid &&
      conversation.createdByUid &&
      conversation.participantUid &&
      conversation.createdByUid !== senderUid &&
      conversation.participantUid !== senderUid
    ) {
      return res.status(403).json({ error: 'Not allowed to send message in this conversation' });
    }

    const recipientUid =
      conversation.createdByUid === senderUid
        ? conversation.participantUid
        : conversation.createdByUid;
    const recipientIsOnline = (userSocketCounts.get(recipientUid) || 0) > 0;
    const deliveredAt = recipientIsOnline ? new Date() : null;

    const [result] = await pool.query(
      'INSERT INTO messages (conversationId, sender, senderUid, text, deliveredAt) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, sender, senderUid || null, String(text).trim(), deliveredAt]
    );

    const [msgRows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
    const createdMessage = msgRows[0];

    io.emit('receive_message', {
      conversationId: Number(req.params.id),
      message: createdMessage,
    });

    emitMessageStatusUpdate({
      conversationId: Number(req.params.id),
      messageId: createdMessage.id,
      deliveredAt: createdMessage.deliveredAt,
      seenAt: createdMessage.seenAt,
    });

    res.status(201).json(createdMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/conversations/:id/seen', async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'uid is required' });
  }

  try {
    const [convRows] = await pool.query('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    if (convRows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const conversation = convRows[0];
    if (conversation.createdByUid !== uid && conversation.participantUid !== uid) {
      return res.status(403).json({ error: 'Not allowed to update seen status' });
    }

    const now = new Date();
    await pool.query(
      `
        UPDATE messages
        SET
          deliveredAt = COALESCE(deliveredAt, ?),
          seenAt = COALESCE(seenAt, ?)
        WHERE conversationId = ?
          AND senderUid IS NOT NULL
          AND senderUid <> ?
          AND seenAt IS NULL
      `,
      [now, now, req.params.id, uid]
    );

    const [updatedRows] = await pool.query(
      `
        SELECT id, deliveredAt, seenAt
        FROM messages
        WHERE conversationId = ?
          AND senderUid IS NOT NULL
          AND senderUid <> ?
          AND seenAt IS NOT NULL
      `,
      [req.params.id, uid]
    );

    updatedRows.forEach((row) => {
      emitMessageStatusUpdate({
        conversationId: Number(req.params.id),
        messageId: row.id,
        deliveredAt: row.deliveredAt,
        seenAt: row.seenAt,
      });
    });

    res.json({ success: true, updated: updatedRows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update seen status' });
  }
});

// Socket.io events for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_join', async (userData) => {
    connectedUsers.set(socket.id, userData);
    const uid = String(userData?.uid || '').trim();

    if (uid) {
      const nextCount = (userSocketCounts.get(uid) || 0) + 1;
      userSocketCounts.set(uid, nextCount);
      if (nextCount === 1) {
        await setUserPresence(uid, true);

        const now = new Date();
        await pool.query(
          `
            UPDATE messages m
            JOIN conversations c ON c.id = m.conversationId
            SET m.deliveredAt = COALESCE(m.deliveredAt, ?)
            WHERE (c.createdByUid = ? OR c.participantUid = ?)
              AND m.senderUid IS NOT NULL
              AND m.senderUid <> ?
              AND m.deliveredAt IS NULL
          `,
          [now, uid, uid, uid]
        );
      }
    }

    socket.broadcast.emit('user_joined', {
      username: userData.displayName || userData.email,
      userId: uid || socket.id,
      timestamp: new Date(),
    });
  });

  socket.on('send_message', async (data) => {
    const { conversationId, message, sender } = data;
    try {
      const [result] = await pool.query(
        'INSERT INTO messages (conversationId, sender, text) VALUES (?, ?, ?)',
        [conversationId, sender, message]
      );
      
      const [msgRows] = await pool.query('SELECT * FROM messages WHERE id = ?', [result.insertId]);
      
      io.emit('receive_message', {
        conversationId,
        message: msgRows[0],
      });
    } catch (error) {
      console.error('Save message error:', error);
    }
  });

  socket.on('typing', (data) => {
    const userData = connectedUsers.get(socket.id);
    socket.broadcast.emit('user_typing', {
      username: userData?.displayName || userData?.email,
      conversationId: data.conversationId,
    });
  });

  socket.on('message_delivered', async (data) => {
    const { messageId, conversationId, uid } = data || {};
    if (!messageId || !conversationId || !uid) return;

    try {
      const now = new Date();
      await pool.query(
        `
          UPDATE messages m
          JOIN conversations c ON c.id = m.conversationId
          SET m.deliveredAt = COALESCE(m.deliveredAt, ?)
          WHERE m.id = ?
            AND m.conversationId = ?
            AND m.senderUid IS NOT NULL
            AND m.senderUid <> ?
            AND (c.createdByUid = ? OR c.participantUid = ?)
        `,
        [now, messageId, conversationId, uid, uid, uid]
      );

      const [rows] = await pool.query('SELECT id, deliveredAt, seenAt FROM messages WHERE id = ?', [messageId]);
      if (rows.length > 0) {
        emitMessageStatusUpdate({
          conversationId: Number(conversationId),
          messageId: rows[0].id,
          deliveredAt: rows[0].deliveredAt,
          seenAt: rows[0].seenAt,
        });
      }
    } catch (error) {
      console.error('Failed to update delivery status:', error);
    }
  });

  socket.on('disconnect', async () => {
    const userData = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);

    const uid = String(userData?.uid || '').trim();
    if (uid) {
      const currentCount = userSocketCounts.get(uid) || 0;
      const nextCount = Math.max(currentCount - 1, 0);

      if (nextCount === 0) {
        userSocketCounts.delete(uid);
        await setUserPresence(uid, false);
      } else {
        userSocketCounts.set(uid, nextCount);
      }
    }

    socket.broadcast.emit('user_left', {
      username: userData?.displayName || userData?.email,
      userId: uid || socket.id,
      timestamp: new Date(),
    });
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

// Start server
const startServer = async () => {
  try {
    await initDB();
    await pool.query('UPDATE users SET isOnline = FALSE');
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📨 WebSocket server ready for connections`);
      console.log(`🔐 Authentication endpoints ready at /api/auth`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
