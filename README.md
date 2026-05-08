# 📱 iChat - WhatsApp-like Chat & Notes App

A modern, real-time chat and notes application with a clean WhatsApp-inspired UI. Built with React, Node.js, Express, and Firebase.

## ✨ Features

- **Real-time Chat** 💬
  - Create and manage conversations
  - Send and receive text messages instantly
  - User status indicators
  - Clean, intuitive chat interface

- **Notes Management** 📝
  - Create, edit, and delete notes
  - Notes persist in local storage
  - Grid view for better organization
  - Quick access to all your notes

- **WhatsApp-like UI** 🎨
  - Modern, clean design
  - Responsive layout
  - Smooth animations and transitions
  - Dark & light mode compatible

- **Real-time Synchronization** 🔄
  - WebSocket support via Socket.io
  - Live message delivery
  - Typing indicators (ready to implement)

## 📋 Project Structure

```
live chate/
├── frontend/                 # React + Vite app
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Auth.jsx
│   │   │   ├── App.jsx
│   │   │   ├── ChatWindow.jsx
│   │   │   └── NotesWindow.jsx
│   │   ├── styles/          # CSS files
│   │   ├── config/          # Firebase config
│   │   └── main.jsx         # Entry point
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── backend/                  # Node.js + Express server
│   ├── server.js            # Main server file
│   ├── routes/              # API routes
│   ├── config/              # Configuration files
│   ├── package.json
│   └── .env.example
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Firebase account (optional, for real-time DB features)

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your Firebase credentials (if using Firebase):
```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

5. Start development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:5000`

## 🎯 Usage

### Chat Features
1. **Start a Conversation**
   - Click the `+` button in the chat header
   - Enter a name for the conversation
   - Start messaging!

2. **Send Messages**
   - Type in the message box
   - Press Enter or click the send button
   - Messages appear instantly

### Notes Features
1. **Create a Note**
   - Click "New Note" button
   - Add a title and content
   - Click "Save Note"

2. **Edit a Note**
   - Click the edit icon on any note card
   - Modify the content
   - Click "Update Note"

3. **Delete a Note**
   - Click the trash icon on any note card
   - Note is removed instantly

## 🔧 API Endpoints

### Chat API
- `GET /api/conversations` - Get all conversations
- `POST /api/conversations` - Create new conversation
- `GET /api/conversations/:id` - Get specific conversation

### WebSocket Events
- `user_join` - User joins chat
- `send_message` - Send message
- `receive_message` - Receive message
- `typing` - User is typing
- `user_typing` - Someone is typing
- `user_left` - User disconnects

## 🎨 Customization

### Colors
Edit the CSS files to change colors:
- Primary gradient: `#667eea` to `#764ba2`
- Modify in `src/styles/Auth.css`, `App.css`, etc.

### Features to Add
- [ ] Real-time messaging with Firebase
- [ ] User authentication
- [ ] Group conversations
- [ ] File/image sharing
- [ ] Message search
- [ ] Message reactions/emojis
- [ ] Voice messages
- [ ] Video calls
- [ ] Dark mode toggle

## 🛠 Technologies Used

**Frontend:**
- React 18
- Vite
- Firebase
- Socket.io (client)
- React Icons

**Backend:**
- Node.js
- Express
- Socket.io
- Firebase Admin SDK
- CORS

## 📝 Environment Variables

### Frontend (.env)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_URL=http://localhost:5000
```

### Backend (.env)
```
PORT=5000
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
NODE_ENV=development
```

## 🐛 Troubleshooting

### Port already in use
- Frontend: Change port in `vite.config.js`
- Backend: Set `PORT` environment variable

### CORS errors
- Check backend CORS settings
- Ensure frontend URL matches in backend config

### Firebase connection issues
- Verify credentials in `.env`
- Check Firebase project settings
- Ensure Realtime Database is enabled

## 📦 Build for Production

### Frontend
```bash
cd frontend
npm run build
```

### Backend
```bash
cd backend
npm start
```

## 📄 License

MIT License - feel free to use this project!

## 👥 Contributing

Contributions are welcome! Feel free to:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📞 Support

For issues and questions, please create an issue in the repository.

---

**Made with ❤️ for better communication**
