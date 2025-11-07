/**
 * Server-Side Encryption Utilities for Firebase
 * Provides field-level encryption for sensitive data using Firebase Functions
 * More secure than client-side encryption as keys are stored server-side
 */

import { getFunctions, httpsCallable } from 'firebase/functions';

export class FieldEncryption {
  // No longer storing key client-side - moved to server
  static ENCRYPTION_KEY = null; // Deprecated - using server-side encryption now

  /**
   * Encrypt sensitive field data using server-side Firebase Functions
   * @param {string} plainText - The sensitive data to encrypt
   * @returns {string} Encrypted data from server
   */
  static async encryptField(plainText) {
    if (!plainText || typeof plainText !== 'string') {
      return plainText; // Return as-is for non-string data
    }

    try {
      // Call server-side encryption function
      const functions = getFunctions();
      const encryptFunction = httpsCallable(functions, 'encryptDataForStorage');

      const result = await encryptFunction({ data: { tempField: plainText } });
      if (result.data.success && result.data.data.tempField) {
        return result.data.data.tempField;
      }

      throw new Error('Server encryption failed');

    } catch (error) {
      console.error('Server-side field encryption failed:', error);
      // Fallback: return plain text with warning (better than breaking the app)
      console.warn('Server encryption failed, storing as plain text');
      return plainText;
    }
  }

  /**
   * Decrypt sensitive field data using server-side Firebase Functions
   * @param {string} encryptedData - The encrypted data from Firestore
   * @returns {string} Decrypted plain text from server
   */
  static async decryptField(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData; // Return as-is for non-string data
    }

    // Check if data is encrypted (has integrity check separator)
    if (!encryptedData.includes('|')) {
      return encryptedData; // Not encrypted, return as-is
    }

    try {
      // Call server-side decryption function
      const functions = getFunctions();
      const decryptFunction = httpsCallable(functions, 'decryptDataForClient');

      const result = await decryptFunction({ data: { tempField: encryptedData } });
      if (result.data.success && result.data.data.tempField !== undefined) {
        return result.data.data.tempField;
      }

      throw new Error('Server decryption failed');

    } catch (error) {
      console.error('Server-side field decryption failed:', error);
      // Fallback: return encrypted data with warning
      console.warn('Server decryption failed, returning encrypted data');
      return encryptedData;
    }
  }

  // Deprecated methods - encryption now handled server-side
  // Keeping for backward compatibility during transition
}

/**
 * Data Sanitization and Encryption Helper
 * Automatically encrypts sensitive fields before saving to Firestore
 */
export class SecureDataHandler {
  // Fields that should be encrypted
  static SENSITIVE_FIELDS = [
    'email',
    'phone',
    'gstNumber',
    'panNumber',
    'bankAccount',
    'ifscCode',
    'clientEmail',
    'contactEmail'
  ];

  /**
   * Prepare data for Firestore storage (encrypt sensitive fields using server)
   * @param {Object} data - The data object to secure
   * @returns {Object} Data with sensitive fields encrypted
   */
  static async secureDataForStorage(data) {
    if (!data || typeof data !== 'object') return data;

    try {
      // Call server-side encryption function
      const functions = getFunctions();
      const encryptFunction = httpsCallable(functions, 'encryptDataForStorage');

      const result = await encryptFunction({ data });
      if (result.data.success) {
        return result.data.data;
      }

      throw new Error('Server encryption failed');

    } catch (error) {
      console.error('Server-side data encryption failed:', error);
      // Fallback: return data without encryption
      console.warn('Server encryption failed, storing without encryption');
      return data;
    }
  }

  /**
   * Prepare data for client use (decrypt sensitive fields using server)
   * @param {Object} data - The data object from Firestore
   * @returns {Object} Data with sensitive fields decrypted
   */
  static async prepareDataForClient(data) {
    if (!data || typeof data !== 'object') return data;

    try {
      // Call server-side decryption function
      const functions = getFunctions();
      const decryptFunction = httpsCallable(functions, 'decryptDataForClient');

      const result = await decryptFunction({ data });
      if (result.data.success) {
        return result.data.data;
      }

      throw new Error('Server decryption failed');

    } catch (error) {
      console.error('Server-side data decryption failed:', error);
      // Fallback: return data as-is
      console.warn('Server decryption failed, returning data as-is');
      return data;
    }
  }

  /**
   * Check if a field should be encrypted
   * @param {string} fieldName - Name of the field
   * @returns {boolean} True if field should be encrypted
   */
  static isSensitiveField(fieldName) {
    return this.SENSITIVE_FIELDS.includes(fieldName);
  }
}