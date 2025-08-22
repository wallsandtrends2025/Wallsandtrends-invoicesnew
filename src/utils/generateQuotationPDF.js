import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function generateQuotationPDF(quotation, client) {
  const doc = new jsPDF();

  doc.setFont("Arial", "normal");

  const isWT = quotation.quotation_type === "WT" || quotation.quotation_type === "WTPL";
  const logoPath = `${window.location.origin}${isWT ? "/wt-logo.png" : "/wtx_logo.webp"}`;
  const signaturePath = `${window.location.origin}/csh-sign.PNG`;

  async function loadImage(path) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Failed to load image at ${path}`);
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.error("Image load failed:", err);
      return null;
    }
  }

  const logoBase64 = await loadImage(logoPath);
  const signatureBase64 = await loadImage(signaturePath);

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", 15, 10, 30, 18);
  }

  doc.setFontSize(10);
  doc.text("19/B, 3rd Floor, Progressive Tower, 100 Ft Road,", 15, 32);
  doc.text("Siddhi Vinayak Nagar, Madhapur,", 15, 37);
  doc.text("Hyderabad, Telangana - 500081", 15, 42);

  doc.setFontSize(16);
  doc.setTextColor(59, 89, 152);
  doc.setFont("Arial", "normal");
  doc.text("Quotation", 15, 52);

  function printInlineLabelValue(label, value, x, y) {
    doc.setFont("Arial", "bold");
    doc.text(label, x, y);
    const labelWidth = doc.getTextWidth(label);
    doc.setFont("Arial", "normal");
    doc.text(value, x + labelWidth + 1, y);
  }

  doc.setFontSize(10);
  doc.setTextColor(0);
  let currentY = 55;
  const rowHeight = 7;

  doc.rect(15, currentY, 95, rowHeight);
  doc.rect(110, currentY, 95, rowHeight);
  printInlineLabelValue("Quotation Number:", quotation.quotation_id, 17, currentY + 5);
  printInlineLabelValue("GST IN:", isWT ? "36AACFW6827B1Z8" : "WTX GST NUMBER", 112, currentY + 5);

  currentY += rowHeight;
  doc.rect(15, currentY, 95, rowHeight);
  doc.rect(110, currentY, 95, rowHeight);
  printInlineLabelValue("Quotation Date:", formatDate(new Date(quotation.quotation_date)), 17, currentY + 5);
  printInlineLabelValue("Total Cost:", `INR ${Number(quotation.total_amount).toLocaleString("en-IN")}`, 112, currentY + 5);

  currentY += rowHeight;
  doc.rect(15, currentY, 190, rowHeight);
  printInlineLabelValue("Quotation Title:", quotation.quotation_title || "N/A", 17, currentY + 5);

  const metaEndY = currentY + rowHeight;
  doc.setFont("Arial", "normal");
  doc.text(
    `This quotation prepared by Walls & Trends (${quotation.quotation_type}) includes the selected service for ${client.client_name}.`,
    15,
    metaEndY + 5
  );

  let customerY = metaEndY + 15;

  doc.rect(15, customerY, 95, rowHeight);
  doc.rect(110, customerY, 95, rowHeight);
  printInlineLabelValue("Customer Name:", client.client_name || "N/A", 17, customerY + 5);
  printInlineLabelValue("Customer Address:", client.address || "N/A", 112, customerY + 5);

  customerY += rowHeight;
  doc.rect(15, customerY, 190, rowHeight);
  printInlineLabelValue("Customer GST IN:", client.gst_number || "N/A", 17, customerY + 5);

  const customerEndY = customerY + rowHeight;

  const tableBody = quotation.services.map((s) => [
    "9983",
    s.name || "",
    s.description || "",
    Number(s.amount).toLocaleString("en-IN")
  ]);

  const total = Number(quotation.total_amount);

  autoTable(doc, {
    startY: customerEndY + 5,
    head: [["HSN / SAC Code", "Item", "Description", "Amount (INR)"]],
    body: [
      ...tableBody,
      ["", "", "Gross", total.toLocaleString("en-IN")],
      ["", "", { content: "Total", styles: { fontStyle: "bold" } }, { content: total.toLocaleString("en-IN"), styles: { fontStyle: "bold" } }]
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
      fontSize: 10,
      font: "Arial",
      textColor: [0, 0, 0],
      halign: "center",
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 47.5 },
      1: { cellWidth: 47.5 },
      2: { cellWidth: 47.5 },
      3: { cellWidth: 47.5 }
    }
  });

  const amountWords = convertNumberToWords(Math.floor(total));
  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 2,
    body: [
      [
        { content: "(Total Amount In Words)", styles: { fontStyle: "bold", halign: "left", valign: "middle" } },
        { content: `${amountWords} only`, styles: { halign: "left", valign: "middle" } }
      ]
    ],
    theme: "grid",
    styles: {
      fontSize: 10,
      font: "Arial",
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 95 }
    }
  });


  const sigBlockY = doc.lastAutoTable.finalY + 12;
  const sigBlockX = 35;
  const sigImgWidth = 28;
  const sigImgHeight = 14;

  if (signatureBase64) {
    doc.addImage(signatureBase64, "PNG", sigBlockX, sigBlockY, sigImgWidth, sigImgHeight);
  }

  const sigLineY = sigBlockY + sigImgHeight + 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.line(sigBlockX, sigLineY, sigBlockX + sigImgWidth, sigLineY);

  doc.setFont("Arial", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("Authorised signature for Walls & Trends", sigBlockX + sigImgWidth / 2, sigLineY + 6, { align: "center" });

  const footerY = sigBlockY + 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightAlignX = pageWidth - 15;

  doc.setFont("times", "italic");
  doc.setFontSize(9);
  doc.setTextColor(59, 89, 152);
  doc.text("Authenticity Promised. Creativity Published.", rightAlignX, footerY, { align: "right" });
  doc.text("Thank you for your business!", rightAlignX, footerY + 6, { align: "right" });

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
