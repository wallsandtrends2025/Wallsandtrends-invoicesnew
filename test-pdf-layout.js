// Simple test script to verify ultra-compact PDF layout constants
// Run with: node test-pdf-layout.js

import fs from 'fs';
import path from 'path';

// Test function to verify ultra-compact layout constants
function testLayoutConstants() {
  console.log("🧪 Testing Ultra-Compact PDF Layout Constants...");
  console.log("================================================");

  try {
    // Read the PDF generation files
    const invoicePDFPath = "./src/utils/generateInvoicePDF.js";
    const quotationPDFPath = "./src/utils/generateQuotationPDF.js";
    const proformaPDFPath = "./src/utils/generateProformaInvoicePDF.js";

    console.log("📁 Reading PDF generation files...");

    const invoiceContent = fs.readFileSync(invoicePDFPath, 'utf8');
    const quotationContent = fs.readFileSync(quotationPDFPath, 'utf8');
    const proformaContent = fs.readFileSync(proformaPDFPath, 'utf8');

    console.log("✅ All PDF files read successfully");

    // Test ultra-compact constants in invoice PDF
    console.log("\n📄 Testing Invoice PDF constants:");
    const invoiceTests = [
      { name: "LINE_H (line height)", expected: "1.8", actual: extractConstant(invoiceContent, "LINE_H = ") },
      { name: "PAD (padding)", expected: "0.5", actual: extractConstant(invoiceContent, "PAD = ") },
      { name: "INVOICE_DETAILS_WIDTH", expected: "70", actual: extractConstant(invoiceContent, "INVOICE_DETAILS_WIDTH = ") },
      { name: "INVOICE_DETAILS_HEIGHT", expected: "20", actual: extractConstant(invoiceContent, "INVOICE_DETAILS_HEIGHT = ") },
      { name: "CUSTOMER_DETAILS_WIDTH", expected: "70", actual: extractConstant(invoiceContent, "CUSTOMER_DETAILS_WIDTH = ") },
      { name: "CUSTOMER_DETAILS_HEIGHT", expected: "15", actual: extractConstant(invoiceContent, "CUSTOMER_DETAILS_HEIGHT = ") }
    ];

    let allTestsPassed = true;
    invoiceTests.forEach(test => {
      if (test.actual === test.expected) {
        console.log(`  ✅ ${test.name}: ${test.actual} (expected: ${test.expected})`);
      } else {
        console.log(`  ❌ ${test.name}: ${test.actual} (expected: ${test.expected})`);
        allTestsPassed = false;
      }
    });

    // Test spacing values in invoice PDF
    console.log("\n📏 Testing Invoice PDF spacing:");
    const spacingTests = [
      { name: "Customer details spacing", expected: "+ 2", actual: extractSpacing(invoiceContent, "CUSTOMER_DETAILS_Y = INVOICE_DETAILS_Y \\+ INVOICE_DETAILS_HEIGHT \\+ ") },
      { name: "Items table spacing", expected: "+ 3", actual: extractSpacing(invoiceContent, "itemsTableY = customerDetailsY \\+ CUSTOMER_DETAILS_HEIGHT \\+ ") },
      { name: "Amount in words spacing", expected: "+ 1", actual: extractSpacing(invoiceContent, "startY: doc.lastAutoTable.finalY \\+ ") },
      { name: "Bank details spacing", expected: "+ 3", actual: extractSpacing(invoiceContent, "bankDetailsY = doc.lastAutoTable.finalY \\+ ") },
      { name: "Footer spacing", expected: "+ 3", actual: extractSpacing(invoiceContent, "footerY = doc.lastAutoTable.finalY \\+ ") },
      { name: "Bottom message spacing", expected: "+ 5", actual: extractSpacing(invoiceContent, "bottomY = footerY \\+ ") }
    ];

    spacingTests.forEach(test => {
      if (test.actual === test.expected) {
        console.log(`  ✅ ${test.name}: ${test.actual}mm`);
      } else {
        console.log(`  ❌ ${test.name}: ${test.actual}mm (expected: ${test.expected}mm)`);
        allTestsPassed = false;
      }
    });

    // Test quotation PDF spacing
    console.log("\n📄 Testing Quotation PDF spacing:");
    const quotationSpacingTests = [
      { name: "Meta section spacing", expected: "+ 2", actual: extractSpacing(quotationContent, "metaEndY \\+ ") },
      { name: "Customer section spacing", expected: "+ 3", actual: extractSpacing(quotationContent, "customerY = metaEndY \\+ ") },
      { name: "Table spacing", expected: "+ 2", actual: extractSpacing(quotationContent, "startY: customerEndY \\+ ") },
      { name: "Amount in words spacing", expected: "+ 1", actual: extractSpacing(quotationContent, "startY: doc.lastAutoTable.finalY \\+ ") },
      { name: "Signature spacing", expected: "+ 3", actual: extractSpacing(quotationContent, "sigBlockY = doc.lastAutoTable.finalY \\+ ") },
      { name: "Footer spacing", expected: "+ 5", actual: extractSpacing(quotationContent, "footerY = sigBlockY \\+ ") }
    ];

    quotationSpacingTests.forEach(test => {
      if (test.actual === test.expected) {
        console.log(`  ✅ ${test.name}: ${test.actual}mm`);
      } else {
        console.log(`  ❌ ${test.name}: ${test.actual}mm (expected: ${test.expected}mm)`);
        allTestsPassed = false;
      }
    });

    // Test proforma PDF spacing
    console.log("\n📄 Testing Proforma PDF spacing:");
    const proformaSpacingTests = [
      { name: "Meta section spacing", expected: "+ 1", actual: extractSpacing(proformaContent, "metaHeight \\+ ") },
      { name: "Customer section spacing", expected: "+ 1", actual: extractSpacing(proformaContent, "y \\+= ") },
      { name: "Table spacing", expected: "+ 2", actual: extractSpacing(proformaContent, "startY: y \\+ ") },
      { name: "Amount in words spacing", expected: "+ 1", actual: extractSpacing(proformaContent, "startY: doc.lastAutoTable.finalY \\+ ") },
      { name: "Bank details title spacing", expected: "+ 3", actual: extractSpacing(proformaContent, "doc.lastAutoTable.finalY \\+ 10") },
      { name: "Bank details table spacing", expected: "+ 5", actual: extractSpacing(proformaContent, "startY: doc.lastAutoTable.finalY \\+ 12") },
      { name: "Signature spacing", expected: "+ 3", actual: extractSpacing(proformaContent, "sigBlockY = doc.lastAutoTable.finalY \\+ ") }
    ];

    proformaSpacingTests.forEach(test => {
      if (test.actual === test.expected) {
        console.log(`  ✅ ${test.name}: ${test.actual}mm`);
      } else {
        console.log(`  ❌ ${test.name}: ${test.actual}mm (expected: ${test.expected}mm)`);
        allTestsPassed = false;
      }
    });

    console.log("\n================================================");
    if (allTestsPassed) {
      console.log("🎉 All ultra-compact layout tests PASSED!");
      console.log("📝 Summary of ultra-compact optimizations:");
      console.log("   ✅ Box dimensions reduced to 70-100mm width, 15-20mm height");
      console.log("   ✅ Line heights reduced to 1.8 units");
      console.log("   ✅ Padding reduced to 0.5 units");
      console.log("   ✅ Section spacing reduced from 10-25mm to 1-5mm");
      console.log("   ✅ All three PDF types (Invoice, Quotation, Proforma) optimized");
    } else {
      console.log("❌ Some tests failed. Please check the constants and spacing values.");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Helper function to extract constants
function extractConstant(content, pattern) {
  const regex = new RegExp(pattern + "([0-9.]+)");
  const match = content.match(regex);
  return match ? match[1] : "not found";
}

// Helper function to extract spacing values
function extractSpacing(content, pattern) {
  const regex = new RegExp(pattern + "([0-9]+)");
  const match = content.match(regex);
  return match ? match[1] : "not found";
}

// Run the test
testLayoutConstants();