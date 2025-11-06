# Server-Side PDF Generation Deployment & Testing Guide

## Overview
This guide provides comprehensive procedures for deploying, testing, and maintaining the enterprise-grade server-side PDF generation system for the Walls & Trends Invoice application.

## Table of Contents
1. [Pre-Deployment Requirements](#pre-deployment-requirements)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Procedures](#deployment-procedures)
4. [Testing Procedures](#testing-procedures)
5. [Migration from Client-Side](#migration-from-client-side)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

## Pre-Deployment Requirements

### 1. Firebase Project Requirements
- ✅ Firebase project with Blaze plan (required for Cloud Functions)
- ✅ Firestore database enabled
- ✅ Cloud Storage enabled
- ✅ Authentication enabled
- ✅ App Check configured (optional but recommended)

### 2. Dependencies Installation
```bash
# Install additional dependencies in functions directory
cd functions
npm install jspdf jspdf-autotable dayjs crypto
```

### 3. Security Prerequisites
- ✅ Firestore security rules deployed
- ✅ Storage security rules deployed
- ✅ App Check configured (recommended)
- ✅ Environment variables configured

## Environment Configuration

### 1. Firebase Functions Configuration
```bash
# Set environment variables for production
firebase functions:config:set \
  gmail.client_id="your-gmail-client-id" \
  gmail.client_secret="your-gmail-client-secret" \
  gmail.refresh_token="your-refresh-token" \
  gmail.user="your-email@domain.com" \
  access.token.secret="your-secure-random-string"
```

### 2. Environment Variables (.env.local)
```bash
# Frontend environment variables
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# PDF Generation settings
VITE_PDF_GENERATION_TIMEOUT=30000
VITE_PDF_CACHE_DURATION=300000
VITE_PDF_MAX_FILE_SIZE=25
```

### 3. Firestore Collections Setup
```javascript
// Ensure these collections exist and have proper security rules
// - pdf_audit_logs (auto-created)
// - users (existing)
// - invoices (existing)
// - quotations (existing)
// - proformas (existing)
```

## Deployment Procedures

### 1. Deploy Cloud Functions
```bash
# Build and deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:generateInvoicePDF
firebase deploy --only functions:generateQuotationPDF
firebase deploy --only functions:generateProformaPDF
firebase deploy --only functions:downloadPDF
```

### 2. Verify Deployment
```bash
# Check function status
firebase functions:log

# Test function deployment
firebase functions:config:get
```

### 3. Update Security Rules
```bash
# Deploy updated security rules
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## Testing Procedures

### 1. Unit Testing (Cloud Functions)
```javascript
// Test local emulation
cd functions
npm test

// Or test individual functions
npm run test:generateInvoicePDF
npm run test:generateQuotationPDF
npm run test:generateProformaPDF
```

### 2. Integration Testing
```javascript
// Test with Firebase Emulator Suite
firebase emulators:start

// Then test in development environment
```

### 3. Production Testing Checklist
- [ ] **Authentication Test**: Verify user authentication works
- [ ] **Permission Test**: Test role-based access control
- [ ] **PDF Generation Test**: Test invoice/quotation/proforma generation
- [ ] **Download Test**: Test secure PDF download
- [ ] **Rate Limiting Test**: Verify rate limits are enforced
- [ ] **Error Handling Test**: Test error scenarios
- [ ] **Performance Test**: Test with large documents
- [ ] **Security Test**: Verify access tokens work correctly

### 4. Test Scripts
```bash
#!/bin/bash
# test-pdf-generation.sh

echo "🧪 Starting PDF Generation Tests..."

# Test authentication
echo "Testing authentication..."
curl -X POST "https://your-project.cloudfunctions.net/generateInvoicePDF" \
  -H "Content-Type: application/json" \
  -d '{"test": "auth"}'

# Test PDF generation
echo "Testing PDF generation..."
node tests/generate-invoice-pdf.js

# Test download
echo "Testing PDF download..."
node tests/download-pdf.js

echo "✅ All tests completed!"
```

## Migration from Client-Side

### 1. Gradual Migration Strategy
```javascript
// Step 1: Add server-side service alongside existing client-side
import { pdfGenerationService } from '../services/pdfGenerationService.js';

// Step 2: Replace generation calls
const generatePDF = async (invoiceData, clientData) => {
  try {
    // Try server-side first
    const result = await pdfGenerationService.generateInvoicePDF(
      invoiceData.invoice_id, 
      { includeHeader: true, quality: 'high' }
    );
    return result;
  } catch (error) {
    console.warn('Server-side generation failed, falling back to client-side:', error);
    // Fallback to existing client-side generation
    return await generateInvoicePDFClientSide(invoiceData, clientData);
  }
};
```

### 2. Component Updates
```javascript
// Update components to use new service
import { pdfGenerationService } from '../services/pdfGenerationService.js';

// In component
const handleGeneratePDF = async () => {
  setGenerating(true);
  try {
    const pdfData = await pdfGenerationService.generateInvoicePDF(invoiceId);
    await pdfGenerationService.downloadPDF(pdfData);
  } catch (error) {
    showError('PDF generation failed: ' + error.message);
  } finally {
    setGenerating(false);
  }
};
```

### 3. Remove Client-Side Dependencies
```bash
# After successful migration, remove client-side PDF libraries
npm uninstall jspdf jspdf-autotable

# Remove client-side PDF generation utilities
rm src/utils/generateInvoicePDF.js
rm src/utils/generateQuotationPDF.js  
rm src/utils/generateProformaInvoicePDF.js
```

## Monitoring & Maintenance

### 1. Cloud Functions Monitoring
```javascript
// Set up monitoring alerts
// Monitor function execution time, error rate, memory usage
// Set up alerts for:
const MONITORING_THRESHOLDS = {
  EXECUTION_TIME: 30000, // 30 seconds
  ERROR_RATE: 0.05, // 5%
  MEMORY_USAGE: 512, // 512MB
  CONCURRENCY: 100
};
```

### 2. Log Analysis
```bash
# View function logs
firebase functions:log --only=generateInvoicePDF

# Analyze errors
firebase functions:log --only=generateInvoicePDF | grep ERROR

# Monitor performance
firebase functions:log --only=generateInvoicePDF | grep "duration"
```

### 3. Performance Optimization
```javascript
// Monitor these metrics:
const PERFORMANCE_METRICS = {
  PDF_GENERATION_TIME: '< 30s',
  STORAGE_UPLOAD_TIME: '< 5s',
  DOWNLOAD_RESPONSE_TIME: '< 2s',
  CACHE_HIT_RATIO: '> 80%'
};
```

### 4. Regular Maintenance Tasks
```bash
# Weekly maintenance script
#!/bin/bash
# maintenance.sh

echo "🧹 Running PDF generation system maintenance..."

# Clean up old PDF files
curl -X POST "https://your-project.cloudfunctions.net/cleanupOldPDFs"

# Get and review statistics
node scripts/get-pdf-stats.js

# Check for errors
firebase functions:log --only=generateInvoicePDF --lines=100 | grep ERROR

echo "✅ Maintenance completed!"
```

## Configuration Management

### 1. Environment-Specific Configs
```javascript
// config/pdf.config.js
export const PDF_CONFIG = {
  development: {
    timeout: 60000, // 1 minute
    maxRetries: 2,
    cacheEnabled: true
  },
  production: {
    timeout: 30000, // 30 seconds
    maxRetries: 3,
    cacheEnabled: true
  }
};
```

### 2. Feature Flags
```javascript
// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  SERVER_SIDE_PDF: process.env.VITE_ENABLE_SERVER_PDF === 'true',
  CACHE_PDFS: process.env.VITE_ENABLE_PDF_CACHE === 'true',
  BATCH_GENERATION: process.env.VITE_ENABLE_BATCH_PDF === 'true'
};
```

## Security Considerations

### 1. Access Control
- All PDF operations require valid Firebase Authentication
- Role-based access to different document types
- Secure access tokens for PDF downloads
- Rate limiting to prevent abuse

### 2. Data Protection
- PDFs stored with metadata
- Automatic cleanup of old files
- Audit logging of all PDF operations
- Secure token-based download system

### 3. Monitoring & Alerts
```javascript
// Set up security monitoring
const SECURITY_MONITORING = {
  FAILED_AUTHENTICATION_RATE: '< 1%',
  SUSPICIOUS_ACTIVITY_THRESHOLD: 10, // requests per minute
  UNAUTHORIZED_ACCESS_ATTEMPTS: 0
};
```

## Troubleshooting

### 1. Common Issues & Solutions

#### Issue: "Authentication required" Error
```javascript
// Solution: Ensure user is logged in
const user = authService.getCurrentUser();
if (!user) {
  // Redirect to login or show auth modal
  navigate('/login');
  return;
}
```

#### Issue: "Rate limit exceeded"
```javascript
// Solution: Implement exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 'resource-exhausted' && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
};
```

#### Issue: "PDF generation timeout"
```javascript
// Solution: Increase timeout or optimize generation
const PDF_CONFIG = {
  timeout: 45000, // Increase timeout
  maxPages: 25,   // Reduce complexity
  quality: 'medium' // Lower quality for faster generation
};
```

### 2. Debug Tools
```javascript
// Debug mode for development
if (process.env.NODE_ENV === 'development') {
  // Enable detailed logging
  window.pdfDebug = {
    service: pdfGenerationService,
    generateTestPDF: async () => {
      const result = await pdfGenerationService.generateInvoicePDF('test-id');
      console.log('Test PDF generated:', result);
    }
  };
}
```

### 3. Emergency Procedures
```bash
# Emergency: Disable PDF generation
firebase functions:delete generateInvoicePDF
firebase functions:delete generateQuotationPDF
firebase functions:delete generateProformaPDF

# Emergency: Revert to client-side
# (Have client-side generation utilities ready as fallback)
```

## Performance Benchmarks

### 1. Expected Performance
- **PDF Generation**: < 30 seconds for standard invoices
- **File Upload**: < 5 seconds to Firebase Storage
- **Download Response**: < 2 seconds
- **Cache Hit Rate**: > 80% for repeated requests

### 2. Load Testing
```javascript
// Load testing script
const loadTest = async (concurrentUsers = 10, requests = 100) => {
  const results = [];
  for (let i = 0; i < concurrentUsers; i++) {
    const user = `test-user-${i}`;
    for (let j = 0; j < requests; j++) {
      const start = Date.now();
      try {
        const result = await pdfGenerationService.generateInvoicePDF(
          `test-invoice-${j}`
        );
        results.push({
          user,
          request: j,
          duration: Date.now() - start,
          success: true
        });
      } catch (error) {
        results.push({
          user,
          request: j,
          duration: Date.now() - start,
          success: false,
          error: error.message
        });
      }
    }
  }
  return results;
};
```

## Rollback Procedures

### 1. Quick Rollback
```bash
# If issues arise, quickly revert to previous version
firebase deploy --only functions:pdfGeneration --force

# Or completely remove server-side functions
firebase functions:delete generateInvoicePDF
firebase functions:delete generateQuotationPDF
firebase functions:delete generateProformaPDF
```

### 2. Gradual Rollback
```javascript
// Gradual rollback by implementing feature flags
const shouldUseServerPDF = FEATURE_FLAGS.SERVER_SIDE_PDF && !EMERGENCY_ROLLBACK;

if (shouldUseServerPDF) {
  return pdfGenerationService.generateInvoicePDF(invoiceId);
} else {
  return generateInvoicePDFClientSide(invoiceData, clientData);
}
```

---

## Support & Contact

For deployment support or issues:
- Check function logs: `firebase functions:log`
- Review security rules: Ensure proper authentication
- Monitor performance: Check Cloud Function metrics
- Test thoroughly: Use the provided test scripts

## Next Steps

1. ✅ Deploy Cloud Functions
2. ✅ Update frontend components
3. ✅ Test thoroughly in staging
4. ✅ Monitor production deployment
5. ✅ Gradual rollout to users
6. ✅ Remove client-side dependencies
7. ✅ Document any customizations

**Status**: Ready for production deployment 🚀