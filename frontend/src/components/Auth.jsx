import React, { useState } from 'react';
import LoginForm from './auth/LoginForm';
import SignupForm from './auth/SignupForm';
import OTPVerification from './auth/OTPVerification';
import { useAppConfig } from '../context/AppConfigContext';
import '../styles/Auth.css';

const Auth = ({ onLogin }) => {
  const { appName, appTagline } = useAppConfig();
  const [authStep, setAuthStep] = useState('login'); // 'login', 'signup', 'otp'
  const [tempUserData, setTempUserData] = useState({
    email: '',
    displayName: '',
    uid: '',
    avatarUrl: '',
  });

  const handleLoginSuccess = (uid, email, displayName, avatarUrl) => {
    // Login successful, pass to App
    onLogin(uid, email, true, displayName, avatarUrl); // true = user is verified
  };

  const handleLoginRequiresVerification = (user) => {
    setTempUserData({
      uid: user?.uid || '',
      email: user?.email || '',
      displayName: user?.displayName || '',
      avatarUrl: user?.avatarUrl || '',
    });
    setAuthStep('otp');
  };

  const handleSignupSuccess = (uid, email, displayName, avatarUrl) => {
    // User registered, now verify email
    setTempUserData({ uid, email, displayName, avatarUrl: avatarUrl || '' });
    setAuthStep('otp');
  };

  const handleOTPVerificationSuccess = (email, displayName) => {
    // OTP verified, pass to App
    onLogin(tempUserData.uid, email, true, displayName, tempUserData.avatarUrl || '');
  };

  const handleBackToAuth = () => {
    setAuthStep('login');
    setTempUserData({ email: '', displayName: '', uid: '' });
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1>📱 {appName}</h1>
        <p>{appTagline}</p>
      </div>

      <div className="auth-content">
        {authStep === 'login' && (
          <LoginForm
            onLoginSuccess={handleLoginSuccess}
            onRequireVerification={handleLoginRequiresVerification}
            onSwitchToSignup={() => setAuthStep('signup')}
          />
        )}

        {authStep === 'signup' && (
          <SignupForm
            onSignupSuccess={handleSignupSuccess}
            onSwitchToLogin={() => setAuthStep('login')}
          />
        )}

        {authStep === 'otp' && (
          <OTPVerification
            email={tempUserData.email}
            displayName={tempUserData.displayName}
            onVerificationSuccess={handleOTPVerificationSuccess}
            onBackToAuth={handleBackToAuth}
          />
        )}
      </div>

      <div className="auth-footer">
        <p>🔒 Your data is secure and encrypted</p>
      </div>
    </div>
  );
};

export default Auth;
