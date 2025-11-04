import { generateTestInvoicePDF } from './src/utils/generateInvoicePDF.js';

async function testLayout() {
  try {
    console.log('Testing PDF layout after spacing reductions...');
    const doc = await generateTestInvoicePDF();

    // Save the PDF to check
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);

    console.log('PDF generated successfully. Blob URL:', url);
    console.log('PDF size:', pdfBlob.size, 'bytes');

    // You can open this URL in browser to view the PDF
    // For now, just log that it was created
    console.log('Test completed - PDF layout should now fit within page boundaries');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testLayout();