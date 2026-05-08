import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Auth from './components/Auth';
import App from './components/App';
import { getCurrentUser, getUserProfile } from './services/authService';
import { AppConfigProvider, useAppConfig } from './context/AppConfigContext';
import './styles/Auth.css';

function Main() {
  const { appName } = useAppConfig();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          const profile = await getUserProfile(currentUser.uid);
          if (profile && profile.isVerified) {
            setUser(currentUser.uid);
            setUserProfile(profile);
          } else {
            // User exists but not verified
            setUser(null);
            setUserProfile(null);
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = (uid, email, isVerified, displayName, avatarUrl = '') => {
    setUser(uid);
    setUserProfile({
      uid,
      email,
      displayName,
      avatarUrl,
      isVerified,
      createdAt: new Date().toISOString(),
    });
  };

  const handleLogout = () => {
    setUser(null);
    setUserProfile(null);
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          fontSize: '1.2em',
        }}
      >
        <div>Loading {appName}...</div>
      </div>
    );
  }

  return (
    <div>
      {!user ? <Auth onLogin={handleLogin} /> : <App user={user} userProfile={userProfile} onLogout={handleLogout} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppConfigProvider>
      <Main />
    </AppConfigProvider>
  </React.StrictMode>
);
