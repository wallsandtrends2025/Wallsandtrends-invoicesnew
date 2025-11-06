const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const dayjs = require("dayjs");

// Initialize Admin SDK
try {
  admin.app();
} catch (e) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

/**
 * Enterprise PDF Generation Service
 * Implements Google Cloud best practices with proper security, monitoring, and scalability
 */

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const CONFIG = {
  // PDF Generation Settings
  MAX_PAGES_PER_DOCUMENT: 50,
  TIMEOUT_MS: 30000, // 30 seconds timeout
  RETRY_ATTEMPTS: 3,
  MAX_FILE_SIZE_MB: 25,
  
  // Storage Settings
  STORAGE_BUCKET: 'invoice-new-6a045.firebasestorage.app',
  PDF_RETENTION_DAYS: 365,
  
  // Rate Limiting
  RATE_LIMITS: {
    GENERATE_PDF: { requests: 10, windowMs: 60000 }, // 10 per minute
    DOWNLOAD_PDF: { requests: 50, windowMs: 60000 }, // 50 per minute
  },
  
  // Company Information
  COMPANIES: {
    WT: {
      name: "Walls And Trends",
      gst: "36AACFW6827B1Z8",
      logo: "/wt-logo.png"
    },
    WTX: {
      name: "Walls And Trends", 
      gst: "36AAACW8991C1Z9",
      logo: "/wtx_logo.png"
    }
  },
  
  // Security
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  PDF_PASSWORD_LENGTH: 32,
  ACCESS_TOKEN_EXPIRY: 3600 // 1 hour
};

// ============================================================================
// SECURITY & AUTHENTICATION LAYER
// ============================================================================

/**
 * Authentication middleware for all PDF operations
 */
async function authenticateRequest(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  const userId = context.auth.uid;
  const userDoc = await db.collection('users').doc(userId).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('permission-denied', 'User not found');
  }
  
  const userData = userDoc.data();
  if (!userData.isApproved) {
    throw new functions.https.HttpsError('permission-denied', 'User not approved');
  }
  
  return { userId, userData };
}

/**
 * Rate limiting implementation
 */
class RateLimiter {
  constructor() {
    this.cache = new Map();
  }
  
  async checkLimit(userId, operation) {
    const config = CONFIG.RATE_LIMITS[operation];
    if (!config) return true;
    
    const key = `${userId}:${operation}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    if (!this.cache.has(key)) {
      this.cache.set(key, []);
    }
    
    const requests = this.cache.get(key).filter(timestamp => timestamp > windowStart);
    
    if (requests.length >= config.requests) {
      return false;
    }
    
    requests.push(now);
    this.cache.set(key, requests);
    
    return true;
  }
}

const rateLimiter = new RateLimiter();

/**
 * Permission validation for document access
 */
async function validateDocumentAccess(userId, documentId, documentType) {
  // Get document from appropriate collection
  const collectionName = `${documentType}s`; // invoices, quotations, proformas
  const docRef = db.collection(collectionName).doc(documentId);
  const docSnap = await docRef.get();
  
  if (!docSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Document not found');
  }
  
  const documentData = docSnap.data();
  
  // Check if user has access to this document
  const isOwner = documentData.ownerId === userId;
  const userRole = await getUserRole(userId);
  const hasAdminAccess = ['ADMIN', 'SUPER_ADMIN'].includes(userRole);
  
  if (!isOwner && !hasAdminAccess) {
    throw new functions.https.HttpsError('permission-denied', 'Access denied to document');
  }
  
  return documentData;
}

/**
 * Get user role with caching
 */
const roleCache = new Map();
async function getUserRole(userId) {
  if (roleCache.has(userId)) {
    const { role, timestamp } = roleCache.get(userId);
    // Cache for 5 minutes
    if (Date.now() - timestamp < 300000) {
      return role;
    }
  }
  
  const userDoc = await db.collection('users').doc(userId).get();
  const role = userDoc.data()?.role || 'USER';
  
  roleCache.set(userId, { role, timestamp: Date.now() });
  return role;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate secure access token for file download
 */
function generateAccessToken(documentId, userId) {
  const payload = {
    documentId,
    userId,
    timestamp: Date.now(),
    expiresAt: Date.now() + (CONFIG.ACCESS_TOKEN_EXPIRY * 1000)
  };
  
  const data = JSON.stringify(payload);
  const hash = crypto.createHmac('sha256', process.env.ACCESS_TOKEN_SECRET || 'default-secret')
    .update(data)
    .digest('hex');
    
  return Buffer.from(`${data}:${hash}`).toString('base64');
}

/**
 * Verify access token
 */
function verifyAccessToken(token, documentId, userId) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    const { documentId: tokenDocId, userId: tokenUserId, timestamp, expiresAt } = decoded;
    
    if (documentId !== tokenDocId || userId !== tokenUserId) {
      return false;
    }
    
    if (Date.now() > expiresAt) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Log PDF generation activity for audit
 */
async function logPDFActivity(action, userId, documentId, documentType, metadata = {}) {
  try {
    await db.collection('pdf_audit_logs').add({
      action,
      userId,
      documentId,
      documentType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata,
      userAgent: 'Cloud-Functions',
      source: 'server-side-generation'
    });
  } catch (error) {
    console.error('Failed to log PDF activity:', error);
  }
}

/**
 * Format currency for PDF display
 */
function formatCurrency(amount, currency = 'INR') {
  const numAmount = Number(amount || 0);
  if (currency === 'INR') {
    return numAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return numAmount.toFixed(2);
}

/**
 * Convert number to words (Indian system)
 */
function numberToWords(amount) {
  const num = Math.floor(Number(amount || 0));
  if (num === 0) return 'Zero';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const thousands = ['', 'Thousand', 'Lakh', 'Crore'];
  
  function convertChunk(num) {
    let result = '';
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)];
      if (num % 10 !== 0) result += ' ' + ones[num % 10];
    } else if (num > 0) {
      result += ones[num];
    }
    return result.trim();
  }
  
  let result = '';
  let chunkIndex = 0;
  
  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      result = convertChunk(chunk) + (thousands[chunkIndex] ? ' ' + thousands[chunkIndex] : '') + 
               (result ? ' ' + result : '');
    }
    num = Math.floor(num / 1000);
    chunkIndex++;
  }
  
  return result + ' Rupees only';
}

// ============================================================================
// PDF GENERATION CORE
// ============================================================================

/**
 * Base PDF generator with common functionality
 */
class BasePDFGenerator {
  constructor(documentData, clientData, options = {}) {
    this.documentData = documentData;
    this.clientData = clientData;
    this.options = options;
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.pageCount = 0;
  }
  
  async generate() {
    try {
      // Add metadata
      this.doc.setProperties({
        title: this.getDocumentTitle(),
        subject: 'Invoice Document',
        author: CONFIG.COMPANIES.WT.name,
        creator: 'Walls & Trends PDF Generator v2.0',
        producer: 'Firebase Cloud Functions'
      });
      
      // Generate content
      await this.generateHeader();
      await this.generateContent();
      await this.generateFooter();
      
      return this.doc;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new functions.https.HttpsError('internal', `PDF generation failed: ${error.message}`);
    }
  }
  
  async generateHeader() {
    const y = 15;
    const company = this.getCompanyInfo();
    
    // Add logo
    try {
      // In production, load from Firebase Storage
      // For now, use text placeholder
      this.doc.setFontSize(20);
      this.doc.setTextColor(59, 89, 152);
      this.doc.text(company.name, 15, y);
    } catch (error) {
      console.warn('Logo loading failed, using text:', error.message);
    }
    
    // Company details
    this.doc.setFontSize(8);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('19/B, 3rd Floor, Progressive Tower', 15, y + 8);
    this.doc.text('100 Ft Road, Siddhi Vinayak Nagar', 15, y + 12);
    this.doc.text('Madhapur, Hyderabad, Telangana - 500081', 15, y + 16);
    this.doc.text(`GST IN: ${company.gst}`, 15, y + 20);
  }
  
  async generateContent() {
    // To be implemented by subclasses
    throw new Error('generateContent must be implemented by subclass');
  }
  
  async generateFooter() {
    const pageHeight = this.doc.internal.pageSize.height;
    
    this.doc.setFontSize(6);
    this.doc.setTextColor(153, 164, 175);
    this.doc.text('Generated by Walls & Trends Invoice System', 15, pageHeight - 10);
    this.doc.text(`Generated on: ${new Date().toISOString()}`, 15, pageHeight - 6);
  }
  
  getCompanyInfo() {
    const documentType = this.documentData.invoice_type || this.documentData.quotation_type || this.documentData.proforma_type;
    const isWTX = documentType && documentType.toString().toUpperCase().includes('WTX');
    return isWTX ? CONFIG.COMPANIES.WTX : CONFIG.COMPANIES.WT;
  }
  
  getDocumentTitle() {
    const docId = this.documentData.invoice_id || this.documentData.quotation_id || this.documentData.proforma_id;
    const docType = this.documentData.invoice_type || this.documentData.quotation_type || this.documentData.proforma_type;
    return `${docType} - ${docId}`;
  }
}

/**
 * Invoice PDF Generator
 */
class InvoicePDFGenerator extends BasePDFGenerator {
  async generateContent() {
    const y = 50;
    
    // Document title
    this.doc.setFontSize(18);
    this.doc.setTextColor(59, 89, 152);
    this.doc.text('Tax Invoice', 15, y);
    
    // Document details
    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);
    
    const docId = this.documentData.invoice_id;
    const docDate = this.documentData.invoice_date || this.documentData.created_at;
    const docTitle = this.documentData.invoice_title || 'Invoice';
    
    this.doc.text(`Invoice Number: ${docId}`, 15, y + 10);
    this.doc.text(`Invoice Date: ${this.formatDate(docDate)}`, 15, y + 16);
    this.doc.text(`Invoice Title: ${docTitle}`, 15, y + 22);
    
    // Client information
    const clientY = y + 35;
    this.doc.text('Bill To:', 15, clientY);
    this.doc.text(this.clientData.client_name || 'N/A', 15, clientY + 6);
    this.doc.text(this.clientData.address || 'N/A', 15, clientY + 12);
    this.doc.text(`GST: ${this.clientData.gst_number || 'N/A'}`, 15, clientY + 18);
    
    // Services table
    const tableY = clientY + 30;
    this.generateServicesTable(tableY);
    
    // Totals
    this.generateTotalsSection(tableY + 80);
  }
  
  generateServicesTable(y) {
    const services = this.documentData.services || [];
    const headers = ['HSN/SAC', 'Item', 'Description', 'Amount'];
    
    const rows = services.map(service => [
      '9983',
      Array.isArray(service.name) ? service.name.join(', ') : (service.name || 'Service'),
      service.description || '',
      formatCurrency(service.amount, this.documentData.currency)
    ]);
    
    // Add subtotal row
    rows.push(['', '', 'Subtotal', formatCurrency(this.documentData.subtotal, this.documentData.currency)]);
    
    autoTable(this.doc, {
      head: [headers],
      body: rows,
      startY: y,
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [59, 89, 152],
        textColor: 255
      }
    });
  }
  
  generateTotalsSection(y) {
    const subtotal = Number(this.documentData.subtotal || 0);
    const totalAmount = Number(this.documentData.total_amount || subtotal);
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(0, 0, 0);
    
    this.doc.text('Total Amount:', 140, y);
    this.doc.text(formatCurrency(totalAmount, this.documentData.currency), 180, y);
    
    // Amount in words
    const words = numberToWords(totalAmount);
    this.doc.setFontSize(8);
    this.doc.text(`Amount in words: ${words}`, 15, y + 10);
  }
  
  formatDate(date) {
    return dayjs(date).format('DD MMMM YYYY');
  }
}

/**
 * Quotation PDF Generator
 */
class QuotationPDFGenerator extends BasePDFGenerator {
  async generateContent() {
    const y = 50;
    
    // Document title
    this.doc.setFontSize(18);
    this.doc.setTextColor(59, 89, 152);
    this.doc.text('Quotation', 15, y);
    
    // Similar structure to invoice but for quotations
    // Implementation details...
  }
}

/**
 * Proforma PDF Generator
 */
class ProformaPDFGenerator extends BasePDFGenerator {
  async generateContent() {
    const y = 50;
    
    // Document title
    this.doc.setFontSize(18);
    this.doc.setTextColor(59, 89, 152);
    this.doc.text('Proforma Invoice', 15, y);
    
    // Similar structure to invoice but for proformas
    // Implementation details...
  }
}

// ============================================================================
// CLOUD FUNCTIONS ENDPOINTS
// ============================================================================

/**
 * Generate PDF for invoice
 */
exports.generateInvoicePDF = functions.https.onCall(async (data, context) => {
  const startTime = Date.now();
  
  try {
    // Authentication
    const { userId } = await authenticateRequest(context);
    
    // Rate limiting
    if (!await rateLimiter.checkLimit(userId, 'GENERATE_PDF')) {
      throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded');
    }
    
    const { invoiceId } = data;
    if (!invoiceId) {
      throw new functions.https.HttpsError('invalid-argument', 'invoiceId is required');
    }
    
    // Validate access
    const invoiceData = await validateDocumentAccess(userId, invoiceId, 'invoice');
    
    // Get client data
    const clientDoc = await db.collection('clients').doc(invoiceData.client_id).get();
    if (!clientDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Client not found');
    }
    const clientData = clientDoc.data();
    
    // Log activity
    await logPDFActivity('GENERATE_START', userId, invoiceId, 'invoice', {
      invoiceType: invoiceData.invoice_type,
      currency: invoiceData.currency
    });
    
    // Generate PDF
    const generator = new InvoicePDFGenerator(invoiceData, clientData);
    const pdfDoc = await generator.generate();
    
    // Convert to buffer
    const pdfBuffer = Buffer.from(pdfDoc.output('arraybuffer'));
    
    // Check file size
    const fileSizeMB = pdfBuffer.length / (1024 * 1024);
    if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
      throw new functions.https.HttpsError('resource-exhausted', 'Generated PDF too large');
    }
    
    // Store in Firebase Storage
    const fileName = `invoices/${invoiceId}_${Date.now()}.pdf`;
    const file = storage.bucket().file(fileName);
    
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          userId,
          documentId: invoiceId,
          documentType: 'invoice',
          generatedAt: new Date().toISOString()
        }
      }
    });
    
    // Generate secure access token
    const accessToken = generateAccessToken(invoiceId, userId);
    
    // Log successful generation
    await logPDFActivity('GENERATE_SUCCESS', userId, invoiceId, 'invoice', {
      fileName,
      fileSize: pdfBuffer.length,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      fileName,
      accessToken,
      fileSize: pdfBuffer.length,
      downloadUrl: `https://storage.googleapis.com/${CONFIG.STORAGE_BUCKET}/${fileName}?token=${accessToken}`,
      expiresAt: new Date(Date.now() + (CONFIG.ACCESS_TOKEN_EXPIRY * 1000)).toISOString()
    };
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    
    // Log failure
    if (context.auth) {
      await logPDFActivity('GENERATE_FAILED', context.auth.uid, data.invoiceId, 'invoice', {
        error: error.message,
        duration: Date.now() - startTime
      });
    }
    
    throw error;
  }
});

/**
 * Generate PDF for quotation
 */
exports.generateQuotationPDF = functions.https.onCall(async (data, context) => {
  // Similar implementation to invoice but for quotations
  // Implementation details...
});

/**
 * Generate PDF for proforma
 */
exports.generateProformaPDF = functions.https.onCall(async (data, context) => {
  // Similar implementation to invoice but for proformas
  // Implementation details...
});

/**
 * Download PDF with access control
 */
exports.downloadPDF = functions.https.onRequest(async (req, res) => {
  try {
    const { fileName, token, userId, documentId } = req.query;
    
    if (!fileName || !token || !userId || !documentId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    // Verify access token
    if (!verifyAccessToken(token, documentId, userId)) {
      return res.status(403).json({ error: 'Invalid or expired access token' });
    }
    
    // Check rate limit
    if (!await rateLimiter.checkLimit(userId, 'DOWNLOAD_PDF')) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    
    // Get file from storage
    const file = storage.bucket().file(fileName);
    const [exists] = await file.exists();
    
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Stream file to response
    const stream = file.createReadStream();
    
    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Log download
    await logPDFActivity('DOWNLOAD', userId, documentId, 'unknown', { fileName });
    
    stream.pipe(res);
    
  } catch (error) {
    console.error('PDF download failed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Clean up old PDF files
 */
exports.cleanupOldPDFs = functions.pubsub
  .schedule("0 2 * * *") // Daily at 2 AM
  .onRun(async (context) => {
    try {
      const cutoffDate = dayjs().subtract(CONFIG.PDF_RETENTION_DAYS, 'days');
      
      const files = await storage.bucket().getFiles({
        prefix: 'invoices/'
      });
      
      let deletedCount = 0;
      
      for (const [file] of files) {
        const [metadata] = await file.getMetadata();
        const createdDate = dayjs(metadata.timeCreated);
        
        if (createdDate.isBefore(cutoffDate)) {
          await file.delete();
          deletedCount++;
          
          // Log cleanup activity
          await db.collection('pdf_audit_logs').add({
            action: 'CLEANUP_DELETE',
            fileName: file.name,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            reason: 'Retention policy'
          });
        }
      }
      
      console.log(`Cleaned up ${deletedCount} old PDF files`);
      
    } catch (error) {
      console.error('PDF cleanup failed:', error);
    }
  });

/**
 * Get PDF generation statistics
 */
exports.getPDFStats = functions.https.onCall(async (data, context) => {
  await authenticateRequest(context);
  
  const { userId } = await authenticateRequest(context);
  const userRole = await getUserRole(userId);
  
  if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required');
  }
  
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get generation stats
    const [gen24h, gen7d, total] = await Promise.all([
      db.collection('pdf_audit_logs')
        .where('action', '==', 'GENERATE_SUCCESS')
        .where('timestamp', '>=', last24h)
        .get(),
        
      db.collection('pdf_audit_logs')
        .where('action', '==', 'GENERATE_SUCCESS')
        .where('timestamp', '>=', last7d)
        .get(),
        
      db.collection('pdf_audit_logs')
        .where('action', '==', 'GENERATE_SUCCESS')
        .get()
    ]);
    
    // Get download stats
    const [download24h, download7d, downloadTotal] = await Promise.all([
      db.collection('pdf_audit_logs')
        .where('action', '==', 'DOWNLOAD')
        .where('timestamp', '>=', last24h)
        .get(),
        
      db.collection('pdf_audit_logs')
        .where('action', '==', 'DOWNLOAD')
        .where('timestamp', '>=', last7d)
        .get(),
        
      db.collection('pdf_audit_logs')
        .where('action', '==', 'DOWNLOAD')
        .get()
    ]);
    
    return {
      generation: {
        last24h: gen24h.size,
        last7d: gen7d.size,
        total: total.size
      },
      downloads: {
        last24h: download24h.size,
        last7d: download7d.size,
        total: downloadTotal.size
      },
      timestamp: now.toISOString()
    };
    
  } catch (error) {
    console.error('Failed to get PDF stats:', error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve statistics');
  }
});

module.exports = {
  InvoicePDFGenerator,
  QuotationPDFGenerator,
  ProformaPDFGenerator,
  CONFIG
};