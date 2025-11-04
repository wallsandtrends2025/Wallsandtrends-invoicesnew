// Test script for Walls And Trends Proforma Invoice Generation
import { testProformaPDFFixes } from './src/utils/generateProformaInvoicePDF.js';
import fs from 'fs';
import path from 'path';

// Mock browser environment for jsPDF
global.window = {
  location: { origin: '' }
};
global.navigator = {};
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

async function testPDFGeneration() {
  try {
    console.log('🧪 Testing Walls And Trends Proforma Invoice Generation...');
    console.log('📄 Invoice Details:');
    console.log('   Company: Walls And Trends');
    console.log('   Proforma Number: WT2509PRF034');
    console.log('   Title: Quotation for Nenu Ready');
    console.log('   Customer: Harniks India LLP');
    console.log('   Customer GST: 37AAJH7994P1Z7');
    console.log('   Services: Teaser/Trailer (₹3,50,000) + Lyrical Videos (₹2,00,000)');
    console.log('   Gross Amount: ₹5,50,000.00');
    console.log('   IGST (18%): ₹99,000.00');
    console.log('   Total Amount: ₹6,49,000.00');

    const doc = await testProformaPDFFixes();

    // Save PDF to file
    const outputPath = path.join(process.cwd(), 'WT2509PRF034_Proforma_Invoice.pdf');
    const pdfBytes = doc.output('arraybuffer');

    fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

    console.log('✅ PDF generated successfully!');
    console.log(`📁 Saved as: ${outputPath}`);
    console.log(`📊 PDF size: ${fs.statSync(outputPath).size} bytes`);

    return true;
  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    console.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the test
testPDFGeneration()
  .then((success) => {
    if (success) {
      console.log('🎉 Test completed successfully!');
    } else {
      console.log('💥 Test failed!');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });