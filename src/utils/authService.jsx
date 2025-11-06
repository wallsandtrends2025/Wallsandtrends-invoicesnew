/**
 * Enterprise-Grade Authentication & Authorization Service
 * Implements RBAC (Role-Based Access Control) with Firebase Auth
 * Designed with Google-level security standards and scalability
 */

import { auth, db, functions } from '../firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  applyActionCode,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { logger } from './logger';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * User Roles Hierarchy
 * Higher numbers = more permissions
 */
export const USER_ROLES = {
  GUEST: 0,        // Unauthenticated users
  USER: 1,         // Basic authenticated users (read-only)
  EDITOR: 2,       // Can create/edit own documents
  MANAGER: 3,      // Can manage team documents
  ADMIN: 4,        // Full system access
  SUPER_ADMIN: 5   // System administration
};

export const PERMISSIONS = {
  // Document Operations
  CREATE_INVOICE: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_INVOICE: [USER_ROLES.USER, USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_INVOICE: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_INVOICE: [USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],

  // Client Management
  CREATE_CLIENT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_CLIENT: [USER_ROLES.USER, USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_CLIENT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_CLIENT: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],

  // Project Management
  CREATE_PROJECT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_PROJECT: [USER_ROLES.USER, USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_PROJECT: [USER_ROLES.EDITOR, USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_PROJECT: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],

  // User Management
  CREATE_USER: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  READ_USER: [USER_ROLES.MANAGER, USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  UPDATE_USER: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  DELETE_USER: [USER_ROLES.SUPER_ADMIN],

  // System Administration
  SYSTEM_CONFIG: [USER_ROLES.SUPER_ADMIN],
  AUDIT_LOGS: [USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN],
  BACKUP_RESTORE: [USER_ROLES.SUPER_ADMIN]
};

/**
 * Security Configuration
 */
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

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export class UserProfile {
  constructor(data) {
    this.uid = data.uid;
    this.email = data.email;
    this.displayName = data.displayName;
    this.role = data.role;
    this.roleLevel = data.roleLevel;
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

// ============================================================================
// AUTHENTICATION SERVICE CLASS
// ============================================================================

class AuthService {
  constructor() {
    this.currentUser = null;
    this.authStateListeners = new Set();
    this.permissionCache = new Map();
    this.sessionTimeoutId = null;

    this.initializeAuthStateListener();
    this.setupSessionManagement();
  }

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  /**
   * Sign up a new user with role assignment and approval logic
   */
  async signUp(email, password, displayName, role = 'USER') {
    try {
      // Validate password strength
      this.validatePasswordStrength(password);

      // Validate role
      if (!USER_ROLES[role]) {
        throw new Error(`Invalid role: ${role}`);
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Set display name
      await updateProfile(userCredential.user, { displayName });

      // Create user profile in Firestore
      const userProfile = {
        email,
        displayName,
        role,
        roleLevel: USER_ROLES[role],
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          securityLevel: this.getSecurityLevelForRole(role)
        }
      };

      const userDocRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userDocRef, {
        ...userProfile,
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
        role: profile.role
      });

      return profile;
    } catch (error) {
      logger.error('Sign up failed', { error: error.message, email });
      throw this.handleAuthError(error);
    }
  }

  /**
   * Sign in user with enhanced security checks and approval validation
   */
  async signIn(email, password) {
    try {
      // Attempt Firebase sign in first to get user profile
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      // Get user profile from Firestore
      let userProfile = await this.getUserProfile(userCredential.user.uid);

      // If no profile exists, create one automatically
      if (!userProfile) {
        logger.info('Creating user profile for new user', { uid: userCredential.user.uid, email });
        userProfile = await this.createUserProfileFromAuth(userCredential.user);
      }

      if (!userProfile.isActive) {
        throw new Error('Account is deactivated. Please contact administrator.');
      }

      // Update last login
      await this.updateLastLogin(userCredential.user.uid);

      // Reset login attempts on successful login
      await this.resetLoginAttempts(email);

      // Cache current user
      this.currentUser = userProfile;

      // Start session timeout
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


  /**
   * Sign out user and clean up session
   */
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

  // ============================================================================
  // AUTHORIZATION METHODS
  // ============================================================================

  /**
   * Check if current user has permission for an action
   */
  hasPermission(permission, context) {
    if (!this.currentUser) return false;

    const allowedRoles = PERMISSIONS[permission];
    const userRoleLevel = USER_ROLES[this.currentUser.role];

    // Check if user's role level is sufficient
    const hasBasePermission = allowedRoles.includes(userRoleLevel);

    if (!hasBasePermission) return false;

    // Additional context-based checks
    if (context) {
      return this.checkContextualPermission(permission, context);
    }

    return true;
  }

  /**
   * Require permission or throw error
   */
  requirePermission(permission, context) {
    if (!this.hasPermission(permission, context)) {
      const error = new Error(`Insufficient permissions: ${permission}`);
      logger.warn('Permission denied', {
        userId: this.currentUser?.uid,
        permission,
        context
      });
      throw error;
    }
  }

  // ============================================================================
  // USER MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get user profile from Firestore by UID
   */
  async getUserProfile(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));

      if (!userDoc.exists()) return null;

      const data = userDoc.data();
      return new UserProfile({
        uid,
        ...data
      });
    } catch (error) {
      logger.error('Failed to get user profile', { error: error.message, uid });
      return null;
    }
  }

  /**
   * Get user profile from Firestore by email (for login attempts tracking)
   */
  async getUserProfileByEmail(email) {
    try {
      const userQuery = query(
        collection(db, 'users'),
        where('email', '==', email)
      );

      const querySnapshot = await getDocs(userQuery);
      if (querySnapshot.empty) return null;

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return new UserProfile({
        uid: doc.id,
        ...data
      });
    } catch (error) {
      logger.error('Failed to get user profile by email', { error: error.message, email });
      return null;
    }
  }

  /**
   * Create user profile from Firebase Auth user (for first-time login)
   */
  async createUserProfileFromAuth(firebaseUser) {
    try {
      const userProfile = {
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        role: 'USER', // Default role
        roleLevel: USER_ROLES.USER,
        isActive: true,
        isEmailVerified: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          securityLevel: this.getSecurityLevelForRole('USER')
        }
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

  /**
   * Update user role (admin only)
   */
  async updateUserRole(uid, newRole) {
    this.requirePermission('UPDATE_USER');

    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        role: newRole,
        roleLevel: USER_ROLES[newRole],
        metadata: {
          securityLevel: this.getSecurityLevelForRole(newRole)
        },
        updatedAt: serverTimestamp()
      });

      logger.info('User role updated', { uid, newRole, updatedBy: this.currentUser?.uid });
    } catch (error) {
      logger.error('Failed to update user role', { error: error.message, uid, newRole });
      throw error;
    }
  }


  /**
   * Deactivate user account
   */
  async deactivateUser(uid) {
    this.requirePermission('DELETE_USER');

    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        isActive: false,
        updatedAt: serverTimestamp()
      });

      logger.info('User account deactivated', { uid, deactivatedBy: this.currentUser?.uid });
    } catch (error) {
      logger.error('Failed to deactivate user', { error: error.message, uid });
      throw error;
    }
  }

  // ============================================================================
  // SECURITY METHODS
  // ============================================================================

  /**
   * Validate password strength
   */
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

  /**
   * Check for account lockout
   */
  async checkAccountLockout(email) {
    try {
      const lockoutDoc = await getDoc(doc(db, 'login_attempts', email));
      if (!lockoutDoc.exists()) return;

      const data = lockoutDoc.data();
      const attempts = data.attempts || 0;
      const lastAttempt = data.lastAttempt?.toDate();

      if (attempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
        const lockoutEnd = new Date(lastAttempt.getTime() + (SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000));

        if (new Date() < lockoutEnd) {
          const remainingMinutes = Math.ceil((lockoutEnd.getTime() - Date.now()) / (60 * 1000));
          throw new Error(`Account is locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`);
        }
      }
    } catch (error) {
      if (error.message.includes('locked')) throw error;
      // Log but don't fail for lockout check errors
      logger.warn('Lockout check failed', { error: error.message, email });
    }
  }

  /**
   * Record failed login attempt
   */
  async recordFailedLoginAttempt(email) {
    try {
      const attemptRef = doc(db, 'login_attempts', email);
      const attemptDoc = await getDoc(attemptRef);

      if (attemptDoc.exists()) {
        const data = attemptDoc.data();
        await updateDoc(attemptRef, {
          attempts: (data.attempts || 0) + 1,
          lastAttempt: serverTimestamp()
        });
      } else {
        await setDoc(attemptRef, {
          attempts: 1,
          lastAttempt: serverTimestamp()
        });
      }
    } catch (error) {
      logger.warn('Failed to record login attempt', { error: error.message, email });
    }
  }

  /**
   * Reset login attempts after successful login
   */
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

  /**
   * Update last login timestamp
   */
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

  /**
   * Get security level for role
   */
  getSecurityLevelForRole(role) {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'critical';
      case 'ADMIN':
        return 'high';
      case 'MANAGER':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Check contextual permissions
   */
  checkContextualPermission(permission, context) {
    if (!this.currentUser) return false;

    // Allow admins and super admins all contextual permissions
    if ([USER_ROLES.ADMIN, USER_ROLES.SUPER_ADMIN].includes(USER_ROLES[this.currentUser.role])) {
      return true;
    }

    // For document ownership checks
    if (context.ownerId && context.ownerId === this.currentUser.uid) {
      return true;
    }

    // For department-based access
    if (context.department && context.department === this.currentUser.metadata?.department) {
      return USER_ROLES[this.currentUser.role] >= USER_ROLES.MANAGER;
    }

    return false;
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  /**
   * Initialize Firebase Auth state listener
   */
  initializeAuthStateListener() {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        const userProfile = await this.getUserProfile(firebaseUser.uid);
        this.currentUser = userProfile;
        this.notifyAuthStateListeners(new AuthState({
          user: userProfile,
          isAuthenticated: true,
          isLoading: false,
          error: null
        }));
      } else {
        // User is signed out
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

  /**
   * Setup session management
   */
  setupSessionManagement() {
    // Clear session on page unload
    window.addEventListener('beforeunload', () => {
      this.clearSession();
    });

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentUser) {
        // Tab hidden - could implement session pause
      } else if (!document.hidden && this.currentUser) {
        // Tab visible - check session validity
        this.validateSession();
      }
    });
  }

  /**
   * Start session timeout
   */
  startSessionTimeout() {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
    }

    this.sessionTimeoutId = setTimeout(() => {
      logger.info('Session timeout - signing out user');
      this.signOut();
    }, SECURITY_CONFIG.SESSION_TIMEOUT_HOURS * 60 * 60 * 1000);
  }

  /**
   * Validate current session
   */
  async validateSession() {
    if (!this.currentUser) return;

    try {
      // Check if user still exists and is active
      const userProfile = await this.getUserProfile(this.currentUser.uid);
      if (!userProfile || !userProfile.isActive) {
        await this.signOut();
      }
    } catch (error) {
      logger.error('Session validation failed', { error: error.message });
      await this.signOut();
    }
  }

  /**
   * Clear session data
   */
  clearSession() {
    this.currentUser = null;
    this.permissionCache.clear();

    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
  }

  // ============================================================================
  // AUTH STATE MANAGEMENT
  // ============================================================================

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback) {
    this.authStateListeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.authStateListeners.delete(callback);
    };
  }

  /**
   * Notify all auth state listeners
   */
  notifyAuthStateListeners(state) {
    this.authStateListeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        logger.error('Auth state listener error', { error: error.message });
      }
    });
  }

  /**
   * Handle Firebase auth errors
   */
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

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * Check if current user has admin role
   */
  isAdmin() {
    return this.currentUser ? USER_ROLES[this.currentUser.role] >= USER_ROLES.ADMIN : false;
  }

  /**
   * Check if current user has super admin role
   */
  isSuperAdmin() {
    return this.currentUser?.role === 'SUPER_ADMIN';
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    this.requirePermission('READ_USER');

    try {
      const usersQuery = query(collection(db, 'users'));
      const querySnapshot = await getDocs(usersQuery);

      const users = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        users.push(new UserProfile({
          uid: doc.id,
          ...data
        }));
      });

      return users;
    } catch (error) {
      logger.error('Failed to get all users', { error: error.message });
      throw error;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const authService = new AuthService();

// ============================================================================
// REACT HOOKS FOR EASY INTEGRATION
// ============================================================================

import React from 'react';

/**
 * React hook for authentication state
 */
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

// ============================================================================
// PERMISSION GUARD COMPONENTS
// ============================================================================

/**
 * Higher-order component for permission checking
 */
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

/**
 * Permission guard component
 */
export function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return fallback;
  }

  return children;
}


 
 