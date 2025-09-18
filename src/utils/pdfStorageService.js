import { storage, auth } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { generateInvoicePDF } from "./generateInvoicePDF";
import { generateProformaInvoicePDF } from "./generateProformaInvoicePDF";

/**
 * Generates PDF and uploads to Firebase Storage
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @param {string} type - PDF type: 'tax' or 'proforma'
 * @returns {Promise<string>} - Download URL of uploaded PDF
 */
export async function generateAndUploadInvoicePDF(invoiceData, clientData, type = 'tax') {
  try {
    console.log('🔄 Starting PDF generation...', { type, invoiceId: invoiceData?.invoice_id });

    // Check authentication
    if (!auth.currentUser) {
      throw new Error('User must be authenticated to upload PDFs');
    }

    // Validate input data
    if (!invoiceData || !clientData) {
      throw new Error('Invoice data and client data are required');
    }

    if (!invoiceData.invoice_id) {
      throw new Error('Invoice ID is required');
    }

    console.log('📄 Generating PDF document...', { type });

    // Generate PDF based on type
    const pdfDoc = type === 'proforma'
      ? await generateProformaInvoicePDF(invoiceData, clientData)
      : await generateInvoicePDF(invoiceData, clientData);

    if (!pdfDoc) {
      throw new Error('Failed to generate PDF document');
    }

    console.log('✅ PDF generated successfully, converting to blob...');

    // Convert PDF to blob
    const pdfBlob = pdfDoc.output('blob');
    
    // Create filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoices/${invoiceData.invoice_id}/${type}_invoice_${timestamp}.pdf`;

    console.log('📁 Uploading to Firebase Storage...', { filename, blobSize: pdfBlob.size });

    // Create storage reference
    const storageRef = ref(storage, filename);

    console.log('🔗 Storage reference created:', storageRef.toString());

    // Upload file with retry logic
    let uploadAttempts = 0;
    const maxAttempts = 3;
    let snapshot;

    while (uploadAttempts < maxAttempts) {
      try {
        uploadAttempts++;
        console.log(`📤 Upload attempt ${uploadAttempts}/${maxAttempts}...`);

        snapshot = await uploadBytes(storageRef, pdfBlob, {
          contentType: 'application/pdf',
          customMetadata: {
            invoiceId: invoiceData.invoice_id,
            clientId: invoiceData.client_id,
            type: type,
            createdAt: new Date().toISOString()
          }
        });

        console.log('✅ Upload successful!');
        break;

      } catch (uploadError) {
        console.error(`❌ Upload attempt ${uploadAttempts} failed:`, uploadError);

        if (uploadAttempts >= maxAttempts) {
          throw new Error(`Failed to upload after ${maxAttempts} attempts: ${uploadError.message}`);
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * uploadAttempts));
      }
    }

    console.log('🔗 Getting download URL...');

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    console.log('✅ PDF uploaded successfully!', { downloadURL });

    return downloadURL;
  } catch (error) {
    console.error('Error generating and uploading PDF:', error);
    throw new Error(`Failed to generate and upload ${type} PDF: ${error.message}`);
  }
}

/**
 * Generates both tax and proforma PDFs and uploads them
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @returns {Promise<Object>} - Object with both PDF URLs
 */
export async function generateAndUploadBothInvoicePDFs(invoiceData, clientData) {
  try {
    const [taxPdfUrl, proformaPdfUrl] = await Promise.all([
      generateAndUploadInvoicePDF(invoiceData, clientData, 'tax'),
      generateAndUploadInvoicePDF(invoiceData, clientData, 'proforma')
    ]);
    
    return {
      taxPdfUrl,
      proformaPdfUrl
    };
  } catch (error) {
    console.error('Error generating and uploading both PDFs:', error);
    throw new Error(`Failed to generate and upload PDFs: ${error.message}`);
  }
}

/**
 * Progress callback for PDF generation and upload
 * @param {Function} onProgress - Callback function to report progress
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @param {string} type - PDF type: 'tax' or 'proforma'
 * @returns {Promise<string>} - Download URL of uploaded PDF
 */
export async function generateAndUploadInvoicePDFWithProgress(invoiceData, clientData, type = 'tax', onProgress) {
  try {
    // Report progress: Starting PDF generation
    onProgress && onProgress({ stage: 'generating', progress: 10, message: `Generating ${type} invoice PDF...` });
    
    // Generate PDF
    const pdfDoc = type === 'proforma' 
      ? await generateProformaInvoicePDF(invoiceData, clientData)
      : await generateInvoicePDF(invoiceData, clientData);
    
    onProgress && onProgress({ stage: 'generated', progress: 40, message: 'PDF generated successfully...' });
    
    // Convert to blob
    const pdfBlob = pdfDoc.output('blob');
    
    onProgress && onProgress({ stage: 'uploading', progress: 60, message: 'Uploading PDF to storage...' });
    
    // Create filename and storage reference
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `invoices/${invoiceData.invoice_id}/${type}_invoice_${timestamp}.pdf`;
    const storageRef = ref(storage, filename);
    
    // Upload file
    const snapshot = await uploadBytes(storageRef, pdfBlob, {
      contentType: 'application/pdf',
      customMetadata: {
        invoiceId: invoiceData.invoice_id,
        clientId: invoiceData.client_id,
        type: type,
        createdAt: new Date().toISOString()
      }
    });
    
    onProgress && onProgress({ stage: 'uploaded', progress: 80, message: 'Getting download URL...' });
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    onProgress && onProgress({ stage: 'complete', progress: 100, message: 'PDF saved successfully!' });
    
    return downloadURL;
  } catch (error) {
    onProgress && onProgress({ stage: 'error', progress: 0, message: `Error: ${error.message}` });
    console.error('Error generating and uploading PDF:', error);
    throw error;
  }
}
