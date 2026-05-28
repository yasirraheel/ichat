import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BsSend,
  BsTrash,
  BsArrowLeft,
  BsSearch,
  BsChatLeftText,
  BsThreeDotsVertical,
  BsBoxArrowRight,
  BsCheck2,
  BsCheck2All,
  BsX,
  BsShieldLock,
} from 'react-icons/bs';
import { io } from 'socket.io-client';
import { chatAPI, SOCKET_URL } from '../services/api';
import { updateMyAvatar } from '../services/authService';
import { useAppConfig } from '../context/AppConfigContext';
import {
  loadPrivateKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  isEncrypted,
} from '../services/cryptoService';
import '../styles/ChatWindow.css';

const ChatWindow = ({ user, userProfile, onLogout }) => {
  const { appName } = useAppConfig();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [newChatQuery, setNewChatQuery] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showHeaderSearch, setShowHeaderSearch] = useState(false);
  const [headerSearchTerm, setHeaderSearchTerm] = useState('');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [participantStatus, setParticipantStatus] = useState({ isOnline: false, lastSeenAt: null });
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [chatActionError, setChatActionError] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [sharedKey, setSharedKey] = useState(null);  // AES-GCM key for current chat
  const [e2eeReady, setE2eeReady] = useState(false);  // true when encryption is set up
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const selectedChatRef = useRef(null);
  const headerMenuRef = useRef(null);
  const selectedParticipantUidRef = useRef(null);
  const selectedChatIdRef = useRef(null);
  const avatarInputRef = useRef(null);
  const sharedKeyRef = useRef(null); // keep sharedKey accessible inside socket callbacks

  const currentUid = userProfile?.uid || user;
  const currentSender = userProfile?.displayName || userProfile?.email || 'Unknown';
  const currentAvatar = currentSender.charAt(0).toUpperCase();
  const currentAvatarUrl = userProfile?.avatarUrl || '';
  const selectedChatStorageKey = currentUid ? `chatnotes_selected_chat_${currentUid}` : null;

  const renderAvatar = (name, avatarUrl, className) => {
    const fallback = String(name || 'U').charAt(0).toUpperCase();
    if (avatarUrl) {
      return <img src={avatarUrl} alt={name || 'profile photo'} className={className} />;
    }
    return <div className={className}>{fallback}</div>;
  };

  const getConversationAvatar = (conversation) => {
    if (!conversation) return '';
    const isCreator = String(conversation.createdByUid || '') === String(currentUid);
    return isCreator ? conversation.participantAvatarUrl || '' : conversation.creatorAvatarUrl || '';
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setChatActionError('Please choose an image file for your dp');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setChatActionError('');
        const avatarUrl = String(reader.result || '');
        await updateMyAvatar(avatarUrl);
        window.location.reload();
      } catch (error) {
        setChatActionError(error.message || 'Could not update your dp');
      }
    };
    reader.readAsDataURL(file);
  };

  const readStoredSelectedChat = () => {
    if (!selectedChatStorageKey) return null;

    try {
      const stored = localStorage.getItem(selectedChatStorageKey);
      if (!stored) return null;

      const parsed = Number(stored);
      return Number.isNaN(parsed) ? null : parsed;
    } catch {
      return null;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!currentUid) return;

    const storedChatId = readStoredSelectedChat();
    if (storedChatId) {
      setSelectedChat(storedChatId);
    }
  }, [currentUid]);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoadingConversations(true);
        const { data } = await chatAPI.getConversations(currentUid);
        const nextConversations = data || [];
        setConversations(nextConversations);

        const storedChatId = readStoredSelectedChat();
        if (storedChatId) {
          const exists = nextConversations.some((conv) => Number(conv.id) === Number(storedChatId));
          if (!exists) {
            setSelectedChat(null);
            localStorage.removeItem(selectedChatStorageKey);
          }
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoadingConversations(false);
      }
    };

    if (currentUid) {
      loadConversations();
    }
  }, [currentUid, selectedChatStorageKey]);

  useEffect(() => {
    if (!selectedChatStorageKey) return;

    if (selectedChat) {
      localStorage.setItem(selectedChatStorageKey, String(selectedChat));
    } else {
      localStorage.removeItem(selectedChatStorageKey);
    }
  }, [selectedChat, selectedChatStorageKey]);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
    selectedChatIdRef.current = selectedChat;
    setShowHeaderSearch(false);
    setHeaderSearchTerm('');
    setShowHeaderMenu(false);

    if (selectedChat) {
      setUnreadCounts((prev) => {
        if (!prev[selectedChat]) return prev;
        const next = { ...prev };
        delete next[selectedChat];
        return next;
      });
    }
  }, [selectedChat]);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!headerMenuRef.current) return;
      if (!headerMenuRef.current.contains(event.target)) {
        setShowHeaderMenu(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current.emit('user_join', {
      uid: currentUid,
      email: userProfile?.email,
      displayName: userProfile?.displayName || userProfile?.email,
    });

    const onMessageReceived = async ({ conversationId, message }) => {
      const normalizedConversationId = Number(conversationId);
      const isOwnMessage = String(message?.senderUid || '') === String(currentUid);
      const isActiveConversation = Number(selectedChatRef.current) === normalizedConversationId;

      // Decrypt the incoming message text if possible
      let displayText = message.text;
      if (isEncrypted(message.text) && sharedKeyRef.current) {
        const decrypted = await decryptMessage(sharedKeyRef.current, message.text);
        displayText = decrypted ?? '🔒 Encrypted message';
      }
      const displayMessage = { ...message, text: displayText };

      setConversations((prev) => {
        const existingConversation = prev.find((c) => Number(c.id) === normalizedConversationId);
        if (!existingConversation) {
          return prev;
        }

        return prev.map((conv) =>
          Number(conv.id) === normalizedConversationId
            ? { ...conv, lastMessage: displayText, timestamp: message.timestamp || new Date().toISOString() }
            : conv
        );
      });

      if (isActiveConversation) {
        setMessages((prev) => [...prev, displayMessage]);

        if (!isOwnMessage) {
          socketRef.current?.emit('message_delivered', {
            messageId: message.id,
            conversationId: normalizedConversationId,
            uid: currentUid,
          });
        }
      } else if (!isOwnMessage) {
        setUnreadCounts((prev) => ({
          ...prev,
          [normalizedConversationId]: (prev[normalizedConversationId] || 0) + 1,
        }));
      }
    };

    const onMessageStatus = ({ conversationId, messageId, deliveredAt, seenAt }) => {
      const normalizedConversationId = Number(conversationId);
      if (Number(selectedChatIdRef.current) !== normalizedConversationId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          Number(msg.id) === Number(messageId)
            ? {
                ...msg,
                deliveredAt: deliveredAt || msg.deliveredAt || null,
                seenAt: seenAt || msg.seenAt || null,
              }
            : msg
        )
      );
    };

    const onPresenceUpdate = ({ uid, isOnline, lastSeenAt }) => {
      if (!uid || selectedParticipantUidRef.current !== uid) return;
      setParticipantStatus({ isOnline: !!isOnline, lastSeenAt: lastSeenAt || null });
    };

    socketRef.current.on('receive_message', onMessageReceived);
    socketRef.current.on('user_presence', onPresenceUpdate);
    socketRef.current.on('message_status', onMessageStatus);

    return () => {
      socketRef.current?.off('receive_message', onMessageReceived);
      socketRef.current?.off('user_presence', onPresenceUpdate);
      socketRef.current?.off('message_status', onMessageStatus);
      socketRef.current?.disconnect();
    };
  }, [currentUid, userProfile?.email, userProfile?.displayName]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setSharedKey(null);
      setE2eeReady(false);
      sharedKeyRef.current = null;
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const { data } = await chatAPI.getConversation(selectedChat, currentUid);
        const loadedMessages = data?.messages || [];

        // ── E2EE: derive shared key for this conversation ──
        let derivedKey = null;
        try {
          const participantUid = data?.participantUid && data.participantUid !== currentUid
            ? data.participantUid
            : data?.createdByUid;
          if (participantUid && participantUid !== currentUid) {
            const myPrivateKey = await loadPrivateKey(currentUid);
            const { data: pkData } = await chatAPI.getUserPublicKey(participantUid);
            if (myPrivateKey && pkData?.publicKey) {
              const theirPublicKey = await importPublicKey(pkData.publicKey);
              derivedKey = await deriveSharedKey(myPrivateKey, theirPublicKey);
            }
          }
        } catch (keyErr) {
          console.warn('E2EE key derivation failed:', keyErr.message);
        }

        sharedKeyRef.current = derivedKey;
        setSharedKey(derivedKey);
        setE2eeReady(!!derivedKey);

        // ── Decrypt all loaded messages ──
        const decryptedMessages = await Promise.all(
          loadedMessages.map(async (msg) => {
            if (derivedKey && isEncrypted(msg.text)) {
              const plain = await decryptMessage(derivedKey, msg.text);
              return { ...msg, text: plain ?? '🔒 Encrypted message' };
            }
            return msg;
          })
        );

        setMessages(decryptedMessages);

        const hasIncoming = loadedMessages.some(
          (m) => String(m.senderUid || '') !== String(currentUid)
        );
        if (hasIncoming) {
          await chatAPI.markConversationSeen(selectedChat, currentUid);
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [selectedChat, currentUid]);

  useEffect(() => {
    if (!showNewChat) {
      setSearchResults([]);
      setNewChatQuery('');
      setSearchError('');
      return;
    }

    if (!newChatQuery.trim()) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        setSearchError('');
        const { data } = await chatAPI.searchUsers(newChatQuery.trim(), currentUid);
        setSearchResults(data || []);
      } catch (error) {
        console.error('Failed to search users:', error);
        setSearchError('Could not search users right now');
        setSearchResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [newChatQuery, showNewChat, currentUid]);

  const formatTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateSeparatorLabel = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((todayStart - targetStart) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    return date.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const toDateKey = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const getOwnMessageStatus = (message) => {
    if (!message?.id) return 'sent';
    if (message.seenAt) return 'seen';
    if (message.deliveredAt) return 'delivered';
    return 'sent';
  };

  const formatPresence = (status) => {
    if (status?.isOnline) return 'online';

    if (!status?.lastSeenAt) return 'offline';

    const date = new Date(status.lastSeenAt);
    if (Number.isNaN(date.getTime())) return 'offline';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.floor((todayStart - targetStart) / (1000 * 60 * 60 * 24));
    const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (diffDays === 0) return `last seen today at ${timePart}`;
    if (diffDays === 1) return `last seen yesterday at ${timePart}`;
    return `last seen ${date.toLocaleDateString([], { day: '2-digit', month: 'short' })} at ${timePart}`;
  };

  const startNewChat = async (participant) => {
    if (!participant?.uid || !currentUid) return;

    try {
      setChatActionError('');
      const { data } = await chatAPI.createConversation(currentUid, participant.uid);
      setConversations((prev) => {
        const exists = prev.some((c) => Number(c.id) === Number(data.id));
        if (exists) {
          return prev;
        }
        return [data, ...prev];
      });
      setSelectedChat(data.id);
      setMessages([]);
      setNewChatQuery('');
      setSearchResults([]);
      setShowNewChat(false);
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setChatActionError(error?.response?.data?.error || 'Failed to start chat');
    }
  };

  const deleteChat = async (conversationId, event) => {
    event?.stopPropagation();

    if (!window.confirm('Delete this chat? This will remove all messages in it.')) {
      return;
    }

    try {
      setChatActionError('');
      await chatAPI.deleteConversation(conversationId, currentUid);
      setConversations((prev) => prev.filter((conv) => Number(conv.id) !== Number(conversationId)));
      if (Number(selectedChatRef.current) === Number(conversationId)) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      setChatActionError(error?.response?.data?.error || 'Failed to delete chat');
    }
  };

  const sendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText || !selectedChat) return;

    try {
      // Encrypt before sending if E2EE key is available
      let textToSend = trimmedText;
      if (sharedKeyRef.current) {
        textToSend = await encryptMessage(sharedKeyRef.current, trimmedText);
      }
      await chatAPI.sendMessage(
        selectedChat,
        currentSender,
        textToSend,
        currentUid
      );
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const term = conversationSearch.trim().toLowerCase();
    if (!term) return true;

    return (
      String(conv.name || '').toLowerCase().includes(term) ||
      String(conv.lastMessage || '').toLowerCase().includes(term)
    );
  });

  const selectedConversation = conversations.find(
    (c) => Number(c.id) === Number(selectedChat)
  );

  const openConversation = (conversationId) => {
    setSelectedChat(conversationId);
    setUnreadCounts((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  const selectedParticipantUid = selectedConversation
    ? (selectedConversation.createdByUid === currentUid
        ? selectedConversation.participantUid
        : selectedConversation.createdByUid)
    : null;

  useEffect(() => {
    selectedParticipantUidRef.current = selectedParticipantUid;
  }, [selectedParticipantUid]);

  useEffect(() => {
    if (!selectedParticipantUid) {
      setParticipantStatus({ isOnline: false, lastSeenAt: null });
      return;
    }

    const loadParticipantStatus = async () => {
      try {
        const { data } = await chatAPI.getUserStatus(selectedParticipantUid);
        setParticipantStatus({
          isOnline: !!data?.isOnline,
          lastSeenAt: data?.lastSeenAt || null,
        });
      } catch (error) {
        console.error('Failed to fetch user status:', error);
        setParticipantStatus({ isOnline: false, lastSeenAt: null });
      }
    };

    loadParticipantStatus();
  }, [selectedParticipantUid]);

  const visibleMessages = messages.filter((msg) => {
    const term = headerSearchTerm.trim().toLowerCase();
    if (!term) return true;
    return String(msg.text || '').toLowerCase().includes(term);
  });

  const messagesWithSeparators = [];
  let previousDateKey = '';
  visibleMessages.forEach((msg) => {
    const currentDateKey = toDateKey(msg.timestamp);
    if (currentDateKey && currentDateKey !== previousDateKey) {
      messagesWithSeparators.push({
        type: 'date-separator',
        id: `sep-${currentDateKey}`,
        label: formatDateSeparatorLabel(msg.timestamp),
      });
      previousDateKey = currentDateKey;
    }

    messagesWithSeparators.push({
      type: 'message',
      data: msg,
      id: `msg-${msg.id}`,
    });
  });

  return (
    <div className={`chat-window ${selectedChat ? 'chat-open' : 'list-open'}`}>
      <div className="conversations-list">
        <div className="sidebar-topbar">
          <div className="sidebar-user">
            {renderAvatar(userProfile?.displayName || 'User', currentAvatarUrl, 'sidebar-user-avatar')}
            <div className="sidebar-user-meta">
              <strong>{userProfile?.displayName || 'User'}</strong>
            </div>
          </div>
          <div className="sidebar-action-buttons">
            <button
              className="icon-btn"
              onClick={() => setShowNewChat(!showNewChat)}
              title="New chat"
            >
              <BsChatLeftText />
            </button>
            <button className="icon-btn" title="More options">
              <BsThreeDotsVertical />
            </button>
          </div>
        </div>

        <div className="chat-search-row">
          <BsSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
          />
        </div>

        {showNewChat && (
          <div className="new-chat-form">
            <input
              type="text"
              placeholder="Type name/email to find users"
              value={newChatQuery}
              onChange={(e) => setNewChatQuery(e.target.value)}
              autoFocus
            />
            {searchingUsers && <p className="search-hint">Searching users...</p>}
            {!searchingUsers && newChatQuery.trim() && searchResults.length === 0 && !searchError && (
              <p className="search-hint">No matching users found</p>
            )}
            {searchError && <p className="search-error">{searchError}</p>}
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((candidate) => (
                  <button
                    type="button"
                    key={candidate.uid}
                    className="search-result-item"
                    onClick={() => startNewChat(candidate)}
                  >
                    {renderAvatar(candidate.displayName, candidate.avatarUrl || '', 'conversation-avatar')}
                    <span>{candidate.displayName}</span>
                    <small>{candidate.email}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {chatActionError && (
          <div className="chat-action-error">{chatActionError}</div>
        )}

        <div className="conversations-items">
          {loadingConversations && (
            <div className="empty-state">
              <p>Loading conversations...</p>
            </div>
          )}
          {!loadingConversations && filteredConversations.length === 0 && (
            <div className="empty-state">
              <p>No chats found</p>
            </div>
          )}
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${Number(selectedChat) === Number(conv.id) ? 'active' : ''}`}
              onClick={() => openConversation(conv.id)}
            >
              {renderAvatar(conv.name, getConversationAvatar(conv), 'conversation-avatar')}
              <div className="conversation-info">
                <h3>{conv.name}</h3>
                <p>{conv.lastMessage || 'Start a conversation'}</p>
              </div>
              <div className="conversation-meta">
                <span className="conversation-time">{formatTime(conv.timestamp || conv.createdAt)}</span>
                {unreadCounts[conv.id] > 0 && (
                  <span className="unread-count-badge">
                    {unreadCounts[conv.id] > 99 ? '99+' : unreadCounts[conv.id]}
                  </span>
                )}
              </div>
              <button
                className="delete-conversation-btn"
                onClick={(event) => deleteChat(conv.id, event)}
                title="Delete chat"
              >
                <BsTrash />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="account-footer-meta">
            {renderAvatar(userProfile?.displayName || 'User', currentAvatarUrl, 'account-footer-avatar')}
            <div>
              <strong>{userProfile?.displayName || 'User'}</strong>
            </div>
          </div>
          <div className="sidebar-footer-actions">
            <button
              className="sidebar-avatar-btn"
              type="button"
              onClick={() => avatarInputRef.current?.click()}
            >
              Change DP
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
            <button className="sidebar-logout-btn" onClick={onLogout}>
              <BsBoxArrowRight /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="chat-area">
        {selectedChat ? (
          <>
            <div className="chat-header">
              <button
                className="mobile-back-btn"
                onClick={() => setSelectedChat(null)}
                title="Back to chats"
              >
                <BsArrowLeft />
              </button>
              {renderAvatar(selectedConversation?.name, getConversationAvatar(selectedConversation), 'chat-header-avatar')}
              <div className="chat-header-meta">
                <h3>{selectedConversation?.name}</h3>
                <span className="online-status">{formatPresence(participantStatus)}</span>
              </div>
              {e2eeReady && (
                <span className="e2ee-badge" title="End-to-end encrypted">
                  <BsShieldLock /> Encrypted
                </span>
              )}
              <div className="chat-header-actions">
                <button
                  className="leave-chat-btn"
                  title="Back to chat list"
                  onClick={() => setSelectedChat(null)}
                >
                  <BsArrowLeft /> Chats
                </button>
                <button
                  className="icon-btn"
                  title="Search in chat"
                  onClick={() => {
                    const next = !showHeaderSearch;
                    setShowHeaderSearch(next);
                    if (!next) setHeaderSearchTerm('');
                  }}
                >
                  <BsSearch />
                </button>

                <div className="header-menu-wrapper" ref={headerMenuRef}>
                  <button
                    className="icon-btn chat-menu-btn"
                    title="Menu"
                    onClick={() => setShowHeaderMenu((prev) => !prev)}
                  >
                    <BsThreeDotsVertical />
                  </button>
                  {showHeaderMenu && (
                    <div className="header-menu-dropdown">
                      <button onClick={() => deleteChat(selectedChat)}>
                        <BsTrash /> Delete chat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showHeaderSearch && (
              <div className="chat-inline-search">
                <BsSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search messages"
                  value={headerSearchTerm}
                  onChange={(e) => setHeaderSearchTerm(e.target.value)}
                />
                <span>{visibleMessages.length}</span>
                <button
                  className="icon-btn"
                  title="Close search"
                  onClick={() => {
                    setShowHeaderSearch(false);
                    setHeaderSearchTerm('');
                  }}
                >
                  <BsX />
                </button>
              </div>
            )}

            <div className="messages-container">
              {loadingMessages && (
                <div className="empty-state">
                  <p>Loading messages...</p>
                </div>
              )}
              {!loadingMessages && visibleMessages.length === 0 && (
                <div className="empty-state">
                  <p>{headerSearchTerm.trim() ? 'No matching messages' : '👋 Start the conversation!'}</p>
                </div>
              )}
              {messagesWithSeparators.map((entry) =>
                entry.type === 'date-separator' ? (
                  <div className="message-date-separator" key={entry.id}>
                    <span>{entry.label}</span>
                  </div>
                ) : (
                  <div
                    key={entry.id}
                    className={`message ${String(entry.data.senderUid || '') === String(currentUid) ? 'own-message' : 'other-message'}`}
                  >
                    <div className="message-bubble">
                      <p>{entry.data.text}</p>
                      <div className="message-meta-row">
                        <span className="message-time">{formatTime(entry.data.timestamp)}</span>
                        {String(entry.data.senderUid || '') === String(currentUid) && (
                          <span
                            className={`message-status ${getOwnMessageStatus(entry.data)}`}
                            title={getOwnMessageStatus(entry.data)}
                          >
                            {getOwnMessageStatus(entry.data) === 'sent' && <BsCheck2 />}
                            {getOwnMessageStatus(entry.data) === 'delivered' && <BsCheck2All />}
                            {getOwnMessageStatus(entry.data) === 'seen' && <BsCheck2All />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-area">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                rows="1"
                className="message-input"
              />
              <button className="send-btn" onClick={sendMessage} title="Send">
                <BsSend />
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <h2>{appName} Web</h2>
            <p>Pick a chat to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
