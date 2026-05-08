import React, { useState } from 'react';
import { BsEnvelope, BsLock, BsPerson, BsEyeFill, BsEyeSlashFill } from 'react-icons/bs';
import { registerUser, sendOTP } from '../../services/authService';
import { useAppConfig } from '../../context/AppConfigContext';
import '../../styles/AuthForms.css';

const SignupForm = ({ onSignupSuccess, onSwitchToLogin }) => {
  const { appName } = useAppConfig();
  const [avatarPreview, setAvatarPreview] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your dp');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const validateInputs = () => {
    if (!displayName.trim()) {
      throw new Error('Please enter your name');
    }
    if (displayName.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    if (!email.trim()) {
      throw new Error('Please enter your email');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please enter a valid email');
    }
    if (!password.trim()) {
      throw new Error('Please enter a password');
    }
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }
    if (!agreedToTerms) {
      throw new Error('Please agree to the terms and conditions');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      validateInputs();

      // Register user
      const user = await registerUser(email, password, displayName, avatarPreview || null);

      // Send OTP
      await sendOTP(email);

      // Pass to OTP verification
      onSignupSuccess(user.uid, email, displayName, user.avatarUrl || avatarPreview || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h2>Create Account 🚀</h2>
      <p className="form-subtitle">Join {appName} for real-time messaging</p>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="signup-name">Full Name</label>
        <div className="input-wrapper">
          <BsPerson className="input-icon" />
          <input
            id="signup-name"
            type="text"
            placeholder="John Doe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            className="auth-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="signup-avatar">Profile Photo</label>
        <div className="input-wrapper">
          <input
            id="signup-avatar"
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            disabled={loading}
            className="auth-input"
          />
        </div>
        {avatarPreview && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={avatarPreview}
              alt="Profile preview"
              style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <small className="password-hint">This will be your dp when you sign up.</small>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="signup-email">Email Address</label>
        <div className="input-wrapper">
          <BsEnvelope className="input-icon" />
          <input
            id="signup-email"
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
        <label htmlFor="signup-password">Password</label>
        <div className="input-wrapper">
          <BsLock className="input-icon" />
          <input
            id="signup-password"
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
        <small className="password-hint">Minimum 6 characters</small>
      </div>

      <div className="form-group">
        <label htmlFor="confirm-password">Confirm Password</label>
        <div className="input-wrapper">
          <BsLock className="input-icon" />
          <input
            id="confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="auth-input"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="toggle-password"
            disabled={loading}
          >
            {showConfirmPassword ? <BsEyeSlashFill /> : <BsEyeFill />}
          </button>
        </div>
      </div>

      <div className="checkbox-group">
        <input
          type="checkbox"
          id="terms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          disabled={loading}
        />
        <label htmlFor="terms">
          I agree to the <a href="#terms">Terms and Conditions</a> and{' '}
          <a href="#privacy">Privacy Policy</a>
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="auth-button primary-button"
      >
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>

      <div className="form-divider">or</div>

      <button
        type="button"
        onClick={onSwitchToLogin}
        disabled={loading}
        className="auth-button secondary-button"
      >
        Sign In Instead
      </button>
    </form>
  );
};

export default SignupForm;
