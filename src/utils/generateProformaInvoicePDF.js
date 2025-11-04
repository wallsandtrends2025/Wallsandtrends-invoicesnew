import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import CurrencyService from './CurrencyService';
import { numberToWords } from './generateInvoicePDF';

/**
 * Proforma/quotation PDF generator aligned with the shared Walls & Trends visual reference.
 */

/* ---------------------- Font loader (fixed) ---------------------- */
async function loadCalibriTTF(doc) {
  try {
    // Resolve origin INSIDE the function so we don't rely on outer scope
    const origin =
      typeof window !== 'undefined' ? window.location.origin : '';
    const ttfUrl = `${origin}/fonts/calibri/Calibri.ttf`;

    console.log('🔍 Attempting to load Calibri font from:', ttfUrl);
    const res = await fetch(ttfUrl);
    if (!res.ok) {
      console.warn('⚠️ Calibri font fetch failed, status:', res.status);
      return false;
    }

    const buf = await res.arrayBuffer();
    console.log('📦 Calibri font buffer size:', buf.byteLength, 'bytes');
    if (buf.byteLength === 0) {
      console.warn('⚠️ Calibri font buffer is empty');
      return false;
    }

    const base64 = arrayBufferToBase64(buf);
    console.log('🔄 Calibri font converted to base64, length:', base64.length);
    doc.addFileToVFS('Calibri.ttf', base64);

    try {
      console.log('➕ Adding Calibri font to jsPDF...');
      doc.addFont('Calibri.ttf', 'Calibri', 'normal');

      const fontList = doc.getFontList?.();
      console.log('📋 Available fonts after adding Calibri:', fontList);

      if (doc.internal && doc.internal.getFont) {
        const fontObj = doc.internal.getFont('Calibri', 'normal');
        console.log('🔍 Font object metadata check:', {
          hasMetadata: !!fontObj?.metadata,
          hasUnicode: !!fontObj?.metadata?.Unicode,
          fontObj,
        });

        if (!fontObj?.metadata?.Unicode) {
          console.error(
            '❌ Calibri font loaded but missing Unicode metadata - falling back to Helvetica'
          );
          return false;
        }
      }

      console.log('✅ Calibri font loaded successfully with unicode metadata');
      return true;
    } catch (fontError) {
      console.error('❌ Error adding Calibri font to jsPDF:', fontError);
      return false;
    }
  } catch (error) {
    console.error('❌ Error loading Calibri font:', error);
    return false;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ---------------------- Main generator ---------------------- */
export async function generateProformaInvoicePDF(invoice, client) {
  if (!invoice) throw new Error('Document data is required for PDF generation');
  if (!client) throw new Error('Client data is required for PDF generation');

  const doc = new jsPDF('p', 'mm', 'a4');

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';

  const baseFont = (await loadCalibriTTF(doc)) ? 'Calibri' : 'Helvetica';

  const BLACK = [0, 0, 0];
  const GRAY = [128, 128, 128];
  const BLUE = [59, 89, 152];
  const YELLOW = [255, 222, 88];
  const PAGE_W = 210;
  const M_L = 15,
    M_R = 15,
    M_T = 12;
  const FULL_W = PAGE_W - M_L - M_R;

  const docType = (
    invoice?.proforma_type ||
    invoice?.quotation_type ||
    invoice?.invoice_type ||
    ''
  )
    .toString()
    .toUpperCase()
    .trim();

  const isWT = docType === 'WT' || docType === 'WTPL' || docType.includes('WT');
  const isWTX =
    docType === 'WTX' || docType === 'WTXPL' || docType.includes('WTX');
  const BRAND = isWTX ? YELLOW : BLUE;

  const companyName = 'Walls And Trends';
  const companyGST = isWT ? '36AACFW6827B1Z8' : '36AAACW8991C1Z9';

  const logoPath = `${origin}${isWTX ? '/wtx_logo.png' : '/wt-logo.png'}`;
  const signaturePath = `${origin}/csh-sign.PNG`;

  const safeToDate = (value) => {
    try {
      if (typeof value?.toDate === 'function') return value.toDate();
      if (value instanceof Date) return value;
      return new Date(value);
    } catch {
      return new Date();
    }
  };

  const fmt0 = (n) =>
    Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  async function loadImageToDataURL(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) return null;
      const blob = await res.blob();
      const reader = new FileReader();
      return await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return null;
    }
  }

  const COMPANY_STATE = 'telangana';
  const COMPANY_COUNTRY = 'india';
  const toLower = (s) => (s || '').toString().trim().toLowerCase();
  const clientCountry = toLower(client?.country);
  const clientState = toLower(client?.state);
  const isIndian = clientCountry === COMPANY_COUNTRY;
  const isTelangana = clientState === COMPANY_STATE;

  // Determine invoice type based on client country and currency
  let currency = invoice?.currency || 'INR';
  const isIndianClient = client?.country && client.country.toLowerCase().includes('india');

  // For international clients, determine if they want INR or local currency
  const isInternationalClient = client?.country && !client.country.toLowerCase().includes('india');
  const clientLocalCurrency = isInternationalClient ? CurrencyService.getDefaultCurrencyForClient(client) : 'INR';

  const isInternationalInvoice = currency === 'INR' && isInternationalClient; // International clients requesting INR invoice (show INR + local currency)
  const isClientCurrencyInvoice = currency !== 'INR' && isInternationalClient; // International clients requesting their own currency (show only local currency)

  // Use correct subtotal based on invoice type
  const rawSubtotalINR = invoice?.subtotal_inr || invoice?.subtotal || 0;
  const rawSubtotal = invoice?.subtotal || 0;

  const cleanSubtotalINR = currency === 'INR' ?
    CurrencyService.sanitizeAmount(rawSubtotalINR) :
    CurrencyService.sanitizeAmount(rawSubtotalINR || rawSubtotal);

  const cleanSubtotal = CurrencyService.sanitizeAmount(rawSubtotal);

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

  // Use CurrencyService for tax calculations based on client country and currency
  let gstResult;
  try {
    if (isInternationalInvoice) {
      gstResult = CurrencyService.calculateGST(subtotalINR, client?.state, client);
    } else if (isClientCurrencyInvoice) {
      gstResult = {
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        totalAmount: subtotalINR,
        taxType: 'none'
      };
    } else {
      gstResult = CurrencyService.calculateGST(subtotalINR, client?.state, client);
    }
  } catch (error) {
    console.error('Error in GST calculation, using fallback:', error);
    if (isInternationalInvoice) {
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
      gstResult = {
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalTax: 0,
        totalAmount: subtotalINR,
        taxType: 'none'
      };
    } else {
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
  const totalTax = gstResult.totalTax;

  const computedTotal = Number((subtotalINR + totalTax).toFixed(2));

  let subtotal, total;
  if (isClientCurrencyInvoice) {
    // Client's own currency invoice - Show only client currency, no INR
    subtotal = subtotalINR;
    total = subtotalINR;
  } else {
    subtotal = subtotalINR;
    total = computedTotal;
  }

  const cleanTotalForWords = CurrencyService.sanitizeAmount(total);
  const wordsCurrency = isInternationalInvoice ? 'INR' : displayCurrency;
  const words = numberToWords(cleanTotalForWords, wordsCurrency);

  // Words already calculated above

  let y = M_T;

  // Logo (keep AR visually close to preview)
  let logoBase64 = await loadImageToDataURL(logoPath);
  if (!logoBase64) {
    const fallbacks = [
      `${origin}/wtx_logo.png`,
      `${origin}/wt-logo.png`,
      `${origin}/invoice-logo.png`,
    ];
    for (const f of fallbacks) {
      if (f !== logoPath) {
        logoBase64 = await loadImageToDataURL(f);
        if (logoBase64) break;
      }
    }
  }

  if (logoBase64) {
    const logoHeight = 13.5;
    const logoWidth = 18;
    doc.addImage(logoBase64, 'PNG', M_L, y, logoWidth, logoHeight);
    y += logoHeight + 3;
  }

  // Address (preview-matching)
  doc.setTextColor(...BLACK);
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(9);
  doc.text('19/B, 3rd Floor, Progressive Tower', M_L, y + 4);
  doc.text('100 Ft Road, Siddhi Vinayak Nagar', M_L, y + 8);
  doc.text('Madhapur, Hyderabad, Telangana - 500081', M_L, y + 12);

  // Heading
  y += 6;
  const heading =
    invoice?.pdf_heading ||
    invoice?.proforma_heading ||
    invoice?.quotation_heading ||
    (invoice?.proforma_id ? 'Proforma Invoice' : (invoice?.quotation_id ? 'Quotation' : 'Proforma Invoice'));

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...BRAND);
  doc.text(heading, M_L, y + 20);
  doc.setTextColor(...BLACK);
  y += 24;
  doc.setFontSize(8);

  const numberLabel = invoice?.proforma_id ? 'Proforma Number:' : (invoice?.quotation_id ? 'Quotation Number:' : 'Proforma Number:');
  const titleLabel = invoice?.proforma_id ? 'Proforma Title:' : (invoice?.quotation_id ? 'Quotation Title:' : 'Proforma Title:');
  const dateLabel = invoice?.proforma_id ? 'Proforma Date:' : (invoice?.quotation_id ? 'Quotation Date:' : 'Proforma Date:');
  const totalLabel =
    invoice?.proforma_id || invoice?.proforma_type
      ? 'Proforma Total Cost:'
      : (invoice?.quotation_id ? 'Quotation Total Cost:' : 'Total Cost:');

  const docNumber =
    invoice?.proforma_id || invoice?.quotation_id || invoice?.invoice_id || 'N/A';
  const titleFromServices = deriveTitleFromServices(invoice);
  const docTitle =
    invoice?.proforma_title ||
    invoice?.quotation_title ||
    invoice?.invoice_title ||
    titleFromServices ||
    invoice?.service_name ||
    'N/A';
  const docDate = safeToDate(
    invoice?.proforma_date ||
      invoice?.quotation_date ||
      invoice?.invoice_date ||
      invoice?.created_at
  );

  /* =========================================================
     1) Meta / Top info table — FORCE EQUAL 50/50 COLUMNS
     ========================================================= */
  const metaRows = [
    [
      { content: `${companyName}`, styles: { fontStyle: 'bold', valign: 'top' } },
      { content: `GST IN: ${companyGST}`, styles: { fontStyle: 'bold', valign: 'top' } },
    ],
    [
      {
        content: `${numberLabel} ${String(docNumber)}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell(data) {
          const { cell, doc } = data;
          const labelText = numberLabel.replace(':', '');
          const valueText = String(docNumber);
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;
          doc.setFont(baseFont, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);
          doc.setFont(baseFont, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        },
      },
      {
        content: `${dateLabel} ${formatDate(docDate)}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell(data) {
          const { cell, doc } = data;
          const labelText = dateLabel.replace(':', '');
          const valueText = formatDate(docDate);
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;
          doc.setFont(baseFont, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);
          doc.setFont(baseFont, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        },
      },
    ],
    [
      {
        content: `${titleLabel} ${docTitle}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell(data) {
          const { cell, doc } = data;
          const labelText = titleLabel.replace(':', '');
          const valueText = docTitle;
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;
          doc.setFont(baseFont, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);
          doc.setFont(baseFont, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        },
      },
      {
        content: `${totalLabel} INR ${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell(data) {
          const { cell, doc } = data;
          const labelText = totalLabel.replace(':', '');
          const valueText = `INR ${total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;
          doc.setFont(baseFont, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);
          doc.setFont(baseFont, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        },
      },
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: metaRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      font: baseFont,
      textColor: BLACK,
      halign: 'left',
      valign: 'top',
      lineColor: GRAY,
      lineWidth: 0.5,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
      fillColor: false,
    },
    // 50/50 equal widths
    columnStyles: {
      0: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
      1: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  y = doc.lastAutoTable.finalY + 4;

  /* =========================================================
     2) Customer table — FORCE EQUAL 50/50 COLUMNS
     ========================================================= */
  const customerRows = [
    [
      {
        content: `Customer Name: ${client?.client_name || 'N/A'}`,
        styles: { fontStyle: 'bold', valign: 'top' },
      },
      {
        content: `Customer Address: ${
          client?.address ||
          client?.client_address ||
          'Please update address in client profile'
        }`,
        styles: { fontStyle: 'bold', valign: 'top' },
        rowSpan: 2,
      },
    ],
    [
      {
        content: `Customer GST IN: ${(client?.gst_number || '').trim() || 'NA'}`,
        styles: { fontStyle: 'bold', valign: 'top' },
      },
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: customerRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      font: baseFont,
      textColor: BLACK,
      halign: 'left',
      valign: 'top',
      lineColor: GRAY,
      lineWidth: 0.5,
      cellPadding: { top: 2, right: 4, bottom: 2, left: 4 },
      fillColor: false,
    },
    // 50/50 equal widths
    columnStyles: {
      0: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
      1: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  y = doc.lastAutoTable.finalY + 3;

  /* ---------------------- Items table (unchanged widths) ---------------------- */
  const servicesRows = buildServiceRowsWithCurrency(invoice, displayCurrency);

  // Handle tax rows based on tax type
  let taxRows = [];
  if (gstResult.taxType === 'international' && igstAmount > 0) {
    taxRows.push(
      ['', '', `IGST @ ${gstResult.igstRate}%`, igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    );
  } else if (gstResult.taxType === 'gst') {
    if (gstResult.cgstAmount > 0) {
      taxRows.push(
        ['', '', `CGST @ ${gstResult.cgstRate}%`, cgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
      );
    }
    if (gstResult.sgstAmount > 0) {
      taxRows.push(
        ['', '', `SGST @ ${gstResult.sgstRate}%`, sgstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
      );
    }
    if (gstResult.igstAmount > 0) {
      taxRows.push(
        ['', '', `IGST @ ${gstResult.igstRate}%`, igstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
      );
    }
  } else if (gstResult.taxType === 'none' && !isClientCurrencyInvoice) {
    taxRows.push(
      ['', '', 'GST', 'NA'],
    );
  }

  const amountInWordsRow = [
    { content: '(Total Amount In Words)', colSpan: 3 },
    { content: `${words} only`, styles: { halign: 'right' } },
  ];

  const tableBody = [
    ...servicesRows,
    ['', '', 'Gross', subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    ...taxRows,
    ['', '', 'Total', total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })],
    amountInWordsRow,
  ];

  autoTable(doc, {
    startY: y,
    head: [['HSN / SAC Code', 'Item', 'Description', 'Amount (INR)']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: false,
      textColor: BLACK,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: GRAY,
      lineWidth: 0.5,
      font: baseFont,
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 29, halign: 'center', valign: 'top' },
      1: { cellWidth: 44, halign: 'left', valign: 'top' },
      2: { cellWidth: 63, halign: 'center', valign: 'top' },
      3: { cellWidth: 44, halign: 'center', valign: 'top' },
    },
    styles: {
      fontSize: 8,
      font: baseFont,
      textColor: BLACK,
      halign: 'left',
      valign: 'top',
      lineColor: GRAY,
      lineWidth: 0.5,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 },
      fillColor: false,
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  // Note + Signature + Footer
  let cursorY = doc.lastAutoTable.finalY + 4;
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text(
    'NOTE: No files will be delivered until the final payment is made.',
    M_L,
    cursorY
  );
  cursorY += 8;

  const signatureBase64 = await loadImageToDataURL(signaturePath);
  if (signatureBase64) {
    const signatureX = M_L + 15;
    doc.addImage(signatureBase64, undefined, signatureX, cursorY, 30, 15);
  }

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(6);
  doc.setTextColor(153, 164, 175);
  doc.text(
    'Authorised Signature for Walls & Trends',
    M_L + 15,
    cursorY + 25,
    { align: 'left' }
  );

  const footerX = PAGE_W - M_R - 5;
  doc.setFont(baseFont, 'italic');
  doc.setTextColor(...BRAND);
  doc.setFontSize(9);
  doc.text(
    'Authenticity Promised. Creativity Published.',
    footerX,
    cursorY + 10,
    { align: 'right' }
  );
  doc.text('Thank you for your business!', footerX, cursorY + 22, {
    align: 'right',
  });

  return doc;
}

/* ---------------------- Other exports ---------------------- */
export async function generateTaxInvoicePDF(invoice, client) {
  const taxInvoice = {
    ...invoice,
    pdf_heading: 'Tax Invoice',
  };
  return await generateProformaInvoicePDF(taxInvoice, client);
}

export async function testProformaPDFFixes() {
  const testInvoice = {
    proforma_type: 'WT',
    proforma_id: 'WT2509PRF034',
    proforma_date: new Date('2025-09-25').toISOString(),
    proforma_title: 'Quotation for Nenu Ready',
    currency: 'INR',
    services: [
      {
        name: 'Teaser, Trailer',
        description: 'Teaser + Trailer + Show Reel = 3.5L',
        amount: 350000,
      },
      {
        name: 'Lyrical Videos',
        description: 'Lyrical Videos Total 4 - Standard - 50k each',
        amount: 200000,
      },
    ],
    subtotal: 550000,
    cgst: 0,
    sgst: 0,
    igst: 99000,
    total_amount: 649000,
  };

  const testClient = {
    client_name: 'Harniks India LLP',
    address:
      '29-36-38, Muesuem road, Governorpet, Vijayawada, Andhra Pradesh',
    gst_number: '37AAJH7994P1Z7',
    country: 'india',
    state: 'andhra pradesh',
  };

  return await generateProformaInvoicePDF(testInvoice, testClient);
}

export async function testWTXLogoDetection() {
  console.log('🧪 Testing WTX logo detection...');

  const wtInvoice = {
    proforma_type: 'WT',
    proforma_id: 'WT2509PRF001',
  };

  const wtxInvoice = {
    proforma_type: 'WTX',
    proforma_id: 'WTX2509PRF001',
  };

  const wtType = (wtInvoice?.proforma_type || '').toString().toUpperCase().trim();
  const wtIsWT = wtType === 'WT' || wtType === 'WTPL' || wtType.includes('WT');
  const wtIsWTX = wtType === 'WTX' || wtType === 'WTXPL' || wtType.includes('WTX');
  console.log(`  WT: isWT=${wtIsWT}, isWTX=${wtIsWTX}, logo=${wtIsWTX ? 'WTX' : 'WT'}`);

  const wtxType = (wtxInvoice?.proforma_type || '').toString().toUpperCase().trim();
  const wtxIsWT = wtxType === 'WT' || wtxType === 'WTPL' || wtxType.includes('WT');
  const wtxIsWTX = wtxType === 'WTX' || wtxType === 'WTXPL' || wtxType.includes('WTX');
  console.log(`  WTX: isWT=${wtxIsWT}, isWTX=${wtxIsWTX}, logo=${wtxIsWTX ? 'WTX' : 'WT'}`);

  return { wt: wtIsWTX ? 'WTX' : 'WT', wtx: wtxIsWTX ? 'WTX' : 'WT' };
}

/* ---------------------- Helpers ---------------------- */
function convertNumberToWords(num) {
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  if (num === 0) return 'Zero';
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        ' Hundred' +
        (n % 100 ? ' and ' + inWords(n % 100) : '')
      );
    if (n < 100000)
      return (
        inWords(Math.floor(n / 1000)) +
        ' Thousand' +
        (n % 1000 ? ' ' + inWords(n % 1000) : '')
      );
    if (n < 10000000)
      return (
        inWords(Math.floor(n / 100000)) +
        ' Lakh' +
        (n % 100000 ? ' ' + inWords(n % 100000) : '')
      );
    return (
      inWords(Math.floor(n / 10000000)) +
      ' Crore' +
      (n % 10000000 ? ' ' + inWords(n % 10000000) : '')
    );
  };
  return inWords(num);
}

function formatDate(dateObj) {
  const d = new Date(dateObj);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = d.toLocaleString('en-us', { month: 'long' });
  const yyyy = d.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}

function deriveTitleFromServices(invoice) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  const first = arr[0]?.name;
  if (Array.isArray(first)) return first.filter(Boolean).join(', ');
  return first || '';
}

function buildServiceRowsWithCurrency(invoice, displayCurrency) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  if (arr.length) {
    return arr.map((s, i) => {
      const nm = Array.isArray(s?.name)
        ? s.name.filter(Boolean).join(', ')
        : s?.name || `Service ${i + 1}`;
      const desc = String(s?.description || '');
      const amt = Number(s?.amount || 0);
      const formattedAmount = amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return ['9983', String(nm), desc, formattedAmount];
    });
  }
  const nm = String(
    invoice?.service_name ||
      invoice?.proforma_title ||
      invoice?.quotation_title ||
      invoice?.invoice_title ||
      'Service'
  );
  const desc = String(invoice?.service_description || '');
  const amt = Number(invoice?.subtotal || 0);
  const formattedAmount = amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return [['9983', nm, desc, formattedAmount]];
}

function calcSubtotalFromServices(invoice) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  if (!arr.length) return Number(invoice?.subtotal || 0) || 0;
  return arr.reduce((sum, s) => sum + (Number(s?.amount || 0)), 0);
}

function roundToTwo(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

