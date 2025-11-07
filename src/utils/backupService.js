/**
 * Client-Side Backup Service (Free Tier Compatible)
 * Provides automated daily backups using Firebase Storage only
 * No Cloud Functions required - runs entirely from client-side
 */

import { db, storage } from '../firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, listAll, deleteObject, getDownloadURL } from 'firebase/storage';
import { logger } from './logger';

export class BackupService {
  static BACKUP_COLLECTIONS = [
    'invoices', 'clients', 'projects', 'quotations', 'proformas',
    'users', 'audit_logs', 'pdf_metadata', 'management_team'
  ];

  static ENCRYPTION_KEY = 'wallsandtrends_backup_key_2024';

  /**
   * Initialize daily backup scheduler
   * Call this once when the app starts (management team only)
   */
  static initializeDailyBackup() {
    // Check if user is management team
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!currentUser?.isManagement) return;

    // Set up daily backup check
    this.scheduleDailyBackup();

    // Check if backup is needed on app start
    this.checkAndRunBackup();
  }

  /**
   * Schedule daily backup check
   */
  static scheduleDailyBackup() {
    // Check every 4 hours if backup is needed
    setInterval(() => {
      this.checkAndRunBackup();
    }, 4 * 60 * 60 * 1000); // 4 hours

    // Also check on visibility change (tab becomes active)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkAndRunBackup();
      }
    });
  }

  /**
   * Check if daily backup is needed and run it
   */
  static async checkAndRunBackup() {
    try {
      const lastBackup = localStorage.getItem('lastBackupDate');
      const today = new Date().toISOString().split('T')[0];

      if (lastBackup !== today) {
        await this.performBackup();
        localStorage.setItem('lastBackupDate', today);
      }
    } catch (error) {
      logger.error('Daily backup failed', { error: error.message });
    }
  }

  /**
   * Perform the actual backup operation
   */
  static async performBackup() {
    const startTime = Date.now();
    const backupDate = new Date().toISOString().split('T')[0];

    try {

      // 1. Collect all data from collections
      const backupData = {
        metadata: {
          backupDate,
          timestamp: new Date(),
          version: '1.0',
          collections: this.BACKUP_COLLECTIONS,
          clientSide: true
        },
        data: {}
      };

      // 2. Export each collection
      for (const collectionName of this.BACKUP_COLLECTIONS) {

        try {
          const collectionRef = collection(db, collectionName);
          const snapshot = await getDocs(collectionRef);

          const documents = [];
          snapshot.forEach(doc => {
            documents.push({
              id: doc.id,
              data: doc.data()
            });
          });

          backupData.data[collectionName] = documents;

        } catch (error) {
          backupData.data[collectionName] = [];
        }
      }

      // 3. Encrypt backup data
      const encryptedData = this.encryptBackupData(JSON.stringify(backupData));

      // 4. Upload to Firebase Storage
      const backupFileName = `backups/daily/${backupDate}/backup-${Date.now()}.json.enc`;
      const storageRef = ref(storage, backupFileName);

      const blob = new Blob([encryptedData], { type: 'application/json' });
      await uploadBytes(storageRef, blob, {
        customMetadata: {
          backupDate,
          collections: this.BACKUP_COLLECTIONS.join(','),
          encrypted: 'true',
          version: '1.0',
          clientSide: 'true'
        }
      });

      // 5. Log backup completion
      await addDoc(collection(db, 'backup_logs'), {
        backupDate,
        fileName: backupFileName,
        collections: this.BACKUP_COLLECTIONS,
        totalCollections: this.BACKUP_COLLECTIONS.length,
        status: 'SUCCESS',
        fileSize: encryptedData.length,
        processingTimeMs: Date.now() - startTime,
        clientSide: true,
        timestamp: serverTimestamp()
      });

      // 6. Cleanup old backups
      await this.cleanupOldBackups();

      return { success: true, fileName: backupFileName };

    } catch (error) {

      // Log failure
      await addDoc(collection(db, 'backup_logs'), {
        backupDate,
        status: 'FAILED',
        error: error.message,
        processingTimeMs: Date.now() - startTime,
        clientSide: true,
        timestamp: serverTimestamp()
      });

      throw error;
    }
  }

  /**
   * Encrypt backup data using simple XOR (free tier compatible)
   */
  static encryptBackupData(data) {
    let encrypted = '';

    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      const keyChar = this.ENCRYPTION_KEY.charCodeAt(i % this.ENCRYPTION_KEY.length);
      encrypted += String.fromCharCode(charCode ^ keyChar);
    }

    // Add integrity check
    const checksum = data.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return checksum.toString() + '|' + btoa(encrypted);
  }

  /**
   * Decrypt backup data
   */
  static decryptBackupData(encryptedData) {
    const [checksumStr, base64Data] = encryptedData.split('|');
    const expectedChecksum = parseInt(checksumStr);

    const encrypted = atob(base64Data);
    const key = this.ENCRYPTION_KEY;
    let decrypted = '';

    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i);
      const keyChar = key.charCodeAt(i % key.length);
      decrypted += String.fromCharCode(charCode ^ keyChar);
    }

    // Verify integrity
    const actualChecksum = decrypted.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    if (actualChecksum !== expectedChecksum) {
      throw new Error('Backup integrity check failed');
    }

    return decrypted;
  }

  /**
   * Clean up old backups (keep last 7 days)
   */
  static async cleanupOldBackups() {
    try {
      const backupsRef = ref(storage, 'backups/daily/');
      const result = await listAll(backupsRef);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const filesToDelete = result.items.filter(item => {
        const fileName = item.name;
        const dateMatch = fileName.match(/(\d{4}-\d{2}-\d{2})\//);
        if (dateMatch) {
          const fileDate = new Date(dateMatch[1]);
          return fileDate < sevenDaysAgo;
        }
        return false;
      });

      if (filesToDelete.length > 0) {
        for (const file of filesToDelete) {
          await deleteObject(file);
        }
      }

    } catch (error) {
      // Silently handle cleanup errors
    }
  }

  /**
   * Manual backup trigger (for management team)
   */
  static async triggerManualBackup() {
    try {
      const result = await this.performBackup();
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get backup history
   */
  static async getBackupHistory(limit = 10) {
    try {
      const querySnapshot = await getDocs(
        collection(db, 'backup_logs')
      );

      const backups = [];
      querySnapshot.forEach(doc => {
        backups.push({ id: doc.id, ...doc.data() });
      });

      // Sort by timestamp descending and limit
      return backups
        .sort((a, b) => {
          const aTime = a.timestamp?.toDate?.() || new Date(a.timestamp);
          const bTime = b.timestamp?.toDate?.() || new Date(b.timestamp);
          return bTime - aTime;
        })
        .slice(0, limit);

    } catch (error) {
      return [];
    }
  }

  /**
   * Download and decrypt a backup file
   */
  static async downloadBackup(backupLogEntry) {
    try {
      const storageRef = ref(storage, backupLogEntry.fileName);
      const url = await getDownloadURL(storageRef);

      // Fetch the encrypted data
      const response = await fetch(url);
      const encryptedData = await response.text();

      // Decrypt the data
      const decryptedData = this.decryptBackupData(encryptedData);

      // Create download link
      const blob = new Blob([decryptedData], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `backup-${backupLogEntry.backupDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(downloadUrl);

      return { success: true };

    } catch (error) {
      throw error;
    }
  }
}

// Export for use in components
export default BackupService;