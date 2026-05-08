import React, { useState, useEffect } from 'react';
import { BsShieldCheck, BsArrowLeft } from 'react-icons/bs';
import { verifyOTP, resendOTP } from '../../services/authService';
import '../../styles/AuthForms.css';

const OTPVerification = ({ email, displayName, onVerificationSuccess, onBackToAuth }) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [canResend, setCanResend] = useState(false);

  // Timer for OTP expiration
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const otpCode = otp.join('');
      if (otpCode.length !== 6) {
        throw new Error('Please enter all 6 digits');
      }

      await verifyOTP(email, otpCode);
      onVerificationSuccess(email, displayName);
    } catch (err) {
      setError(err.message);
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setResendLoading(true);
    setError('');

    try {
      await resendOTP(email);
      setTimeLeft(600); // Reset timer
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form otp-form">
      <button
        type="button"
        onClick={onBackToAuth}
        className="back-button"
        disabled={loading || resendLoading}
      >
        <BsArrowLeft /> Back
      </button>

      <div className="otp-header">
        <BsShieldCheck className="otp-icon" />
        <h2>Verify Your Email 📧</h2>
        <p className="form-subtitle">
          We've sent a 6-digit code to <strong>{email}</strong>
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="otp-inputs">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            maxLength="1"
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={loading}
            className="otp-input"
            placeholder="0"
          />
        ))}
      </div>

      <div className="otp-timer">
        <span>Code expires in: {formatTime(timeLeft)}</span>
      </div>

      <button
        type="submit"
        disabled={loading || otp.join('').length !== 6}
        className="auth-button primary-button"
      >
        {loading ? 'Verifying...' : 'Verify Email'}
      </button>

      <div className="resend-section">
        <p>Didn't receive the code?</p>
        <button
          type="button"
          onClick={handleResendOTP}
          disabled={!canResend || resendLoading}
          className="resend-button"
        >
          {resendLoading ? 'Sending...' : canResend ? 'Resend Code' : 'Resend Code'}
        </button>
      </div>

      <div className="otp-info">
        <p>👆 Enter the 6-digit verification code sent to your email address</p>
      </div>
    </form>
  );
};

export default OTPVerification;
