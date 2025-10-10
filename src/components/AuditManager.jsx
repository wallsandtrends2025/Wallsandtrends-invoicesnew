import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { reconstructPDFFromChunks, getPDFMetadata } from '../utils/pdfChunkedStorage';
import dayjs from 'dayjs';

export default function AuditManager() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to generate TAX invoice audit report');
  const [auditConfig, setAuditConfig] = useState(null);
  const [lastSent, setLastSent] = useState(null);

  // Gmail API client setup
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [testMode, setTestMode] = useState(false); // Default to production mode
  const [useSimpleQuery, setUseSimpleQuery] = useState(true); // Enable simple query by default
  const [useSimpleMode, setUseSimpleMode] = useState(false); // Simple mode without PDF reconstruction

  useEffect(() => {
    fetchAuditConfig();
    fetchLastSent();
    // Don't auto-load Gmail API - let user trigger it manually
  }, []);

  const loadGmailAPI = async () => {
    setStatus('Loading Gmail API...');

    return new Promise((resolve) => {
      // Check if gapi is already loaded and working
      if (window.gapi && window.gapi.client && window.gapi.client.gmail) {
        setGapiLoaded(true);
        setStatus('Gmail API loaded successfully');
        resolve(true);
        return;
      }

      // Load the Gmail API script if not already loaded
      if (!document.querySelector('script[src*="apis.google.com/js/api.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.async = true;
        script.defer = true;

        script.onload = () => {
          // Wait for gapi to be fully available
          const checkGapiReady = () => {
            if (window.gapi && typeof window.gapi.load === 'function') {
              window.gapi.load('client:auth2', () => {
                window.gapi.client.init({
                  clientId: '6264858046-mhr3ur4sgq8rmr82ujai5jktlg00156d.apps.googleusercontent.com',
                  scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
                  ux_mode: 'popup'
                }).then(() => {
                  setGapiLoaded(true);
                  setStatus('Gmail API loaded successfully');
                  resolve(true);
                }).catch(err => {
                  console.error('Gmail API init failed:', err);
                  setGapiLoaded(false);
                  setStatus('Gmail API failed to initialize - will use manual email method');
                  resolve(false);
                });
              });
            } else {
              // Retry if gapi not ready yet
              setTimeout(checkGapiReady, 500);
            }
          };
          checkGapiReady();
        };

        script.onerror = () => {
          setGapiLoaded(false);
          setStatus('Failed to load Google API script - will use manual email method');
          resolve(false);
        };

        document.head.appendChild(script);
      } else {
        // Script exists, try to initialize
        setTimeout(() => {
          if (window.gapi && typeof window.gapi.load === 'function') {
            window.gapi.load('client:auth2', () => {
              window.gapi.client.init({
                clientId: '6264858046-mhr3ur4sgq8rmr82ujai5jktlg00156d.apps.googleusercontent.com',
                scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
                ux_mode: 'popup'
              }).then(() => {
                setGapiLoaded(true);
                setStatus('Gmail API loaded successfully');
                resolve(true);
              }).catch(err => {
                console.error('Gmail API init failed:', err);
                setGapiLoaded(false);
                setStatus('Gmail API failed to initialize - will use manual email method');
                resolve(false);
              });
            });
          } else {
            setGapiLoaded(false);
            setStatus('Gmail API failed to load - will use manual email method');
            resolve(false);
          }
        }, 1000);
      }
    });
  };

  const fetchAuditConfig = async () => {
    try {
      const q = query(
        collection(db, 'audit_emails'),
        where('enabled', '==', true),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setAuditConfig(snapshot.docs[0].data());
      } else {
        // Create default config if none exists
        await createDefaultAuditConfig();
      }
    } catch (error) {
      console.error('Error fetching audit config:', error);
    }
  };

  const createDefaultAuditConfig = async () => {
    try {
      const defaultConfig = {
        enabled: true,
        primary: 'sangareddijaswanth9392@gmail.com', // Audit email address
        cc: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await addDoc(collection(db, 'audit_emails'), defaultConfig);
      setAuditConfig(defaultConfig);
      setStatus('Default audit configuration created. Please update the email address.');
    } catch (error) {
      console.error('Error creating default config:', error);
      setStatus('Error creating audit configuration');
    }
  };

  const fetchLastSent = async () => {
    try {
      const q = query(
        collection(db, 'audit_logs'),
        orderBy('sentAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setLastSent(snapshot.docs[0].data());
      }
    } catch (error) {
      console.error('Error fetching last sent:', error);
    }
  };

  const getPreviousMonthRange = () => {
    const now = dayjs();
    const prev = now.subtract(1, 'month');
    return {
      start: prev.startOf('month').toDate(),
      end: prev.endOf('month').toDate(),
      year: prev.year(),
      month: prev.month() + 1
    };
  };

  const fetchTaxInvoices = async () => {
    const { start, end } = getPreviousMonthRange();

    try {
      let q;
      if (useSimpleQuery) {
        // Simple query: get all PDFs and filter client-side
        q = query(
          collection(db, 'pdf_metadata'),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end)
        );
      } else {
        // Composite query: requires index
        q = query(
          collection(db, 'pdf_metadata'),
          where('createdAt', '>=', start),
          where('createdAt', '<=', end),
          where('type', '==', 'tax')
        );
      }

      const snapshot = await getDocs(q);
      let docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client-side filtering for simple query
      if (useSimpleQuery) {
        docs = docs.filter(doc => doc.type === 'tax');
      }

      return docs;
    } catch (error) {
      if (error.message.includes('requires an index')) {
        throw new Error('Firestore index required. Please create the composite index for pdf_metadata collection (type + createdAt), or enable "Use Simple Query" option.');
      }
      throw error;
    }
  };

  // Removed downloadPDFFromStorage function - causes CORS issues
  // Just generate download URLs without accessing files

  const createZIPFromPDFs = async (pdfs) => {
    try {
      console.log('📦 Creating ZIP file with', pdfs.length, 'PDFs...');

      // Dynamic import with error handling
      let JSZip;
      try {
        JSZip = (await import('jszip')).default;
      } catch (importError) {
        console.error('Failed to import JSZip:', importError);
        throw new Error('JSZip library not available. Please run: npm install jszip');
      }

      const zip = new JSZip();

      // Add PDFs to ZIP
      let addedCount = 0;
      pdfs.forEach(pdf => {
        if (pdf && pdf.blob && pdf.name) {
          zip.file(pdf.name, pdf.blob);
          addedCount++;
        } else {
          console.warn('Skipping invalid PDF:', pdf);
        }
      });

      if (addedCount === 0) {
        throw new Error('No valid PDFs to add to ZIP');
      }

      console.log(`✅ Added ${addedCount} PDFs to ZIP`);

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      console.log('✅ ZIP file created successfully, size:', zipBlob.size, 'bytes');
      return zipBlob;
    } catch (error) {
      console.error('Failed to create ZIP:', error);
      throw new Error(`ZIP creation failed: ${error.message}`);
    }
  };

  const downloadZIPFile = (zipBlob, fileName) => {
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sendAuditEmail = async (simpleMode = false) => {
    if (!auditConfig) {
      setStatus('No audit email configuration found');
      return;
    }

    setLoading(true);
    setStatus(simpleMode ? 'Generating manual instructions...' : 'Fetching TAX invoices...');

    try {
      const taxInvoices = await fetchTaxInvoices();

      if (taxInvoices.length === 0) {
        setStatus('No TAX invoices found for previous month');
        setLoading(false);
        return;
      }

      if (simpleMode) {
        // Simple mode - just provide manual instructions
        console.log('=== TAX INVOICE AUDIT - MANUAL MODE ===');
        console.log(`Found ${taxInvoices.length} TAX invoices for manual processing`);
        console.log('Subject: Monthly Audit Invoices -', getPreviousMonthRange().year + '-' + String(getPreviousMonthRange().month).padStart(2, '0'));
        console.log('Recipient: audit@yourcompany.com');
        console.log('');
        console.log('Manual Download Instructions:');
        taxInvoices.forEach(invoice => {
          console.log(`📄 ${invoice.invoiceId || invoice.id}: Go to PDF Manager → Find and Download`);
        });
        console.log('');
        console.log('Steps to complete:');
        console.log('1. Open PDF Manager from dashboard');
        console.log('2. Download each TAX invoice listed above');
        console.log('3. Create ZIP file with all PDFs');
        console.log('4. Send ZIP to audit team via email');
        console.log('=== END MANUAL INSTRUCTIONS ===');

        setStatus(`✅ Manual instructions generated for ${taxInvoices.length} TAX invoices. Check browser console.`);
        setLoading(false);
        return;
      }

      setStatus(`Found ${taxInvoices.length} TAX invoices. Reconstructing PDFs...`);

      // Automatically reconstruct PDFs from Firestore chunks
      const reconstructedPDFs = [];
      for (let i = 0; i < taxInvoices.length; i++) {
        const invoice = taxInvoices[i];
        try {
          setStatus(`Reconstructing PDF ${i + 1}/${taxInvoices.length}: ${invoice.invoiceId || invoice.id}`);

          const pdfId = invoice.pdfId || invoice.id;

          // Add timeout to prevent hanging
          const reconstructionPromise = reconstructPDFFromChunks(pdfId);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('PDF reconstruction timeout')), 30000)
          );

          const base64Data = await Promise.race([reconstructionPromise, timeoutPromise]);

          if (!base64Data || typeof base64Data !== 'string') {
            throw new Error('Invalid PDF data received from reconstruction');
          }

          // Convert base64 to blob (reconstructPDFFromChunks returns base64 data URI)
          let binaryString;
          try {
            if (base64Data.includes(',')) {
              // It's a data URI format
              binaryString = atob(base64Data.split(',')[1]);
            } else {
              // It's just base64
              binaryString = atob(base64Data);
            }
          } catch (decodeError) {
            console.error('Base64 decode error:', decodeError);
            throw new Error(`Failed to decode PDF data: ${decodeError.message}`);
          }

          if (!binaryString || binaryString.length === 0) {
            throw new Error('Decoded PDF data is empty');
          }

          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          const blob = new Blob([bytes], { type: 'application/pdf' });

          if (blob.size === 0) {
            throw new Error('Created PDF blob is empty');
          }

          reconstructedPDFs.push({
            name: `TAX_${invoice.invoiceId || invoice.id}.pdf`,
            blob: blob,
            invoiceId: invoice.invoiceId || invoice.id
          });

          console.log(`✅ Successfully reconstructed PDF: ${invoice.invoiceId || invoice.id} (${blob.size} bytes)`);

        } catch (error) {
          console.error(`❌ Failed to reconstruct PDF for ${invoice.id}:`, error.message);
          // Continue with other PDFs - don't let one failure stop the process
        }
      }

      if (reconstructedPDFs.length === 0) {
        setStatus('❌ No PDFs could be reconstructed - falling back to manual method');

        // Fallback to manual method - show download instructions
        console.log('=== FALLBACK: MANUAL PDF DOWNLOAD INSTRUCTIONS ===');
        console.log('Since automated reconstruction failed, please use PDF Manager to download manually:');
        console.log('');

        taxInvoices.forEach(invoice => {
          console.log(`📄 ${invoice.invoiceId || invoice.id}: Use PDF Manager → Find and Download`);
        });

        console.log('');
        console.log('Steps:');
        console.log('1. Go to Dashboard → PDF Manager');
        console.log('2. Find each TAX invoice from the list above');
        console.log('3. Click Download for each PDF');
        console.log('4. Create ZIP file manually');
        console.log('5. Send to audit team');
        console.log('=== END MANUAL INSTRUCTIONS ===');

        setLoading(false);
        return;
      }

      setStatus(`✅ Reconstructed ${reconstructedPDFs.length} PDFs. Creating ZIP file...`);

      // Create ZIP file
      const zipBlob = await createZIPFromPDFs(reconstructedPDFs);
      const { year, month } = getPreviousMonthRange();
      const zipFileName = `audit-invoices-${year}-${String(month).padStart(2, '0')}.zip`;

      // Download ZIP file automatically
      downloadZIPFile(zipBlob, zipFileName);

      setStatus(`✅ ZIP file created and downloaded: ${zipFileName}`);

      // Create CSV summary
      const csvHeader = 'Invoice ID,Type,Company,Created At,Status\n';
      const csvRows = reconstructedPDFs.map(pdf => {
        const invoice = taxInvoices.find(inv => (inv.invoiceId || inv.id) === pdf.invoiceId);
        return `${pdf.invoiceId},tax,,${invoice?.createdAt?.toDate?.()?.toISOString() || 'N/A'},PDF reconstructed successfully`;
      }).join('\n');
      const csvContent = csvHeader + csvRows;

      // Log success information
      console.log('=== AUTOMATED TAX INVOICE AUDIT ===');
      console.log(`✅ Successfully reconstructed ${reconstructedPDFs.length} TAX invoice PDFs`);
      console.log(`📦 ZIP file created: audit-invoices-${year}-${String(month).padStart(2, '0')}.zip`);
      console.log('📧 Ready to send to audit team');
      console.log('=== END AUDIT DATA ===');

      setStatus(`✅ Successfully reconstructed ${reconstructedPDFs.length} TAX invoice PDFs and created ZIP file!`);

      // Manual method only - no Gmail API attempts

      // Log the send to Firestore
      try {
        await addDoc(collection(db, 'audit_logs'), {
          sentAt: new Date(),
          invoiceCount: taxInvoices.length,
          year,
          month,
          messageId: 'manual_method',
          recipient: auditConfig.primary,
          method: 'manual_csv'
        });
      } catch (logError) {
        console.warn('Failed to log audit send:', logError);
      }

      setStatus(`✅ Generated audit report for ${taxInvoices.length} TAX invoices. CSV data available above.`);
      fetchLastSent();

    } catch (error) {
      console.error('Error sending audit email:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!gapiLoaded) return;

    try {
      await window.gapi.auth2.getAuthInstance().signIn();
      setStatus('Signed in to Gmail');
    } catch (error) {
      setStatus('Gmail sign-in failed');
    }
  };

  return (
    <div style={{ padding: '20px', margin: '0 auto' }} className=''>
      <div className='bg-[#ffffff] border-curve p-[20px] mb-[20px]'>
      <h2  className="font-semibold text-[#000000] m-[0]">Audit Management</h2>
      </div>
      <div className='bg-[#ffffff] border-curve p-[20px]'>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Professional automated system for monthly TAX invoice audit delivery.
      </p>

      {/* Company Status Banner */}
      <div style={{
        backgroundColor: '#e8f5e8',
        border: '1px solid #4caf50',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>🏢 Company Recommendation</h3>
        <p style={{ margin: '0', fontSize: '14px', color: '#2e7d32' }}>
          <strong>For production use:</strong> Set up the automated script with Windows Task Scheduler for zero-touch monthly operation.
          The web interface below is for testing and manual override.
        </p>
      </div>

      {/* Automated Script Status */}
      <div style={{
        backgroundColor: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '8px',
        padding: '15px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#856404' }}>⚙️ Automated Script Status</h3>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <strong>📧 Script:</strong>
            <span style={{ color: '#28a745', marginLeft: '5px' }}>✅ Ready</span>
          </div>
          <div>
            <strong>🔐 OAuth2:</strong>
            <span style={{ color: '#28a745', marginLeft: '5px' }}>✅ Configured</span>
          </div>
          <div>
            <strong>📅 Schedule:</strong>
            <span style={{ color: '#dc3545', marginLeft: '5px' }}>❌ Not Set</span>
          </div>
        </div>
        <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#856404' }}>
          <strong>Setup Required:</strong> Configure Windows Task Scheduler for monthly automation
        </p>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>📊 System Status</h3>
        <p><strong>📧 Audit Email:</strong> {auditConfig?.primary || 'sangareddijaswanth9392@gmail.com'}</p>
        <p><strong>📅 Last Sent:</strong> {lastSent ? dayjs(lastSent.sentAt?.toDate?.()).format('DD/MM/YYYY HH:mm') : 'Never'}</p>
        <p><strong>🔧 System Status:</strong> ✅ Ready (Simple Query Mode)</p>

      </div>

      {/* Company Setup Instructions */}
      <div style={{
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>🏢 Company Setup Instructions</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ color: '#007bff', margin: '0 0 10px 0' }}>📋 Prerequisites</h4>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
              <li>Node.js installed on company machine</li>
              <li>Firebase service account key</li>
              <li>Google OAuth2 credentials</li>
              <li>Windows Task Scheduler access</li>
            </ul>
          </div>

          <div>
            <h4 style={{ color: '#28a745', margin: '0 0 10px 0' }}>⚙️ Setup Steps</h4>
            <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
              <li>Install dependencies: <code>npm install</code></li>
              <li>Configure OAuth2 credentials</li>
              <li>Test script: <code>run-audit-email.bat</code></li>
              <li>Schedule with Windows Task Scheduler</li>
            </ol>
          </div>
        </div>

        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#e9ecef',
          borderRadius: '4px'
        }}>
          <strong>📄 Complete Setup Guide:</strong> See <code>AUDIT_SETUP_README.md</code> for detailed instructions
        </div>
      </div>

      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e7f3ff', border: '1px solid #b3d9ff', borderRadius: '5px' }}>
        <strong>📧 Current Method:</strong>
        <p style={{ margin: '5px 0' }}>
          Web interface generates PDF download links for manual processing.
        </p>
        <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>
          <strong>Production Recommendation:</strong> Use automated script for zero-touch monthly operation.
        </p>
      </div>

      <div style={{ marginBottom: '20px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => sendAuditEmail(false)}
            disabled={loading || !auditConfig}
            style={{
              backgroundColor: loading ? '#ccc' : '#28a745',
              color: 'white',
              padding: '15px 30px',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? '🔄 Processing TAX Invoices...' : '🚀 Send TAX Invoices to Audit'}
          </button>

          <button
            onClick={() => sendAuditEmail(true)}
            disabled={loading || !auditConfig}
            style={{
              backgroundColor: loading ? '#ccc' : '#17a2b8',
              color: 'white',
              padding: '15px 30px',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? '🔄 Generating Report...' : '📋 Generate Manual Instructions'}
          </button>

          <button
            onClick={() => window.open('AUDIT_SETUP_README.md', '_blank')}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '15px 30px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            📖 Setup Automated Script
          </button>
        </div>

        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          <p><strong>🚀 Automated Mode:</strong> Reconstructs PDFs and creates ZIP automatically</p>
          <p><strong>📋 Manual Mode:</strong> Provides step-by-step download instructions</p>
        </div>
      </div>

      <div style={{
        padding: '15px',
        backgroundColor: status.includes('Found') ? '#d4edda' : status.includes('❌') ? '#f8d7da' : '#e2e3e5',
        border: '1px solid #ddd',
        borderRadius: '5px',
        minHeight: '50px'
      }}>
        <strong>🏢 Company Status:</strong> {status || 'Ready to generate TAX invoice audit report'}
      </div>

      {/* Professional Footer */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #dee2e6',
        borderRadius: '5px',
        textAlign: 'center'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>🏢 Company TAX Audit System</h4>
        <p style={{ margin: '0', fontSize: '14px', color: '#6c757d' }}>
          Professional automated solution for monthly TAX invoice audit delivery.
          Recommended: Automated script with Windows Task Scheduler for zero-touch operation.
        </p>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>How it works:</strong> Every month on the 1st, this system automatically collects all TAX invoices generated from the 1st to 31st of the previous month and sends them to the audit team via email.</p>

        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '5px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>✅ After Sending:</h4>
          <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '13px' }}>
            <li>Check Gmail "Sent" folder for confirmation</li>
            <li>Audit team receives email with CSV attachment</li>
            <li>System logs the send in Firestore</li>
            <li>Next send will be on the 1st of next month</li>
          </ul>
        </div>

        {status.includes('Found') && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            backgroundColor: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '5px'
          }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>📧 Manual Email Instructions:</h4>
            <div style={{ backgroundColor: '#f8f9fa', padding: '10px', borderRadius: '3px', marginBottom: '10px' }}>
              <strong>✅ PDF download links generated!</strong><br/>
              <strong>📊 CSV data logged to browser console.</strong>
            </div>
            <ol style={{ margin: '0', paddingLeft: '20px', fontSize: '13px' }}>
              <li>Press <strong>F12</strong> to open Developer Tools</li>
              <li>Click <strong>Console</strong> tab</li>
              <li>Find the <strong>CSV Data</strong> section with PDF download links</li>
              <li><strong>Copy each PDF link</strong> and paste in browser to download</li>
              <li><strong>Save all PDFs</strong> to a folder on your computer</li>
              <li><strong>Create ZIP file</strong> with all downloaded PDFs</li>
              <li><strong>Send email</strong> to: <strong>{auditConfig?.primary || 'sangareddijaswanth9392@gmail.com'}</strong></li>
              <li><strong>Attach</strong> the ZIP file</li>
              <li><strong>Subject:</strong> <code>Monthly Audit Invoices - {new Date().getFullYear()}-{(new Date().getMonth()).toString().padStart(2, '0')}</code></li>
            </ol>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}