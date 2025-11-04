import { db } from "../firebase";
import { doc, setDoc, getDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";

// Firestore document size limited so  ~1MB,   we'll use 800KB chunks to be safe 
const CHUNK_SIZE = 800 * 1024; // 800KB in bytes

/**
 * Splits base64 data into chunks that fit within Firestore limits
 * @param {string} base64Data - The base64 encoded PDF data
 * @param {string} pdfId - Unique identifier for the PDF
 * @returns {Array} Array of chunk objects
 */
function createChunks(base64Data, pdfId) {
  const chunks = [];
  const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, base64Data.length);
    const chunkData = base64Data.slice(start, end);
    
    chunks.push({
      pdfId: pdfId,
      chunkIndex: i,
      totalChunks: totalChunks,
      data: chunkData,
      createdAt: new Date()
    });
  }
  
  return chunks;
}

/**
 * Saves PDF chunks to Firestore
 * @param {Array} chunks - Array of chunk objects
 * @returns {Promise<void>}
 */
async function saveChunksToFirestore(chunks) {
  const promises = chunks.map(chunk => 
    setDoc(doc(db, "pdf_chunks", `${chunk.pdfId}_chunk_${chunk.chunkIndex}`), chunk)
  );
  
  await Promise.all(promises);
}

/**
 * Generates PDF and saves it in chunks to Firestore
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @param {string} type - PDF type: 'tax' or 'proforma'
 * @param {string} selectedCurrency - The selected currency for PDF display
 * @returns {Promise<string>} - PDF document ID
 */
export async function generateAndSaveChunkedPDF(invoiceData, clientData, type = 'tax', selectedCurrency = 'INR') {
  try {
    console.log('🔄 Starting chunked PDF generation...', { type, invoiceId: invoiceData?.invoice_id });
    
    // Validate input data
    if (!invoiceData || !clientData) {
      throw new Error('Invoice data and client data are required');
    }

    if (!invoiceData.invoice_id) {
      throw new Error('Invoice ID is required');
    }

    // Validate essential invoice fields
    if (!invoiceData.invoice_type) {
      throw new Error('Invoice type is required');
    }

    if (!invoiceData.services || !Array.isArray(invoiceData.services) || invoiceData.services.length === 0) {
      throw new Error('Invoice must have at least one service');
    }

    // Validate client data
    if (!clientData.client_name) {
      throw new Error('Client name is required');
    }

    console.log('✅ Input validation passed', { 
      invoiceId: invoiceData.invoice_id,
      invoiceType: invoiceData.invoice_type,
      servicesCount: invoiceData.services?.length,
      clientName: clientData.client_name
    });

    console.log('📄 Generating PDF document...', { type });
    
    // Generate PDF based on type with better error handling
    let pdfDoc;
    try {
      console.log('📄 Calling PDF generation function...', { 
        type, 
        hasInvoiceData: !!invoiceData,
        hasClientData: !!clientData,
        invoiceDataKeys: Object.keys(invoiceData || {}),
        clientDataKeys: Object.keys(clientData || {})
      });

      // Dynamic import to avoid conflicts with other dynamic imports
      const { generateInvoicePDF } = await import('./generateInvoicePDF');
      const { generateProformaInvoicePDF } = await import('./generateProformaInvoicePDF');

      pdfDoc = type === 'proforma'
        ? await generateProformaInvoicePDF(invoiceData, clientData, { displayCurrency: selectedCurrency })
        : await generateInvoicePDF(invoiceData, clientData, { displayCurrency: selectedCurrency });

      if (!pdfDoc) {
        throw new Error('PDF generation function returned null or undefined');
      }

      // Validate that we have a proper jsPDF document
      if (typeof pdfDoc.output !== 'function') {
        console.error('❌ Invalid PDF document structure:', {
          pdfDocType: typeof pdfDoc,
          pdfDocKeys: Object.keys(pdfDoc || {}),
          hasOutput: typeof pdfDoc?.output,
          pdfDocConstructor: pdfDoc?.constructor?.name
        });
        throw new Error('Invalid PDF document - missing output method');
      }

      console.log('✅ PDF generated successfully, converting to base64...', {
        pdfDocType: typeof pdfDoc,
        hasOutput: typeof pdfDoc.output === 'function',
        constructor: pdfDoc.constructor?.name
      });

    } catch (pdfError) {
      console.error('❌ PDF generation failed:', {
        error: pdfError,
        message: pdfError.message,
        stack: pdfError.stack,
        invoiceData: {
          invoice_id: invoiceData?.invoice_id,
          invoice_type: invoiceData?.invoice_type,
          services: invoiceData?.services?.length
        },
        clientData: {
          client_name: clientData?.client_name,
          country: clientData?.country,
          state: clientData?.state
        }
      });
      throw new Error(`Failed to generate PDF document: ${pdfError.message}`);
    }

    // Convert PDF to base64
    let pdfBase64;
    try {
      // Try different output methods to ensure compatibility with jsPDF
      let rawBase64;
      try {
        // Method 1: Try datauristring (most common for jsPDF 3.x)
        rawBase64 = pdfDoc.output('datauristring');
        console.log('✅ Used datauristring method');
      } catch (e) {
        console.warn('datauristring method failed, trying alternative:', e.message);
        try {
          // Method 2: Try datauri
          rawBase64 = pdfDoc.output('datauri');
          console.log('✅ Used datauri method');
        } catch (e2) {
          console.warn('datauri method failed, trying base64:', e2.message);
          try {
            // Method 3: Get raw base64 and construct data URI manually
            const base64Only = pdfDoc.output('base64');
            rawBase64 = `data:application/pdf;base64,${base64Only}`;
            console.log('✅ Used base64 method with manual data URI construction');
          } catch (e3) {
            console.warn('base64 method failed, trying arraybuffer:', e3.message);
            // Method 4: Last resort - use arraybuffer and convert
            const arrayBuffer = pdfDoc.output('arraybuffer');
            const uint8Array = new Uint8Array(arrayBuffer);
            let binaryString = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }
            const base64String = btoa(binaryString);
            rawBase64 = `data:application/pdf;base64,${base64String}`;
            console.log('✅ Used arraybuffer method with manual conversion');
          }
        }
      }

      pdfBase64 = rawBase64;
      
      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        throw new Error('PDF output is empty or invalid');
      }

      // Ensure we have a proper data URI format
      if (!pdfBase64.startsWith('data:application/pdf;base64,')) {
        console.warn('Unexpected PDF format, attempting to fix:', pdfBase64.substring(0, 100));
        // If it's just base64 without data URI prefix, add it
        if (!pdfBase64.startsWith('data:')) {
          pdfBase64 = `data:application/pdf;base64,${pdfBase64}`;
        }
      }
      
      console.log('📄 PDF base64 conversion successful', { 
        outputLength: pdfBase64.length,
        startsWithDataUri: pdfBase64.startsWith('data:application/pdf;base64,'),
        format: pdfBase64.substring(0, 50) + '...'
      });
      
    } catch (conversionError) {
      console.error('❌ PDF to base64 conversion failed:', conversionError);
      console.error('Available output methods:', Object.getOwnPropertyNames(pdfDoc));
      throw new Error(`Failed to convert PDF to base64: ${conversionError.message}`);
    }
    
    // Create unique PDF ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfId = `${invoiceData.invoice_id}_${type}_${timestamp}`;
    
    console.log('📦 Creating chunks...', { 
      pdfId, 
      originalSize: pdfBase64.length,
      estimatedChunks: Math.ceil(pdfBase64.length / CHUNK_SIZE)
    });
    
    // Create chunks
    const chunks = createChunks(pdfBase64, pdfId);
    
    console.log('💾 Saving chunks to Firestore...', { totalChunks: chunks.length });
    
    // Save chunks to Firestore
    await saveChunksToFirestore(chunks);
    
    // Save PDF metadata
    const pdfMetadata = {
      pdfId: pdfId,
      invoiceId: invoiceData.invoice_id,
      clientId: invoiceData.client_id,
      type: type,
      // Include company info for audit CSV and filtering/reporting
      company: invoiceData.invoice_type || invoiceData.company || invoiceData.company_name || "",
      invoice_type: invoiceData.invoice_type || "",
      filename: `${type}_invoice_${timestamp}.pdf`,
      totalChunks: chunks.length,
      originalSize: pdfBase64.length,
      createdAt: new Date()
    };
    
    await setDoc(doc(db, "pdf_metadata", pdfId), pdfMetadata);
    
    console.log('✅ Chunked PDF saved successfully!', { pdfId, chunks: chunks.length });
    
    return pdfId;
    
  } catch (error) {
    console.error('Error generating and saving chunked PDF:', error);
    throw new Error(`Failed to generate and save ${type} PDF: ${error.message}`);
  }
}

/**
 * Generates both tax and proforma PDFs and saves them in chunks
 * @param {Object} invoiceData - The invoice data
 * @param {Object} clientData - The client data
 * @param {string} selectedCurrency - The selected currency for PDF display
 * @returns {Promise<Object>} - Object with both PDF IDs
 */
export async function generateAndSaveBothChunkedPDFs(invoiceData, clientData, selectedCurrency = 'INR') {
  try {
    console.log('🔄 Generating both chunked PDFs...', { selectedCurrency });

    const [taxPdfId, proformaPdfId] = await Promise.all([
      generateAndSaveChunkedPDF(invoiceData, clientData, 'tax', selectedCurrency),
      generateAndSaveChunkedPDF(invoiceData, clientData, 'proforma', selectedCurrency)
    ]);

    return {
      taxPdfId,
      proformaPdfId
    };
  } catch (error) {
    console.error('Error generating and saving both chunked PDFs:', error);
    throw new Error(`Failed to generate and save PDFs: ${error.message}`);
  }
}

/**
 * Retrieves and reconstructs PDF from chunks, then triggers download
 * @param {string} pdfId - The PDF document ID
 * @returns {Promise<void>}
 */
export async function downloadChunkedPDF(pdfId) {
  try {
    console.log('📥 Downloading chunked PDF...', { pdfId });

    const reconstructedBase64 = await reconstructPDFFromChunks(pdfId);
    const metadata = await getPDFMetadata(pdfId);

    // Create download link
    const link = document.createElement('a');
    link.href = reconstructedBase64;
    link.download = metadata.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('✅ PDF downloaded successfully!');

  } catch (error) {
    console.error('Error downloading chunked PDF:', error);
    throw error;
  }
}

/**
 * Retrieves and reconstructs PDF from chunks for viewing
 * @param {string} pdfId - The PDF document ID
 * @returns {Promise<string>} - Base64 data URL for the PDF
 */
export async function reconstructPDFFromChunks(pdfId) {
  try {
    console.log('🔧 Reconstructing PDF from chunks...', { pdfId });

    // Get PDF metadata
    const metadata = await getPDFMetadata(pdfId);

    // Get all chunks - using a simpler approach to avoid index requirements
    const chunksQuery = query(
      collection(db, "pdf_chunks"),
      where("pdfId", "==", pdfId)
    );

    const chunksSnapshot = await getDocs(chunksQuery);
    const chunks = chunksSnapshot.docs.map(doc => doc.data());

    if (chunks.length !== metadata.totalChunks) {
      throw new Error(`Missing chunks: expected ${metadata.totalChunks}, found ${chunks.length}`);
    }

    console.log('🔧 Reconstructing PDF...', { chunks: chunks.length });

    // Reconstruct the base64 data
    const reconstructedBase64 = chunks
      .sort((a, b) => a.chunkIndex - b.chunkIndex)
      .map(chunk => chunk.data)
      .join('');

    console.log('✅ PDF reconstructed successfully!');

    return reconstructedBase64;

  } catch (error) {
    console.error('Error reconstructing PDF:', error);
    throw error;
  }
}

/**
 * Gets PDF metadata
 * @param {string} pdfId - The PDF document ID
 * @returns {Promise<Object>} - PDF metadata
 */
export async function getPDFMetadata(pdfId) {
  const metadataDoc = await getDoc(doc(db, "pdf_metadata", pdfId));
  if (!metadataDoc.exists()) {
    throw new Error('PDF metadata not found');
  }
  return metadataDoc.data();
}

/**
 * Opens PDF in a new browser tab for viewing
 * @param {string} pdfId - The PDF document ID
 * @returns {Promise<void>}
 */
export async function viewChunkedPDF(pdfId) {
  try {
    console.log('👁️ Opening PDF for viewing...', { pdfId });

    const reconstructedBase64 = await reconstructPDFFromChunks(pdfId);

    // Open PDF in new tab
    const newWindow = window.open();
    newWindow.document.write(`
      <html>
        <head>
          <title>PDF Viewer</title>
          <style>
            body { margin: 0; padding: 0; }
            iframe { width: 100%; height: 100vh; border: none; }
          </style>
        </head>
        <body>
          <iframe src="${reconstructedBase64}" type="application/pdf"></iframe>
        </body>
      </html>
    `);

    console.log('✅ PDF opened for viewing!');

  } catch (error) {
    console.error('Error viewing PDF:', error);
    throw error;
  }
}
