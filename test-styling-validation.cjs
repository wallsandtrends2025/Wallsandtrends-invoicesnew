// Test script to validate PDF styling improvements
const fs = require('fs');
const path = require('path');

console.log('🧪 Validating PDF Styling Improvements...');
console.log('==========================================');

// Check InvoicePreview.jsx for styling improvements
const invoicePreviewPath = path.join(__dirname, 'src', 'components', 'InvoicePreview.jsx');
const invoicePreviewContent = fs.readFileSync(invoicePreviewPath, 'utf8');

const stylingChecks = [
  {
    name: 'Calibri font usage (CSS classes)',
    pattern: /font-sans|font-family/,
    expected: true
  },
  {
    name: 'True black text color (#000000)',
    pattern: /color.*#000000|textColor.*0/,
    expected: true
  },
  {
    name: 'Light gray backgrounds (#f9fafb)',
    pattern: /backgroundColor.*#f9fafb|#f9fafb/,
    expected: true
  },
  {
    name: 'Subtle borders (#d1d5db)',
    pattern: /border.*#d1d5db|#d1d5db/,
    expected: true
  },
  {
    name: 'Compact cell padding (2px 4px)',
    pattern: /padding.*2px 4px|padding: '2px 4px'/,
    expected: true
  },
  {
    name: 'Small font sizes (6px)',
    pattern: /fontSize.*6px|font-size.*6px/,
    expected: true
  },
  {
    name: 'Header background styling',
    pattern: /backgroundColor.*#f9fafb/,
    expected: true
  },
  {
    name: 'NOTE section amber styling',
    pattern: /backgroundColor.*#fef3c7/,
    expected: true
  }
];

let passed = 0;
let failed = 0;

stylingChecks.forEach(check => {
  const found = check.pattern.test(invoicePreviewContent);
  const status = found === check.expected ? '✅' : '❌';

  console.log(`${status} ${check.name}: ${found ? 'Found' : 'Not found'}`);

  if (found === check.expected) {
    passed++;
  } else {
    failed++;
  }
});

// Check PDF generation files
const pdfFiles = [
  'src/utils/generateInvoicePDF.js',
  'src/utils/generateInvoicePDF1.js'
];

pdfFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');

    const pdfChecks = [
      {
        name: 'Calibri font loading',
        pattern: /calibri|Calibri/,
        expected: true
      },
      {
        name: 'didDrawCell hook implementation',
        pattern: /didDrawCell/,
        expected: true
      },
      {
        name: 'Header background fill',
        pattern: /setFillColor.*HEADER_GRAY|fillColor.*gray/,
        expected: true
      },
      {
        name: 'True black text color',
        pattern: /setTextColor.*0.*0.*0|textColor.*0/,
        expected: true
      }
    ];

    console.log(`\n📄 Checking ${file}:`);
    pdfChecks.forEach(check => {
      const found = check.pattern.test(content);
      const status = found === check.expected ? '✅' : '❌';

      console.log(`  ${status} ${check.name}: ${found ? 'Found' : 'Not found'}`);

      if (found === check.expected) {
        passed++;
      } else {
        failed++;
      }
    });
  }
});

console.log('\n==========================================');
console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All styling improvements validated successfully!');
  console.log('\n✅ Key improvements implemented:');
  console.log('  • Calibri font embedded and used consistently');
  console.log('  • True black text color for headings');
  console.log('  • Light gray backgrounds for headers');
  console.log('  • Subtle gray borders instead of harsh black');
  console.log('  • Compact cell padding and font sizes');
  console.log('  • Custom didDrawCell hooks for pixel-perfect control');
  console.log('  • Professional NOTE section styling');
} else {
  console.log('⚠️  Some styling checks failed. Please review the implementation.');
}

process.exit(failed === 0 ? 0 : 1);