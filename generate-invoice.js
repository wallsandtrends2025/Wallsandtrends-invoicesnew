import { generateTestInvoicePDF } from './src/utils/generateInvoicePDF.js';
import fs from 'fs';

async function main() {
  try {
    const doc = await generateTestInvoicePDF();
    const pdfBytes = doc.output('arraybuffer');
    fs.writeFileSync('invoice-236.pdf', Buffer.from(pdfBytes));
    console.log('PDF generated successfully: invoice-236.pdf');
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
}

main();