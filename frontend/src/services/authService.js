import api from './api';
import {
  generateKeyPair,
  exportPublicKey,
  savePrivateKey,
  loadPrivateKey,
  deletePrivateKey,
} from './cryptoService';

const SESSION_KEY = 'chatnotes_session';
const USERS_KEY = 'chatnotes_users';

const readUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const saveSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const updateSessionUser = (user) => {
  const session = readSession();
  if (!session) return;
  saveSession({ ...session, user: { ...(session.user || {}), ...user } });
};

const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

// User registration with email and password
export const registerUser = async (email, password, displayName, avatarUrl = null) => {
  try {
    // Generate E2EE key pair before registering
    const keyPair = await generateKeyPair();
    const publicKeyB64 = await exportPublicKey(keyPair.publicKey);

    const { data } = await api.post('/api/auth/register', {
      email,
      password,
      displayName,
      avatarUrl,
      publicKey: publicKeyB64,
    });

    // Store private key locally (never sent to server)
    await savePrivateKey(data.user.uid, keyPair.privateKey);

    return data.user;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};

// User login with email and password
export const loginUser = async (email, password) => {
  try {
    const { data } = await api.post('/api/auth/login', { email, password });

    saveSession({ token: data.token, user: data.user });

    // Check if private key exists for this device; if not, generate new pair
    const existingKey = await loadPrivateKey(data.user.uid);
    if (!existingKey) {
      try {
        const keyPair = await generateKeyPair();
        const publicKeyB64 = await exportPublicKey(keyPair.publicKey);
        await savePrivateKey(data.user.uid, keyPair.privateKey);
        // Upload new public key to server
        await api.post(
          '/api/auth/upload-public-key',
          { publicKey: publicKeyB64 },
          { headers: { Authorization: `Bearer ${data.token}` } }
        );
      } catch (keyErr) {
        console.warn('E2EE key setup failed:', keyErr.message);
      }
    }

    return data.user;
  } catch (error) {
    const responseData = error.response?.data;
    const message = responseData?.message || error.message;
    const wrapped = new Error(message);
    if (responseData?.code) {
      wrapped.code = responseData.code;
    }
    if (responseData?.user) {
      wrapped.user = responseData.user;
    }
    throw wrapped;
  }
};

// Send password reset email
export const resetPassword = async (email) => {
  throw new Error('Password reset is not implemented yet');
};

// Sign out user
export const logoutUser = async (uid = null) => {
  clearSession();
  // Note: we intentionally keep the private key in IndexedDB on logout
  // so the user can still read old messages when they log back in on this device.
  return true;
};

// Get current user
export const getCurrentUser = async () => {
  const session = readSession();
  if (!session || !session.token) return null;
  
  try {
    const { data } = await api.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${session.token}` }
    });
    // Update local storage just in case
    saveSession({ token: session.token, user: data.user });
    return data.user;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      clearSession();
    }
    return null;
  }
};

// Get user profile
export const getUserProfile = async (uid) => {
  // If we need another user's profile we would typically hit an API endpoint like /api/users/:uid.
  // Since we only need our own user context for now, this just leverages the latest DB result
  const session = readSession();
  return session?.user || null;
};

export const updateMyAvatar = async (avatarUrl) => {
  try {
    const session = readSession();
    if (!session?.token) {
      throw new Error('You are not signed in');
    }

    const { data } = await api.put(
      '/api/auth/me/avatar',
      { avatarUrl },
      { headers: { Authorization: `Bearer ${session.token}` } }
    );

    if (data?.user) {
      updateSessionUser(data.user);
    }

    return data.user;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};

// Verify user email via OTP
export const sendOTP = async (email) => {
  try {
    const { data } = await api.post('/api/auth/send-otp', { email });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};

// Verify OTP
export const verifyOTP = async (email, otpCode) => {
  try {
    const { data } = await api.post('/api/auth/verify-otp', {
      email,
      code: otpCode,
    });

    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};

// Resend OTP
export const resendOTP = async (email) => {
  try {
    const { data } = await api.post('/api/auth/resend-otp', { email });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
};
