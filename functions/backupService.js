// Firebase Functions - Daily Automated Backup Service (Free Tier Compatible)
// Uses Firebase Storage for backups, no external cloud storage required

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Admin SDK
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

/**
 * Daily Automated Backup Function
 * Runs at 2 AM IST daily, creates encrypted backup in Firebase Storage
 * Compatible with Firebase Free Tier (no external APIs)
 */
exports.dailyDatabaseBackup = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const startTime = Date.now();
    const backupDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    try {
      // 1. Collect all collections to backup
      const collections = [
        'invoices', 'clients', 'projects', 'quotations', 'proformas',
        'users', 'audit_logs', 'pdf_metadata'
      ];

      const backupData = {
        metadata: {
          backupDate,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          version: '1.0',
          collections: collections
        },
        data: {}
      };

      // 2. Export each collection
      for (const collectionName of collections) {
        const collectionRef = db.collection(collectionName);
        const snapshot = await collectionRef.get();

        if (!snapshot.empty) {
          const documents = [];
          snapshot.forEach(doc => {
            documents.push({
              id: doc.id,
              data: doc.data()
            });
          });

          backupData.data[collectionName] = documents;
        } else {
          backupData.data[collectionName] = [];
        }
      }

      // 3. Encrypt backup data (simple obfuscation for free tier)
      const encryptedData = encryptBackupData(JSON.stringify(backupData));

      // 4. Upload to Firebase Storage
      const bucket = storage.bucket();
      const backupFileName = `backups/daily/${backupDate}/backup-${Date.now()}.json.enc`;
      const file = bucket.file(backupFileName);

      await file.save(encryptedData, {
        metadata: {
          contentType: 'application/json',
          metadata: {
            backupDate,
            collections: collections.join(','),
            encrypted: 'true',
            version: '1.0'
          }
        }
      });

      // 5. Log backup completion
      await db.collection('backup_logs').add({
        backupDate,
        fileName: backupFileName,
        collections: collections,
        totalCollections: collections.length,
        status: 'SUCCESS',
        fileSize: encryptedData.length,
        processingTimeMs: Date.now() - startTime,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // 6. Note: Backups are kept indefinitely for compliance
      // No cleanup performed - all backups retained

      return null;

    } catch (error) {

      // Log failure
      await db.collection('backup_logs').add({
        backupDate,
        status: 'FAILED',
        error: error.message,
        processingTimeMs: Date.now() - startTime,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      throw error;
    }
  });

/**
 * Encrypt backup data using server-side encryption (consistent with field encryption)
 * Uses the same encryption key as field encryption for consistency
 */
function encryptBackupData(data) {
  // Use the same encryption key as field encryption for consistency
  const key = process.env.ENCRYPTION_KEY || 'wallsandtrends_field_encryption_v1_2024';

  // Use Node.js crypto for stronger encryption (same as field encryption)
  const crypto = require('crypto');

  // Generate a random IV for each encryption
  const iv = crypto.randomBytes(12);

  // Create cipher using AES-GCM (same as field encryption)
  const cipher = crypto.createCipher('aes-256-gcm', key);
  cipher.setIV(iv);

  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag for integrity
  const authTag = cipher.getAuthTag();

  // Combine IV + auth tag + encrypted data (same format as field encryption)
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);

  // Add integrity check (HMAC) - same as field encryption
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(combined);
  const integrityCheck = hmac.digest('hex').substring(0, 16); // First 16 hex chars

  // Final format: integrity_check|base64_data (same as field encryption)
  const base64Data = combined.toString('base64');
  return `${integrityCheck}|${base64Data}`;
}

/**
 * Decrypt backup data using server-side decryption (consistent with field decryption)
 */
function decryptBackupData(encryptedData) {
  // Use the same encryption key as field encryption for consistency
  const key = process.env.ENCRYPTION_KEY || 'wallsandtrends_field_encryption_v1_2024';

  // Use Node.js crypto for decryption (same as field decryption)
  const crypto = require('crypto');
  const [integrityCheck, base64Data] = encryptedData.split('|');

  // Convert base64 to buffer
  const combined = Buffer.from(base64Data, 'base64');

  // Extract components (same as field decryption)
  const iv = combined.slice(0, 12);
  const authTag = combined.slice(12, 28);
  const encrypted = combined.slice(28);

  // Verify integrity (same as field decryption)
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(Buffer.concat([iv, authTag, encrypted]));
  const expectedIntegrity = hmac.digest('hex').substring(0, 16);

  if (integrityCheck !== expectedIntegrity) {
    throw new Error('Backup data integrity check failed');
  }

  // Create decipher (same as field decryption)
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  decipher.setIV(iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Backup retention policy: Keep ALL backups indefinitely
 * No cleanup performed for compliance and audit purposes
 */
async function cleanupOldBackups(bucket, currentDate) {
  // Backups are retained indefinitely - no cleanup performed
  console.log('📦 Backup retention: All backups kept indefinitely for compliance');
}

/**
 * Manual backup trigger (for testing or immediate backup)
 */
exports.triggerManualBackup = functions.https.onCall(async (data, context) => {
  // Only management team can trigger backups
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  // Check if user is management team (via hashed UID lookup)
  const hashedUid = await hashUid(context.auth.uid);
  const managementDoc = await db.collection('management_team').doc(hashedUid).get();

  if (!managementDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Management team access required');
  }

  try {
    // Trigger the backup process
    const result = await performBackup();
    return { success: true, ...result };

  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Backup failed: ' + error.message);
  }
});

/**
 * Hash UID for secure lookups
 */
async function hashUid(uid) {
  const encoder = new TextEncoder();
  const data = encoder.encode(uid + 'wallsandtrends_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Perform the actual backup (shared function)
 */
async function performBackup() {
  const backupDate = new Date().toISOString().split('T')[0];
  const startTime = Date.now();

  const collections = [
    'invoices', 'clients', 'projects', 'quotations', 'proformas',
    'users', 'audit_logs', 'pdf_metadata'
  ];

  const backupData = {
    metadata: {
      backupDate,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      version: '1.0',
      collections: collections
    },
    data: {}
  };

  // Export collections
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    const documents = [];
    snapshot.forEach(doc => {
      documents.push({ id: doc.id, data: doc.data() });
    });
    backupData.data[collectionName] = documents;
  }

  // Encrypt and upload
  const encryptedData = encryptBackupData(JSON.stringify(backupData));
  const bucket = storage.bucket();
  const backupFileName = `backups/manual/${backupDate}/backup-${Date.now()}.json.enc`;

  await bucket.file(backupFileName).save(encryptedData, {
    metadata: {
      contentType: 'application/json',
      metadata: {
        backupDate,
        collections: collections.join(','),
        encrypted: 'true',
        version: '1.0',
        type: 'manual'
      }
    }
  });

  return {
    fileName: backupFileName,
    collections: collections.length,
    processingTimeMs: Date.now() - startTime
  };
}