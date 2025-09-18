// utils/generateProformaInvoicePDF.js
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function generateProformaInvoicePDF(invoice, client) {
  const doc = new jsPDF();

  // ---- Base fonts & brand colors ----
  doc.setFont("helvetica", "normal");
  const BLUE   = [59, 89, 152];   // WT heading color
  const YELLOW = [255, 222, 88];  // WTX heading color
  const BLACK  = [0, 0, 0];

  // ---- Brand / assets ----
  const isWT  = invoice.invoice_type === "WT"  || invoice.invoice_type === "WTPL";
  const isWTX = invoice.invoice_type === "WTX" || invoice.invoice_type === "WTXPL";
  const BRAND = isWTX ? YELLOW : BLUE;

  const companyName = isWT ? "Walls And Trends" : "Walls And Trends WTX";
  const companyGST  = isWT ? "36AACFW6827B1Z8" : "36AAACW8991C1Z9";

  const logoPath = `${window.location.origin}${isWT ? "/wt-logo.png" : "/wtx_logo.png"}`;
  const signaturePath = `${window.location.origin}/csh-sign.PNG`;

  // ---- Helpers ----
  const safeToDate = (d) => {
    try {
      if (typeof d?.toDate === "function") return d.toDate();
      if (d instanceof Date) return d;
      return new Date(d);
    } catch { return new Date(); }
  };

  async function loadImage(path) {
    try {
      console.log('🖼️ Loading image:', path);
      const res = await fetch(path);
      if (!res.ok) {
        console.warn(`Image fetch failed: ${res.status} ${res.statusText} for ${path}`);
        return null;
      }
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('✅ Image loaded successfully:', path);
          resolve(reader.result);
        };
        reader.onerror = () => {
          console.error('❌ FileReader error for:', path);
          reject(new Error('FileReader failed'));
        };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Image load failed, continuing without image:", e.message);
      return null;
    }
  }

  // grid constants
  const MARGIN_L = 15;
  const COL_W = 95;
  const COL1_X = MARGIN_L;          // 15
  const COL2_X = MARGIN_L + COL_W;  // 110
  const FULL_W = COL_W * 2;         // 190
  const LINE_H = 4.2;
  const PAD = 2.0;

  function drawPlainCell({ x, y, w, value }) {
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    const lines = doc.splitTextToSize(String(value ?? ""), w - PAD * 2);
    const h = Math.max(7, PAD + (lines.length * LINE_H) + PAD);
    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);
    doc.text(lines, x + PAD, y + PAD + LINE_H);
    return h;
  }

  function drawLabeledCell({ x, y, w, label, value }) {
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);

    doc.setFont("helvetica", "bold");
    const labelText = String(label ?? "");
    const labelWidth = doc.getTextWidth(labelText + " ");

    const valueStartX = x + PAD + labelWidth + 1;
    const usableFirstLineWidth = Math.max(10, w - (labelWidth + PAD * 2 + 1));

    doc.setFont("helvetica", "normal");
    const rawValue = String(value ?? "");
    const first = (doc.splitTextToSize(rawValue, usableFirstLineWidth)[0] ?? "");
    const restText = rawValue.slice(first.length).trim();
    const rest = restText ? doc.splitTextToSize(restText, w - PAD * 2) : [];
    const totalLines = 1 + rest.length;

    const h = Math.max(7, PAD + (totalLines * LINE_H) + PAD);

    doc.setDrawColor(...BLACK);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);

    const baseY = y + PAD + LINE_H;
    doc.setFont("helvetica", "bold");
    doc.text(labelText, x + PAD, baseY);
    doc.setFont("helvetica", "normal");
    doc.text(first, valueStartX, baseY);
    if (rest.length) doc.text(rest, x + PAD, baseY + LINE_H);

    return h;
  }

  function drawTwoColRow(y, left, right, { leftIsPlain = false, rightIsPlain = false } = {}) {
    const lh = leftIsPlain  ? drawPlainCell({ x: COL1_X, y, w: COL_W, value: left.value })
                            : drawLabeledCell({ x: COL1_X, y, w: COL_W, ...left });
    const rh = rightIsPlain ? drawPlainCell({ x: COL2_X, y, w: COL_W, value: right.value })
                            : drawLabeledCell({ x: COL2_X, y, w: COL_W, ...right });
    return y + Math.max(lh, rh);
  }

  function drawFullWidthRow(y, label, value) {
    const h = drawLabeledCell({ x: COL1_X, y, w: FULL_W, label, value });
    return y + h;
  }

  // ---- Header ----
  const logo = await loadImage(logoPath);
  const sign = await loadImage(signaturePath);
  if (logo) {
    const ext = (logoPath.split(".").pop() || "").toLowerCase();
    const fmt = ext === "webp" ? "WEBP" : "PNG";
    doc.addImage(logo, fmt, 15, 10, 30, 18);
  }

  // Address
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  doc.text("19/B, 3rd Floor, Progressive Tower, 100 Ft Road,", 15, 32);
  doc.text("Siddhi Vinayak Nagar, Madhapur,", 15, 37);
  doc.text("Hyderabad, Telangana - 500081", 15, 42);

  // Heading
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND);
  doc.text("Proforma Invoice", 15, 52);

  // ---- Company row (name / GST IN) ----
  doc.setFontSize(10);
  doc.setTextColor(...BLACK);
  let y = 55;

  y = drawTwoColRow(
    y,
    { value: companyName },
    { label: "GST IN:", value: companyGST },
    { leftIsPlain: true, rightIsPlain: false }
  );

  // ---- Metadata rows ----
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

  // Summary line
  const summary = `This invoice prepared by Walls & Trends (${invoice.invoice_type}) includes ${titleValue} for ${client.client_name || "client"}.`;
  y = drawFullWidthRow(y, "", summary);

  // ---- Customer details ----
  y += 3;
  y = drawTwoColRow(y,
    { label: "Customer Name:",    value: client.client_name || "N/A" },
    { label: "Customer Address:", value: client.address || "N/A" }
  );
  y = drawFullWidthRow(y, "Customer GST IN:", (client.gst_number || "").trim() || "NA");

  // ---- Items & GST table ----
  const fmt0 = (n) => Number(n || 0).toLocaleString("en-IN"); // no decimals

  // Build service rows (supports array or legacy single service)
  const serviceRows = buildServiceRowsNoDecimals(invoice, fmt0);

  // === GST LOGIC (mirrors CreateInvoice & InvoicePreview) ===
  const COMPANY_STATE = "telangana";
  const COMPANY_COUNTRY = "india";
  const toLower = (s) => (s || "").toString().trim().toLowerCase();
  const clientCountry = toLower(client.country);
  const clientState   = toLower(client.state);
  const isIndian      = clientCountry === COMPANY_COUNTRY;
  const isTelangana   = clientState === COMPANY_STATE;

  // Statutory rates
  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9; sgstRate = 9; igstRate = 0;          // intra-state
  } else if (isIndian && !isTelangana) {
    cgstRate = 0; sgstRate = 0; igstRate = 18;         // inter-state → IGST 18%
  } else {
    cgstRate = 0; sgstRate = 0; igstRate = 0;          // international
  }

  const subtotal = Number(invoice.subtotal) || calcSubtotalFromServices(invoice);
  const explicitCGST = Number(invoice.cgst || 0);
  const explicitSGST = Number(invoice.sgst || 0);
  const explicitIGST = Number(invoice.igst || 0);

  // If explicit split present, use it. Otherwise compute from rates.
  const cgst = explicitCGST || +(subtotal * (cgstRate / 100)).toFixed(2);
  const sgst = explicitSGST || +(subtotal * (sgstRate / 100)).toFixed(2);
  const igst = explicitIGST || +(subtotal * (igstRate / 100)).toFixed(2);

  const totalTax = cgst + sgst + igst;
  const total    = Number(invoice.total_amount || 0) || +(subtotal + totalTax).toFixed(2);

  // Build tax rows with explicit rate labels
  const taxRows =
    isIndian && isTelangana
      ? [
          [`CGST @ ${cgstRate}%`, fmt0(cgst)],
          [`SGST @ ${sgstRate}%`, fmt0(sgst)],
        ]
      : [
          [`IGST @ ${igstRate}%`, fmt0(igst)],   // covers inter-state (18%) & international (0%)
        ];

  const SUMMARY_ROW_COUNT = 1 /*Gross*/ + taxRows.length + 1 /*Total*/;

  const tableBody = [
    ...serviceRows,
    [
      { content: "", rowSpan: SUMMARY_ROW_COUNT, styles: { halign: "center", valign: "middle" } },
      { content: "", rowSpan: SUMMARY_ROW_COUNT, styles: { halign: "center", valign: "middle" } },
      "Gross",
      fmt0(subtotal),
    ],
    ...taxRows.map(([label, amt]) => [label, amt]),
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
      lineColor: BLACK,
      lineWidth: 0.3,
      font: "helvetica",
    },
    styles: {
      fontSize: 10,
      font: "helvetica",
      textColor: BLACK,
      halign: "center",
      valign: "middle",
      lineColor: BLACK,
      lineWidth: 0.3,
      cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 },
      overflow: "linebreak",
      minCellHeight: 6,
    },
    bodyStyles: { textColor: BLACK },
    columnStyles: {
      0: { cellWidth: 47.5, halign: "center" },
      1: { cellWidth: 47.5, halign: "center" },
      2: { cellWidth: 47.5, halign: "center" },
      3: { cellWidth: 47.5, halign: "center" },
    }
  });

  // ---- Amount in words ----
  const amountWords = convertNumberToWords(Math.floor(total));
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    body: [
      [
        { content: "(Total Amount In Words)", styles: { fontStyle: "bold", halign: "left", valign: "middle", font: "helvetica" } },
        { content: `${amountWords} only`,      styles: { halign: "left",  valign: "middle", font: "helvetica" } }
      ]
    ],
    theme: "grid",
    styles: {
      fontSize: 10,
      font: "helvetica",
      textColor: BLACK,
      lineColor: BLACK,
      lineWidth: 0.3,
      cellPadding: 2,
    },
    columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 95 } }
  });

  // ---- Bank details ----
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND);
  doc.text("Bank Details", 15, doc.lastAutoTable.finalY + 10);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 12,
    body: [
      ["Bank Name",        "Yes Bank"],
      ["Beneficiary Name", companyName],
      ["Account Number",   "000663300001713"],
      ["Account Type",     "Current Account"],
      ["IFSC Code",        "YESB0000006"],
      ["Bank Branch",      "Somajiguda"],
      ["City",             "Hyderabad"],
    ],
    theme: "grid",
    styles: {
      fontSize: 10,
      font: "helvetica",
      textColor: BLACK,
      lineColor: BLACK,
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
      cellPadding: 2,
    },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 95 }, 1: { cellWidth: 95 } }
  });

  // ---- Note + signature + footer ----
  const sigY = doc.lastAutoTable.finalY + 12;
  const sigX = 35;
  const sigW = 28;
  const sigH = 14;

  if (sign) doc.addImage(sign, "PNG", sigX, sigY, sigW, sigH);

  const pageHeight = doc.internal.pageSize.height;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  doc.text("NOTE:", 14, pageHeight - 10);

  doc.setFont("helvetica", "normal");
  doc.text("No files will be delivered until the final payment is made.", 30, pageHeight - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Authorised signature for Walls & Trends", sigX + sigW / 2, sigY + sigH + 8, { align: "center" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const rightX = pageWidth - 15;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...BLUE);
  doc.text("Authenticity Promised. Creativity Published.", rightX, sigY + sigH + 20, { align: "right" });
  doc.text("Thank you for your business!",                  rightX, sigY + sigH + 26, { align: "right" });

  // Return the document instead of saving it directly
  return doc;
}

/* ===== Utilities ===== */

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

function calcSubtotalFromServices(invoice) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  if (!arr.length) return Number(invoice?.subtotal || 0) || 0;
  return arr.reduce((sum, s) => sum + (Number(s?.amount || 0)), 0);
}
