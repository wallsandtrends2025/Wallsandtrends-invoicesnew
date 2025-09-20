// utils/generateInvoicePDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function generateInvoicePDF(invoice, client) {
  const doc = new jsPDF();

  // ---------- Base fonts & colors ----------
  doc.setFont("helvetica", "normal");
  const BLUE   = [59, 89, 152];      // WT heading color
  const YELLOW = [255, 222, 88];     // WTX heading color
  const BLACK  = [0, 0, 0];
  const GRAY   = [169, 169, 169];    // Gray border color

  // ---------- Brand / assets ----------
  const isWT  = invoice.invoice_type === "WT"  || invoice.invoice_type === "WTPL";
  const isWTX = invoice.invoice_type === "WTX" || invoice.invoice_type === "WTXPL";
  const BRAND = isWTX ? YELLOW : BLUE;

  const companyName = isWT ? "Walls And Trends" : "Walls And Trends WTX";
  const companyGST  = isWT ? "36AACFW6827B1Z8" : "36AAACW8991C1Z9";

  const logoPath = `${window.location.origin}${isWT ? "/wt-logo.png" : "/wtx_logo.png"}`;
  const signaturePath = `${window.location.origin}/csh-sign.PNG`;

  // ---------- Helpers ----------
  const safeToDate = (d) => {
    try {
      if (typeof d?.toDate === "function") return d.toDate();
      if (d instanceof Date) return d;
      return new Date(d);
    } catch {
      return new Date();
    }
  };

  async function loadImage(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        console.warn(`Image fetch failed: ${res.status} ${res.statusText} for ${path}`);
        return null;
      }
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Image load failed, continuing without image:", e.message);
      return null;
    }
  }

  // --- layout constants (grid) - centered for equal left/right margins & mobile optimized ---
  const PAGE_WIDTH = 210;  // A4 width in mm
  const CONTENT_WIDTH = 180;  // Total width for content (2 columns + spacing)
  const MARGIN_L = (PAGE_WIDTH - CONTENT_WIDTH) / 2;  // Center the content
  const COL_W = 85;  // Adjusted column width to fit within centered layout
  const COL1_X = MARGIN_L;
  const COL2_X = MARGIN_L + COL_W + 10;  // Added 10mm spacing between columns
  const FULL_W = COL_W * 2 + 10;  // Account for spacing between columns
  const LINE_H = 5.5;  // Increased for better mobile readability
  const PAD = 8.0;     // Increased padding for mobile-friendly spacing

  // --- draw helpers with auto-wrap & clean grid ---
  function drawPlainCell({ x, y, w, value }) {
    doc.setFontSize(12);  // Increased for mobile readability
    doc.setTextColor(...BLACK);

    const lines = doc.splitTextToSize(String(value ?? ""), w - PAD * 2);
    const cellHeight = Math.max(9, PAD + (lines.length * LINE_H) + PAD);  // Increased minimum height

    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, cellHeight);

    doc.text(lines, x + PAD, y + PAD + LINE_H);
    return cellHeight;
  }

  function drawLabeledCell({ x, y, w, label, value }) {
    doc.setFontSize(12);  // Increased for mobile readability
    doc.setTextColor(...BLACK);

    doc.setFont("helvetica", "bold");
    const labelText = String(label ?? "");
    const labelWidth = doc.getTextWidth(labelText + " ");

    const valueStartX = x + PAD + labelWidth + 1;
    const usableFirstLineWidth = Math.max(12, w - (labelWidth + PAD * 2 + 1));  // Increased minimum width

    doc.setFont("helvetica", "normal");
    const rawValue = String(value ?? "");
    const firstLineArr = doc.splitTextToSize(rawValue, usableFirstLineWidth);
    const firstLine = firstLineArr[0] ?? "";
    const restText = rawValue.slice(firstLine.length).trim();
    const restLines = restText ? doc.splitTextToSize(restText, w - PAD * 2) : [];
    const totalLines = 1 + restLines.length;

    const cellHeight = Math.max(9, PAD + (totalLines * LINE_H) + PAD);  // Increased minimum height

    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, cellHeight);

    const baseY = y + PAD + LINE_H;
    doc.setFont("helvetica", "bold");
    doc.text(labelText, x + PAD, baseY);
    doc.setFont("helvetica", "normal");
    doc.text(firstLine, valueStartX, baseY);

    if (restLines.length) {
      const restY = baseY + LINE_H;
      doc.text(restLines, x + PAD, restY);
    }

    return cellHeight;
  }

  function drawTwoColRow(y, left, right, { leftIsPlain = false, rightIsPlain = false } = {}) {
    const leftH  = leftIsPlain  ? drawPlainCell({ x: COL1_X, y, w: COL_W, value: left.value })
                                : drawLabeledCell({ x: COL1_X, y, w: COL_W, ...left });
    const rightH = rightIsPlain ? drawPlainCell({ x: COL2_X, y, w: COL_W, value: right.value })
                                : drawLabeledCell({ x: COL2_X, y, w: COL_W, ...right });
    return y + Math.max(leftH, rightH);
  }

  function drawFullWidthRow(y, label, value) {
    const h = drawLabeledCell({ x: COL1_X, y, w: FULL_W, label, value });
    return y + h;
  }

  // Load images
  const logoBase64 = await loadImage(logoPath);
  const signatureBase64 = await loadImage(signaturePath);

  if (logoBase64) doc.addImage(logoBase64, "PNG", MARGIN_L, 10, 30, 18);

  // Address
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);  // Increased for mobile readability
  doc.setTextColor(...BLACK);
  doc.text("19/B, 3rd Floor, Progressive Tower, 100 Ft Road,", MARGIN_L, 32);
  doc.text("Siddhi Vinayak Nagar, Madhapur,", MARGIN_L, 37);
  doc.text("Hyderabad, Telangana - 500081", MARGIN_L, 42);

  // Heading
  doc.setFontSize(18);  // Increased for mobile readability
  doc.setFont("helvetica", "Bold");
  doc.setTextColor(...BRAND);
  doc.text("Tax Invoice", MARGIN_L, 52);

  // ---------- Company row ----------
  doc.setFontSize(12);  // Increased for mobile readability
  doc.setTextColor(...BLACK);
  let y = 55;

  y = drawTwoColRow(
    y,
    { value: companyName },
    { label: "GST IN:", value: companyGST },
    { leftIsPlain: true, rightIsPlain: false }
  );

  // ---------- Metadata rows ----------
  y = drawTwoColRow(y,
    { label: "Invoice Number:", value: invoice.invoice_id },
    { label: "Invoice Date:",   value: formatDate(safeToDate(invoice.created_at || invoice.invoice_date)) }
  );

  const titleFromServices = deriveTitleFromServices(invoice);
  const titleValue = invoice.invoice_title || titleFromServices || invoice.service_name || "N/A";
  y = drawTwoColRow(y,
    { label: "Invoice Title:", value: titleValue },
    { label: "Total Cost:",    value: `INR ${Number(invoice.total_amount || 0).toLocaleString("en-IN")}` }
  );

  // Summary line (plain text, no box to match preview)
  const metaNote = `This invoice prepared by Walls & Trends (${invoice.invoice_type}) includes ${titleValue} for ${client.client_name || "client"}.`;
  doc.setFontSize(12);  // Increased for mobile readability
  doc.setTextColor(...BLACK);
  const lines = doc.splitTextToSize(metaNote, FULL_W - PAD * 2);
  doc.text(lines, COL1_X + PAD, y + PAD + LINE_H);
  const metaHeight = PAD + (lines.length * LINE_H) + PAD;
  y += metaHeight + 3;

  // ---------- Customer details ----------
  y += 3;
  y = drawTwoColRow(y,
    { label: "Customer Name:",    value: client.client_name || "N/A" },
    { label: "Customer Address:", value: client.address || "N/A" }
  );
  y = drawFullWidthRow(y, "Customer GST IN:", (client.gst_number || "").trim() || "NA");

  // ---------- Services + GST table ----------
  const fmt0 = (n) => Number(n || 0).toLocaleString("en-IN"); // Indian grouping, no decimals

  // Service line(s)
  const servicesBodyRows = buildServiceRowsNoDecimals(invoice, fmt0);

  // === GST LOGIC (exactly matches CreateInvoice & InvoicePreview) ===
  const COMPANY_STATE = "telangana";
  const COMPANY_COUNTRY = "india";
  const toLower = (s) => (s || "").toString().trim().toLowerCase();

  const clientCountry = toLower(client.country);
  const clientState   = toLower(client.state);
  const isIndian      = clientCountry === COMPANY_COUNTRY;
  const isTelangana   = clientState === COMPANY_STATE;

  // Determine statutory rates
  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9; sgstRate = 9; igstRate = 0;          // intra-state
  } else if (isIndian && !isTelangana) {
    cgstRate = 0; sgstRate = 0; igstRate = 18;         // inter-state → IGST 18%
  } else {
    cgstRate = 0; sgstRate = 0; igstRate = 0;          // international
  }

  const subtotal  = Number(invoice.subtotal) || 0;
  const storedCGST = Number(invoice.cgst ?? 0);
  const storedSGST = Number(invoice.sgst ?? 0);
  const storedIGST = Number(invoice.igst ?? 0);

  // Prefer stored values when present; otherwise compute from rates
  const cgstAmount = storedCGST || Math.round((subtotal * (cgstRate / 100)) * 100) / 100;
  const sgstAmount = storedSGST || Math.round((subtotal * (sgstRate / 100)) * 100) / 100;
  const igstAmount = storedIGST || Math.round((subtotal * (igstRate / 100)) * 100) / 100;

  const totalTax   = cgstAmount + sgstAmount + igstAmount;
  const calculatedTotal = Math.round((subtotal + totalTax) * 100) / 100; // Preserve 2 decimal places

  // Preserve exact decimal precision from invoice.total_amount
  let total;
  if (invoice.total_amount !== undefined && invoice.total_amount !== null) {
    total = parseFloat(invoice.total_amount.toString());
  } else {
    total = calculatedTotal;
  }

  // Debug logging removed for production
 
  // Build summary rows (only show applicable rows)
  const taxRows =
    isIndian && isTelangana
      ? [
          [`CGST @ ${cgstRate}%`, fmt0(cgstAmount)],
          [`SGST @ ${sgstRate}%`, fmt0(sgstAmount)],
        ]
      : [
          [`IGST @ ${igstRate}%`, fmt0(igstAmount)],   // covers inter-state (18%) & international (0%)
        ];

  const SUMMARY_ROW_COUNT = 1 /*Gross*/ + taxRows.length + 1 /*Total*/;

  // Compose table body:
  const tableBody = [
    ...servicesBodyRows,

    // First summary row: create tall empty boxes in col 1 & 2 via rowSpan
    [
      { content: "", rowSpan: SUMMARY_ROW_COUNT, styles: { halign: "center", valign: "middle" } },
      { content: "", rowSpan: SUMMARY_ROW_COUNT, styles: { halign: "center", valign: "middle" } },
      "Gross",
      fmt0(subtotal),
    ],

    // Tax rows (only 2 cells because col 1 & 2 are occupied by the rowSpan)
    ...taxRows.map(([label, amt]) => [label, amt]),

    // Final summary row (Total)
    [
      { content: "Total", styles: { fontStyle: "bold", halign: "center" } },
      { content: fmt0(total), styles: { fontStyle: "bold", halign: "center" } },
    ],
  ];

  autoTable(doc, {
    startY: y + 5,
    head: [["HSN / SAC Code", "Item", "Description", "Amount (INR)"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: false,
      textColor: BLACK,
      fontStyle: "bold",
      halign: "center",
      lineColor: GRAY,
      lineWidth: 0.3,
      font: "helvetica",
    },
    styles: {
      fontSize: 12,  // Increased for mobile readability
      font: "helvetica",
      textColor: BLACK,
      halign: "center",
      valign: "middle",
      lineColor: GRAY,
      lineWidth: 0.3,
      cellPadding: 4,  // Increased for better mobile spacing
    },
    bodyStyles: { textColor: BLACK },
    columnStyles: {
      0: { cellWidth: 45, halign: "center" }, // HSN - increased for mobile
      1: { cellWidth: 45, halign: "center" }, // Item - increased for mobile
      2: { cellWidth: 45, halign: "center" }, // Description (Gross/IGST/CGST/SGST/Total) - increased for mobile
      3: { cellWidth: 45, halign: "center" }, // Amount (centered) - increased for mobile
    }
  });

  // ---------- Amount in words ----------
  // Ensure we have exactly 2 decimal places for precise calculation
  const preciseTotal = Math.round(total * 100) / 100;
  const rupeesPart = Math.floor(preciseTotal);
  const paisePart = Math.round((preciseTotal - rupeesPart) * 100);

  let amountWords = convertNumberToWords(rupeesPart);

  if (paisePart > 0) {
    const paiseWords = convertNumberToWords(paisePart);
    amountWords += ` and ${paiseWords} Paise`;
  }

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    body: [
      [
        { content: "(Total Amount In Words)", styles: { fontStyle: "bold", halign: "left", valign: "middle", font: "helvetica" } },
        { content: `Rupees ${amountWords} only`,      styles: { halign: "left", valign: "middle", font: "helvetica" } }
      ]
    ],
    theme: "grid",
    styles: {
      fontSize: 12,  // Increased for mobile readability
      font: "helvetica",
      textColor: BLACK,
      lineColor: GRAY,
      lineWidth: 0.3,
      cellPadding: 4,  // Increased for better mobile spacing
    },
    columnStyles: {
      0: { cellWidth: COL_W },
      1: { cellWidth: COL_W }
    }
  });

  // ---------- Bank details ----------
  doc.setFontSize(14);  // Increased for mobile readability
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND);
  doc.text("Bank Details", MARGIN_L, doc.lastAutoTable.finalY + 10);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    body: [
      ["Bank Name",        "Yes Bank"],
      ["Beneficiary Name", companyName],
      ["Account Number",   "000663300001713"],
      ["Account Type",     "Current Account"],
      ["IFSC Code",        "YESB0000006"],
      ["Bank Branch",      "Somajiguda"],
      ["City",             "Hyderabad"]
    ],
    theme: "grid",
    styles: {
      fontSize: 12,  // Increased for mobile readability
      font: "helvetica",
      textColor: BLACK,
      lineColor: GRAY,
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
      cellPadding: 2,  // Reduced cell padding
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: COL_W },
      1: { cellWidth: COL_W }
    }
  });

  // ---------- Note + signature + footer ----------
  const sigBlockY = doc.lastAutoTable.finalY + 12;
  const sigBlockX = MARGIN_L + 20;  // Position signature relative to left margin
  const sigImgWidth = 28;
  const sigImgHeight = 14;

  if (signatureBase64) {
    doc.addImage(signatureBase64, "PNG", sigBlockX, sigBlockY, sigImgWidth, sigImgHeight);
  }

  const pageHeight = doc.internal.pageSize.height;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);  // Increased for mobile readability
  doc.setTextColor(...BLACK);
  doc.text("NOTE:", MARGIN_L, pageHeight - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);  // Increased for mobile readability
  doc.text("No files will be delivered until the final payment is made.", MARGIN_L + 16, pageHeight - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);  // Increased for mobile readability
  doc.text(
    "Authorised signature for Walls & Trends",
    sigBlockX + sigImgWidth / 2,
    sigBlockY + sigImgHeight + 8,
    { align: "center" }
  );

  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - MARGIN_L;  // Use same margin as left side
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);  // Increased for mobile readability
  doc.setTextColor(...BLUE);
  doc.text("Authenticity Promised. Creativity Published.", rightX, sigBlockY + sigImgHeight + 20, { align: "right" });
  doc.text("Thank you for your business!",                  rightX, sigBlockY + sigImgHeight + 26, { align: "right" });

  // Return the document instead of saving it directly
  return doc;
}

// ===== helpers =====
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

function deriveTitleFromServices(invoice) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  const first = arr[0]?.name;
  if (Array.isArray(first)) return first.filter(Boolean).join(", ");
  return first || "";
}

function buildServiceRowsNoDecimals(invoice, fmt0) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  if (arr.length) {
    return arr.map((s, i) => {
      const nm = Array.isArray(s?.name) ? s.name.filter(Boolean).join(", ") : (s?.name || `Service ${i + 1}`);
      const desc = String(s?.description || "");
      const amt = Number(s?.amount || 0);
      return ["9983", String(nm), desc, fmt0(amt)];
    });
  }
  const nm = String(invoice?.service_name || invoice?.invoice_title || "Service");
  const desc = String(invoice?.service_description || "");
  const amt = Number(invoice?.subtotal || 0);
  return [["9983", nm, desc, fmt0(amt)]];
}
