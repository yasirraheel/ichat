# 🚀 Quick Start Guide

## Installation & Running (Recommended Method)

### Option 1: Using Root Package (Easiest)

1. **Install all dependencies at once:**
```bash
cd "c:\Users\folio\Desktop\live chate"
npm install-all
```

2. **Run both frontend and backend:**
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:5000

### Option 2: Manual Setup

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Backend (in another terminal):**
```bash
cd backend
npm install
npm start
```

## 📱 First Time Usage

1. Open browser to `http://localhost:3000`
2. Enter your username
3. Click "Start Chat"
4. Use the chat and notes features!

## 🎯 Features to Try

### Chat
- Click **`+`** button to create new conversation
- Type a message and press **Enter** or click send button
- Messages appear instantly

### Notes
- Click **Notes** tab in sidebar
- Click **"New Note"** button
- Add title and content
- Notes save automatically to browser storage

## 🔑 Key Points

- **No Firebase Required**: App works with local storage by default
- **No Database Setup**: Chat and notes work locally
- **No Backend Auth**: Simple username entry for demo
- **Responsive**: Works on desktop and tablet

## ⚙️ Configuration

### To use Firebase (Optional):

1. Create Firebase project at https://console.firebase.google.com
2. Get your credentials
3. Update `frontend/.env` with your keys
4. The app will auto-sync with Firebase

### To customize colors:

Edit `frontend/src/styles/App.css` line 6-7:
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Port 3000 already in use | Change port in `frontend/vite.config.js` |
| Port 5000 already in use | Set `PORT=5001` in `backend/.env` |
| npm install fails | Delete `node_modules` and try again |
| Messages not saving | Check browser localStorage is enabled |

## 📝 Next Steps

1. Test the chat feature
2. Create and save notes
3. Explore the UI
4. Read FEATURES.md for what to build next

## 🎨 Customization Ideas

- [ ] Add user avatars
- [ ] Implement real-time notifications
- [ ] Add message search
- [ ] Add message reactions
- [ ] Dark mode toggle
- [ ] Message timestamps on hover
- [ ] User online status
- [ ] Message read receipts

---

**Questions?** Check README.md for more details!
