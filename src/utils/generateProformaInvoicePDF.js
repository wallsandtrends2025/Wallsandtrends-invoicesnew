import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Proforma/quotation PDF generator aligned with the shared Walls & Trends visual reference.
 */
async function loadCalibriTTF(doc) {
  try {
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
      
      // Validate font was added properly
      const fontList = doc.getFontList();
      console.log('📋 Available fonts after adding Calibri:', fontList);
      
      // Check if font has unicode metadata
      if (doc.internal && doc.internal.getFont) {
        const fontObj = doc.internal.getFont('Calibri', 'normal');
        console.log('🔍 Font object metadata check:', {
          hasMetadata: !!fontObj?.metadata,
          hasUnicode: !!fontObj?.metadata?.Unicode,
          fontObj: fontObj
        });
        
        // If no unicode metadata, return false to use fallback
        if (!fontObj?.metadata?.Unicode) {
          console.error('❌ Calibri font loaded but missing Unicode metadata - falling back to Helvetica');
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

export async function generateProformaInvoicePDF(invoice, client) {
  if (!invoice) throw new Error('Document data is required for PDF generation');
  if (!client) throw new Error('Client data is required for PDF generation');

  const doc = new jsPDF('p', 'mm', 'a4');

  // Declare origin variable at the top level to avoid lexical declaration error
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const baseFont = await loadCalibriTTF(doc) ? 'Calibri' : 'Helvetica';

  const BLACK = [0, 0, 0];
  const GRAY = [128, 128, 128];
  const BLUE = [59, 89, 152];
  const YELLOW = [255, 222, 88];
  const PAGE_W = 210;
  const M_L = 15, M_R = 15, M_T = 12; // Slightly increased margins for better centering
  const FULL_W = PAGE_W - M_L - M_R;

  const docType = (invoice?.proforma_type || invoice?.quotation_type || invoice?.invoice_type || "").toString().toUpperCase().trim();
  console.log('🔍 PDF DEBUG: Document type detection:', {
    proforma_type: invoice?.proforma_type,
    quotation_type: invoice?.quotation_type,
    invoice_type: invoice?.invoice_type,
    final_docType: docType,
    docType_length: docType.length
  });

  // Enhanced type detection for WTX
  const isWT = docType === 'WT' || docType === 'WTPL' || docType.includes('WT');
  const isWTX = docType === 'WTX' || docType === 'WTXPL' || docType.includes('WTX');
  const BRAND = isWTX ? YELLOW : BLUE;

  console.log('🔍 PDF DEBUG: Enhanced type analysis:', {
    docType,
    isWT,
    isWTX,
    BRAND: isWTX ? 'YELLOW' : 'BLUE',
    docType_charCodes: docType.split('').map(c => c.charCodeAt(0))
  });

  // Test different type values to ensure logic works
  console.log('🔍 PDF DEBUG: Testing type detection logic:');
  const testTypes = ['WT', 'WTX', 'WTPL', 'WTXPL', 'wt', 'wtx'];
  testTypes.forEach(testType => {
    const testIsWT = testType === 'WT' || testType === 'WTPL' || testType.includes('WT');
    const testIsWTX = testType === 'WTX' || testType === 'WTXPL' || testType.includes('WTX');
    const testLogoPath = testIsWTX ? `${origin}/wtx_logo.png` : `${origin}/wt-logo.png`;
    console.log(`  ${testType}: isWT=${testIsWT}, isWTX=${testIsWTX}, logo=${testLogoPath}`);
  });

  console.log('🔍 PDF DEBUG: Brand selection:', {
    isWT,
    isWTX,
    BRAND: isWTX ? 'YELLOW' : 'BLUE'
  });

  const companyName = 'Walls And Trends';
  const companyGST = isWT ? '36AACFW6827B1Z8' : '36AAACW8991C1Z9';

  const logoPath = `${origin}${isWTX ? '/wtx_logo.png' : '/wt-logo.png'}`;
  const signaturePath = `${origin}/csh-sign.PNG`;

  console.log('🔍 PDF DEBUG: Logo path selection:', {
    origin,
    logoPath,
    signaturePath,
    isWTX,
    isWT
  });

  // Test direct logo file access in PDF generation
  console.log('🔍 PDF DEBUG: Testing direct logo file access...');
  if (typeof window !== 'undefined') {
    fetch('/wt-logo.png')
      .then(response => {
        console.log('✅ PDF DEBUG: /wt-logo.png accessible:', response.ok, 'status:', response.status);
        if (response.ok) {
          console.log('✅ PDF DEBUG: WT logo file exists and is accessible');
        } else {
          console.error('❌ PDF DEBUG: WT logo file not accessible, status:', response.status);
        }
      })
      .catch(error => console.error('❌ PDF DEBUG: /wt-logo.png error:', error));

    fetch('/wtx_logo.png')
      .then(response => {
        console.log('✅ PDF DEBUG: /wtx_logo.png accessible:', response.ok, 'status:', response.status);
        if (response.ok) {
          console.log('✅ PDF DEBUG: WTX logo file exists and is accessible');
        } else {
          console.error('❌ PDF DEBUG: WTX logo file not accessible, status:', response.status);
        }
      })
      .catch(error => console.error('❌ PDF DEBUG: /wtx_logo.png error:', error));

    // Test with full URL
    const fullWtPath = `${window.location.origin}/wt-logo.png`;
    const fullWtxPath = `${window.location.origin}/wtx_logo.png`;

    console.log('🔍 PDF DEBUG: Testing full URL logo access...');
    fetch(fullWtPath)
      .then(response => {
        console.log('✅ PDF DEBUG: Full WT logo accessible:', response.ok, 'status:', response.status);
      })
      .catch(error => console.error('❌ PDF DEBUG: Full WT logo error:', error));

    fetch(fullWtxPath)
      .then(response => {
        console.log('✅ PDF DEBUG: Full WTX logo accessible:', response.ok, 'status:', response.status);
      })
      .catch(error => console.error('❌ PDF DEBUG: Full WTX logo error:', error));
  }

  const safeToDate = (value) => {
    try {
      if (typeof value?.toDate === 'function') return value.toDate();
      if (value instanceof Date) return value;
      return new Date(value);
    } catch {
      return new Date();
    }
  };

  const fmt0 = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function loadImageToDataURL(path) {
    try {
      console.log('🔍 PDF DEBUG: Loading image from path:', path);
      const res = await fetch(path);
      console.log('🔍 PDF DEBUG: Fetch response status:', res.status, 'ok:', res.ok);
      if (!res.ok) {
        console.error('❌ PDF DEBUG: Failed to load image:', path, 'Status:', res.status);
        console.error('❌ PDF DEBUG: Response headers:', [...res.headers.entries()]);
        return null;
      }
      const blob = await res.blob();
      console.log('✅ PDF DEBUG: Image loaded successfully:', path, 'Type:', blob.type, 'Size:', blob.size);
      const reader = new FileReader();
      return await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          console.log('📄 PDF DEBUG: Image converted to DataURL, length:', reader.result?.length || 0);
          resolve(reader.result);
        };
        reader.onerror = () => {
          console.error('❌ PDF DEBUG: FileReader failed for path:', path);
          reject(new Error('FileReader failed'));
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ PDF DEBUG: Error loading image:', path, error);
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

  const rawSubtotal = invoice?.subtotal != null ? Number(invoice.subtotal) : calcSubtotalFromServices(invoice);
  const subtotal = Number.isFinite(rawSubtotal) ? rawSubtotal : 0;

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9;
    sgstRate = 9;
  } else if (isIndian) {
    igstRate = 18;
  }

  const cgstAmount = invoice?.cgst != null ? Number(invoice.cgst) : roundToTwo(subtotal * (cgstRate / 100));
  const sgstAmount = invoice?.sgst != null ? Number(invoice.sgst) : roundToTwo(subtotal * (sgstRate / 100));
  const igstAmount = invoice?.igst != null ? Number(invoice.igst) : roundToTwo(subtotal * (igstRate / 100));
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const computedTotal = roundToTwo(subtotal + totalTax);
  const total = invoice?.total_amount != null ? Number(invoice.total_amount) : computedTotal;

  const precise = roundToTwo(total);
  const rupees = Math.floor(precise);
  const paise = Math.round((precise - rupees) * 100);
  let words = convertNumberToWords(rupees);
  if (paise > 0) {
    words += ` and ${convertNumberToWords(paise)} Paise`;
  }

  let y = M_T;

  // Logo - match preview exactly (48px height)
  console.log('🖼️ PDF DEBUG: Attempting to load logo from path:', logoPath);

  let logoBase64 = await loadImageToDataURL(logoPath);

  // Try fallback logos if primary logo fails
  if (!logoBase64) {
    console.log('🔄 PDF DEBUG: Primary logo failed, trying fallbacks...');
    const fallbackPaths = [
      `${origin}/wtx_logo.png`,
      `${origin}/wt-logo.png`,
      `${origin}/invoice-logo.png`
    ];

    for (const fallbackPath of fallbackPaths) {
      if (fallbackPath !== logoPath) {
        console.log('🔄 PDF DEBUG: Trying fallback logo:', fallbackPath);
        logoBase64 = await loadImageToDataURL(fallbackPath);
        if (logoBase64) {
          console.log('✅ PDF DEBUG: Fallback logo loaded successfully');
          break;
        }
      }
    }

    // If still no logo, try alternative extensions
    if (!logoBase64) {
      console.log('🔄 PDF DEBUG: Trying alternative extensions...');
      const altExtensions = ['.png', '.jpg', '.jpeg', '.svg'];

      for (const ext of altExtensions) {
        if (!logoPath.endsWith(ext)) {
          const altPath = logoPath.replace(/\.[^/.]+$/, ext);
          console.log('🔄 PDF DEBUG: Trying alternative extension:', altPath);
          logoBase64 = await loadImageToDataURL(altPath);
          if (logoBase64) {
            console.log('✅ PDF DEBUG: Alternative extension logo loaded successfully');
            break;
          }
        }
      }
    }
  }

  if (logoBase64) {
    console.log('✅ PDF DEBUG: Logo loaded successfully, size:', logoBase64.length);

    // Use dimensions that closely match the preview
    // Preview uses height: 44px, so we use approximately 13.5mm height in PDF
    // Width is set proportionally to maintain aspect ratio
    const logoHeight = 13.5; // Slightly increased for better match with preview
    const logoWidth = 18;    // Slightly increased proportionally

    console.log('🖼️ PDF DEBUG: Using logo dimensions:', { logoWidth, logoHeight });

    doc.addImage(logoBase64, 'PNG', M_L, y, logoWidth, logoHeight);
    y += logoHeight + 3; // Update Y position with small spacing (slightly increased for new size)
  } else {
    console.error('❌ PDF DEBUG: All logo paths failed for path:', logoPath);
    console.error('❌ PDF DEBUG: Tried paths:', [
      logoPath,
      `${origin}/wtx_logo.png`,
      `${origin}/wt-logo.png`,
      `${origin}/invoice-logo.png`
    ]);
  }

  // Note: Y position will be updated after logo is processed to maintain proper spacing

  // Company address - match preview styling exactly with proper spacing
  doc.setTextColor(...BLACK);
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(9);
  doc.text('19/B, 3rd Floor, Progressive Tower', M_L, y + 4); // 4px spacing from logo
  doc.text('100 Ft Road, Siddhi Vinayak Nagar', M_L, y + 8); // 4px line spacing
  doc.text('Madhapur, Hyderabad, Telangana - 500081', M_L, y + 12); // 4px line spacing

  // Heading - match preview exactly with reduced spacing
  y += 6; // Add spacing above heading
  const heading = invoice?.pdf_heading
    || invoice?.proforma_heading
    || invoice?.quotation_heading
    || (invoice?.quotation_id ? 'Quotation' : 'Proforma Invoice');

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(20);
  doc.setTextColor(...BRAND);
  doc.text(heading, M_L, y + 20); // 8px spacing from address

  // Ensure the color is applied by setting it again
  doc.setTextColor(...BRAND);

  y += 24; // Reduced spacing for single page to separate heading from box
  doc.setFontSize(8);

  const numberLabel = invoice?.quotation_id ? 'Quotation Number:' : 'Proforma Number:';
  const titleLabel = invoice?.quotation_id ? 'Quotation Title:' : 'Proforma Title:';
  const dateLabel = invoice?.quotation_id ? 'Quotation Date:' : 'Proforma Date:';
  const totalLabel = invoice?.quotation_id || invoice?.proforma_id || invoice?.proforma_type ? 'Proforma Total Cost:' : 'Total Cost:';


  const docNumber = invoice?.proforma_id || invoice?.quotation_id || invoice?.invoice_id || 'N/A';
  const titleFromServices = deriveTitleFromServices(invoice);
  const docTitle = invoice?.proforma_title
    || invoice?.quotation_title
    || invoice?.invoice_title
    || titleFromServices
    || invoice?.service_name
    || 'N/A';
  const docDate = safeToDate(
    invoice?.proforma_date
    || invoice?.quotation_date
    || invoice?.invoice_date
    || invoice?.created_at
  );

  const docKind = invoice?.quotation_id ? 'quotation' : 'invoice';
  const summarySource = invoice?.summary_note || docTitle;
  const summary = `This ${docKind} prepared by ${companyName} (${isWTX ? 'WTX' : 'WT'}) includes ${summarySource} for ${client?.client_name || 'the client'}.`;

  const metaRows = [
    [
      {
        content: `${companyName}`,
        styles: { fontStyle: 'bold', valign: 'top' }
      },
      {
        content: `GST IN: ${companyGST}`,
        styles: { fontStyle: 'bold', valign: 'top' }
      }
    ],
    [
      {
        content: `${numberLabel} ${String(docNumber)}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell: function(data) {
          const { cell, doc } = data;
          const labelText = numberLabel.replace(':', '');
          const valueText = String(docNumber);
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;

          // Draw label in bold
          doc.setFont(doc.getFont().fontName, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);

          // Draw value in normal
          doc.setFont(doc.getFont().fontName, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        }
      },
      {
        content: `${dateLabel} ${formatDate(docDate)}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell: function(data) {
          const { cell, doc } = data;
          const labelText = dateLabel.replace(':', '');
          const valueText = formatDate(docDate);
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;

          // Draw label in bold
          doc.setFont(doc.getFont().fontName, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);

          // Draw value in normal
          doc.setFont(doc.getFont().fontName, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        }
      }
    ],
    [
      {
        content: `${titleLabel} ${docTitle}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell: function(data) {
          const { cell, doc } = data;
          const labelText = titleLabel.replace(':', '');
          const valueText = docTitle;
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;

          // Draw label in bold
          doc.setFont(doc.getFont().fontName, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);

          // Draw value in normal
          doc.setFont(doc.getFont().fontName, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        }
      },
      {
        content: `${totalLabel} ${fmt0(total)}`,
        styles: { fontStyle: 'bold', valign: 'top' },
        didDrawCell: function(data) {
          const { cell, doc } = data;
          const labelText = totalLabel.replace(':', '');
          const valueText = fmt0(total);
          const labelWidth = doc.getTextWidth(labelText + ': ');
          const cellX = cell.x;
          const cellY = cell.y + 3;

          // Draw label in bold
          doc.setFont(doc.getFont().fontName, 'bold');
          doc.text(labelText + ':', cellX + 2, cellY);

          // Draw value in normal
          doc.setFont(doc.getFont().fontName, 'normal');
          doc.text(valueText, cellX + 2 + labelWidth, cellY);
        }
      }
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
    columnStyles: {
      0: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
      1: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  y = doc.lastAutoTable.finalY + 4; // Little bit spacing after meta information box

  // ---- Customer Information Section
  // 🔍 DEBUG: Customer section should match preview layout
  console.log("🔍 Proforma Customer Section Layout:");
  console.log("  Row 1: [Customer Name] [Customer Address - rowSpan 2]");
  console.log("  Row 2: [Customer GST IN] [continues from row 1]");
  
  const customerRows = [
    [
      { content: `Customer Name: ${client?.client_name || 'N/A'}`, styles: { fontStyle: 'bold', valign: 'top' } },
      { content: `Customer Address: ${client?.address || client?.client_address || 'Please update address in client profile'}`, styles: { fontStyle: 'bold', valign: 'top' }, rowSpan: 2 }
    ],
    [
      { content: `Customer GST IN: ${(client?.gst_number || '').trim() || 'NA'}`, styles: { fontStyle: 'bold', valign: 'top' } }
    ]
  ];
  
  console.log("✅ Proforma customer table configured with address rowSpan=2");

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
    columnStyles: {
      0: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
      1: { cellWidth: FULL_W / 2, valign: 'top', halign: 'left' },
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  y = doc.lastAutoTable.finalY + 3; // Minimal spacing after customer information box

  const servicesRows = buildServiceRowsNoDecimals(invoice, fmt0);
  const taxRows = isIndian && isTelangana
    ? [
        ['', '', `CGST @ ${cgstRate}%`, fmt0(cgstAmount)],
        ['', '', `SGST @ ${sgstRate}%`, fmt0(sgstAmount)],
      ]
    : [
        ['', '', `IGST @ ${igstRate}%`, fmt0(igstAmount)],
      ];

  const amountInWordsRow = [
    { content: '(Total Amount In Words)', colSpan: 3 },
    { content: `${words} only`, styles: { halign: 'right' } },
  ];

  const tableBody = [
    ...servicesRows,
    ['', '', 'Gross', fmt0(subtotal)],
    ...taxRows,
    ['', '', 'Total', fmt0(total)],
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
      3: { cellWidth: 44, halign: 'center', valign: 'top' }, // Center align Amount (INR) column
    },
    styles: {
      fontSize: 8,
      font: baseFont,
      textColor: BLACK,
      halign: 'left',
      valign: 'top',
      lineColor: GRAY,
      lineWidth: 0.5,
      cellPadding: { top: 3, right: 6, bottom: 3, left: 6 }, // Match preview padding
      fillColor: false,
    },
    tableWidth: FULL_W,
    margin: { left: M_L, right: M_R },
  });

  // Single page layout - no page breaks
  let cursorY = doc.lastAutoTable.finalY + 4; // Little bit spacing after services table

  // ---- Payment Note
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BLACK);
  doc.text('NOTE: No files will be delivered until the final payment is made.', M_L, cursorY);

  cursorY += 8; // Reduced spacing for single page

  // ---- Signature & Footer - matching tax invoice exactly
  const signatureBase64 = await loadImageToDataURL(signaturePath);
  if (signatureBase64) {
    console.log('Signature loaded successfully, adding to PDF...');
    // Position signature image slightly left of center (matching tax invoice)
    const signatureX = M_L + 15; // Less centered, matching tax invoice
    console.log('Adding signature at position:', { x: signatureX, y: cursorY, width: 30, height: 15 });
    doc.addImage(signatureBase64, undefined, signatureX, cursorY, 30, 15); // undefined = auto-detect format
  } else {
    console.warn('Signature could not be loaded, continuing without signature');
  }

  // Authorised Signature text below signature - left-aligned with image (matching tax invoice)
  console.log('Adding signature text at position:', { x: M_L + 15, y: cursorY + 25 });
  doc.setFont(baseFont, 'normal');
  doc.setFontSize(6); // Smaller font size matching tax invoice
  doc.setTextColor(153, 164, 175); // Gray color matching tax invoice
  doc.text('Authorised Signature for Walls & Trends', M_L + 15, cursorY + 25, { align: 'left' });

  // Footer text on the right side - with more spacing (matching tax invoice)
  const footerX = PAGE_W - M_R - 5; // Closer to right edge, matching tax invoice
  console.log('Adding footer text at positions:', {
    line1: { x: footerX, y: cursorY + 10 },
    line2: { x: footerX, y: cursorY + 22 } // More spacing between lines, matching tax invoice
  });
  doc.setFont(baseFont, 'italic');
  doc.setTextColor(...BRAND);
  doc.setFontSize(9);
  doc.text('Authenticity Promised. Creativity Published.', footerX, cursorY + 10, { align: 'right' });
  doc.text('Thank you for your business!', footerX, cursorY + 22, { align: 'right' }); // More spacing, matching tax invoice

  return doc;
}

export async function generateTaxInvoicePDF(invoice, client) {
  // For now, use the same function as proforma but with tax invoice heading
  const taxInvoice = {
    ...invoice,
    pdf_heading: 'Tax Invoice'
  };
  return await generateProformaInvoicePDF(taxInvoice, client);
}

export async function testProformaPDFFixes() {
    const testInvoice = {
      proforma_type: 'WT',
      proforma_id: 'WT2509PRF034',
      proforma_date: new Date('2025-09-25').toISOString(),
      proforma_title: 'Quotation for Nenu Ready',
      services: [
        { name: 'Teaser, Trailer', description: 'Teaser + Trailer + Show Reel = 3.5L', amount: 350000 },
        { name: 'Lyrical Videos', description: 'Lyrical Videos Total 4 - Standard - 50k each', amount: 200000 },
      ],
      subtotal: 550000,
      cgst: 0,
      sgst: 0,
      igst: 99000,
      total_amount: 649000,
    };

    const testClient = {
      client_name: 'Harniks India LLP',
      address: '29-36-38, Muesuem road, Governorpet, Vijayawada, Andhra Pradesh',
      gst_number: '37AAJH7994P1Z7',
      country: 'india',
      state: 'andhra pradesh',
    };

    return await generateProformaInvoicePDF(testInvoice, testClient);
  }

export async function testWTXLogoDetection() {
    console.log('🧪 Testing WTX logo detection...');

    // Test WT detection
    const wtInvoice = {
      proforma_type: 'WT',
      proforma_id: 'WT2509PRF001',
    };

    // Test WTX detection
    const wtxInvoice = {
      proforma_type: 'WTX',
      proforma_id: 'WTX2509PRF001',
    };

    console.log('Testing WT invoice:');
    const wtDoc = new jsPDF('p', 'mm', 'a4');
    const wtType = (wtInvoice?.proforma_type || "").toString().toUpperCase().trim();
    const wtIsWT = wtType === 'WT' || wtType === 'WTPL' || wtType.includes('WT');
    const wtIsWTX = wtType === 'WTX' || wtType === 'WTXPL' || wtType.includes('WTX');
    console.log(`  WT: isWT=${wtIsWT}, isWTX=${wtIsWTX}, logo=${wtIsWTX ? 'WTX' : 'WT'}`);

    console.log('Testing WTX invoice:');
    const wtxType = (wtxInvoice?.proforma_type || "").toString().toUpperCase().trim();
    const wtxIsWT = wtxType === 'WT' || wtxType === 'WTPL' || wtxType.includes('WT');
    const wtxIsWTX = wtxType === 'WTX' || wtxType === 'WTXPL' || wtxType.includes('WTX');
    console.log(`  WTX: isWT=${wtxIsWT}, isWTX=${wtxIsWTX}, logo=${wtxIsWTX ? 'WTX' : 'WT'}`);

    return { wt: wtIsWTX ? 'WTX' : 'WT', wtx: wtxIsWTX ? 'WTX' : 'WT' };
  }

function convertNumberToWords(num) {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero';
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
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

function buildServiceRowsNoDecimals(invoice, fmt0) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  if (arr.length) {
    return arr.map((s, i) => {
      const nm = Array.isArray(s?.name) ? s.name.filter(Boolean).join(', ') : (s?.name || `Service ${i + 1}`);
      const desc = String(s?.description || '');
      const amt = Number(s?.amount || 0);
      return ['9983', String(nm), desc, fmt0(amt)];
    });
  }
  const nm = String(invoice?.service_name || invoice?.proforma_title || invoice?.quotation_title || invoice?.invoice_title || 'Service');
  const desc = String(invoice?.service_description || '');
  const amt = Number(invoice?.subtotal || 0);
  return [['9983', nm, desc, fmt0(amt)]];
}

function calcSubtotalFromServices(invoice) {
  const arr = Array.isArray(invoice?.services) ? invoice.services : [];
  if (!arr.length) return Number(invoice?.subtotal || 0) || 0;
  return arr.reduce((sum, s) => sum + (Number(s?.amount || 0)), 0);
}

function roundToTwo(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

