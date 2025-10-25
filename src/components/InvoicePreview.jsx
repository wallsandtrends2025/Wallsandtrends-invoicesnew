// src/pages/InvoicePreview.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import jsPDF from "jspdf";
import CurrencyService from "../utils/CurrencyService";

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();

  // All useState hooks must be at the top level - before any conditional logic
  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formattedAmounts, setFormattedAmounts] = useState({});
  const [formattingError, setFormattingError] = useState(null);
  const previewRef = useRef(null);
  const [searchParams] = useSearchParams();
  const autoDoneRef = useRef(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔍 DEBUG: InvoicePreview - Starting to fetch invoice:', id);
        console.log('🔍 DEBUG: InvoicePreview - Search params:', Object.fromEntries(searchParams));

        if (!id) {
          throw new Error('No invoice ID provided');
        }

        const by = (searchParams.get('by') || '').toLowerCase();
        let invoiceData = null;

        if (by === 'invoice_id') {
          console.log('🔍 DEBUG: InvoicePreview - Fetching by invoice_id:', id);
          const q = query(collection(db, 'invoices'), where('invoice_id', '==', id), limit(1));
          const invSnap = await getDocs(q);
          console.log('🔍 DEBUG: InvoicePreview - Query result:', invSnap.size, 'documents');

          if (!invSnap.empty) {
            invoiceData = invSnap.docs[0].data();
            console.log('✅ DEBUG: InvoicePreview - Found invoice data:', {
              invoice_id: invoiceData.invoice_id,
              client_id: invoiceData.client_id,
              currency: invoiceData.currency
            });
          } else {
            throw new Error(`No invoice found with invoice_id: ${id}`);
          }
        } else {
          console.log('🔍 DEBUG: InvoicePreview - Fetching by document ID:', id);
          const invoiceRef = doc(db, 'invoices', id);
          const invoiceSnap = await getDoc(invoiceRef);
          console.log('🔍 DEBUG: InvoicePreview - Document exists:', invoiceSnap.exists());

          if (invoiceSnap.exists()) {
            invoiceData = invoiceSnap.data();
            console.log('✅ DEBUG: InvoicePreview - Found invoice data:', {
              invoice_id: invoiceData.invoice_id,
              client_id: invoiceData.client_id,
              currency: invoiceData.currency
            });
          } else {
            throw new Error(`No invoice document found with ID: ${id}`);
          }
        }

        if (invoiceData) {
          console.log('🔍 DEBUG: InvoicePreview - Setting invoice state');
          setInvoice(invoiceData);

          if (!invoiceData.client_id) {
            throw new Error('Invoice missing client_id');
          }

          console.log('🔍 DEBUG: InvoicePreview - Fetching client data:', invoiceData.client_id);
          const clientRef = doc(db, 'clients', invoiceData.client_id);
          const clientSnap = await getDoc(clientRef);

          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            console.log('✅ DEBUG: InvoicePreview - Client data loaded:', {
              client_name: clientData.client_name,
              company_name: clientData.company_name
            });
            setClient(clientData);
          } else {
            throw new Error(`Client not found: ${invoiceData.client_id}`);
          }
        } else {
          throw new Error('No invoice data available');
        }

        console.log('✅ DEBUG: InvoicePreview - Data loading completed successfully');
      } catch (err) {
        console.error('❌ DEBUG: InvoicePreview - Error loading invoice:', err);
        console.error('❌ DEBUG: InvoicePreview - Error details:', {
          message: err.message,
          code: err.code,
          stack: err.stack,
          id,
          searchParams: Object.fromEntries(searchParams)
        });
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    console.log('🔄 DEBUG: InvoicePreview - Component mounted, fetching invoice for ID:', id);
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

  useEffect(() => {
    const formatAmounts = async () => {
      try {
        setFormattingError(null);

        // Clear exchange rate cache to ensure fresh rates are used
        if (CurrencyService.LiveExchangeRateService && typeof CurrencyService.LiveExchangeRateService.clearCache === 'function') {
          CurrencyService.LiveExchangeRateService.clearCache();
        }

        if (!invoice || !client) {
          console.log('🔍 DEBUG: InvoicePreview - No invoice or client data for formatting');
          return;
        }

        console.log('🔍 DEBUG: InvoicePreview - Starting amount formatting');
        const currency = invoice?.currency || "INR";
        console.log('🔍 DEBUG: InvoicePreview - Formatting amounts for currency:', currency);

        // Use the calculated values directly instead of variables that might not be initialized yet
        const currentSubtotalINR = gstApplicable && invoice
          ? (invoice?.subtotal_inr || invoice?.subtotal || subtotal)
          : Number(invoice?.subtotal_inr || invoice?.subtotal || subtotal || 0);

        const currentTotalINR = gstApplicable && invoice
          ? (invoice?.total_amount_inr || invoice?.total_amount || currentSubtotalINR + gstCalculation.totalTax)
          : currentSubtotalINR;

        // Amount formatting based on invoice type
        console.log('🔍 DEBUG: Amount formatting - showINRAmounts:', showINRAmounts, 'currency:', currency, 'totalINR:', totalINR, 'subtotalINR:', subtotalINR);

        const amountsToFormat = [
          { key: 'total', value: showINRAmounts ? currentTotalINR : totalINR },
          { key: 'subtotal', value: showINRAmounts ? currentSubtotalINR : subtotalINR },
          { key: 'cgst', value: gstCalculation.cgstAmount },
          { key: 'sgst', value: gstCalculation.sgstAmount },
          { key: 'igst', value: gstCalculation.igstAmount }
        ];

        console.log('🔍 DEBUG: amountsToFormat values:', amountsToFormat);
        console.log('🔍 DEBUG: showINRAmounts:', showINRAmounts, 'totalINR:', totalINR, 'currentTotalINR:', currentTotalINR);
        console.log('🔍 DEBUG: gstCalculation:', gstCalculation);

        console.log('🔍 DEBUG: InvoicePreview - Amounts to format:', amountsToFormat.filter(a => a.value > 0));
        console.log('🔍 DEBUG: InvoicePreview - Line items count:', lineItems.length);

        const formatted = {};
        for (const { key, value } of amountsToFormat) {
          if (value > 0) {
            try {
              if (!showINRAmounts) {
                // For client currency invoices, format in client currency
                const currencyInfo = CurrencyService.getCurrencyInfo(currency);
                formatted[key] = `${currencyInfo.symbol}${value.toLocaleString(currencyInfo.locale || 'en-US')}`;
                console.log(`✅ DEBUG: InvoicePreview - Formatted ${key} (client currency): ${value} -> ${formatted[key]}`);
              } else {
                // For INR invoices, use normal INR formatting
                formatted[key] = await CurrencyService.formatAmountForPDF(value, 'INR');
                console.log(`✅ DEBUG: InvoicePreview - Formatted ${key} (INR): ${value} -> ${formatted[key]}`);
              }
            } catch (formatError) {
              console.error(`❌ DEBUG: InvoicePreview - Error formatting ${key}:`, formatError);
              if (!showINRAmounts) {
                formatted[key] = `${CurrencyService.getCurrencySymbol(currency)}${value.toLocaleString('en-US')}`;
              } else {
                formatted[key] = `₹${value.toLocaleString('en-IN')}`;
              }
            }
          }
        }

        console.log('✅ DEBUG: Final formatted amounts:', formatted);
        console.log('🔍 DEBUG: isLocalCurrency:', isLocalCurrency, 'currency:', currency);

        console.log('✅ DEBUG: Final formatted amounts:', formatted);
        console.log('🔍 DEBUG: isLocalCurrency:', isLocalCurrency, 'currency:', currency);

        console.log('✅ DEBUG: Final formatted amounts:', formatted);
        console.log('🔍 DEBUG: isLocalCurrency:', isLocalCurrency, 'currency:', currency);

        console.log('✅ DEBUG: Final formatted amounts:', formatted);
        console.log('🔍 DEBUG: showINRAmounts:', showINRAmounts, 'currency:', currency);

        console.log('✅ DEBUG: Final formatted amounts:', formatted);

        // Format line items
        for (let i = 0; i < lineItems.length; i++) {
          try {
            console.log(`🔍 DEBUG: InvoicePreview - Formatting item ${i}: amount=${lineItems[i].amount}, currency=${currency}`);

            if (!showINRAmounts) {
              // For client currency invoices, format in their currency
              const currencyInfo = CurrencyService.getCurrencyInfo(currency);
              formatted[`item_${i}`] = `${currencyInfo.symbol}${lineItems[i].amount.toLocaleString(currencyInfo.locale || 'en-US')}`;
              console.log(`✅ DEBUG: InvoicePreview - Formatted item ${i} (client currency): ${lineItems[i].amount} -> ${formatted[`item_${i}`]}`);
            } else {
              // For INR invoices, use INR formatting
              formatted[`item_${i}`] = `₹${lineItems[i].amount.toLocaleString('en-IN')}`;
              console.log(`✅ DEBUG: InvoicePreview - Formatted item ${i} (INR): ${lineItems[i].amount} -> ${formatted[`item_${i}`]}`);
            }
          } catch (formatError) {
            console.error(`❌ DEBUG: InvoicePreview - Error formatting item ${i}:`, formatError);
            if (!showINRAmounts) {
              formatted[`item_${i}`] = `${CurrencyService.getCurrencySymbol(currency)}${lineItems[i].amount.toLocaleString('en-US')}`;
            } else {
              formatted[`item_${i}`] = `₹${lineItems[i].amount.toLocaleString('en-IN')}`;
            }
          }
        }

        console.log('✅ DEBUG: InvoicePreview - Amount formatting completed:', Object.keys(formatted).length, 'items');
        console.log('🔍 DEBUG: Formatted amounts:', formatted);
        setFormattedAmounts(formatted);
      } catch (error) {
        console.error('❌ DEBUG: InvoicePreview - Error in formatAmounts:', error);
        setFormattingError(error.message);
      }
    };

    formatAmounts();
  }, [invoice, client]);

  const handleEdit = () => {
    navigate(`/dashboard/edit-invoice/${id}`);
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


  // ---------- Multi-currency number to words converter ----------
  function numberToWords(amountInput, currencyCode = 'INR') {
    const amount = Number(amountInput ?? 0);
    console.log('🔍 DEBUG: numberToWords input - amount:', amountInput, 'parsed:', amount, 'currency:', currencyCode);
    if (!isFinite(amount)) {
      console.log('❌ DEBUG: Invalid amount for words conversion:', amountInput);
      return "";
    }

    // Handle different currencies
    if (currencyCode === 'INR') {
      console.log('🔍 DEBUG: Using INR words function for INR currency');
      return numberToWordsINR(amount);
    } else {
      console.log('🔍 DEBUG: Using English words function for currency:', currencyCode, 'amount:', amount);
      return numberToWordsEnglish(amount, currencyCode);
    }
  }

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

    const rupeesWords = rupees > 0 ? `${segmentWords(rupees)} Rupees` : "Zero Rupees";
    const paiseWords = paise > 0 ? ` and ${twoDigitWords(paise)} Paise` : "";
    return `${rupeesWords}${paiseWords} only`;
  }

  function numberToWordsEnglish(amountInput, currencyCode) {
    const amount = Number(amountInput ?? 0);
    console.log('🔍 DEBUG: numberToWordsEnglish - input:', amountInput, 'parsed:', amount, 'currency:', currencyCode);
    if (!isFinite(amount)) {
      console.log('❌ DEBUG: Invalid amount for English words:', amountInput);
      return "";
    }

    // Round to 2 decimal places for currency
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
    const currencySymbol = CurrencyService.getCurrencySymbol(currencyCode);

    const result = `${integerWords}${decimalWords} ${currencyName} only`;
    console.log('✅ DEBUG: English words result:', result, 'currencyName:', currencyName, 'currencySymbol:', currencySymbol);
    return result;
  }
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3b5999] mx-auto mb-4"></div>
          <div className="text-[#3b5999] text-xl font-semibold mb-2">
            Loading invoice details...
          </div>
          <div className="text-gray-600 text-sm">
            {id ? `Invoice ID: ${id}` : 'No invoice ID provided'}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <div className="text-red-700 text-xl font-semibold mb-2">
            Error Loading Invoice
          </div>
          <div className="text-gray-600 text-sm mb-4">
            {error}
          </div>
          <div className="text-gray-500 text-xs">
            Invoice ID: {id || 'Not provided'}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#3b5999] text-white rounded hover:bg-[#2d4373] text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!invoice || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6]">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="text-yellow-500 text-6xl mb-4">📄</div>
          <div className="text-yellow-700 text-xl font-semibold mb-2">
            Invoice Data Missing
          </div>
          <div className="text-gray-600 text-sm mb-4">
            The invoice or client data could not be loaded properly.
          </div>
          <div className="text-gray-500 text-xs">
            Please check the console for technical details.
          </div>
        </div>
      </div>
    );
  }

  // Company visuals (robust brand detection) - only calculate when invoice exists
  const type = invoice ? String(invoice.invoice_type || '').trim().toUpperCase() : '';
  const isWTX = type === "WTX" || type === "WTXPL" || type.includes("WTX");
  const isWT = !isWTX; // default to WT when unknown
  const headingColor = isWTX ? "#ffde58" : "#3b5998";
  const logoPath = isWTX ? "/wtx_logo.png" : "/wt-logo.png";

  // Calculations - only perform when invoice exists
  const subtotal = invoice ? Number(invoice.subtotal) || 0 : 0;
  const total = invoice ? Number(invoice.total_amount) || subtotal : 0;

  // ======== INTERNATIONAL INVOICE LOGIC ========
  let currency = invoice?.currency || "INR";
  const isIndianClient = client?.country && client.country.toLowerCase().includes('india');

  // For international clients, determine if they want INR or local currency
  const isInternationalClient = client?.country && !client.country.toLowerCase().includes('india');
  const clientLocalCurrency = isInternationalClient ? CurrencyService.getDefaultCurrencyForClient(client) : 'INR';

  // Determine invoice type based on business requirements
  const isInternationalInvoice = currency === 'INR' && isInternationalClient; // International clients requesting INR invoice (show INR + local currency)
  const isClientCurrencyInvoice = currency !== 'INR' && isInternationalClient; // International clients requesting their own currency (show only local currency)

  console.log('🔍 DEBUG: InvoicePreview - Invoice Type Analysis:', {
    currency,
    isIndianClient,
    isInternationalInvoice,
    isClientCurrencyInvoice,
    clientCountry: client?.country
  });

  // Tax calculation based on invoice type (not just client country)
  let gstCalculation = { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0, totalAmount: 0, taxType: 'none' };

  if (isInternationalInvoice) {
    // International Invoice (INR format) - Apply 18% GST
    console.log('🔍 DEBUG: InvoicePreview - Processing International Invoice (INR format)');
    const subtotalINR = invoice?.subtotal_inr || invoice?.subtotal || subtotal;
    const gstRate = 18;
    const gstAmount = (subtotalINR * gstRate) / 100;

    gstCalculation = {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: gstAmount,
      totalTax: gstAmount,
      totalAmount: subtotalINR + gstAmount,
      taxType: 'international',
      gstRate: gstRate
    };
  } else if (isClientCurrencyInvoice) {
    // Client's own currency invoice - NO GST
    console.log('🔍 DEBUG: InvoicePreview - Processing Client Currency Invoice (no GST)');
    const subtotalOriginal = invoice?.subtotal || subtotal;

    gstCalculation = {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
      totalAmount: subtotalOriginal,
      taxType: 'none'
    };
  } else {
    // Indian client or INR invoice - use existing GST logic
    console.log('🔍 DEBUG: InvoicePreview - Processing Indian client or INR invoice');
    const subtotalINR = invoice?.subtotal_inr || invoice?.subtotal || subtotal;
    const calculatedGST = CurrencyService.calculateGST(subtotalINR, client?.state, client);
    gstCalculation = { ...calculatedGST };
  }

  console.log('🔍 DEBUG: InvoicePreview - Final GST calculation:', gstCalculation);

  // Tax calculation already handled above based on invoice type

   // Handle amounts based on invoice type (business requirements)
    let subtotalINR, totalINR;
    let displayCurrency = currency; // Currency to show on invoice
    let showINRAmounts = true; // Whether to show INR amounts and exchange rates

    if (isInternationalInvoice) {
      // International Invoice (INR format) - Show ONLY INR amounts and GST (no dual currency)
      subtotalINR = invoice?.subtotal_inr || invoice?.subtotal || subtotal;
      totalINR = gstCalculation.totalAmount || subtotalINR;
      displayCurrency = 'INR';
      showINRAmounts = true;
      console.log('🔍 DEBUG: InvoicePreview - International Invoice (INR only) - Subtotal:', subtotalINR, 'Total:', totalINR);
    } else if (isClientCurrencyInvoice) {
      // Client's own currency invoice - Show only client currency, no INR
      subtotalINR = invoice?.subtotal || subtotal;
      totalINR = gstCalculation.totalAmount || subtotalINR;
      displayCurrency = currency;
      showINRAmounts = false; // Don't show INR amounts or exchange rates
      console.log('🔍 DEBUG: InvoicePreview - Client Currency Invoice - Subtotal:', subtotalINR, 'Total:', totalINR, 'Currency:', currency);
    } else {
      // Indian client or INR invoice - Show INR amounts
      subtotalINR = invoice?.subtotal_inr || invoice?.subtotal || subtotal;
      totalINR = gstCalculation.totalAmount || subtotalINR;
      displayCurrency = 'INR';
      showINRAmounts = true;
      console.log('🔍 DEBUG: InvoicePreview - Indian Client/INR - Subtotal:', subtotalINR, 'Total:', totalINR);
    }

  // Calculate summary row count based on new tax logic
  let summaryRowCount = 1; // Base subtotal row
  if (gstCalculation.totalTax > 0) {
    if (gstCalculation.cgstAmount > 0) summaryRowCount++;
    if (gstCalculation.sgstAmount > 0) summaryRowCount++;
    if (gstCalculation.igstAmount > 0) summaryRowCount++;
  } else if (gstCalculation.taxType === 'none' && !isClientCurrencyInvoice) {
    summaryRowCount++; // GST row showing "NA"
  }
  summaryRowCount++; // Total row
  summaryRowCount++; // Amount in words row

  // ======== SERVICES NORMALIZATION (multi-currency support) ========
  let lineItems = [];
  if (invoice) {
    if (Array.isArray(invoice.services) && invoice.services.length) {
      lineItems = invoice.services.map((s, i) => {
        const nameStr = Array.isArray(s?.name) ? s.name.filter(Boolean).join(", ") : (s?.name || `Service ${i + 1}`);

        // Handle amounts based on invoice type
        let amount;
        if (!showINRAmounts) {
          // For client currency invoices, use original amounts
          amount = Number(s?.amount || 0);
        } else {
          // For INR invoices, use INR amounts
          amount = Number(invoice?.subtotal_inr || s?.amount || 0);
        }

        return {
          name: String(nameStr),
          description: String(s?.description || ""),
          amount: amount,
        };
      });
    } else {
      lineItems = [
        {
          name: String(invoice.invoice_title || invoice.service_name || "Service"),
          description: String(invoice.service_description || ""),
          amount: !showINRAmounts
            ? Number(invoice?.subtotal || 0) // Use original amount for client currency
            : Number(invoice?.subtotal_inr || invoice?.subtotal || 0), // Use INR for others
        },
      ];
    }
  }

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
                  <span style={{fontWeight: '600'}}>Total Cost:</span> <span style={{fontWeight: 'normal'}}>
                    {(() => {
                      console.log('🔍 DEBUG: Total Cost Display:', {
                        showINRAmounts,
                        formattedAmounts,
                        totalINR,
                        currency,
                        isClientCurrencyInvoice
                      });

                      if (formattedAmounts.total) {
                        console.log('✅ DEBUG: Using formatted amount:', formattedAmounts.total);
                        return formattedAmounts.total;
                      } else {
                        // Fallback formatting with INR prefix for INR amounts
                        const fallbackAmount = showINRAmounts ? totalINR : totalINR;
                        if (showINRAmounts) {
                          const formattedFallback = `INR ${fallbackAmount.toLocaleString('en-IN')}`;
                          console.log('⚠️ DEBUG: Using INR fallback formatting:', formattedFallback);
                          return formattedFallback;
                        } else {
                          const fallbackSymbol = CurrencyService.getCurrencySymbol(currency);
                          const formattedFallback = `${fallbackSymbol}${fallbackAmount.toLocaleString('en-US')}`;
                          console.log('⚠️ DEBUG: Using fallback formatting:', formattedFallback);
                          return formattedFallback;
                        }
                      }
                    })()}
                  </span>
                </div>
              </td>
            </tr>
            {/* Currency Information - Add as table rows to match PDF layout exactly */}
            {(() => {
              console.log('🔍 DEBUG: Adding currency info to meta table:', {
                currency,
                shouldShow: currency !== "INR",
                currencyName: CurrencyService.getCurrencyName(currency),
                currencySymbol: CurrencyService.getCurrencySymbol(currency),
                exchangeRate: invoice?.exchange_rate
              });

              // Show currency info only for non-INR currencies (not for international clients selecting INR)
              return currency !== "INR" && (
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
                      <span style={{fontWeight: '600'}}>Currency:</span> <span style={{fontWeight: 'normal'}}>{CurrencyService.getCurrencyName(currency)} ({CurrencyService.getCurrencySymbol(currency)})</span>
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
                      <span style={{fontWeight: '600'}}>Exchange Rate:</span> <span style={{fontWeight: 'normal'}}>1 {currency} = {invoice?.exchange_rate || '1.0'} INR</span>
                    </div>
                  </td>
                </tr>
              );
            })()}
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
              }}>Amount ({showINRAmounts ? 'INR' : currency})</th>
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
                }}>
                  {(() => {
                    console.log(`🔍 DEBUG: Line item ${idx} formatting:`, {
                      showINRAmounts,
                      formattedAmounts,
                      itemAmount: it.amount,
                      currency,
                      formattingError
                    });

                    if (formattedAmounts[`item_${idx}`]) {
                      console.log(`✅ DEBUG: Using formatted amount for item ${idx}:`, formattedAmounts[`item_${idx}`]);
                      return formattedAmounts[`item_${idx}`];
                    } else if (formattingError) {
                      const fallbackSymbol = !showINRAmounts ? CurrencyService.getCurrencySymbol(currency) : '₹';
                      const fallbackAmount = `${fallbackSymbol}${it.amount.toLocaleString(!showINRAmounts ? 'en-US' : 'en-IN')}`;
                      console.log(`⚠️ DEBUG: Using fallback for item ${idx}:`, fallbackAmount);
                      return fallbackAmount;
                    } else {
                      console.log(`⏳ DEBUG: Still loading item ${idx}...`);
                      return 'Loading...';
                    }
                  })()}
                </td>
              </tr>
            ))}

            {/* Summary with proper alignment - Gross row */}
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
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
              }}>
                {(() => {
                  if (formattedAmounts.subtotal) {
                    return formattedAmounts.subtotal;
                  } else if (formattingError) {
                    const fallbackSymbol = !showINRAmounts ? CurrencyService.getCurrencySymbol(currency) : '₹';
                    return `${fallbackSymbol}${subtotalINR.toLocaleString(!showINRAmounts ? 'en-US' : 'en-IN')}`;
                  } else {
                    return 'Loading...';
                  }
                })()}
              </td>
            </tr>

            {(() => {
              console.log('🔍 DEBUG: GST Display Logic:', {
                isClientCurrencyInvoice,
                gstCalculation,
                shouldShowNA: isClientCurrencyInvoice || gstCalculation.taxType === 'none'
              });

              if (gstCalculation.taxType === 'none' && !isClientCurrencyInvoice) {
                // Show "NA" for GST when no tax applies (excluding client currency invoices)
                return (
                  <tr style={{ border: '1px solid #cccccc' }}>
                    <td className="p-1 text-[6px] text-center" style={{
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
                    }}></td>
                    <td className="p-1 text-[6px] text-center" style={{
                      padding: '3px 6px',
                      fontSize: '8px',
                      border: '1px solid #cccccc',
                      textAlign: 'center',
                      backgroundColor: '#ffffff'
                    }}>
                      <span style={{fontWeight:'bold'}}>GST</span>
                    </td>
                    <td className="p-1 text-[6px] text-center" style={{
                      padding: '3px 6px',
                      fontSize: '8px',
                      border: '1px solid #cccccc',
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                      whiteSpace: 'nowrap'
                    }}>
                      NA
                    </td>
                  </tr>
                );
              }

              // Show actual GST breakdown for other cases
              return (
                <>
                  {gstCalculation.cgstAmount > 0 && (
                    <tr style={{ border: '1px solid #cccccc' }}>
                      <td className="p-1 text-[6px] text-center" style={{
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
                      }}></td>
                      <td className="p-1 text-[6px] text-center" style={{
                        padding: '3px 6px',
                        fontSize: '8px',
                        border: '1px solid #cccccc',
                        textAlign: 'center',
                        backgroundColor: '#ffffff'
                      }}>
                        <span style={{fontWeight:'bold'}}>
                          {gstCalculation.taxType === 'gst' ? `CGST @ ${gstCalculation.cgstRate}%` : 'Tax'}
                        </span>
                      </td>
                      <td className="p-1 text-[6px] text-center" style={{
                        padding: '3px 6px',
                        fontSize: '8px',
                        border: '1px solid #cccccc',
                        textAlign: 'center',
                        backgroundColor: '#ffffff',
                        whiteSpace: 'nowrap'
                      }}>
                        {(() => {
                          if (formattedAmounts.cgst) {
                            return formattedAmounts.cgst;
                          } else if (formattingError) {
                            const fallbackSymbol = showINRAmounts ? '₹' : CurrencyService.getCurrencySymbol(currency);
                            return `${fallbackSymbol}${gstCalculation.cgstAmount.toLocaleString(showINRAmounts ? 'en-IN' : 'en-US')}`;
                          } else {
                            return 'Loading...';
                          }
                        })()}
                      </td>
                    </tr>
                  )}

                  {gstCalculation.sgstAmount > 0 && (
                    <tr style={{ border: '1px solid #cccccc' }}>
                      <td className="p-1 text-[6px] text-center" style={{
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
                      }}></td>
                      <td className="p-1 text-[6px] text-center" style={{
                        padding: '3px 6px',
                        fontSize: '8px',
                        border: '1px solid #cccccc',
                        textAlign: 'center',
                        backgroundColor: '#ffffff'
                      }}>
                        <span style={{fontWeight:'bold'}}>
                          {gstCalculation.taxType === 'gst' ? `SGST @ ${gstCalculation.sgstRate}%` : 'Tax'}
                        </span>
                      </td>
                      <td className="p-1 text-[6px] text-center" style={{
                        padding: '3px 6px',
                        fontSize: '8px',
                        border: '1px solid #cccccc',
                        textAlign: 'center',
                        backgroundColor: '#ffffff',
                        whiteSpace: 'nowrap'
                      }}>
                        {(() => {
                          if (formattedAmounts.sgst) {
                            return formattedAmounts.sgst;
                          } else if (formattingError) {
                            const fallbackSymbol = showINRAmounts ? '₹' : CurrencyService.getCurrencySymbol(currency);
                            return `${fallbackSymbol}${gstCalculation.sgstAmount.toLocaleString(showINRAmounts ? 'en-IN' : 'en-US')}`;
                          } else {
                            return 'Loading...';
                          }
                        })()}
                      </td>
                    </tr>
                  )}

                  {gstCalculation.igstAmount > 0 && (
                    <tr style={{ border: '1px solid #cccccc' }}>
                      <td className="p-1 text-[6px] text-center" style={{
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
                      }}></td>
                      <td className="p-1 text-[6px] text-center" style={{
                        padding: '3px 6px',
                        fontSize: '8px',
                        border: '1px solid #cccccc',
                        textAlign: 'center',
                        backgroundColor: '#ffffff'
                      }}>
                        <span style={{fontWeight:'bold'}}>
                          {gstCalculation.taxType === 'gst'
                            ? `IGST @ ${gstCalculation.igstRate}%`
                            : gstCalculation.taxType === 'international'
                              ? `IGST @ ${gstCalculation.igstRate || 18}%`
                              : `Tax @ ${gstCalculation.igstRate}%`
                          }
                        </span>
                      </td>
                      <td className="p-1 text-[6px] text-center" style={{
                        padding: '3px 6px',
                        fontSize: '8px',
                        border: '1px solid #cccccc',
                        textAlign: 'center',
                        backgroundColor: '#ffffff',
                        whiteSpace: 'nowrap'
                      }}>
                        {(() => {
                          if (formattedAmounts.igst) {
                            return formattedAmounts.igst;
                          } else if (formattingError) {
                            const fallbackSymbol = showINRAmounts ? '₹' : CurrencyService.getCurrencySymbol(currency);
                            return `${fallbackSymbol}${gstCalculation.igstAmount.toLocaleString(showINRAmounts ? 'en-IN' : 'en-US')}`;
                          } else {
                            return 'Loading...';
                          }
                        })()}
                      </td>
                    </tr>
                  )}
                </>
              );
            })()}

            <tr className="font-bold" style={{ border: '1px solid #cccccc' }}>
               <td className="p-1 text-[6px] text-center" style={{
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
               }}></td>
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
               }}>
                 {(() => {
                   if (formattedAmounts.total) {
                     return formattedAmounts.total;
                   } else if (formattingError) {
                     const fallbackSymbol = !showINRAmounts ? CurrencyService.getCurrencySymbol(currency) : '₹';
                     return `${fallbackSymbol}${totalINR.toLocaleString(!showINRAmounts ? 'en-US' : 'en-IN')}`;
                   } else {
                     return 'Loading...';
                   }
                 })()}
               </td>
             </tr>

            {/* Amount in words row: label in column 3 and words in column 4 */}
            <tr style={{ border: '1px solid #cccccc' }}>
              <td className="p-1 text-[6px] text-center" style={{
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
              }}>
                {invoice ? (() => {
                  console.log('🔍 DEBUG: Amount in words - Invoice type analysis:', {
                    isInternationalInvoice,
                    isClientCurrencyInvoice,
                    currency,
                    totalINR,
                    displayCurrency
                  });

                  // Determine the correct amount and currency for words conversion
                  let amountForWords = totalINR;
                  let currencyForWords = displayCurrency;

                  if (isInternationalInvoice) {
                    // International Invoice (INR format) - Show INR only for words
                    console.log('🔍 DEBUG: Converting INR amount to words for International Invoice');
                    amountForWords = totalINR;
                    currencyForWords = 'INR';
                  } else if (isClientCurrencyInvoice) {
                    // Client's own currency invoice - Show client currency only
                    console.log('🔍 DEBUG: Converting client currency amount to words');
                    amountForWords = totalINR;
                    currencyForWords = currency;
                  } else {
                    // Indian client - Show INR
                    console.log('🔍 DEBUG: Converting INR amount to words for Indian client');
                    amountForWords = totalINR;
                    currencyForWords = 'INR';
                  }

                  console.log('🔍 DEBUG: Amount in words conversion:', {
                    amountForWords,
                    currencyForWords,
                    isInternationalInvoice,
                    isClientCurrencyInvoice
                  });

                  return numberToWords(amountForWords, currencyForWords);
                })() : 'Loading...'}
              </td>
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
