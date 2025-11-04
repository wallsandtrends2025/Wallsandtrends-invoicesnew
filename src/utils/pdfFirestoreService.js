import { db } from "../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { generateInvoicePDF } from "./generateInvoicePDF";
import { generateProformaInvoicePDF } from "./generateProformaInvoicePDF";

/**
 * Generates PDF and saves to Firestore as base64 data
 * This is a fallback solution when Firebase Storage has CORS issues
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @param {string} type - PDF type: 'tax' or 'proforma'
 * @returns {Promise<string>} - Base64 PDF data
 */
export async function generateAndSavePDFToFirestore(invoiceData, clientData, type = 'tax') {
  try {
    console.log('🔄 Starting PDF generation for Firestore...', { type, invoiceId: invoiceData?.invoice_id });
    
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

    console.log('✅ PDF generated successfully, converting to base64...');

    // Convert PDF to base64
    const pdfBase64 = pdfDoc.output('datauristring'); // Returns data:application/pdf;base64,{base64data}
    
    // Create document ID for the PDF
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfDocId = `${invoiceData.invoice_id}_${type}_${timestamp}`;
    
    console.log('💾 Saving PDF to Firestore...', { pdfDocId });
    
    // Save PDF data to Firestore
    const pdfData = {
      invoiceId: invoiceData.invoice_id,
      clientId: invoiceData.client_id,
      type: type,
      pdfBase64: pdfBase64,
      createdAt: new Date(),
      filename: `${type}_invoice_${timestamp}.pdf`,
      size: pdfBase64.length
    };
    
    await setDoc(doc(db, "invoice_pdfs", pdfDocId), pdfData);
    
    console.log('✅ PDF saved to Firestore successfully!', { pdfDocId });
    
    // Return the document ID which can be used to retrieve the PDF
    return pdfDocId;
    
  } catch (error) {
    console.error('Error generating and saving PDF to Firestore:', error);
    throw new Error(`Failed to generate and save ${type} PDF: ${error.message}`);
  }
}

/**
 * Generates both tax and proforma PDFs and saves them to Firestore
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @returns {Promise<Object>} - Object with both PDF document IDs
 */
export async function generateAndSaveBothPDFsToFirestore(invoiceData, clientData) {
  try {
    console.log('🔄 Generating both PDFs for Firestore...');
    
    const [taxPdfId, proformaPdfId] = await Promise.all([
      generateAndSavePDFToFirestore(invoiceData, clientData, 'tax'),
      generateAndSavePDFToFirestore(invoiceData, clientData, 'proforma')
    ]);
    
    return {
      taxPdfId,
      proformaPdfId
    };
  } catch (error) {
    console.error('Error generating and saving both PDFs to Firestore:', error);
    throw new Error(`Failed to generate and save PDFs: ${error.message}`);
  }
}

/**
 * Retrieves PDF from Firestore and triggers download
 * @param {string} pdfDocId - The PDF document ID
 * @returns {Promise<void>}
 */
export async function downloadPDFFromFirestore(pdfDocId) {
  try {
    console.log('📥 Downloading PDF from Firestore...', { pdfDocId });

    const pdfDoc = await getDoc(doc(db, "invoice_pdfs", pdfDocId));

    if (!pdfDoc.exists()) {
      throw new Error('PDF not found');
    }

    const pdfData = pdfDoc.data();

    console.log('✅ PDF found in Firestore, preparing download...', {
      filename: pdfData.filename,
      size: pdfData.size,
      type: pdfData.type
    });

    // Create download link
    const link = document.createElement('a');
    link.href = pdfData.pdfBase64;
    link.download = pdfData.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ PDF downloaded successfully from Firestore!', { filename: pdfData.filename });

  } catch (error) {
    console.error('Error downloading PDF from Firestore:', error);
    throw error;
  }
}
