import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/* ---------------------- Optional Calibri loader with fallback ---------------------- */
async function loadCalibriTTF(doc) {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ttfUrl = `${origin}/fonts/calibri/Calibri.ttf`;
    const res = await fetch(ttfUrl);
    if (!res.ok) return false;

    const buf = await res.arrayBuffer();
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
/* ---------------------------------------------------------------------------------- */

export async function generateQuotationPDF(quotation, client) {
  // Use A4 format for consistent sizing with other PDFs
  const doc = new jsPDF("p", "mm", "a4");

  // Choose font (Calibri if found, else Helvetica)
  const hasCalibri = await loadCalibriTTF(doc);
  const BASE_FONT = hasCalibri ? "calibri" : "helvetica";

  // Colors/metrics
  const BLACK = [0, 0, 0];
  const BLUE = [59, 89, 152];
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const M_L = 15, M_R = 15, M_T = 12;
  const FULL_W = PAGE_W - M_L - M_R;

  // Brand + assets
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const isWT = (quotation?.quotation_type || "").toUpperCase().includes("WT") && 
               !(quotation?.quotation_type || "").toUpperCase().includes("WTX");
  const logoPath = `${origin}${isWT ? "/wt-logo.png" : "/wtx_logo.png"}`;
  const signaturePath = `${origin}/csh-sign.PNG`;

  // Helpers
  async function loadImage(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
  const fmt2 = (n) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Draw logo
  let y = M_T;
  const logoBase64 = await loadImage(logoPath);
  if (logoBase64) {
    // approximately match preview height/spacing
    doc.addImage(logoBase64, undefined, M_L, y, 18, 13.5);
    y += 16.5; // logo height + small gap
  }

  // Company address
  doc.setFont(BASE_FONT, "normal");
  doc.setFontSize(9);
  doc.setTextColor(...BLACK);
  doc.text("19/B, 3rd Floor, Progressive Tower", M_L, y + 4);
  doc.text("100 Ft Road, Siddhi Vinayak Nagar", M_L, y + 8);
  doc.text("Madhapur, Hyderabad, Telangana - 500081", M_L, y + 12);

  // Heading (“Quotation” for this file)
  y += 6;
  doc.setFont(BASE_FONT, "normal");
  doc.setFontSize(20);
  doc.setTextColor(...BLUE);
  doc.text("Quotation", M_L, y + 20);
  doc.setTextColor(...BLACK);
  y += 24; // spacing down to first table

  /* =========================================================
     1) META / TOP INFO — equal 50/50 columns via AutoTable
     ========================================================= */
  const companyName = "Walls And Trends";
  const companyGST = isWT ? "36AACFW6827B1Z8" : "36AAACW8991C1Z9";

  const docNumber = quotation?.quotation_id || "N/A";
  const docDate = quotation?.quotation_date ? new Date(quotation.quotation_date) : new Date();
  const docTitle = quotation?.quotation_title || quotation?.title || "N/A";
  const total = Number(quotation?.total_amount) || 0;

  const metaRows = [
    [
      { content: companyName, styles: { fontStyle: "bold" } },
      { content: `GST IN: ${companyGST}`, styles: { fontStyle: "bold" } },
    ],
    [
      { // Quotation Number
        content: `Quotation Number: ${String(docNumber)}`,
        didDrawCell: ({ cell }) => {
          // no-op; we already draw inline text simple
        }
      },
      { // Quotation Date
        content: `Quotation Date: ${formatDate(docDate)}`
      }
    ],
    [
      { content: `Quotation Title: ${docTitle}` },
      { content: `Total Cost: INR ${fmt2(total)}` }
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: metaRows,
    theme: "grid",
    styles: {
      font: BASE_FONT,
      fontSize: 8,
      textColor: BLACK,
      halign: "left",
      valign: "top",
      lineColor: [128, 128, 128],
      lineWidth: 0.5,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
      fillColor: false,
    },
    // FORCE 50/50 equal widths
    columnStyles: {
      0: { cellWidth: FULL_W / 2, halign: "left", valign: "top" },
      1: { cellWidth: FULL_W / 2, halign: "left", valign: "top" },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  y = doc.lastAutoTable.finalY + 4;

  /* =========================================================
     2) CUSTOMER BLOCK — equal 50/50 columns via AutoTable
        Address uses rowSpan: 2
     ========================================================= */
  const displayClient = client || {
    client_name: "Client Not Found",
    address: "Please update address in client profile",
    gst_number: "N/A",
  };

  const customerRows = [
    [
      { content: `Customer Name: ${displayClient.client_name || "N/A"}`, styles: { fontStyle: "bold" } },
      { content: `Customer Address: ${displayClient.address || "N/A"}`, styles: { fontStyle: "bold" }, rowSpan: 2 },
    ],
    [
      { content: `Customer GST IN: ${(displayClient.gst_number || "").trim() || "NA"}`, styles: { fontStyle: "bold" } },
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: customerRows,
    theme: "grid",
    styles: {
      font: BASE_FONT,
      fontSize: 8,
      textColor: BLACK,
      halign: "left",
      valign: "top",
      lineColor: [128, 128, 128],
      lineWidth: 0.5,
      cellPadding: { top: 2, right: 4, bottom: 2, left: 4 },
      fillColor: false,
    },
    // FORCE 50/50 equal widths
    columnStyles: {
      0: { cellWidth: FULL_W / 2, halign: "left", valign: "top" },
      1: { cellWidth: FULL_W / 2, halign: "left", valign: "top" },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  const customerEndY = doc.lastAutoTable.finalY;

  /* ===========================
     Items table (your original)
     =========================== */
  const tableBody = Array.isArray(quotation?.services)
    ? quotation.services.map((s, idx) => [
        "9983",
        s?.name || "Posters",
        s?.description || "",
        fmt2(Number(s?.amount || 0)),
      ])
    : [];

  // Fallback if no services
  if (!tableBody.length) {
    tableBody.push(["9983", "Item", "", fmt2(0)]);
  }

  autoTable(doc, {
    startY: customerEndY + 5,
    head: [["HSN/SAC", "Item", "Description", "Amount (INR)"]],
    body: [
      ...tableBody,
      ["", "", "Gross", fmt2(total)], // if you have explicit subtotal, use it here
      ["", "", { content: "IGST @ 18%", styles: { fontStyle: "bold" } }, { content: fmt2(0), styles: { fontStyle: "bold" } }],
      ["", "", { content: "Total", styles: { fontStyle: "bold" } }, { content: fmt2(total), styles: { fontStyle: "bold" } }],
    ],
    theme: "grid",
    headStyles: {
      fillColor: false,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      font: BASE_FONT,
      fontSize: 8,
    },
    styles: {
      fontSize: 8,
      font: BASE_FONT,
      textColor: [0, 0, 0],
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35, halign: "left" },
      2: { cellWidth: 60, halign: "center" },
      3: { cellWidth: 30 },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  // Bank Details table (unchanged)
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
      ["City", "Hyderabad"],
    ],
    theme: "grid",
    headStyles: {
      fillColor: false,
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      font: BASE_FONT,
    },
    styles: {
      fontSize: 8,
      font: BASE_FONT,
      textColor: [0, 0, 0],
      halign: "left",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
    },
    columnStyles: { 0: { cellWidth: FULL_W / 2 }, 1: { cellWidth: FULL_W / 2 } },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  // Amount in Words table (unchanged content)
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 5,
    body: [
      [
        { content: "(Total Amount In Words)", styles: { fontStyle: "bold", halign: "left", valign: "middle" } },
        { content: `${convertNumberToWords(Math.floor(total))} Rupees only`, styles: { halign: "left", valign: "middle" } },
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: 8,
      font: BASE_FONT,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
    },
    columnStyles: { 0: { cellWidth: FULL_W / 2 }, 1: { cellWidth: FULL_W / 2 } },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  // Signature + footer
  const sigBlockY = doc.lastAutoTable.finalY + 8;
  const sigBlockX = M_L;
  const sigImgWidth = 30;
  const sigImgHeight = 15;

  const signatureBase64 = await loadImage(signaturePath);
  if (signatureBase64) {
    doc.addImage(signatureBase64, undefined, sigBlockX, sigBlockY, sigImgWidth, sigImgHeight);
  }

  doc.setFont(BASE_FONT, "normal");
  doc.setFontSize(6);
  doc.setTextColor(153, 164, 175);
  doc.text("Authorised Signature for Walls & Trends", sigBlockX, sigBlockY + sigImgHeight + 7);

  const footerX = PAGE_W - M_R - 5;
  doc.setFont(BASE_FONT, "italic");
  doc.setTextColor(...BLUE);
  doc.setFontSize(9);
  doc.text("Authenticity Promised. Creativity Published.", footerX, sigBlockY + 8, { align: "right" });
  doc.text("Thank you for your business!", footerX, sigBlockY + 20, { align: "right" });

  // Payment note
  doc.setFont(BASE_FONT, "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text("NOTE: No files will be delivered until the final payment is made.", M_L, PAGE_H - 10);

  doc.save(`${docNumber}.pdf`);
}

/* ---------------------- helpers ---------------------- */
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
