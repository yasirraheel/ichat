import React, { useState } from 'react';
import { BsEnvelope, BsLock, BsEyeFill, BsEyeSlashFill } from 'react-icons/bs';
import { loginUser, sendOTP } from '../../services/authService';
import '../../styles/AuthForms.css';

const LoginForm = ({ onLoginSuccess, onRequireVerification, onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate inputs
      if (!email.trim()) {
        throw new Error('Please enter your email');
      }
      if (!password.trim()) {
        throw new Error('Please enter your password');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Please enter a valid email');
      }

      const user = await loginUser(email, password);
      onLoginSuccess(user.uid, email, user.displayName, user.avatarUrl || '');
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        const pendingEmail = err.user?.email || email;
        try {
          await sendOTP(pendingEmail);
          if (onRequireVerification) {
            onRequireVerification(err.user || { email: pendingEmail });
          }
          return;
        } catch (otpError) {
          setError(otpError.message);
          return;
        }
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Welcome Back! 👋</h2>
      <p className="form-subtitle">Sign in with your email and password</p>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="login-email">Email Address</label>
        <div className="input-wrapper">
          <BsEnvelope className="input-icon" />
          <input
            id="login-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="auth-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="login-password">Password</label>
        <div className="input-wrapper">
          <BsLock className="input-icon" />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="auth-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="toggle-password"
            disabled={loading}
          >
            {showPassword ? <BsEyeSlashFill /> : <BsEyeFill />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="auth-button primary-button"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>

      <div className="form-divider">or</div>

      <button
        type="button"
        onClick={onSwitchToSignup}
        disabled={loading}
        className="auth-button secondary-button"
      >
        Create New Account
      </button>

      <p className="form-footer">
        <a href="#forgot">Forgot your password?</a>
      </p>
    </form>
  );
};

export default LoginForm;
