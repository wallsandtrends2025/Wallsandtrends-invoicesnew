/**
 * Invoice PDF Generation Utility
 * Generates tax invoices in PDF format using jsPDF and AutoTable
 */
 import { jsPDF } from "jspdf";
 import "jspdf-autotable";
 import autoTableModule from "jspdf-autotable";

 /* ===== Quick test ===== */
 export function testModuleLoading() { return "Module loaded and working"; }

 /* ===== Constants ===== */
 const BASE_FONT = "Helvetica";             // set to 'Calibri' if you embed it
 const COLOR_BLACK = [0, 0, 0];
 const COLOR_BORDER = [200, 200, 200];      // light gray border - consistent for all boxes
 const COLOR_WT    = [59, 89, 152];         // #3b5998 - WT Blue
 const COLOR_WTX   = [255, 222, 88];        // #FFDE58 - WTX Yellow
 const PAGE_W = 210, PAGE_H = 297;
 const M_L = 14, M_R = 14, M_T = 14, M_B = 16;
 const FULL_W = PAGE_W - M_L - M_R;

 /* Typography */
 const TABLE_FS = 7;          // all tables
 const ADDRESS_FS = 6;        // top address
 const SIGN_FS = 6;           // signature caption
 const LINE_WIDTH = 0.3;      // consistent border width
 const LINE_HEIGHT = 1.15;    // compact line-height inside tables
 const PAD_Y = 2.5;           // top/bottom padding (mm-ish)
 const PAD_X = 4;             // left/right padding

 /* Services table locked column widths - must equal FULL_W (182) */
 const COL_W = { hsn: 30, item: 52, desc: 50, amt: 50 }; // sums to FULL_W (182)

 /* Bold-label y offset tuned for 7px type */
 const LABEL_Y = 3.5;

/* ===== Utils ===== */
const safeToDate = (d) => (typeof d?.toDate === "function" ? d.toDate() : new Date(d || Date.now()));
const fmtCurrency = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt2 = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDate(dateObj) {
  const d = new Date(dateObj);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = d.toLocaleString("en-us", { month: "long" });
  const yyyy = d.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}

function deriveTitleFromServices(inv) {
  const arr = Array.isArray(inv?.services) ? inv.services : [];
  const first = arr[0]?.name;
  if (Array.isArray(first)) return first.filter(Boolean).join(", ");
  return first || inv?.invoice_title || inv?.service_name || "";
}

function runAutoTable(doc, options) {
  if (typeof autoTableModule === "function") return autoTableModule(doc, options);
  if (typeof doc.autoTable === "function")   return doc.autoTable(options);
  throw new Error("jsPDF-AutoTable not loaded. Add: import 'jspdf-autotable'");
}

/* Image helpers */
async function loadImageAsDataURL(url) {
  try {
    console.log('🔍 Loading image from URL:', url);
    const res = await fetch(url);
    if (!res.ok) {
      console.error('❌ Failed to load image:', url, 'Status:', res.status);
      return null;
    }
    const blob = await res.blob();
    console.log('✅ Image loaded successfully:', url, 'Type:', blob.type, 'Size:', blob.size);
    const fr = new FileReader();
    return await new Promise((resolve, reject) => {
      fr.onloadend = () => {
        console.log('📄 Image converted to DataURL, length:', fr.result?.length || 0);
        resolve(fr.result);
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('❌ Error loading image:', url, error);
    return null;
  }
}
function getImageNaturalSize(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}
async function addImageKeepAR(doc, dataUrl, x, y, targetH, maxW) {
  let w=1,h=1;
  if (typeof doc.getImageProperties === "function") {
    const p = doc.getImageProperties(dataUrl); w = p?.width || 1; h = p?.height || 1;
  } else {
    const p = await getImageNaturalSize(dataUrl); w = p.width; h = p.height;
  }
  const ar = w / h || 1;
  let drawW = targetH * ar;
  if (maxW && drawW > maxW) drawW = maxW;
  doc.addImage(dataUrl, undefined, x, y, drawW, targetH);
  return drawW;
}

/* Words (Indian system) */
function numberToWordsINR(amountInput) {
  const amount = Number(amountInput ?? 0);
  if (!Number.isFinite(amount)) return "";

  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigitWords = (n) => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? " " + ones[o] : ""}`.trim();
  };

  const threeDigitWords = (n) => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let out = "";
    if (h) out += `${ones[h]} Hundred`;
    if (rem) out += `${out ? " " : ""}${twoDigitWords(rem)}`;
    return out.trim();
  };

  const segmentWords = (n) => {
    if (n === 0) return "Zero";
    let out = "";

    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = n % 1000;

    if (crore) out += `${threeDigitWords(crore)} Crore`;
    if (lakh) out += `${out ? " " : ""}${threeDigitWords(lakh)} Lakh`;
    if (thousand) out += `${out ? " " : ""}${threeDigitWords(thousand)} Thousand`;
    if (hundred) out += `${out ? " " : ""}${threeDigitWords(hundred)}`;

    return out.trim();
  };

  const rupeesWords = `${segmentWords(rupees)} Rupees`;
  const paiseWords = paise ? ` and ${twoDigitWords(paise)} Paise` : "";
  return `${rupeesWords}${paiseWords} only`;
}


/* ===== Main ===== */
export async function generateInvoicePDF(invoice, client) {
  if (!invoice) throw new Error("Invoice data is required for PDF generation");
  if (!client)  throw new Error("Client data is required for PDF generation");

  const isWT  = invoice?.invoice_type === "WT"  || invoice?.invoice_type === "WTPL";
  const isWTX = invoice?.invoice_type === "WTX" || invoice?.invoice_type === "WTXPL";
  const companyName = "Walls And Trends"; // Same for both WT and WTX
  const companyGST  = isWT ? "36AACFW6827B1Z8"  : "36AAACW8991C1Z9";

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const logoPath = `${origin}${isWT ? "/wt-logo.png" : "/wtx_logo.png"}`;
  const signaturePath = `${origin}/csh-sign.PNG`;

  const docNumber = String(invoice?.invoice_id || "N/A");
  const docTitle  = deriveTitleFromServices(invoice) || "N/A";
  const docDate   = safeToDate(invoice?.created_at || invoice?.invoice_date);

  // tax regime
  const COMPANY_STATE = "telangana";
  const COMPANY_COUNTRY = "india";
  const toLower = (s) => (s || "").toString().trim().toLowerCase();
  const isIndian    = toLower(client?.country) === COMPANY_COUNTRY;
  const isTelangana = toLower(client?.state)   === COMPANY_STATE;

  const subtotal = Number(invoice?.subtotal || 0);
  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) { cgstRate = 9; sgstRate = 9; }
  else if (isIndian)           { igstRate = 18; }

  const cgstAmount = Number(invoice?.cgst ?? Math.round(subtotal * cgstRate) / 100);
  const sgstAmount = Number(invoice?.sgst ?? Math.round(subtotal * sgstRate) / 100);
  const igstAmount = Number(invoice?.igst ?? Math.round(subtotal * igstRate) / 100);
  const totalTax   = cgstAmount + sgstAmount + igstAmount;

  const computedTotal = Math.round((subtotal + totalTax) * 100) / 100;
  const total = Number(invoice?.total_amount ?? computedTotal);
  const words = numberToWordsINR(total);

  /* ----- Document ----- */
  const doc = new jsPDF("p", "mm", "a4");
  doc.setFont(BASE_FONT, "normal");
  doc.setTextColor(...COLOR_BLACK);

  // Header: logo + address (address 6px)
  let y = M_T;
  const logoB64 = await loadImageAsDataURL(logoPath);
  if (logoB64) await addImageKeepAR(doc, logoB64, M_L, y, 16, 40);
  y += 16;

  doc.setFontSize(ADDRESS_FS);
  doc.text("19/B, 3rd Floor, Progressive Tower, 100 Ft Road,", M_L, y + 2.5);
  doc.text("Siddhi Vinayak Nagar, Madhapur,", M_L, y + 5);
  doc.text("Hyderabad, Telangana - 500081", M_L, y + 7.5);

  // Title - use brand color (WTX yellow or WT blue)
  const BRAND_COLOR = isWTX ? COLOR_WTX : COLOR_WT;
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_COLOR);
  doc.text("Tax Invoice", M_L, y + 16);
  doc.setTextColor(...COLOR_BLACK);
  y += 20;

  /* ----- Force no fill colors in table cells ----- */
  const tableConfig = {
    styles: {
      font: BASE_FONT,
      fontSize: TABLE_FS,
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: LINE_WIDTH,
      cellPadding: { top: PAD_Y, right: PAD_X, bottom: PAD_Y, left: PAD_X },
      fillColor: [255, 255, 255],  // White background - no gray
      halign: "left",
      valign: "middle",
      lineHeight: LINE_HEIGHT,
      overflow: "linebreak",
      minCellHeight: 8,  // Consistent minimum cell height
    },
    headStyles: {
      fillColor: [255, 255, 255],  // White background - no gray
      fontStyle: "bold",
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: LINE_WIDTH,
      halign: "center",
      valign: "middle",
      lineHeight: LINE_HEIGHT,
      minCellHeight: 8,
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  };

  /* ----- Meta box (2 columns) ----- */
  const metaRows = [
    [
      { content: "dummy", meta: { value: companyName, isBoldLabel: true } },
      { content: "dummy", meta: { label: "GST IN", value: companyGST, isBoldLabel: true } },
    ],
    [
      { content: "dummy", meta: { label: "Invoice Number", value: docNumber, isBoldLabel: true } },
      { content: "dummy", meta: { label: "Invoice Date", value: formatDate(docDate), isBoldLabel: true } },
    ],
    [
      { content: "dummy", meta: { label: "Invoice Title", value: docTitle, isBoldLabel: true } },
      { content: "dummy", meta: { label: "Total Cost", value: `INR ${fmtCurrency(total)}`, isBoldLabel: true } },
    ],
  ];

  console.log("Meta table positioning - Start Y:", y);
  runAutoTable(doc, {
    ...tableConfig,
    startY: y,
    body: metaRows,
    columnStyles: { 
      0: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] }, 
      1: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] } 
    },
    didDrawCell: ({ cell, doc, row, column }) => {
      const cellData = cell.raw;
      if (cellData && cellData.meta) {
        const { label, value, isBoldLabel } = cellData.meta;
        const isBoldValue = !label && isBoldLabel;

        // Clear cell background only (don't redraw borders)
        doc.setFillColor(255, 255, 255);
        doc.rect(cell.x + 0.15, cell.y + 0.15, cell.width - 0.3, cell.height - 0.3, "F");

        let currentX = cell.x + PAD_X;
        const textY = cell.y + (cell.height / 2) + 1.5;

        // Draw label if it exists
        if (label) {
          doc.setFont(BASE_FONT, isBoldLabel ? "bold" : "normal");
          doc.text(`${label}:`, currentX, textY);
          currentX += doc.getTextWidth(`${label}:`) + 2;
        }

        // Draw value
        doc.setFont(BASE_FONT, isBoldValue ? "bold" : "normal");
        doc.text(value, currentX, textY);
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;
  /* ----- Customer box ----- */
  // 🔍 DEBUG: Customer section should match preview layout
  console.log("🔍 Customer Section Layout:");
  console.log("  Row 1: [Customer Name] [Customer Address - rowSpan 2]");
  console.log("  Row 2: [Customer GST IN] [continues from row 1]");
  
  const customerRows = [
    [
      { content: "dummy", meta: { label: "Customer Name", value: client?.client_name || "N/A", isBoldLabel: true } },
      { content: "dummy", meta: { label: "Customer Address", value: client?.address || "N/A", isBoldLabel: true }, rowSpan: 2 },
    ],
    [
      { content: "dummy", meta: { label: "Customer GST IN", value: (client?.gst_number || "").trim() || "NA", isBoldLabel: true } },
    ],
  ];
  
  console.log("✅ Customer table configured with address rowSpan=2");

  runAutoTable(doc, {
    ...tableConfig,
    startY: y,
    body: customerRows,
    columnStyles: { 
      0: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] }, 
      1: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] } 
    },
    didDrawCell: ({ cell, doc, row, column }) => {
      const cellData = cell.raw;
      if (cellData && cellData.meta) {
        const { label, value, isBoldLabel } = cellData.meta;

        // Clear cell background only (don't redraw borders)
        doc.setFillColor(255, 255, 255);
        doc.rect(cell.x + 0.15, cell.y + 0.15, cell.width - 0.3, cell.height - 0.3, "F");

        let currentX = cell.x + PAD_X;
        const textY = cell.y + (cell.height / 2) + 1.5;

        // If there's a label, draw it
        if (label) {
          doc.setFont(BASE_FONT, isBoldLabel ? "bold" : "normal");
          doc.text(`${label}:`, currentX, textY);
          currentX += doc.getTextWidth(`${label}:`) + 2;
          // Draw value after label
          doc.setFont(BASE_FONT, "normal");
          doc.text(value, currentX, textY);
        } else {
          // No label, just draw the value
          doc.setFont(BASE_FONT, "normal");
          doc.text(value, currentX, textY);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  /* ----- Services table (matches preview layout) ----- */
  const servicesArr = Array.isArray(invoice?.services) ? invoice.services : [];

  // Create table structure matching preview exactly
  const servicesHead = [[
    { content: "HSN / SAC Code", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.hsn } },
    { content: "Item", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.item } },
    { content: "Description", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.desc } },
    { content: "Amount (INR)", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.amt } }
  ]];

  // Service data rows
  const servicesBody = [];
  if (servicesArr.length) {
    servicesArr.forEach((s, i) => {
      servicesBody.push([
        { content: "9983", styles: { halign: "center", minCellHeight: 8 } },
        { content: Array.isArray(s?.name) ? s.name.filter(Boolean).join(", ") : (s?.name || `Service ${i+1}`), styles: { halign: "center", minCellHeight: 8 } },
        { content: String(s?.description ?? ""), styles: { halign: "center", minCellHeight: 8 } },
        { content: fmt2(Number(s?.amount || 0)), styles: { halign: "center", minCellHeight: 8 } }
      ]);
    });
  } else {
    servicesBody.push([
      { content: "9983", styles: { halign: "center", minCellHeight: 8 } },
      { content: deriveTitleFromServices(invoice) || "Service", styles: { halign: "center", minCellHeight: 8 } },
      { content: String(invoice?.service_description || ""), styles: { halign: "center", minCellHeight: 8 } },
      { content: fmt2(Number(invoice?.subtotal || 0)), styles: { halign: "center", minCellHeight: 8 } }
    ]);
  }

  // Add summary section - Gross row
  servicesBody.push([
    { content: "", styles: { halign: "center", minCellHeight: 8 } },
    { content: "", styles: { halign: "center", minCellHeight: 8 } },
    { content: "Gross", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } },
    { content: fmt2(subtotal), styles: { halign: "center", minCellHeight: 8 } }
  ]);

  // Add tax rows
  if (isIndian && isTelangana) {
    servicesBody.push([
      { content: "", styles: { halign: "center", minCellHeight: 8 } },
      { content: "", styles: { halign: "center", minCellHeight: 8 } },
      { content: `CGST @ ${cgstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } },
      { content: fmt2(cgstAmount), styles: { halign: "center", minCellHeight: 8 } }
    ]);
    servicesBody.push([
      { content: "", styles: { halign: "center", minCellHeight: 8 } },
      { content: "", styles: { halign: "center", minCellHeight: 8 } },
      { content: `SGST @ ${sgstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } },
      { content: fmt2(sgstAmount), styles: { halign: "center", minCellHeight: 8 } }
    ]);
  } else {
    servicesBody.push([
      { content: "", styles: { halign: "center", minCellHeight: 8 } },
      { content: "", styles: { halign: "center", minCellHeight: 8 } },
      { content: `IGST @ ${igstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } },
      { content: fmt2(igstAmount), styles: { halign: "center", minCellHeight: 8 } }
    ]);
  }

  // Add Total row
  servicesBody.push([
    { content: "", styles: { halign: "center", minCellHeight: 8 } },
    { content: "", styles: { halign: "center", minCellHeight: 8 } },
    { content: "Total", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } },
    { content: fmt2(total), styles: { halign: "center", minCellHeight: 8 } }
  ]);

  // Add amount in words row
  servicesBody.push([
    { content: "", styles: { halign: "center", minCellHeight: 8 } },
    { content: "", styles: { halign: "center", minCellHeight: 8 } },
    { content: "(Total Amount in Words)", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } },
    { content: words, styles: { halign: "center", minCellHeight: 8 } }
  ]);

  runAutoTable(doc, {
    ...tableConfig,
    startY: y,
    head: servicesHead,
    body: servicesBody,
    tableWidth: FULL_W,
    columnStyles: {
      0: { cellWidth: COL_W.hsn, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, minCellHeight: 8, fillColor: [255, 255, 255] },
      1: { cellWidth: COL_W.item, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, minCellHeight: 8, fillColor: [255, 255, 255] },
      2: { cellWidth: COL_W.desc, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, minCellHeight: 8, fillColor: [255, 255, 255] },
      3: { cellWidth: COL_W.amt, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, minCellHeight: 8, fillColor: [255, 255, 255] },
    },
    headStyles: {
      fillColor: [255, 255, 255],
      fontStyle: "bold",
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: LINE_WIDTH,
      halign: "center",
      valign: "middle",
      cellPadding: { top: PAD_Y, right: PAD_X, bottom: PAD_Y, left: PAD_X },
      minCellHeight: 8,
    },
    bodyStyles: {
      minCellHeight: 8,
      cellPadding: { top: PAD_Y, right: PAD_X, bottom: PAD_Y, left: PAD_X },
      fillColor: [255, 255, 255],
      lineColor: COLOR_BORDER,
      lineWidth: LINE_WIDTH,
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  /* ----- Bank Details (two-column layout matching preview) ----- */
  doc.setFont(BASE_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLOR);
  doc.text("Bank Details", M_L, y);
  doc.setTextColor(...COLOR_BLACK);

  // Bank details in two-column format matching preview exactly
  const bankDetailsBody = [
    [
      { content: "Bank Name", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Yes Bank", styles: { halign: "center" } }
    ],
    [
      { content: "Beneficiary Name", styles: { halign: "center", fontStyle: "bold" } },
      { content: companyName, styles: { halign: "center" } }
    ],
    [
      { content: "Account Number", styles: { halign: "center", fontStyle: "bold" } },
      { content: "000663300001713", styles: { halign: "center" } }
    ],
    [
      { content: "Account Type", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Current Account", styles: { halign: "center" } }
    ],
    [
      { content: "IFSC Code", styles: { halign: "center", fontStyle: "bold" } },
      { content: "YESB0000006", styles: { halign: "center" } }
    ],
    [
      { content: "Bank Branch", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Somajiguda", styles: { halign: "center" } }
    ],
    [
      { content: "City", styles: { halign: "center", fontStyle: "bold" } },
      { content: "Hyderabad", styles: { halign: "center" } }
    ]
  ];

  runAutoTable(doc, {
    ...tableConfig,
    startY: y + 3,
    body: bankDetailsBody,
    tableWidth: FULL_W,
    columnStyles: {
      0: { cellWidth: FULL_W/2, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255], minCellHeight: 8 },
      1: { cellWidth: FULL_W/2, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255], minCellHeight: 8 }
    },
    bodyStyles: {
      lineColor: COLOR_BORDER,
      lineWidth: LINE_WIDTH,
      fillColor: [255, 255, 255],
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  /* ----- Note + Signature (caption 6px) ----- */
  doc.setFont(BASE_FONT, "bold");
  doc.setFontSize(8);
  doc.text("NOTE: No files will be delivered until the final payment is Done.", M_L, y);
  y += 6;

  const sigB64 = await loadImageAsDataURL(signaturePath);
  if (sigB64) await addImageKeepAR(doc, sigB64, M_L + 10, y, 12, 35);

  doc.setFont(BASE_FONT, "normal");
  doc.setFontSize(SIGN_FS);
  doc.setTextColor(100, 100, 100);
  doc.text("Authorised signature for Walls & Trends", M_L + 10, y + 18);
  doc.setTextColor(...COLOR_BLACK);

  // Footer - use brand color
  doc.setFont(BASE_FONT, "italic");
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(9);
  const rightX = PAGE_W - M_R;

  // Add spacing before footer text
  doc.text("Authenticity Promised. Creativity Published.", rightX, y + 26,  { align: "right" });
  doc.text("Thank you for your business!",                 rightX, y + 31, { align: "right" });

  return doc;
}

/* ===== Optional test ===== */
export async function generateTestInvoicePDF() {
  const testInvoice = {
    invoice_type: "WT",
    invoice_id: "WT2505INV003",
    invoice_date: new Date().toISOString(),
    invoice_title: "YouTube Channels Suspension",
    subtotal: 60000,
    cgst: 0, sgst: 0, igst: 10800,
    total_amount: 70800,
    services: [{ name: "YouTube Channels Suspension", description: "", amount: 60000 }],
  };
  const testClient = {
    client_name: "Aananda Audio Video M1",
    address: "White House, No. 29, St. Marks Road, Bangalore - 560001.",
    gst_number: "29AAPFA3367G1Z8",
    country: "india",
    state: "karnataka",
  };
  return await generateInvoicePDF(testInvoice, testClient);
}

export default generateInvoicePDF;