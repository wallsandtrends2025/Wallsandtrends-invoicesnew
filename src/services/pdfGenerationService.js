// src/services/pdfGenerationService.js
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { authService } from '../utils/authService.jsx';
import logger from '../utils/logger.js';

/**
 * Enterprise Server-Side PDF Generation Service
 * Handles all PDF generation operations through Firebase Cloud Functions
 */
class PDFGenerationService {
  constructor() {
    this.functions = getFunctions();
    this.storage = getStorage();
    this.cache = new Map();
    this.maxCacheSize = 50;
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Generate PDF for invoice through server
   */
  async generateInvoicePDF(invoiceId, options = {}) {
    try {
      logger.info('Generating server-side PDF for invoice:', { invoiceId });

      // Validate authentication
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required for PDF generation');
      }

      // Check cache first
      const cacheKey = `invoice:${invoiceId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && !options.forceRegenerate) {
        logger.info('Using cached PDF for invoice:', { invoiceId });
        return cached;
      }

      // Call Firebase Function
      const generatePDF = httpsCallable(this.functions, 'generateInvoicePDF');
      const result = await generatePDF({
        invoiceId,
        options: {
          ...options,
          format: options.format || 'A4',
          includeHeader: options.includeHeader !== false,
          includeFooter: options.includeFooter !== false,
          quality: options.quality || 'high'
        }
      });

      const pdfData = result.data;
      
      if (!pdfData.success) {
        throw new Error(pdfData.error || 'PDF generation failed');
      }

      // Store in cache
      this.addToCache(cacheKey, pdfData);

      logger.info('Successfully generated server-side PDF:', { 
        invoiceId, 
        fileName: pdfData.fileName,
        fileSize: pdfData.fileSize 
      });

      return pdfData;

    } catch (error) {
      logger.error('PDF generation failed:', { 
        invoiceId, 
        error: error.message,
        stack: error.stack 
      });
      
      // Enhanced error handling
      if (error.code === 'permission-denied') {
        throw new Error('Access denied to generate PDF for this invoice');
      } else if (error.code === 'resource-exhausted') {
        throw new Error('Rate limit exceeded. Please try again later');
      } else if (error.code === 'not-found') {
        throw new Error('Invoice not found');
      }
      
      throw new Error(`PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF for quotation through server
   */
  async generateQuotationPDF(quotationId, options = {}) {
    try {
      logger.info('Generating server-side PDF for quotation:', { quotationId });

      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required for PDF generation');
      }

      const cacheKey = `quotation:${quotationId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && !options.forceRegenerate) {
        logger.info('Using cached PDF for quotation:', { quotationId });
        return cached;
      }

      const generatePDF = httpsCallable(this.functions, 'generateQuotationPDF');
      const result = await generatePDF({
        quotationId,
        options: {
          ...options,
          format: options.format || 'A4',
          includeHeader: options.includeHeader !== false,
          includeFooter: options.includeFooter !== false
        }
      });

      const pdfData = result.data;
      
      if (!pdfData.success) {
        throw new Error(pdfData.error || 'PDF generation failed');
      }

      this.addToCache(cacheKey, pdfData);

      logger.info('Successfully generated server-side PDF for quotation:', { 
        quotationId, 
        fileName: pdfData.fileName 
      });

      return pdfData;

    } catch (error) {
      logger.error('Quotation PDF generation failed:', { 
        quotationId, 
        error: error.message 
      });
      
      throw new Error(`Quotation PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Generate PDF for proforma through server
   */
  async generateProformaPDF(proformaId, options = {}) {
    try {
      logger.info('Generating server-side PDF for proforma:', { proformaId });

      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required for PDF generation');
      }

      const cacheKey = `proforma:${proformaId}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && !options.forceRegenerate) {
        logger.info('Using cached PDF for proforma:', { proformaId });
        return cached;
      }

      const generatePDF = httpsCallable(this.functions, 'generateProformaPDF');
      const result = await generatePDF({
        proformaId,
        options: {
          ...options,
          format: options.format || 'A4',
          includeHeader: options.includeHeader !== false,
          includeFooter: options.includeFooter !== false
        }
      });

      const pdfData = result.data;
      
      if (!pdfData.success) {
        throw new Error(pdfData.error || 'PDF generation failed');
      }

      this.addToCache(cacheKey, pdfData);

      logger.info('Successfully generated server-side PDF for proforma:', { 
        proformaId, 
        fileName: pdfData.fileName 
      });

      return pdfData;

    } catch (error) {
      logger.error('Proforma PDF generation failed:', { 
        proformaId, 
        error: error.message 
      });
      
      throw new Error(`Proforma PDF generation failed: ${error.message}`);
    }
  }

  /**
   * Download PDF with secure access token
   */
  async downloadPDF(pdfData, options = {}) {
    try {
      const { fileName, accessToken, downloadUrl, expiresAt } = pdfData;
      
      if (!fileName || !accessToken) {
        throw new Error('Missing fileName or accessToken for PDF download');
      }

      // Check if token is still valid
      if (expiresAt && new Date() > new Date(expiresAt)) {
        throw new Error('Access token has expired. Please regenerate PDF');
      }

      // Log download attempt
      logger.info('Downloading PDF:', { fileName, size: pdfData.fileSize });

      // Use the provided download URL or generate one
      const url = downloadUrl || `https://storage.googleapis.com/invoice-new-6a045.firebasestorage.app/${fileName}?token=${accessToken}`;
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logger.info('PDF download triggered successfully:', { fileName });

      return {
        success: true,
        fileName,
        downloadUrl: url,
        expiresAt
      };

    } catch (error) {
      logger.error('PDF download failed:', { 
        fileName: pdfData?.fileName,
        error: error.message 
      });
      
      throw new Error(`PDF download failed: ${error.message}`);
    }
  }

  /**
   * Get PDF statistics for admin users
   */
  async getPDFStats() {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        throw new Error('Authentication required');
      }

      // Check if user is admin
      if (!authService.isAdmin()) {
        throw new Error('Admin access required to view PDF statistics');
      }

      const getStats = httpsCallable(this.functions, 'getPDFStats');
      const result = await getStats({});
      
      return result.data;

    } catch (error) {
      logger.error('Failed to get PDF statistics:', error);
      throw new Error(`Failed to get PDF statistics: ${error.message}`);
    }
  }

  /**
   * Clear PDF cache
   */
  clearCache(pattern = null) {
    if (pattern) {
      // Clear specific pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
    
    logger.info('PDF cache cleared:', { pattern });
  }

  /**
   * Cache management methods
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    // Remove expired cache entry
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  addToCache(key, data) {
    // Manage cache size
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Legacy compatibility - wrapper for existing components
   * This allows gradual migration from client-side to server-side generation
   */
  async generatePDFLegacy(documentType, documentData, clientData, options = {}) {
    logger.warn('Using legacy PDF generation - migrate to server-side', { documentType });
    
    const documentId = documentData[`${documentType}_id`];
    if (!documentId) {
      throw new Error(`Document ID not found for ${documentType}`);
    }

    switch (documentType) {
      case 'invoice':
        return this.generateInvoicePDF(documentId, options);
      case 'quotation':
        return this.generateQuotationPDF(documentId, options);
      case 'proforma':
        return this.generateProformaPDF(documentId, options);
      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }
  }

  /**
   * Batch PDF generation for multiple documents
   */
  async generateBatchPDFs(documents, options = {}) {
    const results = [];
    const errors = [];
    
    for (const doc of documents) {
      try {
        const { type, data } = doc;
        const result = await this.generatePDFLegacy(type, data, doc.clientData, options);
        results.push({ type, data, result });
        
        // Add delay between requests to respect rate limits
        if (options.delayBetweenRequests !== false) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        errors.push({ type: doc.type, data: doc.data, error: error.message });
      }
    }
    
    return { results, errors };
  }

  /**
   * Monitor PDF generation health
   */
  async healthCheck() {
    try {
      const user = authService.getCurrentUser();
      if (!user) {
        return { status: 'unauthenticated', timestamp: new Date().toISOString() };
      }

      // Test with a simple function call
      const getStats = httpsCallable(this.functions, 'getPDFStats');
      const result = await getStats({ healthCheck: true });
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats: result.data
      };
      
    } catch (error) {
      logger.error('PDF service health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const pdfGenerationService = new PDFGenerationService();

// Export individual methods for direct import
export const {
  generateInvoicePDF,
  generateQuotationPDF,
  generateProformaPDF,
  downloadPDF,
  getPDFStats,
  clearCache
} = pdfGenerationService;

// Export types for better IDE support
export const PDF_OPTIONS = {
  FORMAT: {
    A4: 'A4',
    LETTER: 'letter'
  },
  QUALITY: {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
  },
  ORIENTATION: {
    PORTRAIT: 'portrait',
    LANDSCAPE: 'landscape'
  }
};

export default pdfGenerationService; 
