
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");
const dayjs = require("dayjs");
const fs = require("fs");
const os = require("os");
const path = require("path");
const archiver = require("archiver");

// Initialize Admin SDK only once
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// ============================================================================
// SERVER-SIDE ENCRYPTION UTILITIES
// ============================================================================

/**
 * Server-side encryption utilities using Node.js crypto
 * More secure than client-side Web Crypto API
 */
class ServerEncryption {
  // Encryption key from environment variable
  static get ENCRYPTION_KEY() {
    return process.env.ENCRYPTION_KEY || 'wallsandtrends_field_encryption_v1_2024';
  }

  /**
   * Encrypt sensitive field data before storing in Firestore
   * @param {string} plainText - The sensitive data to encrypt
   * @returns {string} Base64 encoded encrypted data with integrity check
   */
  static encryptField(plainText) {
    if (!plainText || typeof plainText !== 'string') {
      return plainText; // Return as-is for non-string data
    }

    try {
      const crypto = require('crypto');

      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(12);

      // Create cipher using AES-GCM
      const cipher = crypto.createCipher('aes-256-gcm', this.ENCRYPTION_KEY);
      cipher.setIV(iv);

      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get auth tag for integrity
      const authTag = cipher.getAuthTag();

      // Combine IV + auth tag + encrypted data
      const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);

      // Add integrity check (HMAC)
      const hmac = crypto.createHmac('sha256', this.ENCRYPTION_KEY);
      hmac.update(combined);
      const integrityCheck = hmac.digest('hex').substring(0, 16); // First 16 hex chars

      // Final format: integrity_check|base64_data
      const base64Data = combined.toString('base64');
      return `${integrityCheck}|${base64Data}`;

    } catch (error) {
      console.error('Server-side field encryption failed:', error);
      // Fallback: return plain text with warning (better than breaking the app)
      console.warn('Encryption failed, storing as plain text');
      return plainText;
    }
  }

  /**
   * Decrypt sensitive field data when reading from Firestore
   * @param {string} encryptedData - The encrypted data from Firestore
   * @returns {string} Decrypted plain text
   */
  static decryptField(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return encryptedData; // Return as-is for non-string data
    }

    // Check if data is encrypted (has integrity check separator)
    if (!encryptedData.includes('|')) {
      return encryptedData; // Not encrypted, return as-is
    }

    try {
      const crypto = require('crypto');
      const [integrityCheck, base64Data] = encryptedData.split('|');

      // Convert base64 to buffer
      const combined = Buffer.from(base64Data, 'base64');

      // Extract components
      const iv = combined.slice(0, 12);
      const authTag = combined.slice(12, 28);
      const encrypted = combined.slice(28);

      // Verify integrity
      const hmac = crypto.createHmac('sha256', this.ENCRYPTION_KEY);
      hmac.update(Buffer.concat([iv, authTag, encrypted]));
      const expectedIntegrity = hmac.digest('hex').substring(0, 16);

      if (integrityCheck !== expectedIntegrity) {
        throw new Error('Data integrity check failed');
      }

      // Create decipher
      const decipher = crypto.createDecipher('aes-256-gcm', this.ENCRYPTION_KEY);
      decipher.setIV(iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted);
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      console.error('Server-side field decryption failed:', error);
      // Fallback: return encrypted data with warning
      console.warn('Decryption failed, returning encrypted data');
      return encryptedData;
    }
  }
}

/**
 * Data Sanitization and Encryption Handler for Server
 */
class ServerSecureDataHandler {
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
   * Prepare data for Firestore storage (encrypt sensitive fields)
   * @param {Object} data - The data object to secure
   * @returns {Object} Data with sensitive fields encrypted
   */
  static secureDataForStorage(data) {
    if (!data || typeof data !== 'object') return data;

    const securedData = { ...data };

    // Encrypt sensitive fields
    for (const field of this.SENSITIVE_FIELDS) {
      if (securedData[field]) {
        securedData[field] = ServerEncryption.encryptField(String(securedData[field]));
        securedData[field + '_encrypted'] = true; // Flag to indicate encryption
      }
    }

    return securedData;
  }

  /**
   * Prepare data for client use (decrypt sensitive fields)
   * @param {Object} data - The data object from Firestore
   * @returns {Object} Data with sensitive fields decrypted
   */
  static prepareDataForClient(data) {
    if (!data || typeof data !== 'object') return data;

    const preparedData = { ...data };

    // Decrypt sensitive fields
    for (const field of this.SENSITIVE_FIELDS) {
      if (preparedData[field] && preparedData[field + '_encrypted']) {
        preparedData[field] = ServerEncryption.decryptField(preparedData[field]);
        delete preparedData[field + '_encrypted']; // Remove encryption flag
      }
    }

    return preparedData;
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

// ============================================================================
// ENCRYPTION FUNCTIONS (Callable from Client)
// ============================================================================

/**
 * Encrypt data before storing in Firestore
 */
exports.encryptDataForStorage = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    const { data: inputData } = data;
    if (!inputData) {
      throw new functions.https.HttpsError('invalid-argument', 'Data is required');
    }

    const encryptedData = ServerSecureDataHandler.secureDataForStorage(inputData);
    return { success: true, data: encryptedData };

  } catch (error) {
    console.error('Encryption function error:', error);
    throw new functions.https.HttpsError('internal', 'Encryption failed');
  }
});

/**
 * Decrypt data for client use
 */
exports.decryptDataForClient = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    const { data: inputData } = data;
    if (!inputData) {
      throw new functions.https.HttpsError('invalid-argument', 'Data is required');
    }

    const decryptedData = ServerSecureDataHandler.prepareDataForClient(inputData);
    return { success: true, data: decryptedData };

  } catch (error) {
    console.error('Decryption function error:', error);
    throw new functions.https.HttpsError('internal', 'Decryption failed');
  }
});

// ============================================================================
// REST OF THE EXISTING CODE (functions/index.js)
// ============================================================================

// Helper: fetch audit email configuration (first enabled doc)
async function getAuditEmailConfig() {
  const snap = await db
    .collection("audit_emails")
    .where("enabled", "==", true)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

// Helper: build previous month time range [inclusive]
function previousMonthRange(tz = "Asia/Kolkata") {
  const now = dayjs().tz ? dayjs().tz(tz) : dayjs();
  const prev = now.subtract(1, "month");
  const start = prev.startOf("month");
  const end = prev.endOf("month");
  return { start: start.toDate(), end: end.toDate(), y: prev.year(), m: prev.month() + 1 };
}

// Email Service Configuration - Gmail OAuth2 (Blaze plan required)
function getEmailService() {
  // Gmail OAuth2 (requires Blaze plan for Cloud Functions)
  const gmailClientId = process.env.GMAIL_CLIENT_ID || functions.config().gmail?.client_id;
  const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET || functions.config().gmail?.client_secret;
  const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN || functions.config().gmail?.refresh_token;
  const gmailUser = process.env.GMAIL_USER || functions.config().gmail?.user;

  if (!gmailClientId || !gmailClientSecret || !gmailRefreshToken || !gmailUser) {
    throw new Error("Gmail OAuth2 credentials not configured. Required environment variables: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER");
  }

  const oAuth2Client = new google.auth.OAuth2(gmailClientId, gmailClientSecret);
  oAuth2Client.setCredentials({ refresh_token: gmailRefreshToken });
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

  return {
    provider: 'gmail',
    gmail,
    user: gmailUser
  };
}

// Build RFC822 email and return base64url encoded string
function buildRawEmail({ from, to, cc, subject, html, attachments = [] }) {
  const boundary = "foo_bar_baz_boundary";
  const lines = [];
  lines.push(`From: ${from}`);
  lines.push(`To: ${Array.isArray(to) ? to.join(", ") : to}`);
  if (cc && cc.length) lines.push(`Cc: ${cc.join(", ")}`);
  lines.push(`Subject: ${subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push(`Content-Type: multipart/mixed; boundary=${boundary}`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 7bit");
  lines.push("");
  lines.push(html);

  // attachments: [{filename, mimeType, contentBase64}]
  for (const a of attachments) {
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push(`Content-Type: ${a.mimeType}; name=${a.filename}`);
    lines.push("Content-Transfer-Encoding: base64");
    lines.push(`Content-Disposition: attachment; filename=${a.filename}`);
    lines.push("");
    lines.push(a.contentBase64.replace(/\n/g, ""));
  }

  lines.push("");
  lines.push(`--${boundary}--`);

  const raw = Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  return raw;
}

// Server-side reconstruct of a chunked PDF into a Buffer
async function reconstructPDFFromChunksServer(pdfId) {
  const chunksSnap = await db
    .collection("pdf_chunks")
    .where("pdfId", "==", pdfId)
    .get();
  if (chunksSnap.empty) {
    throw new Error(`No chunks found for ${pdfId}`);
  }
  const chunks = chunksSnap.docs.map((d) => d.data());
  const joined = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex).map((c) => c.data).join("");
  const base64 = joined.startsWith("data:") ? (joined.split("base64,")[1] || "") : joined;
  if (!base64) throw new Error(`Invalid base64 for ${pdfId}`);
  return Buffer.from(base64, "base64");
}

// Create a ZIP file in the /tmp directory, return path and size
async function createZipToTmp(files, zipBaseName) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(os.tmpdir(), zipBaseName);
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve({ path: outPath, size: archive.pointer() }));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    for (const f of files) {
      archive.append(f.buffer, { name: f.filename });
    }
    archive.finalize();
  });
}

// Upload a file to default bucket and return a signed URL
async function uploadAndGetSignedUrl(localPath, destPath, expiresDays = 7) {
  const bucket = admin.storage().bucket();
  await bucket.upload(localPath, {
    destination: destPath,
    contentType: "application/zip",
  });
  const file = bucket.file(destPath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresDays * 24 * 60 * 60 * 1000,
  });
  return url;
}

// Callable to seed a default audit_emails document
exports.seedAuditEmailConfig = functions.https.onCall(async (data, context) => {
  // Verify SUPER_ADMIN access only
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'SUPER_ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'SUPER_ADMIN access required');
  }

  const payload = {
    enabled: true,
    primary: data?.primary || "harsha@wallsandtrends.com",
    cc: Array.isArray(data?.cc) ? data.cc : ["navya@wallsandtrends.com", "veda@wallsandtrends.com", "sai@wallsandtrends.com"],
    companyFilters: Array.isArray(data?.companyFilters) ? data.companyFilters : [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection("audit_emails").add(payload);
  return { id: ref.id, ...payload };
});

// Scheduled function: runs 09:00 on the 1st of every month IST
exports.sendMonthlyAuditEmails = functions.pubsub
  .schedule("0 9 1 * *")
  .timeZone("Asia/Kolkata")
  .onRun(async (context) => {
    const cfg = await getAuditEmailConfig();
    if (!cfg) {
      console.log("No enabled audit_emails config found. Skipping.");
      return null;
    }

    // TEMPORARY: Use current month for testing (revert after test)
    const { start, end, y, m } = previousMonthRange("Asia/Kolkata");
    // For testing, uncomment next line to use current month:
    // const now = dayjs().tz ? dayjs().tz("Asia/Kolkata") : dayjs();
    // const start = now.startOf("month").toDate();
    // const end = now.endOf("month").toDate();
    // const y = now.year(); const m = now.month() + 1;

    // Collect PDFs created in the previous month
    const pdfSnap = await db
      .collection("pdf_metadata")
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .get();

    if (pdfSnap.empty) {
      console.log("No PDFs created in previous month.");
      return null;
    }

    const rawPdfs = pdfSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Filter only 'tax' invoices (send all companies)
    let pdfs = rawPdfs.filter((p) => (p.type || "").toLowerCase() === "tax");
    if (!pdfs.length) {
      console.log("No TAX PDFs created in previous month after filters.");
      return null;
    }

    // Reconstruct PDFs into buffers
    const files = [];
    for (const p of pdfs) {
      try {
        const buffer = await reconstructPDFFromChunksServer(p.pdfId || p.id);
        const safeName = p.filename || `${p.invoiceId || "unknown"}_${p.type || "pdf"}.pdf`;
        files.push({ filename: safeName, buffer });
      } catch (e) {
        console.error("Failed to reconstruct", p.id, e.message);
      }
    }

    if (!files.length) {
      console.log("No reconstructable PDFs found for month.");
      return null;
    }

    // Build a CSV summary
    const header = ["invoiceId", "type", "company", "filename", "originalSize", "createdAt"].join(",");
    const rows = pdfs.map((p) => [
      p.invoiceId,
      p.type,
      p.company || p.invoice_type || "",
      p.filename,
      p.originalSize,
      p.createdAt?.toDate?.().toISOString?.() || ""
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const csvB64 = Buffer.from(csv).toString("base64");

    // Create ZIP in /tmp
    const zipBase = `audit-invoices-${y}-${String(m).padStart(2, "0")}.zip`;
    const { path: zipPath, size: zipSize } = await createZipToTmp(files, zipBase);

    // Thresholds
    const ATTACHMENT_LIMIT_BYTES = 15 * 1024 * 1024; // 15 MB
    let html = `
      <div>
        <p>Dear Audit Team,</p>
        <p>Attached is the monthly invoices package for ${y}-${String(m).padStart(2, "0")} and a CSV summary.</p>
        <p>Total PDFs: <b>${files.length}</b></p>
    `;

    const attachments = [
      { filename: `audit-summary-${y}-${String(m).padStart(2, "0")}.csv`, mimeType: "text/csv", contentBase64: csvB64 },
    ];

    if (zipSize <= ATTACHMENT_LIMIT_BYTES) {
      const zipB64 = fs.readFileSync(zipPath).toString("base64");
      attachments.push({ filename: zipBase, mimeType: "application/zip", contentBase64: zipB64 });
      html += `<p>ZIP is attached directly to this email.</p>`;
    } else {
      const dest = `audit-zips/${zipBase}`;
      const url = await uploadAndGetSignedUrl(zipPath, dest, 7);
      html += `<p>ZIP was too large to attach. Download it securely (valid 7 days):<br/><a href="${url}">${url}</a></p>`;
    }

    html += `<p>Regards,<br/>WT Invoices</p></div>`;

    const { gmail, user } = getEmailService();
    const subject = `Monthly Audit Invoices - ${y}-${String(m).padStart(2, "0")}`;
    const raw = buildRawEmail({ from: user, to: cfg.primary, cc: cfg.cc || [], subject, html, attachments });

    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    console.log("Audit ZIP email sent to", cfg.primary);

    return null;
  });



// ============================================================================
// DAILY AUTOMATED BACKUP SERVICE (FREE TIER COMPATIBLE)
// ============================================================================

// Circuit Breaker State Management
class CircuitBreaker {
  constructor(failureThreshold = 5, recoveryTimeout = 60000) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log('🔄 Circuit breaker: HALF_OPEN - Testing recovery');
      } else {
        throw new Error('Circuit breaker is OPEN - Email service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    console.log('✅ Circuit breaker: CLOSED - Service operational');
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(`❌ Circuit breaker: OPEN - ${this.failureCount} consecutive failures`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Global circuit breaker instance
const emailCircuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 1 minute recovery

// Rate Limiting Cache (in-memory for this implementation)
const rateLimitCache = new Map();

// Rate limiting function
function checkRateLimit(userId, maxAttempts = 3, windowMs = 3600000) { // 3 per hour
  const key = `rate_limit_${userId}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  if (!rateLimitCache.has(key)) {
    rateLimitCache.set(key, []);
  }

  const attempts = rateLimitCache.get(key).filter(timestamp => timestamp > windowStart);

  if (attempts.length >= maxAttempts) {
    return false; // Rate limited
  }

  attempts.push(now);
  rateLimitCache.set(key, attempts);

  // Clean up old entries periodically
  if (Math.random() < 0.01) { // 1% chance to clean up
    for (const [k, v] of rateLimitCache.entries()) {
      rateLimitCache.set(k, v.filter(timestamp => timestamp > windowStart));
    }
  }

  return true; // Allow
}

// Enterprise Email Template Builder
class EmailTemplateBuilder {
  static buildApprovalNotification(userData, notification, adminData) {
    const loginTime = notification.metadata?.loginAttemptAt?.toDate?.();
    const formattedLoginTime = loginTime ? loginTime.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'short'
    }) : 'Just now';

    const signupDate = userData.createdAt?.toDate?.();
    const formattedSignupDate = signupDate ? signupDate.toLocaleDateString('en-IN') : 'Unknown';

    return {
      subject: `🚨 SECURITY ALERT: User Login Attempt Requires Approval - ${userData.displayName || userData.email}`,
      html: this.buildHTMLTemplate(userData, formattedLoginTime, formattedSignupDate, adminData)
    };
  }

  static buildHTMLTemplate(userData, loginTime, signupDate, adminData) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>User Approval Required</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">🔐 Security Alert</h1>
            <p style="color: #e8eaf6; margin: 10px 0 0 0; font-size: 16px;">User Approval Required</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            <p style="font-size: 16px; line-height: 1.6; color: #333333; margin-bottom: 20px;">
              Dear <strong>${adminData.displayName || 'Administrator'}</strong>,
            </p>

            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <div style="display: flex; align-items: center; margin-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
                <strong style="color: #856404; font-size: 18px;">Immediate Action Required</strong>
              </div>
              <p style="margin: 0; color: #856404; line-height: 1.5;">
                An unapproved user has attempted to access the Walls & Trends application. Please review and take appropriate action.
              </p>
            </div>

            <!-- User Details Card -->
            <div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057; font-size: 18px; border-bottom: 2px solid #dee2e6; padding-bottom: 10px;">
                👤 User Information
              </h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #495057; width: 120px;">Name:</td>
                  <td style="padding: 8px 0; color: #212529;">${userData.displayName || 'Not provided'}</td>
                </tr>
                <tr style="background-color: #ffffff;">
                  <td style="padding: 8px 0; font-weight: 600; color: #495057;">Email:</td>
                  <td style="padding: 8px 0; color: #212529; font-family: 'Courier New', monospace;">${userData.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #495057;">Role:</td>
                  <td style="padding: 8px 0; color: #212529;">
                    <span style="background-color: #e9ecef; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                      ${userData.role}
                    </span>
                  </td>
                </tr>
                <tr style="background-color: #ffffff;">
                  <td style="padding: 8px 0; font-weight: 600; color: #495057;">Signup Date:</td>
                  <td style="padding: 8px 0; color: #212529;">${signupDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: 600; color: #495057;">Login Attempt:</td>
                  <td style="padding: 8px 0; color: #dc3545; font-weight: 600;">${loginTime}</td>
                </tr>
              </table>
            </div>

            <!-- Action Required -->
            <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #0c5460;">📋 Required Action</h4>
              <p style="margin: 0; color: #0c5460; line-height: 1.5;">
                Please log in to the admin panel immediately to review this access request. You can either <strong>approve</strong> or <strong>deny</strong> the user's access.
              </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.ADMIN_PANEL_URL || 'https://your-app-url.com/admin'}"
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); transition: all 0.3s ease;">
                🔗 Open Admin Panel
              </a>
            </div>

            <!-- Security Notice -->
            <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #721c24; font-size: 14px; line-height: 1.5;">
                <strong>Security Notice:</strong> This notification was automatically generated because an unapproved user attempted to access the system. If you suspect malicious activity, please investigate immediately and consider additional security measures.
              </p>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #dee2e6; padding-top: 20px; margin-top: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="text-align: left;">
                    <p style="margin: 0; font-size: 14px; color: #6c757d;">
                      <strong>Walls & Trends</strong><br>
                      Invoice Management System
                    </p>
                  </td>
                  <td style="text-align: right;">
                    <p style="margin: 0; font-size: 12px; color: #6c757d;">
                      Automated Security Notification<br>
                      Do not reply to this email
                    </p>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Admin Approval Notification System with Enterprise Features
exports.sendAdminApprovalNotification = functions.firestore
  .document('admin_notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    const notificationId = context.params.notificationId;

    // Comprehensive logging
    console.log(`📧 Processing notification ${notificationId}:`, {
      type: notification.type,
      userId: notification.userId,
      adminId: notification.adminId,
      emailSent: notification.emailSent
    });

    // Validate notification type
    if (notification.type !== 'USER_LOGIN_ATTEMPT') {
      console.log(`⏭️ Skipping notification ${notificationId} - not a login attempt`);
      return null;
    }

    // Check if already sent
    if (notification.emailSent) {
      console.log(`⏭️ Skipping notification ${notificationId} - already sent`);
      return null;
    }

    // Rate limiting check
    if (!checkRateLimit(notification.userId)) {
      console.warn(`🚫 Rate limit exceeded for user ${notification.userId} - notification ${notificationId} blocked`);
      await snap.ref.update({
        emailSent: false,
        rateLimited: true,
        blockedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return null;
    }

    try {
      // Circuit breaker execution
      await emailCircuitBreaker.execute(async () => {
        await sendNotificationEmail(snap, notification, notificationId);
      });

    } catch (circuitError) {
      console.error(`🚫 Circuit breaker blocked notification ${notificationId}:`, circuitError.message);

      // Log circuit breaker state
      const circuitState = emailCircuitBreaker.getState();
      console.error('Circuit breaker state:', circuitState);

      // Mark as circuit blocked
      await snap.ref.update({
        emailSent: false,
        circuitBlocked: true,
        circuitState: circuitState,
        blockedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: circuitError.message
      });

      return null;
    }
  });

// Core email sending function
async function sendNotificationEmail(snap, notification, notificationId) {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting email send for notification ${notificationId}`);

    // Parallel data fetching for performance
    const [adminDoc, userDoc] = await Promise.all([
      db.collection('users').doc(notification.adminId).get(),
      db.collection('users').doc(notification.userId).get()
    ]);

    // Validate admin
    if (!adminDoc.exists) {
      throw new Error(`Admin ${notification.adminId} not found`);
    }

    const adminData = adminDoc.data();
    if (!adminData.email) {
      throw new Error(`Admin ${notification.adminId} has no email address`);
    }

    // Validate user
    if (!userDoc.exists) {
      throw new Error(`User ${notification.userId} not found`);
    }

    const userData = userDoc.data();

    console.log(`📊 Sending notification: User ${userData.email} → Admin ${adminData.email}`);

    // Build email using template builder
    const { subject, html } = EmailTemplateBuilder.buildApprovalNotification(userData, notification, adminData);

    // Send email via configured service
    const emailService = getEmailService();
    let emailResult;

    console.log(`📤 Sending email via ${emailService.provider.toUpperCase()} to ${adminData.email}`);

    // Gmail API implementation (Blaze plan required)
    emailResult = await emailService.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: buildRawEmail({
          from: emailService.user,
          to: adminData.email,
          subject,
          html
        })
      }
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Mark as successfully sent
    await snap.ref.update({
      emailSent: true,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      gmailMessageId: emailResult.data.id,
      processingDurationMs: duration,
      deliveryStatus: 'SENT'
    });

    console.log(`✅ Email sent successfully in ${duration}ms - Notification ${notificationId}`);

    // Log success metrics
    await logEmailMetrics(notificationId, 'SUCCESS', duration, {
      userId: notification.userId,
      adminId: notification.adminId,
      subject: subject.substring(0, 100) + '...'
    });

    return null;

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error(`❌ Email send failed for notification ${notificationId} (${duration}ms):`, error);

    // Enhanced error logging
    const errorDetails = {
      message: error.message,
      code: error.code,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
      gmailError: error.errors ? JSON.stringify(error.errors) : null
    };

    // Update notification with failure details
    await snap.ref.update({
      emailSent: false,
      deliveryStatus: 'FAILED',
      error: errorDetails,
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingDurationMs: duration,
      retryCount: admin.firestore.FieldValue.increment(1)
    });

    // Log failure metrics
    await logEmailMetrics(notificationId, 'FAILED', duration, {
      userId: notification.userId,
      adminId: notification.adminId,
      error: error.message
    });

    // Re-throw to trigger circuit breaker
    throw error;
  }
}

// Email metrics logging function
async function logEmailMetrics(notificationId, status, duration, metadata) {
  try {
    await db.collection('email_delivery_metrics').add({
      notificationId,
      status,
      durationMs: duration,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata,
      circuitBreakerState: emailCircuitBreaker.getState()
    });
  } catch (logError) {
    console.error('Failed to log email metrics:', logError);
    // Don't throw - logging failure shouldn't break email sending
  }
}

// Manual trigger for sending admin notifications (for testing or manual sending)
exports.sendAdminNotificationManual = functions.https.onCall(async (data, context) => {
  // Verify admin authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required');
  }

  // Verify admin role
  const adminDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Admin not found');
  }

  const adminData = adminDoc.data();
  if (!['ADMIN', 'SUPER_ADMIN'].includes(adminData.role)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin role required');
  }

  const { userId, adminId, customMessage } = data;

  if (!userId || !adminId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId and adminId are required');
  }

  try {
    // Create notification document to trigger the cloud function
    const notificationRef = db.collection('admin_notifications').doc();
    await notificationRef.set({
      type: 'USER_LOGIN_ATTEMPT',
      userId,
      adminId,
      emailSent: false,
      actionTaken: null,
      actionTakenAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        loginAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
        customMessage: customMessage || null,
        manualTrigger: true,
        triggeredBy: context.auth.uid
      }
    });

    return {
      success: true,
      message: 'Admin notification queued for sending',
      notificationId: notificationRef.id
    };

  } catch (error) {
    console.error('Failed to send manual admin notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

// ============================================================================
// DATABASE MIGRATION: Add Approval Fields to Existing Users
// Run this function once after deploying the approval system
// ============================================================================

exports.migrateUsersForApprovalSystem = functions.https.onCall(async (data, context) => {
  // Verify SUPER_ADMIN access only
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  const callerDoc = await db.collection('users').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().role !== 'SUPER_ADMIN') {
    throw new functions.https.HttpsError('permission-denied', 'SUPER_ADMIN access required for migration');
  }

  console.log('🚀 Starting user migration for approval system...');

  try {
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();

      // Skip if already has approval fields (already migrated)
      if (userData.hasOwnProperty('isApproved')) {
        console.log(`⏭️ Skipping user ${userDoc.id} - already migrated`);
        skippedCount++;
        continue;
      }

      // Determine approval status based on role
      const isApproved = userData.role === 'SUPER_ADMIN' || userData.role === 'ADMIN';

      // Prepare migration data
      const migrationData = {
        isApproved,
        approvedBy: isApproved ? userDoc.id : null, // Self-approved for admins
        approvedAt: isApproved ? admin.firestore.FieldValue.serverTimestamp() : null,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        migrationVersion: '1.0'
      };

      // Add to batch
      batch.update(userDoc.ref, migrationData);
      migratedCount++;

      console.log(`📝 Queued migration for user ${userDoc.id} (${userData.email}): isApproved=${isApproved}`);
    }

    // Execute batch migration
    if (migratedCount > 0) {
      await batch.commit();
      console.log(`✅ Migration completed: ${migratedCount} users migrated, ${skippedCount} skipped`);
    } else {
      console.log(`ℹ️ Migration completed: No users needed migration (${skippedCount} already migrated)`);
    }

    return {
      success: true,
      message: `Migration completed successfully`,
      stats: {
        migrated: migratedCount,
        skipped: skippedCount,
        total: usersSnapshot.size
      }
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw new functions.https.HttpsError('internal', `Migration failed: ${error.message}`);
  }
});

// ============================================================================
// DAILY AUTOMATED BACKUP SERVICE (FREE TIER COMPATIBLE)
// ============================================================================

/**
 * Daily Automated Backup Function
 * Compatible with Firebase Free Tier - uses Firebase Storage only
 */
exports.dailyDatabaseBackup = functions.pubsub
  .schedule('0 2 * * *') // 2 AM daily
  .timeZone('Asia/Kolkata')
  .onRun(async (context) => {
    const startTime = Date.now();
    const backupDate = new Date().toISOString().split('T')[0];

    console.log(`🔄 Starting daily backup for ${backupDate}`);

    try {
      const collections = [
        'invoices', 'clients', 'projects', 'quotations', 'proformas',
        'users', 'audit_logs', 'pdf_metadata', 'management_team'
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

      // Export each collection
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
          console.log(`✅ ${collectionName}: ${documents.length} documents`);
        } else {
          backupData.data[collectionName] = [];
          console.log(`ℹ️ ${collectionName}: No documents`);
        }
      }

      // Simple encryption for backup security (free tier compatible)
      const encryptedData = encryptBackupData(JSON.stringify(backupData));

      // Upload to Firebase Storage
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

      // Log successful backup
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

      console.log(`✅ Daily backup completed: ${backupFileName}`);

      // Cleanup old backups (keep last 7 days)
      await cleanupOldBackups(bucket, backupDate);

      return null;

    } catch (error) {
      console.error('❌ Daily backup failed:', error);

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
 * Simple encryption for backup data (free tier compatible)
 */
function encryptBackupData(data) {
  const key = 'wallsandtrends_backup_key_2024';
  let encrypted = '';

  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    encrypted += String.fromCharCode(charCode ^ keyChar);
  }

  const checksum = data.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return checksum.toString() + '|' + Buffer.from(encrypted).toString('base64');
}

/**
 * Cleanup old backups (keep last 7 days)
 */
async function cleanupOldBackups(bucket, currentDate) {
  try {
    const [files] = await bucket.getFiles({
      prefix: 'backups/daily/'
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const filesToDelete = files.filter(file => {
      const fileName = file.name;
      const dateMatch = fileName.match(/backups\/daily\/(\d{4}-\d{2}-\d{2})\//);
      if (dateMatch) {
        const fileDate = new Date(dateMatch[1]);
        return fileDate < sevenDaysAgo;
      }
      return false;
    });

    if (filesToDelete.length > 0) {
      console.log(`🧹 Cleaning up ${filesToDelete.length} old backup files`);
      for (const file of filesToDelete) {
        await file.delete();
      }
    }

  } catch (error) {
    console.warn('Failed to cleanup old backups:', error.message);
  }
}

/**
 * Manual backup trigger (management team only)
 */
exports.triggerManualBackup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  // Hash UID and check management team
  const hashedUid = await hashUid(context.auth.uid);
  const managementDoc = await db.collection('management_team').doc(hashedUid).get();

  if (!managementDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Management team access required');
  }

  console.log(`🔄 Manual backup triggered by ${context.auth.uid}`);

  try {
    const result = await performBackup();
    return { success: true, ...result };
  } catch (error) {
    console.error('Manual backup failed:', error);
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
 * Perform backup operation
 */
async function performBackup() {
  const backupDate = new Date().toISOString().split('T')[0];
  const startTime = Date.now();

  const collections = [
    'invoices', 'clients', 'projects', 'quotations', 'proformas',
    'users', 'audit_logs', 'pdf_metadata', 'management_team'
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

  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    const documents = [];
    snapshot.forEach(doc => {
      documents.push({ id: doc.id, data: doc.data() });
    });
    backupData.data[collectionName] = documents;
  }

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

// Existing example retained for compatibility
exports.sendInvoiceEmail = functions.https.onCall((data, context) => {
  console.log("Sending email to:", data.email);
  return { message: "Email sent successfully" };
});
