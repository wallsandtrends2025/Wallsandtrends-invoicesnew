/**
 * Authentication Service - Core authentication logic
 * Handles user sign up, sign in, session management
 */

import { auth, db } from '../../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { logger } from '../logger';
import { SecureDataHandler } from '../encryption';

export const USER_ROLES = {
  GUEST: 0,
  USER: 1,
  EDITOR: 2,
  MANAGER: 3,
  ADMIN: 4,
  SUPER_ADMIN: 5
};

export const PERMISSIONS = {
  CREATE_INVOICE: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_INVOICE: [USER_ROLES.USER, USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_INVOICE: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_INVOICE: [USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  CREATE_CLIENT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_CLIENT: [USER_ROLES.USER, USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_CLIENT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_CLIENT: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  CREATE_PROJECT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_PROJECT: [USER_ROLES.USER, USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_PROJECT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_PROJECT: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  CREATE_USER: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_USER: [USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_USER: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_USER: [USER_ROLES.SUPER_ADMIN],
  SYSTEM_CONFIG: [USER_ROLES.SUPER_ADMIN],
  AUDIT_LOGS: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  BACKUP_RESTORE: [USER_ROLES.SUPER_ADMIN]
};

const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  PASSWORD_MIN_LENGTH: 12,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBERS: true,
  PASSWORD_REQUIRE_SYMBOLS: true,
  SESSION_TIMEOUT_HOURS: 8
};

export class UserProfile {
  constructor(data) {
    this.uid = data.uid;
    this.email = data.email;
    this.displayName = data.displayName;
    this.isActive = data.isActive ?? true;
    this.isEmailVerified = data.isEmailVerified ?? true;
    this.lastLoginAt = data.lastLoginAt?.toDate() || null;
    this.createdAt = data.createdAt?.toDate() || new Date();
    this.updatedAt = data.updatedAt?.toDate() || new Date();
    this.metadata = data.metadata || { securityLevel: 'low' };
  }
}

export class AuthState {
  constructor() {
    this.user = null;
    this.isAuthenticated = false;
    this.isLoading = true;
    this.error = null;
  }
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = new Set();
    this.sessionTimeoutId = null;
    this.initializeAuthStateListener();
    this.setupSessionManagement();
  }

  async signUp(email, password, displayName, isManagement = false) {
    try {
      this.validatePasswordStrength(password);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });

      const userProfile = {
        displayName,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { securityLevel: isManagement ? 'high' : 'low' }
      };

      const secureProfile = await SecureDataHandler.secureDataForStorage({
        ...userProfile,
        email
      });

      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        ...secureProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const profile = new UserProfile({
        uid: userCredential.user.uid,
        ...userProfile
      });

      logger.info('User signed up successfully', {
        userId: profile.uid,
        email: profile.email,
        isManagement: profile.isManagement
      });

      return profile;
    } catch (error) {
      logger.error('Sign up failed', { error: error.message, email });
      throw this.handleAuthError(error);
    }
  }

  async signIn(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      let userProfile = await this.getUserProfile(userCredential.user.uid);

      if (!userProfile) {
        logger.info('Creating user profile for new user', { uid: userCredential.user.uid, email });
        userProfile = await this.createUserProfileFromAuth(userCredential.user);
      }

      if (!userProfile.isActive) {
        throw new Error('Account is deactivated. Please contact administrator.');
      }

      await this.updateLastLogin(userCredential.user.uid);
      await this.resetLoginAttempts(email);

      this.currentUser = userProfile;
      this.startSessionTimeout();

      logger.info('User signed in successfully', {
        userId: userProfile.uid,
        email: userProfile.email,
        role: userProfile.role
      });

      return userProfile;
    } catch (error) {
      logger.error('Sign in failed', { error: error.message, email });
      throw this.handleAuthError(error);
    }
  }

  async signOut() {
    try {
      await signOut(auth);
      this.clearSession();
      logger.info('User signed out successfully');
    } catch (error) {
      logger.error('Sign out failed', { error: error.message });
      throw this.handleAuthError(error);
    }
  }

  async hasPermission(permission, context) {
    if (!this.currentUser) return false;
    return await this.checkServerSideManagementStatus();
  }

  async checkServerSideManagementStatus() {
    if (!this.currentUser) return false;

    try {
      const hashedUid = await this.hashUid(this.currentUser.uid);
      const userDoc = await getDoc(doc(db, 'management_team', hashedUid));
      return userDoc.exists();
    } catch (error) {
      logger.error('Failed to check management status', { error: error.message });
      return false;
    }
  }

  async hashUid(uid) {
    const encoder = new TextEncoder();
    const data = encoder.encode(uid + 'wallsandtrends_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async requirePermission(permission, context) {
    if (!(await this.hasPermission(permission, context))) {
      const error = new Error(`Insufficient permissions: ${permission}`);
      logger.warn('Permission denied', {
        userId: this.currentUser?.uid,
        permission,
        context
      });
      throw error;
    }
  }

  async getUserProfile(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));

      if (!userDoc.exists()) return null;

      const encryptedData = userDoc.data();
      const decryptedData = await SecureDataHandler.prepareDataForClient(encryptedData);

      return new UserProfile({
        uid,
        ...decryptedData
      });
    } catch (error) {
      logger.error('Failed to get user profile', { error: error.message, uid });
      return null;
    }
  }

  async createUserProfileFromAuth(firebaseUser) {
    try {
      const userProfile = {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        isManagement: false,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { securityLevel: 'low' }
      };

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userDocRef, {
        ...userProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const profile = new UserProfile({
        uid: firebaseUser.uid,
        ...userProfile
      });

      logger.info('User profile created automatically', {
        userId: profile.uid,
        email: profile.email,
        role: profile.role
      });

      return profile;
    } catch (error) {
      logger.error('Failed to create user profile from auth', { error: error.message, uid: firebaseUser.uid });
      throw error;
    }
  }

  validatePasswordStrength(password) {
    if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (SECURITY_CONFIG.PASSWORD_REQUIRE_SYMBOLS && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  async updateLastLogin(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      logger.warn('Failed to update last login', { error: error.message, uid });
    }
  }

  async resetLoginAttempts(email) {
    try {
      const attemptRef = doc(db, 'login_attempts', email);
      await setDoc(attemptRef, {
        attempts: 0,
        lastAttempt: serverTimestamp()
      });
    } catch (error) {
      logger.warn('Failed to reset login attempts', { error: error.message, email });
    }
  }

  initializeAuthStateListener() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await this.getUserProfile(firebaseUser.uid);
        this.currentUser = userProfile;
        this.notifyAuthStateListeners(new AuthState({
          user: userProfile,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        this.currentUser = null;
        this.clearSession();
        this.notifyAuthStateListeners(new AuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        }));
      }
    });
  }

  setupSessionManagement() {
    window.addEventListener('beforeunload', () => {
      this.clearSession();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentUser) {
        // Tab hidden
      } else if (!document.hidden && this.currentUser) {
        this.validateSession();
      }
    });
  }

  startSessionTimeout() {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
    }

    this.sessionTimeoutId = setTimeout(() => {
      logger.info('Session timeout - signing out user');
      this.signOut();
    }, SECURITY_CONFIG.SESSION_TIMEOUT_HOURS * 60 * 60 * 1000);
  }

  async validateSession() {
    if (!this.currentUser) return;

    try {
      const userProfile = await this.getUserProfile(this.currentUser.uid);
      if (!userProfile || !userProfile.isActive) {
        await this.signOut();
      }
    } catch (error) {
      logger.error('Session validation failed', { error: error.message });
      await this.signOut();
    }
  }

  clearSession() {
    this.currentUser = null;
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
  }

  onAuthStateChange(callback) {
    this.authStateListeners.add(callback);
    return () => {
      this.authStateListeners.delete(callback);
    };
  }

  notifyAuthStateListeners(state) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        logger.error('Auth state listener error', { error: error.message });
      }
    });
  }

  handleAuthError(error) {
    switch (error.code) {
      case 'auth/user-disabled':
        return new Error('This account has been disabled. Please contact support.');
      case 'auth/user-not-found':
        return new Error('No account found with this email address.');
      case 'auth/wrong-password':
        return new Error('Incorrect password.');
      case 'auth/email-already-in-use':
        return new Error('An account with this email already exists.');
      case 'auth/weak-password':
        return new Error('Password is too weak.');
      case 'auth/invalid-email':
        return new Error('Invalid email address.');
      case 'auth/operation-not-allowed':
        return new Error('This sign-in method is not enabled.');
      case 'auth/too-many-requests':
        return new Error('Too many failed attempts. Please try again later.');
      default:
        return new Error('Authentication failed. Please try again.');
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  async isManagement() {
    return await this.checkServerSideManagementStatus();
  }

  isAdmin() {
    return this.isManagement();
  }

  isSuperAdmin() {
    return this.isManagement();
  }
}

export const authService = new AuthService();

// React hooks
import React from 'react';

export function useAuth() {
  const [authState, setAuthState] = React.useState(new AuthState());

  React.useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(setAuthState);
    return unsubscribe;
  }, []);

  return {
    ...authState,
    signIn: authService.signIn.bind(authService),
    signOut: authService.signOut.bind(authService),
    hasPermission: (permission) => authService.hasPermission(permission),
    requirePermission: (permission) => authService.requirePermission(permission)
  };
}

export function withPermission(WrappedComponent, permission, fallback) {
  return function PermissionGuard(props) {
    const { hasPermission } = useAuth();

    if (!hasPermission(permission)) {
      if (fallback) {
        const FallbackComponent = fallback;
        return React.createElement(FallbackComponent);
      }
      return React.createElement('div', { className: 'text-red-600 p-4' }, 'Access denied. Insufficient permissions.');
    }

    return React.createElement(WrappedComponent, props);
  };
}

export function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return children;
}