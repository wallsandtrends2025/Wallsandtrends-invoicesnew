// src/pages/InvoicePreview.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import jsPDF from "jspdf";

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const previewRef = useRef(null);
  const [searchParams] = useSearchParams();
  const autoDoneRef = useRef(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const by = (searchParams.get('by') || '').toLowerCase();
        let invoiceData = null;

        if (by === 'invoice_id') {
          const q = query(collection(db, 'invoices'), where('invoice_id', '==', id), limit(1));
          const invSnap = await getDocs(q);
          if (!invSnap.empty) {
            invoiceData = invSnap.docs[0].data();
          }
        } else {
          const invoiceRef = doc(db, 'invoices', id);
          const invoiceSnap = await getDoc(invoiceRef);
          if (invoiceSnap.exists()) {
            invoiceData = invoiceSnap.data();
          }
        }

        if (invoiceData) {
          setInvoice(invoiceData);
          const clientRef = doc(db, 'clients', invoiceData.client_id);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) setClient(clientSnap.data());
        }
      } catch (err) {
        console.error('Error loading invoice:', err);
      }
    };

    fetchInvoice();
  }, [id, searchParams]);

  // Auto-download via query params (?autoDownload=tax|proforma&close=1)
  useEffect(() => {
    const auto = (searchParams.get('autoDownload') || '').toLowerCase();
    const shouldClose = searchParams.get('close') === '1';
    if (!invoice || !client || autoDoneRef.current || !auto) return;
    autoDoneRef.current = true;

    (async () => {
      try {
        if (auto === 'tax') {
          await handleDownloadTax();
        } else if (auto === 'proforma') {
          await handleDownloadProforma();
        }
      } catch (e) {
        console.error('Auto-download failed:', e);
      } finally {
        if (shouldClose) {
          setTimeout(() => {
            try { window.close(); } catch (_) {}
          }, 500);
        }
      }
    })();
  }, [invoice, client, searchParams]);

  const handleEdit = () => {
    navigate(`/dashboard/edit-invoice/${id}`);
  };

  const testModuleImport = async () => {
    try {
      console.log('🧪 Testing module import...');

      // Test the module loading
      const { testModuleLoading } = await import('../utils/generateInvoicePDF');
      const result = testModuleLoading();

      console.log('✅ Module test result:', result);
      alert('Module loaded successfully! Check console for details.');

    } catch (error) {
      console.error('❌ Module import test failed:', error);
      alert('Module import failed! Check console for error details.');
    }
  };


  const handleDownloadTax = async () => {
    if (!invoice || !client) {
      alert('Invoice data not available');
      return;
    }

    try {
      console.log('🔄 Attempting to import generateInvoicePDF module...');

      // Import the PDF generation utility
      const { generateInvoicePDF } = await import('../utils/generateInvoicePDF');

      console.log('✅ Module imported successfully:', typeof generateInvoicePDF);

      // Generate PDF using the dedicated utility
      const pdfDoc = await generateInvoicePDF(invoice, client);

      const timestamp = new Date().getTime();
      pdfDoc.save(`${invoice.invoice_id}_TAX_${timestamp}.pdf`);
    } catch (error) {
      console.error('❌ Tax Invoice PDF Generation Failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        invoice_id: invoice?.invoice_id,
        client_name: client?.client_name
      });

      // Provide user-friendly error message with guidance
      let userMessage = 'Error generating Tax Invoice PDF. ';
      if (error.message.includes('font')) {
        userMessage += 'Font loading issue - check if Calibri font is available. ';
      } else if (error.message.includes('image') || error.message.includes('logo')) {
        userMessage += 'Image loading issue - check if logo/signature images are accessible. ';
      } else if (error.message.includes('data')) {
        userMessage += 'Data validation issue - check invoice and client information. ';
      } else {
        userMessage += 'Unknown error occurred. ';
      }
      userMessage += 'See browser console (F12) for detailed technical information.';

      alert(userMessage);
    }
  };

  const handleDownloadProforma = async () => {
    if (!invoice || !client) {
      alert('Invoice or client data not available');
      return;
    }

    try {
      console.log('🔄 Attempting to import generateProformaInvoicePDF module...');

      // Import the PDF generation utility
      const { generateProformaInvoicePDF } = await import('../utils/generateProformaInvoicePDF');

      console.log('✅ Proforma module imported successfully:', typeof generateProformaInvoicePDF);

      // Generate PDF using the dedicated utility
      const pdfDoc = await generateProformaInvoicePDF(invoice, client);

      const timestamp = new Date().getTime();
      pdfDoc.save(`${invoice.invoice_id}_PROFORMA_${timestamp}.pdf`);
    } catch (error) {
      console.error('❌ Proforma Invoice PDF Generation Failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        invoice_id: invoice?.invoice_id,
        client_name: client?.client_name
      });

      // Provide user-friendly error message with guidance
      let userMessage = 'Error generating Proforma Invoice PDF. ';
      if (error.message.includes('font')) {
        userMessage += 'Font loading issue - check if Calibri font is available. ';
      } else if (error.message.includes('image') || error.message.includes('logo')) {
        userMessage += 'Image loading issue - check if logo/signature images are accessible. ';
      } else if (error.message.includes('data')) {
        userMessage += 'Data validation issue - check invoice and client information. ';
      } else {
        userMessage += 'Unknown error occurred. ';
      }
      userMessage += 'See browser console (F12) for detailed technical information.';

      alert(userMessage);
    }
  };

  const handleDebugPDF = async () => {
    try {
      console.log('🔧 Starting debug PDF generation...');

      // Import the debug function
      const { debugPDFGeneration } = await import('../utils/generateInvoicePDF');

      console.log('✅ Debug function imported successfully');

      // Generate debug PDF
      const result = await debugPDFGeneration();

      console.log('Debug result:', result);
      alert('Debug PDF generation completed! Check console for details and downloads folder for the PDF file.');

    } catch (error) {
      console.error('❌ Debug PDF generation failed:', error);
      alert(`Debug PDF generation failed: ${error.message}`);
    }
  };

  const formatDate = (dateObj) => {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const month = d.toLocaleString("default", { month: "long" });
    return `${dd} ${month} ${yyyy}`;
  };


  // ---------- NEW: robust Indian-numbering converter (Rupees & Paise) ----------
  function numberToWordsINR(amountInput) {
    const amount = Number(amountInput ?? 0);
    if (!isFinite(amount)) return "";

    // use paise to avoid floating point issues
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

      const crore = Math.floor(n / 10000000);                 // 1,00,00,000
      const lakh = Math.floor((n % 10000000) / 100000);       // 1,00,000
      const thousand = Math.floor((n % 100000) / 1000);       // 1,000
      const hundred = n % 1000;                               // 0..999

      if (crore)   out += `${threeDigitWords(crore)} Crore`;
      if (lakh)    out += `${out ? " " : ""}${threeDigitWords(lakh)} Lakh`;
      if (thousand)out += `${out ? " " : ""}${threeDigitWords(thousand)} Thousand`;
      if (hundred) out += `${out ? " " : ""}${threeDigitWords(hundred)}`;

      return out.trim();
    };

    const rupeesWords = `${segmentWords(rupees)} Rupees`;
    const paiseWords = paise ? ` and ${twoDigitWords(paise)} Paise` : "";
    return `${rupeesWords}${paiseWords} only`;
  }
  // ---------------------------------------------------------------------------

  if (!invoice || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading invoice...
      </div>
    );
  }

  // Company visuals (robust brand detection)
  const type = String(invoice.invoice_type || '').trim().toUpperCase();
  const isWTX = type === "WTX" || type === "WTXPL" || type.includes("WTX");
  const isWT = !isWTX; // default to WT when unknown
  const headingColor = isWTX ? "#ffde58" : "#3b5998";
  const logoPath = isWTX ? "/wtx_logo.png" : "/wt-logo.png";

  // ======== AMOUNTS & FORMATTING (always 2 decimals) ========
  const fmt2 = (n) =>
    Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const subtotal = Number(invoice.subtotal) || 0;
  const total = Number(invoice.total_amount) || subtotal;

  // ======== TAX VISIBILITY (match CreateInvoice rules) ========
  const toLower = (s) => (s || "").toString().trim().toLowerCase();
  const clientCountry = toLower(client.country);
  const clientState = toLower(client.state);
  const isIndian = clientCountry === "india";
  const isTelangana = clientState === "telangana";

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9; sgstRate = 9; igstRate = 0;
  } else if (isIndian && !isTelangana) {
    cgstRate = 0; sgstRate = 0; igstRate = 18;
  } else {
    cgstRate = 0; sgstRate = 0; igstRate = 0;
  }

  // Prefer stored amounts; fall back to computed
  const storedCGST = Number(invoice.cgst ?? 0);
  const storedSGST = Number(invoice.sgst ?? 0);
  const storedIGST = Number(invoice.igst ?? 0);

  const cgstAmount = storedCGST || +(subtotal * (cgstRate / 100)).toFixed(2);
  const sgstAmount = storedSGST || +(subtotal * (sgstRate / 100)).toFixed(2);
  const igstAmount = storedIGST || +(subtotal * (igstRate / 100)).toFixed(2);
  const summaryRowCount = 1 + (isIndian && isTelangana ? 2 : 1) + 1;

  // ======== SERVICES NORMALIZATION ========
  const lineItems = Array.isArray(invoice.services) && invoice.services.length
    ? invoice.services.map((s, i) => {
        const nameStr = Array.isArray(s?.name) ? s.name.filter(Boolean).join(", ") : (s?.name || `Service ${i + 1}`);
        return {
          name: String(nameStr),
          description: String(s?.description || ""),
          amount: Number(s?.amount || 0),
        };
      })
    : [
        {
          name: String(invoice.invoice_title || invoice.service_name || "Service"),
          description: String(invoice.service_description || ""),
          amount: Number(invoice.subtotal || 0),
        },
      ];

  return (
    <div className="bg-gray-100 font-sans text-[13px] text-gray-900 preview" style={{ margin: '0 auto', padding: '0' }}>
      {/* actions */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex gap-2 justify-center" style={{ margin: '0', padding: '12px 24px' }}>
        <button
          onClick={handleEdit}
          className="bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] text-sm"
        >
          Edit Invoice
        </button>
        <button
          onClick={handleDownloadTax}
          className="bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] text-sm"
        >
          Download Tax Invoice PDF
        </button>
       
        
      </div>

      <div className="flex justify-center items-start bg-gray-100" style={{
          margin: '0',
          padding: '10px',
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflow: 'visible',
          paddingTop: '15px'
        }}>
         <div ref={previewRef} className="a4-preview bg-white" style={{
            width: '210mm',
            height: 'auto',
            backgroundColor: 'white',
            padding: '10mm 15mm 10mm 15mm',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: '1px solid #e5e7eb',
            margin: '0 auto',
            fontSize: '10px',
            lineHeight: '1.2',
            overflow: 'visible',
            position: 'relative',
            display: 'block',
            visibility: 'visible',
            opacity: '1',
            zoom: '1.15'
          }}>
        {/* logo + address */}
        <div className="mb-2" style={{ marginBottom: '8px', textAlign: 'left' }}>
           <img src={logoPath} alt="Company Logo" className="h-12" style={{ height: '44px', width: 'auto' }} />
           <div className="text-left text-[9px] leading-tight" style={{ fontSize: '9px', lineHeight: '1.2', marginTop: '10px', textAlign: 'left' }}>
             <p>19/B, 3rd Floor, Progressive Tower<br />100 Ft Road, Siddhi Vinayak Nagar<br />Madhapur, Hyderabad, Telangana - 500081</p>
           </div>
        </div>

        {/* Heading - Enhanced styling with consistent format */}
        <h1 className="text-xl mb-4" style={{ color: headingColor, fontSize: '20px', marginBottom: '10px', marginTop: '0px', fontFamily: 'Calibri, sans-serif', fontWeight: 'normal' }}>
           Tax Invoice
        </h1>
        
        {/* Top info table */}
        <table className="w-full border-collapse mb-3" style={{
          marginBottom: '8px',
          border: '1px solid #cccccc',
          backgroundColor: '#ffffff',
          fontFamily: 'Calibri, sans-serif',
          fontSize: '9px'
        }}>
          <tbody>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[8px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top'
              }}>
                <span style={{fontWeight: '600'}}>{isWT ? "Walls And Trends" : "Walls And Trends"}</span>
              </td>
              <td className="p-1 text-[8px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top'
              }}>
                <span style={{fontWeight: '600'}}>GST IN:</span> <span style={{fontWeight: 'normal'}}>{isWT ? "36AACFW6827B1Z8" : "36AAACW8991C1Z9"}</span>
              </td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[7px] text-left" style={{
                padding: '2px 4px',
                fontSize: '7px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top',
                fontFamily: 'Calibri, sans-serif'
              }}>
                <div style={{textAlign: 'left', width: '100%'}}>
                  <span style={{fontWeight: '600'}}>Invoice Number:</span> <span style={{fontWeight: 'normal'}}>{invoice.invoice_id}</span>
                </div>
              </td>
              <td className="p-1 text-[6px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top'
              }}>
                <div style={{textAlign: 'left', width: '100%'}}>
                  <span style={{fontWeight: '600'}}>Invoice Date:</span>{" "}
                  <span style={{fontWeight: 'normal'}}>
                  {invoice.invoice_date
                    ? formatDate(invoice.invoice_date)
                    : invoice.created_at?.toDate
                    ? formatDate(invoice.created_at.toDate())
                    : ""}
                  </span>
                </div>
              </td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top'
              }}>
                <div style={{textAlign: 'left', width: '100%'}}>
                  <span style={{fontWeight: '600'}}>Invoice Title:</span> <span style={{fontWeight: 'normal'}}>{invoice.invoice_title || lineItems[0]?.name}</span>
                </div>
              </td>
              <td className="p-1 font-semibold text-[6px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top'
              }}>
                <div style={{textAlign: 'left', width: '100%'}}>
                  <span style={{fontWeight: '600'}}>Total Cost:</span> <span style={{fontWeight: 'normal'}}>INR {fmt2(total)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>



        {/* Customer block */}
        <table className="w-full border-collapse mb-3" style={{
          marginBottom: '8px',
          border: '1px solid #cccccc',
          backgroundColor: '#ffffff',
          fontFamily: 'Calibri, sans-serif',
          fontSize: '9px'
        }}>
          <tbody>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top',
                lineHeight: '1.2'
              }}>
                <div style={{textAlign: 'left', width: '100%', margin: '0', padding: '0'}}>
                  <span style={{fontWeight: '600'}}>Customer Name:</span> <span style={{fontWeight: 'normal'}}>{client.client_name}</span>
                </div>
              </td>
              <td className="p-1 text-[6px] text-left" rowSpan={2} style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top',
                lineHeight: '1.2'
              }}>
                <div style={{textAlign: 'left', width: '100%', margin: '0', padding: '0'}}>
                  <span style={{fontWeight:'bold'}}>Customer Address:</span> {client.address}
                </div>
              </td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-left" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff',
                verticalAlign: 'top',
                lineHeight: '1.2'
              }}>
                <div style={{
                  textAlign: 'left',
                  width: '100%',
                  margin: '0',
                  padding: '0'
                }}>
                  <span style={{fontWeight:'bold'}}>Customer GST IN:</span> {(client.gst_number || "").trim() || "NA"}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table className="w-full border-collapse mb-3 text-center" style={{ marginBottom: '12px', fontSize: '10px', border: '1px solid #cccccc', backgroundColor: '#ffffff', fontFamily: 'Calibri, sans-serif' }}>
          <thead className="text-black" style={{ backgroundColor: '#ffffff', border: '1px solid #cccccc' }}>
            <tr style={{ border: '1px solid #cccccc', backgroundColor: '#ffffff' }}>
              <th className="p-1 text-[6px] text-center font-bold" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>HSN / SAC Code</th>
              <th className="p-1 text-[6px] text-center font-bold" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>Item</th>
              <th className="p-1 text-[6px] text-center font-bold" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>Description</th>
              <th className="p-1 text-[6px] text-center font-bold" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                color: '#000000'
              }}>Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((it, idx) => (
              <tr key={idx} style={{ border: '1px solid #cccccc' }}>
                <td className="p-1 text-[6px] text-center" style={{
                  padding: '3px 6px',
                  fontSize: '8px',
                  border: '1px solid #cccccc',
                  textAlign: 'center',
                  backgroundColor: '#ffffff'
                }}>9983</td>
                <td className="p-1 text-[6px] text-center" style={{
                  padding: '3px 6px',
                  fontSize: '8px',
                  border: '1px solid #cccccc',
                  textAlign: 'left',
                  backgroundColor: '#ffffff'
                }}>{it.name}</td>
                <td className="p-1 text-[6px] text-center" style={{
                  padding: '3px 6px',
                  fontSize: '8px',
                  border: '1px solid #cccccc',
                  textAlign: 'center',
                  backgroundColor: '#ffffff'
                }}>{it.description}</td>
                <td className="p-1 text-[6px] text-center" style={{
                  padding: '3px 6px',
                  fontSize: '8px',
                  border: '1px solid #cccccc',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'nowrap'
                }}>{fmt2(it.amount)}</td>
              </tr>
            ))}

            {/* Summary with rowSpan on first two columns to match reference layout */}
            <tr style={{ border: '1px solid #cccccc' }}>
              <td rowSpan={summaryRowCount} style={{
                padding: '0',
                border: '1px solid #cccccc',
                backgroundColor: '#ffffff'
              }}></td>
              <td rowSpan={summaryRowCount} style={{
                padding: '0',
                border: '1px solid #cccccc',
                backgroundColor: '#ffffff'
              }}></td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}><span style={{fontWeight:'bold'}}>Gross</span></td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff',
                whiteSpace: 'nowrap'
              }}>{fmt2(subtotal)}</td>
            </tr>

            {isIndian && isTelangana ? (
              <>
                <tr style={{ border: '1px solid #cccccc' }}>
                  <td className="p-1 text-[6px] text-center" style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    border: '1px solid #cccccc',
                    textAlign: 'center',
                    backgroundColor: '#ffffff'
                  }}><span style={{fontWeight:'bold'}}>CGST @ 9%</span></td>
                  <td className="p-1 text-[6px] text-center" style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    border: '1px solid #cccccc',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    whiteSpace: 'nowrap'
                  }}>{fmt2(cgstAmount)}</td>
                </tr>
                <tr style={{ border: '1px solid #cccccc' }}>
                  <td className="p-1 text-[6px] text-center" style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    border: '1px solid #cccccc',
                    textAlign: 'center',
                    backgroundColor: '#ffffff'
                  }}><span style={{fontWeight:'bold'}}>SGST @ 9%</span></td>
                  <td className="p-1 text-[6px] text-center" style={{
                    padding: '3px 6px',
                    fontSize: '8px',
                    border: '1px solid #cccccc',
                    textAlign: 'center',
                    backgroundColor: '#ffffff',
                    whiteSpace: 'nowrap'
                  }}>{fmt2(sgstAmount)}</td>
                </tr>
              </>
            ) : (
              <tr style={{ border: '1px solid #cccccc' }}>
                <td className="p-1 text-[6px] text-center" style={{
                  padding: '3px 6px',
                  fontSize: '8px',
                  border: '1px solid #cccccc',
                  textAlign: 'center',
                  backgroundColor: '#ffffff'
                }}><span style={{fontWeight:'bold'}}>IGST @ {isIndian ? '18%' : '0%'}</span></td>
                <td className="p-1 text-[6px] text-center" style={{
                  padding: '3px 6px',
                  fontSize: '8px',
                  border: '1px solid #cccccc',
                  textAlign: 'center',
                  backgroundColor: '#ffffff',
                  whiteSpace: 'nowrap'
                }}>{fmt2(igstAmount)}</td>
              </tr>
            )}

            <tr className="font-bold" style={{ border: '1px solid #cccccc' }}>
               <td className="p-1 text-[6px] text-center" style={{
                 padding: '3px 6px',
                 fontSize: '8px',
                 border: '1px solid #cccccc',
                 color: '#000000',
                 fontWeight: 'bold',
                 textAlign: 'center',
                 backgroundColor: '#ffffff'
               }}>Total</td>
               <td className="p-1 text-[6px] text-center" style={{
                 padding: '3px 6px',
                 fontSize: '8px',
                 border: '1px solid #cccccc',
                 color: '#000000',
                 fontWeight: 'bold',
                 textAlign: 'center',
                 backgroundColor: '#ffffff',
                 whiteSpace: 'nowrap'
               }}>{fmt2(total)}</td>
             </tr>

            {/* Amount in words row: label in column 3 and words in column 4 */}
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" colSpan={2} style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}></td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}><span className="italic" style={{fontWeight:'bold'}}>(Total Amount In Words)</span></td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'left',
                backgroundColor: '#ffffff'
              }}>{numberToWordsINR(total)}</td>
            </tr>
          </tbody>
        </table>

        {/* Bank Details - Enhanced styling with consistent format */}
        <h2 className="font-semibold mb-3 text-[14px]" style={{ color: headingColor, fontSize: '14px', marginBottom: '12px', marginTop: '16px', fontFamily: 'Calibri, sans-serif' }}>
           Bank Details
        </h2>
        <table className="w-full border-collapse mb-3 text-center" style={{ marginBottom: '12px', fontSize: '10px', border: '1px solid #cccccc', backgroundColor: '#ffffff', fontFamily: 'Calibri, sans-serif' }}>
          <tbody>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] w-1/3 text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Bank Name</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Yes Bank</td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Beneficiary Name</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>{isWT ? "Walls And Trends" : "Walls And Trends"}</td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Account Number</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>000663300001713</td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Account Type</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Current Account</td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>IFSC Code</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>YESB0000006</td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Bank Branch</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Somajiguda</td>
            </tr>
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                fontWeight: 'bold',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>City</td>
              <td className="p-1 text-[6px] text-center" style={{
                padding: '3px 6px',
                fontSize: '8px',
                border: '1px solid #cccccc',
                textAlign: 'center',
                backgroundColor: '#ffffff'
              }}>Hyderabad</td>
            </tr>
          </tbody>
        </table>

        <p style={{ fontSize: '8px', marginBottom: '8px' }}>NOTE: No files will be delivered until the final payment is Done.</p>

        <div className="flex justify-start" style={{ marginTop: '12px' }}>
          <div className="text-center">
            <img src="/csh-sign.PNG" alt="Signature" className="h-8 mx-auto mb-1" style={{ height: '32px' }} />
            <p className="text-[6px]" style={{ fontSize: '8px', color: '#9ca3af' }}>Authorised Signature for Walls & Trends</p>
          </div>
        </div>

        <div className="flex justify-end" style={{ marginTop: '12px' }}>
          <div className="text-right">
            <p className="text-[8px] italic" style={{
              fontSize: '8px',
              color: headingColor,
              fontFamily: 'calibri, sans-serif',
              fontStyle: 'italic'
            }}>Authenticity Promised. Creativity Published</p>
            <p className="text-[8px] italic" style={{
              fontSize: '8px',
              color: headingColor,
              fontFamily: 'calibri, sans-serif',
              fontStyle: 'italic',
              marginTop: '2px'
            }}>Thank you for your business!</p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
