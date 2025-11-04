/**
 * Invoice PDF Generation Utility
 * Generates tax invoices in PDF format using jsPDF and AutoTable
 */
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import autoTableModule from "jspdf-autotable";
import CurrencyService from "./CurrencyService.js";
import { CURRENCIES, STATIC_EXCHANGE_RATES } from '../constants/currencies.js';

/* ===== Quick test ===== */
export function testModuleLoading() { return "Module loaded and working"; }

/* ===== Font loading ===== */
async function loadCalibriTTF(doc) {
  try {
    let buf;
    if (typeof window !== "undefined") {
      // Browser
      const origin = window.location.origin;
      const ttfUrl = `${origin}/fonts/calibri/Calibri.ttf`;
      const res = await fetch(ttfUrl);
      if (!res.ok) return false;
      buf = await res.arrayBuffer();
    } else {
      // Node.js
      const fs = await import('fs');
      const path = await import('path');
      const fontPath = path.join(process.cwd(), 'public', 'fonts', 'calibri', 'Calibri.ttf');
      buf = fs.readFileSync(fontPath);
    }
    if (!buf.byteLength) return false;

    const base64 = arrayBufferToBase64(buf);
    doc.addFileToVFS("Calibri.ttf", base64);
    doc.addFont("Calibri.ttf", "calibri", "normal");

    // verify available
    const list = doc.getFontList?.();
    if (!list || !list.calibri) return false;
    return true;
  } catch {
    return false;
  }
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* ===== Constants ===== */
const COLOR_BLACK = [0, 0, 0];
const COLOR_BORDER = [200, 200, 200];      // light gray border
const COLOR_WT    = [59, 89, 152];         // #3b5998 - WT Blue
const COLOR_WTX   = [255, 222, 88];        // #FFDE58 - WTX Yellow
const PAGE_W = 210, PAGE_H = 297;
const M_L = 14, M_R = 14, M_T = 14, M_B = 16;
const FULL_W = PAGE_W - M_L - M_R;

/* Typography */
const TABLE_FS = 7;          // all tables
const ADDRESS_FS = 6;        // top address
const SIGN_FS = 6;           // signature caption
const LINE_WIDTH = 0.3;      // border width
const LINE_HEIGHT = 1.15;    // line-height inside tables
const PAD_Y = 2.5;           // top/bottom padding
const PAD_X = 4;             // left/right padding

/* Services table locked column widths - must equal FULL_W (182) */
const COL_W = { hsn: 30, item: 52, desc: 50, amt: 50 }; // 30+52+50+50 = 182

/* ===== Utils ===== */
const safeToDate = (d) => (typeof d?.toDate === "function" ? d.toDate() : new Date(d || Date.now()));
const fmt2 = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Sanitize amount input for form fields
 * @param {string|number} input - Raw input value
 * @returns {number} Sanitized number or 0 if invalid
 */
export function sanitizeAmountInput(input) {
  if (input === "" || input === null || input === undefined) return 0;

  // Convert to string and remove all non-numeric characters except decimal point
  const cleaned = String(input).replace(/[^0-9.-]/g, '');

  // Handle multiple decimal points (keep only the last one)
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    const integerPart = parts.slice(0, -1).join('').replace(/[^0-9]/g, '');
    const decimalPart = parts[parts.length - 1].replace(/[^0-9]/g, '');
    return Number(`${integerPart}.${decimalPart}`);
  }

  // Remove leading zeros but keep decimal values
  const trimmed = cleaned.replace(/^0+(?=\d)/, '');

  const num = Number(trimmed);

  // Return 0 for invalid numbers, otherwise return the valid number
  return isNaN(num) ? 0 : num;
}

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
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const fr = new FileReader();
    return await new Promise((resolve, reject) => {
      fr.onloadend = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
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

/* Words (English system for other currencies) */
function numberToWordsEnglish(amountInput, currencyCode) {
  const amount = Number(amountInput ?? 0);
  if (!isFinite(amount)) return "";

  const roundedAmount = Math.round(amount * 100) / 100;
  const integerPart = Math.floor(roundedAmount);
  const decimalPart = Math.round((roundedAmount - integerPart) * 100);

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
    if (n === 0) return "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let out = "";
    if (h) out += `${ones[h]} Hundred`;
    if (rem) out += `${out ? " " : ""}${twoDigitWords(rem)}`;
    return out.trim();
  };

  const integerWords = integerPart > 0 ? threeDigitWords(integerPart) : "Zero";
  const decimalWords = decimalPart > 0 ? ` Point ${twoDigitWords(decimalPart)}` : "";

  const currencyName = CurrencyService.getCurrencyName(currencyCode);

  return `${integerWords}${decimalWords} ${currencyName} only`;
}

/* Multi-currency number to words converter */
export function numberToWords(amountInput, currencyCode = 'INR') {
  const amount = Number(amountInput ?? 0);
  if (!isFinite(amount)) return "";

  if (currencyCode === 'INR') {
    return numberToWordsINR(amount);
  } else {
    return numberToWordsEnglish(amount, currencyCode);
  }
}

/* ===== Main ===== */
export async function generateInvoicePDF(invoice, client, options = {}) {
  if (!invoice) throw new Error("Invoice data is required for PDF generation");
  if (!client)  throw new Error("Client data is required for PDF generation");

  // Extract currency options with defaults
  const {
    displayCurrency: initialDisplayCurrency = 'INR',
    exchangeRate = null,
    useLiveRates = false
  } = options;

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

  // Determine invoice type based on client country and currency
  let currency = invoice?.currency || 'INR';
  const isIndianClient = client?.country && client.country.toLowerCase().includes('india');

  // For international clients, determine if they want INR or local currency
  const isInternationalClient = client?.country && !client.country.toLowerCase().includes('india');
  const clientLocalCurrency = isInternationalClient ? CurrencyService.getDefaultCurrencyForClient(client) : 'INR';

  const isInternationalInvoice = currency === 'INR' && isInternationalClient; // International clients requesting INR invoice (show INR + local currency)
  const isClientCurrencyInvoice = currency !== 'INR' && isInternationalClient; // International clients requesting their own currency (show only local currency)

  // Use correct subtotal based on invoice type - ensure clean data for INR invoices
  const rawSubtotalINR = invoice?.subtotal_inr || invoice?.subtotal || 0;
  const rawSubtotal = invoice?.subtotal || 0;

  // For INR invoices, be extra careful with sanitization
  const cleanSubtotalINR = currency === 'INR' ?
    CurrencyService.sanitizeAmount(rawSubtotalINR) :
    CurrencyService.sanitizeAmount(rawSubtotalINR || rawSubtotal);

  const cleanSubtotal = CurrencyService.sanitizeAmount(rawSubtotal);

  // Handle amounts based on invoice type (match preview logic exactly)
  let subtotalINR;
  const displayCurrency = isClientCurrencyInvoice ? currency : 'INR';

  if (isInternationalInvoice) {
    // International Invoice (INR format) - Show ONLY INR amounts and GST (no dual currency)
    subtotalINR = cleanSubtotalINR;
  } else if (isClientCurrencyInvoice) {
    // Client's own currency invoice - Show only client currency, no INR
    subtotalINR = cleanSubtotal;
  } else {
    // Indian client or INR invoice - Show INR amounts
    subtotalINR = cleanSubtotalINR;
  }

  console.log(`🔍 DEBUG: PDF Subtotal calculation (INR focus):`, {
    rawSubtotalINR,
    rawSubtotal,
    cleanSubtotalINR,
    cleanSubtotal,
    subtotalINR,
    displayCurrency,
    currency,
    isINRInvoice: currency === 'INR',
    isInternationalInvoice,
    isIndianClient,
    isClientCurrencyInvoice
  });

  // Use CurrencyService for tax calculations based on client country and currency
  let gstResult;
  try {
    if (isInternationalInvoice) {
      // International Invoice (INR format) - Apply 18% GST
      gstResult = CurrencyService.calculateGST(subtotalINR, client?.state, client);
    } else if (isClientCurrencyInvoice) {
      // Client's own currency invoice - NO GST
      gstResult = {
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        totalAmount: subtotalINR,
        taxType: 'none'
      };
    } else {
      // Indian client - use existing GST logic
      gstResult = CurrencyService.calculateGST(subtotalINR, client?.state, client);
    }
    console.log('DEBUG: GST calculation result:', gstResult);
  } catch (error) {
    console.error('DEBUG: Error in GST calculation, using fallback:', error);
    // Fallback using the same logic
    if (isInternationalInvoice) {
      // International tax (18% flat rate)
      const taxRate = 18;
      const taxAmount = (subtotalINR * taxRate) / 100;
      gstResult = {
        cgstRate: 0,
        sgstRate: 0,
        igstRate: taxRate,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: taxAmount,
        totalTax: taxAmount,
        totalAmount: subtotalINR + taxAmount,
        isInternationalTax: true,
        taxType: 'international'
      };
    } else if (isClientCurrencyInvoice) {
      // No GST
      gstResult = {
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        totalAmount: subtotalINR,
        taxType: 'none'
      };
    } else {
      // Indian client - fallback GST
      const isTelangana = toLower(client?.state) === COMPANY_STATE;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;
      if (isTelangana) { cgstRate = 9; sgstRate = 9; }
      else { igstRate = 18; }
      const cgstAmount = (subtotalINR * cgstRate) / 100;
      const sgstAmount = (subtotalINR * sgstRate) / 100;
      const igstAmount = (subtotalINR * igstRate) / 100;
      gstResult = {
        cgstRate,
        sgstRate,
        igstRate,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTax: cgstAmount + sgstAmount + igstAmount,
        totalAmount: subtotalINR + cgstAmount + sgstAmount + igstAmount,
        isInternationalTax: false,
        taxType: 'gst'
      };
    }
  }

  const cgstAmount = gstResult.cgstAmount;
  const sgstAmount = gstResult.sgstAmount;
  const igstAmount = gstResult.igstAmount;
  const totalTax   = gstResult.totalTax;

  // Always use computed total for PDF generation to ensure accuracy
  // Don't trust stored total_amount as it might be malformed
  const computedTotal = Number((subtotalINR + totalTax).toFixed(2));

  let subtotal, total;
  if (isClientCurrencyInvoice) {
    // For client currency invoices, amounts are already in client currency
    subtotal = subtotalINR;
    total = subtotalINR;
  } else {
    subtotal = subtotalINR;
    total = computedTotal;
  }

  console.log(`🔍 DEBUG: PDF Total calculation (INR invoice focus):`, {
    computedTotal,
    subtotalINR,
    subtotal,
    totalTax,
    subtotalPlusTax: subtotalINR + totalTax,
    storedTotalAmount: invoice?.total_amount,
    currency,
    isINRInvoice: currency === 'INR',
    finalTotal: total,
    totalFormatted: CurrencyService.formatAmountForPDF(total, displayCurrency),
    isInternationalInvoice
  });
  // Ensure total is clean for words conversion
  const cleanTotalForWords = CurrencyService.sanitizeAmount(total);
  const words = numberToWords(cleanTotalForWords, displayCurrency);

  console.log(`🔍 DEBUG: Words conversion: total=${total}, cleanTotalForWords=${cleanTotalForWords}, words="${words}"`);

  /* ----- Document ----- */
  const doc = new jsPDF("p", "mm", "a4");

  // Load Calibri font if available
  const hasCalibri = await loadCalibriTTF(doc);
  const BASE_FONT = "helvetica"; // Force use of standard font to avoid Unicode metadata issues

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

  // Title - brand color (WTX yellow or WT blue)
  const BRAND_COLOR = isWTX ? COLOR_WTX : COLOR_WT;
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_COLOR);
  doc.text("Tax Invoice", M_L, y + 16);
  doc.setTextColor(...COLOR_BLACK);
  y += 20;

  /* ----- Shared table styles ----- */
  const tableConfig = {
    styles: {
      font: BASE_FONT,
      fontSize: TABLE_FS,
      textColor: COLOR_BLACK,
      lineColor: COLOR_BORDER,
      lineWidth: LINE_WIDTH,
      cellPadding: { top: PAD_Y, right: PAD_X, bottom: PAD_Y, left: PAD_X },
      fillColor: [255, 255, 255],
      halign: "left",
      valign: "middle",
      lineHeight: LINE_HEIGHT,
      overflow: "linebreak",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: [255, 255, 255],
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

  /* ----- 1) Meta box — FORCE 50/50 columns ----- */
  let totalCostFormatted;
  if (displayCurrency === 'INR') {
    // For INR amounts, show with INR prefix
    totalCostFormatted = `INR ${total.toLocaleString('en-IN')}`;
  } else {
    totalCostFormatted = CurrencyService.formatAmountForPDF(total, displayCurrency);
  }

  let metaRows = [
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
      { content: "dummy", meta: { label: "Total Cost", value: totalCostFormatted, isBoldLabel: true } },
    ],
  ];


  runAutoTable(doc, {
    ...tableConfig,
    startY: y,
    body: metaRows,
    columnStyles: {
      0: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] },
      1: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] },
    },
    didDrawCell: ({ cell }) => {
      const cellData = cell.raw;
      if (cellData?.meta) {
        const { label, value, isBoldLabel } = cellData.meta;

        // Clear cell fill (keep borders from AutoTable)
        doc.setFillColor(255, 255, 255);
        doc.rect(cell.x + 0.15, cell.y + 0.15, cell.width - 0.3, cell.height - 0.3, "F");

        let currentX = cell.x + PAD_X;
        const textY = cell.y + (cell.height / 2) + 1.5;

        if (label) {
          doc.setFont(BASE_FONT, isBoldLabel ? "bold" : "normal");
          doc.text(`${label}:`, currentX, textY);
          currentX += doc.getTextWidth(`${label}:`) + 2;
          doc.setFont(BASE_FONT, "normal");
          doc.text(value, currentX, textY);
        } else {
          // value only (e.g., companyName)
          doc.setFont(BASE_FONT, isBoldLabel ? "bold" : "normal");
          doc.text(value, currentX, textY);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  /* ----- 2) Customer box — FORCE 50/50 columns ----- */
  const customerRows = [
    [
      { content: "dummy", meta: { label: "Customer Name", value: client?.client_name || "N/A", isBoldLabel: true } },
      { content: "dummy", meta: { label: "Customer Address", value: client?.address || "N/A", isBoldLabel: true }, rowSpan: 2 },
    ],
    [
      { content: "dummy", meta: { label: "Customer GST IN", value: (client?.gst_number || "").trim() || "NA", isBoldLabel: true } },
    ],
  ];

  runAutoTable(doc, {
    ...tableConfig,
    startY: y,
    body: customerRows,
    columnStyles: {
      0: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] },
      1: { cellWidth: FULL_W/2, lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255] },
    },
    didDrawCell: ({ cell }) => {
      const cellData = cell.raw;
      if (cellData?.meta) {
        const { label, value, isBoldLabel } = cellData.meta;

        doc.setFillColor(255, 255, 255);
        doc.rect(cell.x + 0.15, cell.y + 0.15, cell.width - 0.3, cell.height - 0.3, "F");

        let currentX = cell.x + PAD_X;
        const textY = cell.y + (cell.height / 2) + 1.5;

        if (label) {
          doc.setFont(BASE_FONT, isBoldLabel ? "bold" : "normal");
          doc.text(`${label}:`, currentX, textY);
          currentX += doc.getTextWidth(`${label}:`) + 2;
          doc.setFont(BASE_FONT, "normal");
          doc.text(value, currentX, textY);
        } else {
          doc.setFont(BASE_FONT, "normal");
          doc.text(value, currentX, textY);
        }
      }
    },
  });

  y = doc.lastAutoTable.finalY + 3;

  /* ----- Services table (matches preview layout) ----- */
  const servicesArr = Array.isArray(invoice?.services) ? invoice.services : [];

  const servicesHead = [[
    { content: "HSN / SAC Code", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.hsn } },
    { content: "Item",            styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.item } },
    { content: "Description",     styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.desc } },
    { content: `Amount (${displayCurrency})`,    styles: { halign: "center", fontStyle: "bold", minCellHeight: 8, cellWidth: COL_W.amt } }
  ]];

  const servicesBody = [];
  if (servicesArr.length) {
    for (const s of servicesArr) {
      const amount = CurrencyService.sanitizeAmount(s?.amount || 0);
      const formattedAmount = CurrencyService.formatAmountForPDF(amount, displayCurrency);
      servicesBody.push([
        { content: "9983", styles: { halign: "center", minCellHeight: 8 } },
        { content: Array.isArray(s?.name) ? s.name.filter(Boolean).join(", ") : (s?.name || `Service ${servicesArr.indexOf(s)+1}`), styles: { halign: "center", minCellHeight: 8 } },
        { content: String(s?.description ?? ""), styles: { halign: "center", minCellHeight: 8 } },
        { content: formattedAmount, styles: { halign: "center", minCellHeight: 8 } }
      ]);
    }
  } else {
    const subtotalAmount = CurrencyService.sanitizeAmount(invoice?.subtotal || 0);
    const formattedSubtotal = CurrencyService.formatAmountForPDF(subtotalAmount, displayCurrency);
    servicesBody.push([
      { content: "9983", styles: { halign: "center", minCellHeight: 8 } },
      { content: deriveTitleFromServices(invoice) || "Service", styles: { halign: "center", minCellHeight: 8 } },
      { content: String(invoice?.service_description || ""), styles: { halign: "center", minCellHeight: 8 } },
      { content: formattedSubtotal, styles: { halign: "center", minCellHeight: 8 } }
    ]);
  }

  // Summary rows
  servicesBody.push(
    [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "Gross", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: CurrencyService.formatAmountForPDF(subtotal, displayCurrency), styles: { halign: "center", minCellHeight: 8 } }]
  );


  // Handle tax rows based on tax type
  if (gstResult.taxType === 'international') {
    // International tax (18% flat rate)
    servicesBody.push(
      [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: `IGST @ ${gstResult.igstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: CurrencyService.formatAmountForPDF(igstAmount, displayCurrency), styles: { halign: "center", minCellHeight: 8 } }],
    );
  } else if (gstResult.taxType === 'gst') {
    // GST for Indian clients
    if (gstResult.cgstAmount > 0) {
      servicesBody.push(
        [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: `CGST @ ${gstResult.cgstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: CurrencyService.formatAmountForPDF(cgstAmount, displayCurrency), styles: { halign: "center", minCellHeight: 8 } }],
      );
    }
    if (gstResult.sgstAmount > 0) {
      servicesBody.push(
        [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: `SGST @ ${gstResult.sgstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: CurrencyService.formatAmountForPDF(sgstAmount, displayCurrency), styles: { halign: "center", minCellHeight: 8 } }],
      );
    }
    if (gstResult.igstAmount > 0) {
      servicesBody.push(
        [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: `IGST @ ${gstResult.igstRate}%`, styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: CurrencyService.formatAmountForPDF(igstAmount, displayCurrency), styles: { halign: "center", minCellHeight: 8 } }],
      );
    }
  } else if (gstResult.taxType === 'none' && !isClientCurrencyInvoice) {
    // No GST - show NA (excluding client currency invoices)
    servicesBody.push(
      [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "GST", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: "NA", styles: { halign: "center", minCellHeight: 8 } }],
    );
  }

  servicesBody.push(
    [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "Total", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: CurrencyService.formatAmountForPDF(total, displayCurrency), styles: { halign: "center", minCellHeight: 8 } }],
    [{ content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "", styles: { halign: "center", minCellHeight: 8 } }, { content: "(Total Amount in Words)", styles: { halign: "center", fontStyle: "bold", minCellHeight: 8 } }, { content: words, styles: { halign: "center", minCellHeight: 8 } }],
  );

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

  /* ----- 4) Bank Details — FORCE 50/50 columns ----- */
  doc.setFont(BASE_FONT, "bold");
  doc.setFontSize(10);
  doc.setTextColor(...BRAND_COLOR);
  doc.text("Bank Details", M_L, y);
  doc.setTextColor(...COLOR_BLACK);

  const bankDetailsBody = [
    [ { content: "Bank Name", styles: { halign: "center", fontStyle: "bold" } }, { content: "Yes Bank", styles: { halign: "center" } } ],
    [ { content: "Beneficiary Name", styles: { halign: "center", fontStyle: "bold" } }, { content: companyName, styles: { halign: "center" } } ],
    [ { content: "Account Number", styles: { halign: "center", fontStyle: "bold" } }, { content: "000663300001713", styles: { halign: "center" } } ],
    [ { content: "Account Type", styles: { halign: "center", fontStyle: "bold" } }, { content: "Current Account", styles: { halign: "center" } } ],
    [ { content: "IFSC Code", styles: { halign: "center", fontStyle: "bold" } }, { content: "YESB0000006", styles: { halign: "center" } } ],
    [ { content: "Bank Branch", styles: { halign: "center", fontStyle: "bold" } }, { content: "Somajiguda", styles: { halign: "center" } } ],
    [ { content: "City", styles: { halign: "center", fontStyle: "bold" } }, { content: "Hyderabad", styles: { halign: "center" } } ],
  ];

  runAutoTable(doc, {
    ...tableConfig,
    startY: y + 3,
    body: bankDetailsBody,
    tableWidth: FULL_W,
    columnStyles: {
      0: { cellWidth: FULL_W/2, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255], minCellHeight: 8 },
      1: { cellWidth: FULL_W/2, halign: "center", lineColor: COLOR_BORDER, lineWidth: LINE_WIDTH, fillColor: [255, 255, 255], minCellHeight: 8 },
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

  // Footer - brand color
  doc.setFont(BASE_FONT, "italic");
  doc.setTextColor(...BRAND_COLOR);
  doc.setFontSize(9);
  const rightX = PAGE_W - M_R;
  doc.text("Authenticity Promised. Creativity Published.", rightX, y + 26,  { align: "right" });
  doc.text("Thank you for your business!",                 rightX, y + 31, { align: "right" });

  return doc;
}

/* ===== Optional test ===== */
export async function generateTestInvoicePDF(options = {}) {
  const testInvoice = {
    invoice_type: "WT",
    invoice_id: "WT2505INV003",
    invoice_date: new Date().toISOString(),
    invoice_title: "YouTube Channels Suspension",
    subtotal: 2000,
    currency: 'INR',
    services: [{ name: "YouTube Channels Suspension", description: "", amount: 2000 }],
  };
  const testClient = {
    client_name: "Aananda Audio Video M1",
    address: "White House, No. 29, St. Marks Road, Bangalore - 560001.",
    gst_number: "29AAPFA3367G1Z8",
    country: "USA",
    state: "karnataka",
  };
  return await generateInvoicePDF(testInvoice, testClient, options);
}

export default generateInvoicePDF;
