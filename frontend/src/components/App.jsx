import React from 'react';
import { logoutUser } from '../services/authService';
import ChatWindow from './ChatWindow';
import '../styles/App.css';

const App = ({ user, userProfile, onLogout }) => {
  const handleLogout = async () => {
    try {
      await logoutUser();
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      onLogout();
    }
  };

  return (
    <div className="app-container">
      <div className="main-content">
        <ChatWindow user={user} userProfile={userProfile} onLogout={handleLogout} />
      </div>
    </div>
  );
};

export default App;
