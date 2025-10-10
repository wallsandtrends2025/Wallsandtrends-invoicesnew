import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function generateQuotationPDF(quotation, client) {
  // Use A4 format for consistent sizing with other PDFs
  const doc = new jsPDF('p', 'mm', 'a4');

  // Debug logging for page dimensions
  console.log('=== Quotation PDF Debug - Page Setup ===');
  console.log('Page format:', doc.internal.pageSize.getName());
  console.log('Page width:', doc.internal.pageSize.getWidth());
  console.log('Page height:', doc.internal.pageSize.getHeight());
  console.log('Units:', doc.internal.scaleFactor);

  doc.setFont("calibri", "normal");

  const isWT = quotation.quotation_type === "WT" || quotation.quotation_type === "WTPL";
  const logoPath = `${window.location.origin}${isWT ? "/wt-logo.png" : "/wtx_logo.png"}`;
  const signaturePath = `${window.location.origin}/csh-sign.PNG`;

  async function loadImage(path) {
    try {
      console.log('🔍 Loading image from path:', path);
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to load image at ${path}`);
      const blob = await response.blob();
      console.log('✅ Image loaded successfully:', path, 'Type:', blob.type, 'Size:', blob.size);
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('📄 Image converted to DataURL, length:', reader.result?.length || 0);
          resolve(reader.result);
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("❌ Image load failed:", path, err);
      return null;
    }
  }

  const logoBase64 = await loadImage(logoPath);
  const signatureBase64 = await loadImage(signaturePath);

  if (logoBase64) {
    console.log('🖼️ Adding logo to quotation PDF with auto-detected format');
    doc.addImage(logoBase64, undefined, 10, 10, 25, 15); // undefined = auto-detect format for transparency
  }

  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.setFont("calibri", "bold");
  doc.text("Walls And Trends", 10, 30);
  doc.setFont("calibri", "normal");
  doc.text("19/B, 3rd Floor, Progressive Tower", 10, 35);
  doc.text("100 Ft Road, Siddhi Vinayak Nagar", 10, 40);
  doc.text("Madhapur, Hyderabad, Telangana - 500081", 10, 45);

  doc.setFontSize(12);
  doc.setTextColor(59, 89, 152);
  doc.text("Tax Invoice", 10, 55);

  function printInlineLabelValue(label, value, x, y) {
    doc.setFont("calibri", "bold");
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("calibri", "normal");
    doc.text(value, x + labelWidth + 1, y);
  }

  doc.setFontSize(7);
  doc.setTextColor(0);
  let currentY = 60;
  const rowHeight = 4.0;

  // Use A4 dimensions with proper margins
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15; // Standard margin for A4
  const leftColumnX = margin;
  const rightColumnX = pageWidth - margin - 50; // Leave space for right column content

  // Debug logging for layout calculations
  console.log('=== Quotation PDF Debug - Layout Calculations ===');
  console.log('Page width:', pageWidth);
  console.log('Margin:', margin);
  console.log('Left column X:', leftColumnX);
  console.log('Right column X:', rightColumnX);
  console.log('Column spacing:', rightColumnX - leftColumnX);
  console.log('Current Y start:', currentY);
  console.log('Row height:', rowHeight);

  // Left Column
  doc.setFont("calibri", "bold");
  doc.setFontSize(7);
  doc.text("Walls And Trends", leftColumnX, currentY);
  doc.setFont("calibri", "normal");
  doc.text("Invoice Number: " + quotation.quotation_id, leftColumnX, currentY + 4);
  doc.text("Invoice Date: " + formatDate(new Date(quotation.quotation_date)), leftColumnX, currentY + 8);
  doc.text("Total Cost: INR " + Number(quotation.total_amount).toLocaleString("en-IN"), leftColumnX, currentY + 12);
  doc.text("Customer Name: Testing", leftColumnX, currentY + 16);
  doc.text("GST IN: 36AACFW6827B1Z8", leftColumnX, currentY + 20);

  // Right Column
  doc.setFont("calibri", "bold");
  doc.text("Customer Address: Madhapur", rightColumnX, currentY);
  // Ensure Calibri font is loaded and available
  try {
    doc.setFont("calibri", "normal");
    console.log('✅ Calibri font loaded successfully in quotation PDF');
  } catch (fontError) {
    console.warn('⚠️ Calibri font not available in quotation PDF, falling back to helvetica:', fontError);
    // Fallback to helvetica font if Calibri is not available
    try {
      doc.setFont('helvetica', 'normal');
      console.log('✅ Using Helvetica as fallback font in quotation PDF');
    } catch (fallbackError) {
      console.warn('⚠️ Helvetica also not available in quotation PDF, using system default');
    }
  }
  doc.text("GST IN: 36 24242423", rightColumnX, currentY + 4);

  const customerEndY = currentY + 20;

  const tableBody = quotation.services.map((s) => [
    "9983",
    "Posters",
    s.description || "",
    "0.00"
  ]);

  const total = Number(quotation.total_amount);

  // Debug logging for table configuration
  console.log('=== Quotation PDF Debug - Table Configuration ===');
  console.log('Table startY:', customerEndY + 5);
  console.log('Customer end Y:', customerEndY);
  console.log('Page height:', doc.internal.pageSize.getHeight());

  autoTable(doc, {
    startY: customerEndY + 5,
    head: [["HSN/SAC", "Item", "Description", "Amount (INR)"]],
    body: [
      ...tableBody,
      ["", "", "Gross", "2,360.00"],
      ["", "", { content: "IGST @ 18%", styles: { fontStyle: "bold" } }, { content: "360.00", styles: { fontStyle: "bold" } }],
      ["", "", { content: "Total", styles: { fontStyle: "bold" } }, { content: "2,360.00", styles: { fontStyle: "bold" } }]
    ],
    theme: "grid",
    headStyles: {
      fillColor: false,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    styles: {
      fontSize: 6,
      font: "calibri",
      textColor: [0, 0, 0],
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: 0.2
    },
    columnStyles: {
      0: { cellWidth: 25 }, // HSN/SAC - increased for A4
      1: { cellWidth: 35 }, // Item - increased for A4
      2: { cellWidth: 60 }, // Description - increased for A4
      3: { cellWidth: 30 }  // Amount - increased for A4
    }
  });

  // Bank Details table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    head: [["Bank Details"]],
    body: [
      ["Bank Name", "Yes Bank"],
      ["Beneficiary Name", "Walls And Trends"],
      ["Account Number", "00060330001713"],
      ["Account Type", "Current Account"],
      ["IFSC Code", "YESB0000006"],
      ["Bank Branch", "Somajiguda"],
      ["City", "Hyderabad"]
    ],
    theme: "grid",
    headStyles: {
      fillColor: false,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    styles: {
      fontSize: 6,
      font: "calibri",
      textColor: [0, 0, 0],
      halign: "left",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: 0.2
    },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: "bold" },
      1: { cellWidth: 50 }
    }
  });

  // Amount in Words table
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    body: [
      [
        { content: "(Total Amount In Words)", styles: { fontStyle: "bold", halign: "left", valign: "middle" } },
        { content: "Two Thousand Three Hundred Sixty Rupees only", styles: { halign: "left", valign: "middle" } }
      ]
    ],
    theme: "grid",
    styles: {
      fontSize: 6,
      font: "calibri",
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: 0.2
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 50 }
    }
  });


  const sigBlockY = doc.lastAutoTable.finalY + 8;
  const sigBlockX = 10;
  const sigImgWidth = 25;
  const sigImgHeight = 12;

  if (signatureBase64) {
    console.log('🖼️ Adding signature to quotation PDF with auto-detected format');
    doc.addImage(signatureBase64, undefined, sigBlockX, sigBlockY, sigImgWidth, sigImgHeight); // undefined = auto-detect format
  }

  const sigLineY = sigBlockY + sigImgHeight + 1;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(sigBlockX, sigLineY, sigBlockX + sigImgWidth, sigLineY);

  doc.setFont("calibri", "normal");
  doc.setFontSize(5);
  doc.setTextColor(0);
  doc.text("Authorised Signature", sigBlockX + sigImgWidth / 2, sigLineY + 2, { align: "center" });
  doc.setFontSize(4);
  doc.text("Walls & Trends", sigBlockX + sigImgWidth / 2, sigLineY + 4, { align: "center" });

  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 10;
  const rightAlignX = pageWidth - 15; // Use consistent margin

  doc.setFont("calibri", "normal");
  doc.setFontSize(5);
  doc.setTextColor(59, 89, 152);
  doc.text("Thank you for your business!", rightAlignX, footerY - 5, { align: "right" });

  doc.setFont("calibri", "italic");
  doc.setFontSize(5);
  doc.setTextColor(100, 100, 100);
  doc.text("Authenticity Promised. Creativity Published.", rightAlignX, footerY - 2, { align: "right" });

  // Payment terms note
  doc.setFont("calibri", "normal");
  doc.setFontSize(5);
  doc.setTextColor(80, 80, 80);
  doc.text("NOTE: No files will be delivered until the final payment is made.", 10, footerY - 2);

  doc.save(`${quotation.quotation_id}.pdf`);
}

function convertNumberToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  if (num === 0) return "Zero";
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };
  return inWords(num);
}

function formatDate(dateObj) {
  const date = new Date(dateObj);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = date.toLocaleString("en-us", { month: "long" });
  const yyyy = date.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}
