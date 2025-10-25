// src/pages/PreviewQuotation.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import CurrencyService from "../utils/CurrencyService";

export default function PreviewQuotation() { // keep same name to avoid route changes
  const { id } = useParams();
  const navigate = useNavigate();

  console.log("🔍 DEBUG: PreviewQuotation component mounted");
  console.log("🔍 DEBUG: URL params - id:", id);

  const [quote, setQuote] = useState(null);
  const [client, setClient] = useState(null);

  const displayClient = useMemo(() => client || {
    client_name: "Client Not Found",
    address: "Please update address in client profile",
    gst_number: "N/A",
    country: "india",
    state: "telangana"
  }, [client]);

  useEffect(() => {
    console.log("🔄 DEBUG: useEffect triggered for quotation fetch");
    const fetchQuotation = async () => {
      console.log("🔍 DEBUG: Starting proforma fetch for ID:", id);
      console.log("🔍 DEBUG: Firebase db object:", !!db);

      try {
        if (!id || !id.trim()) {
          console.error("❌ DEBUG: Invalid ID in URL params");
          return;
        }

        console.log("🔍 DEBUG: Querying quotations collection for ID:", id);
        const qRef = doc(db, "quotations", id);
        console.log("🔍 DEBUG: Created document reference:", qRef.path);
        const qSnap = await getDoc(qRef);
        console.log("🔍 DEBUG: getDoc completed, snapshot exists:", qSnap.exists());

        if (qSnap.exists()) {
          const qData = qSnap.data();
          console.log("✅ DEBUG: Quotation found:", {
            id: qSnap.id,
            proforma_id: qData.proforma_id,
            quotation_id: qData.quotation_id,
            client_id: qData.client_id,
            hasClientId: !!qData.client_id
          });

          setQuote(qData);

          if (qData.client_id) {
            console.log("🔍 DEBUG: Fetching client data for client_id:", qData.client_id);
            const clientRef = doc(db, "clients", qData.client_id);
            const clientSnap = await getDoc(clientRef);

            if (clientSnap.exists()) {
              const clientData = clientSnap.data();
              console.log("✅ DEBUG: Client found:", {
                id: clientSnap.id,
                name: clientData.client_name,
                gst: clientData.gst_number
              });
              setClient(clientData);
            } else {
              console.warn("⚠️ INFO: Client document not found for client_id:", qData.client_id);
              setClient(null);
            }
          } else {
            console.warn("⚠️ DEBUG: No client_id in quotation data");
            setClient(null);
          }
        } else {
          console.error("❌ DEBUG: Quotation document not found for ID:", id);
          try {
            const { collection, getDocs, query, limit } = await import("firebase/firestore");
            const testQuery = query(collection(db, "quotations"), limit(5));
            const testSnap = await getDocs(testQuery);
            console.log("🔍 DEBUG: Quotations collection exists with", testSnap.docs.length, "documents");
            testSnap.docs.forEach((doc, index) => {
              console.log(`  Document ${index + 1}:`, doc.id, doc.data().proforma_id || doc.data().quotation_id);
            });
          } catch (collectionError) {
            console.error("❌ DEBUG: Error checking quotations collection:", collectionError);
          }
        }
      } catch (err) {
        console.error("❌ DEBUG: Error loading proforma:", err);
        console.error("❌ DEBUG: Error details:", {
          message: err.message,
          code: err.code,
          stack: err.stack
        });
      } finally {
        console.log("🔚 DEBUG: fetchQuotation function completed");
      }
    };
    fetchQuotation();
  }, [id]);

  console.log("🔍 DEBUG: Validation - Before useEffect that references displayClient in deps");
  useEffect(() => {
    console.log("🔄 DEBUG: Component state changed:", {
      hasQuote: !!quote,
      hasClient: !!client,
      quoteId: quote?.proforma_id || quote?.quotation_id,
      clientId: quote?.client_id,
      clientName: client?.client_name,
      displayClientName: displayClient?.client_name
    });

    if (quote && !client && quote.client_id) {
      console.warn("⚠️ DEBUG: Quote loaded but client missing - using placeholder client data");
    }

    if (!quote) {
      console.log("⏳ DEBUG: Still loading quote data");
    }

    if (quote) {
      console.log("✅ DEBUG: Quote loaded successfully - rendering preview with client data");
      console.log("=== PDF ALIGNMENT DEBUG INFO ===");
      console.log("Proforma/Quotation ID:", quote.proforma_id || quote.quotation_id);
      console.log("Type:", quote.proforma_type || quote.quotation_type);

      const previewElement = document.querySelector(".a4-preview");
      if (previewElement) {
        const rect = previewElement.getBoundingClientRect();
        console.log("Preview Container Dimensions:", {
          width: rect.width,
          height: rect.height,
          aspectRatio: rect.width / rect.height,
          expectedA4Ratio: 210 / 297,
        });

        const computedStyle = window.getComputedStyle(previewElement);
        console.log("Preview Container Computed Styles:", {
          width: computedStyle.width,
          height: computedStyle.height,
          maxWidth: computedStyle.maxWidth,
          maxHeight: computedStyle.maxHeight,
          padding: computedStyle.padding,
          fontSize: computedStyle.fontSize,
        });
      }

      const table = document.querySelector(".a4-preview table");
      if (table) {
        console.log("Table dimensions:", table.getBoundingClientRect());
        const headers = table.querySelectorAll("th");
        headers.forEach((th, i) => {
          console.log(`Header ${i} (${th.textContent}):`, th.getBoundingClientRect());
        });
        const rows = table.querySelectorAll("tbody tr");
        rows.forEach((tr, i) => {
          console.log(`Row ${i} dimensions:`, tr.getBoundingClientRect());
          const cells = tr.querySelectorAll("td");
          cells.forEach((td, j) => {
            console.log(`  Cell ${j} (${td.textContent?.slice(0,20)}):`, td.getBoundingClientRect());
          });
        });
      }

      const keyElements = [
        ".a4-preview h1",
        ".a4-preview table",
        ".a4-preview td",
        ".a4-preview p",
      ];
      keyElements.forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          const style = window.getComputedStyle(element);
          console.log(`${selector} font-size:`, style.fontSize);
        }
      });

      console.log("=== END DEBUG INFO ===");
    }
  }, [quote, client, displayClient]);

  const handleEdit = () => {
    navigate(`/dashboard/edit-quotation/${id}`); // adjust route if different
  };

  const testLogoDetection = () => {
    console.log('🧪 Testing logo detection logic...');

    const testTypes = [
      { type: 'WT', expected: 'WT' },
      { type: 'WTX', expected: 'WTX' },
      { type: 'WTPL', expected: 'WT' },
      { type: 'WTXPL', expected: 'WTX' },
      { type: 'wt', expected: 'WT' },
      { type: 'wtx', expected: 'WTX' }
    ];

    testTypes.forEach(({ type, expected }) => {
      const testIsWT = type === 'WT' || type === 'WTPL' || type.includes('WT');
      const testIsWTX = type === 'WTX' || type === 'WTXPL' || type.includes('WTX');
      const testLogoPath = testIsWTX ? '/wtx_logo.png' : '/wt-logo.png';
      const actual = testIsWTX ? 'WTX' : 'WT';

      console.log(`${type}: expected=${expected}, actual=${actual}, logo=${testLogoPath}, ${actual === expected ? '✅' : '❌'}`);
    });
  };

  if (quote) {
    testLogoDetection();
  }

  const handleDownloadProforma = async () => {
    if (!quote || !displayClient) {
      alert('Proforma or client data not available');
      return;
    }

    try {
      console.log('🔄 Attempting to import generateProformaInvoicePDF module...');
      const { generateProformaInvoicePDF } = await import('../utils/generateProformaInvoicePDF');
      console.log('✅ Proforma module imported successfully:', typeof generateProformaInvoicePDF);

      const pdfDoc = await generateProformaInvoicePDF(quote, displayClient);

      const timestamp = new Date().getTime();
      const fileName = `${quote.proforma_id || quote.quotation_id || id}_PROFORMA_${timestamp}.pdf`;
      pdfDoc.save(fileName);

      console.log('✅ Proforma PDF downloaded successfully:', fileName);
    } catch (error) {
      console.error('❌ Proforma PDF Generation Failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        proforma_id: quote?.proforma_id || quote?.quotation_id,
        client_name: displayClient?.client_name
      });

      let userMessage = 'Error generating Proforma PDF. ';
      if (error.message.includes('font')) {
        userMessage += 'Font loading issue - check if Calibri font is available. ';
      } else if (error.message.includes('image') || error.message.includes('logo')) {
        userMessage += 'Image loading issue - check if logo/signature images are accessible. ';
      } else if (error.message.includes('data')) {
        userMessage += 'Data validation issue - check proforma and client information. ';
      } else {
        userMessage += 'Unknown error occurred. ';
      }
      userMessage += 'See browser console (F12) for detailed technical information.';

      alert(userMessage);
    }
  };

  const formatDate = (dateObj) => {
    const d =
      typeof dateObj?.toDate === "function"
        ? dateObj.toDate()
        : new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const month = d.toLocaleString("default", { month: "long" });
    return `${dd} ${month} ${yyyy}`;
  };

  function numberToWordsINR(amountInput) {
    const amount = Number(amountInput ?? 0);
    if (!isFinite(amount)) return "";

    const totalPaise = Math.round(amount * 100);
    const rupees = Math.floor(totalPaise / 100);
    const paise = totalPaise % 100;

    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
      "Sixteen", "Seventeen", "Eighteen", "Nineteen",
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

  if (!quote) {
    console.log("⏳ DEBUG: Rendering loading state - quote not loaded yet");
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading proforma...
      </div>
    );
  }

  console.log("✅ INFO: Rendering proforma preview");

  const type = (quote.proforma_type || quote.quotation_type || quote.invoice_type || "").toString().toUpperCase().trim();
  const isWT = type === "WT" || type === "WTPL" || type.includes("WT");
  const isWTX = type === "WTX" || type === "WTXPL" || type.includes("WTX");
  const headingColor = isWTX ? "#ffde58" : "#3b5998";
  const logoPath = isWTX ? "/wtx_logo.png" : "/wt-logo.png";

  const fmt2 = (n) =>
    Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const services = Array.isArray(quote.services) ? quote.services : [];
  const normalizedItems =
    services.length > 0
      ? services.map((s, i) => {
          const nameStr = Array.isArray(s?.name)
            ? s.name.filter(Boolean).join(", ")
            : s?.name || `Service ${i + 1}`;
          return {
            name: String(nameStr),
            description: String(s?.description || ""),
            amount: Number(s?.amount || 0),
          };
        })
      : [
          {
            name: String(
              quote.proforma_title ||
                quote.quotation_title ||
                quote.service_name ||
                "Service"
            ),
            description: String(quote.service_description || ""),
            amount: Number(quote.subtotal || 0),
          },
        ];

  const subtotal =
    Number(quote.subtotal) ||
    normalizedItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);
  const total = Number(quote.total_amount) || subtotal;

  const toLower = (s) => (s || "").toString().trim().toLowerCase();
  const clientCountry = toLower(displayClient.country);
  const clientState = toLower(displayClient.state);
  const isIndian = clientCountry === "india";
  const isTelangana = clientState === "telangana";

  // Currency detection logic for international clients
  const isInternationalClient = displayClient.country && !clientCountry.includes('india');
  const clientCurrency = isInternationalClient ? CurrencyService.getDefaultCurrencyForClient(displayClient) : 'INR';
  const displayCurrency = quote?.currency || clientCurrency;
  const showINRAmounts = displayCurrency === 'INR';

  console.log('🔍 DEBUG: Proforma Currency Analysis:', {
    clientCountry: displayClient.country,
    isInternationalClient,
    clientCurrency,
    displayCurrency,
    showINRAmounts,
    quoteCurrency: quote?.currency
  });

  let cgstRate = 0,
    sgstRate = 0,
    igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9;
    sgstRate = 9;
    igstRate = 0;
  } else if (isIndian && !isTelangana) {
    cgstRate = 0;
    sgstRate = 0;
    igstRate = 18;
  } else {
    cgstRate = 0;
    sgstRate = 0;
    igstRate = 0;
  }

  const storedCGST = Number(quote.cgst ?? 0);
  const storedSGST = Number(quote.sgst ?? 0);
  const storedIGST = Number(quote.igst ?? 0);

  const cgstAmount = storedCGST || +(subtotal * (cgstRate / 100)).toFixed(2);
  const sgstAmount = storedSGST || +(subtotal * (sgstRate / 100)).toFixed(2);
  const igstAmount = storedIGST || +(subtotal * (igstRate / 100)).toFixed(2);
  const summaryRowCount = 1 + (isIndian && isTelangana ? 2 : 1) + 1;

  const proformaId = quote.proforma_id || quote.quotation_id || id;
  const proformaDate =
    quote.proforma_date || quote.quotation_date || quote.created_at?.toDate?.();
  const proformaTitle =
    quote.proforma_title || quote.quotation_title || normalizedItems[0]?.name;

  return (
    <div className="bg-gray-100 font-sans text-[13px] text-gray-900 preview" style={{ margin: '0 auto', padding: '0' }}>
      {/* actions */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex gap-2 justify-center" style={{ margin: '0', padding: '12px 24px' }}>
        <button
          onClick={handleEdit}
          className="bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] text-sm"
        >
          Edit Proforma
        </button>
        <button
          onClick={handleDownloadProforma}
          className="bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] text-sm"
        >
          Download Proforma PDF
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
        <div className="a4-preview bg-white" style={{
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
            <img
              src={logoPath}
              alt="Company Logo"
              className="h-12"
              style={{ height: '44px', width: 'auto' }}
              onError={(e) => {
                console.error('❌ Preview DEBUG: Logo failed to load:', logoPath);
                const fallbackPaths = ['/wtx_logo.png', '/wt-logo.png', '/invoice-logo.png'];
                let i = 0;
                const tryFallback = () => {
                  if (i < fallbackPaths.length) {
                    e.target.src = fallbackPaths[i++];
                  }
                };
                e.target.onerror = tryFallback;
                tryFallback();
              }}
              onLoad={(e) => {
                console.log('✅ Preview DEBUG: Logo loaded:', e.target.naturalWidth + 'x' + e.target.naturalHeight);
              }}
            />
            <div className="text-left text-[9px] leading-tight" style={{ fontSize: '9px', lineHeight: '1.2', marginTop: '10px', textAlign: 'left' }}>
              <p>19/B, 3rd Floor, Progressive Tower<br />100 Ft Road, Siddhi Vinayak Nagar<br />Madhapur, Hyderabad, Telangana - 500081</p>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-xl mb-4" style={{ color: headingColor, fontSize: '20px', marginBottom: '10px', marginTop: '0px', fontFamily: 'Calibri, sans-serif', fontWeight: 'normal' }}>
            Proforma Invoice
          </h1>

          {/* ================== 1) Top info table — FORCE 50/50 COLUMNS ================== */}
          <table className="w-full border-collapse mb-3" style={{
            marginBottom: '8px',
            border: '1px solid #cccccc',
            backgroundColor: '#ffffff',
            fontFamily: 'Calibri, sans-serif',
            fontSize: '9px'
          }}>
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
            </colgroup>
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
                    <span style={{fontWeight: '600'}}>Proforma Number:</span> <span style={{fontWeight: 'normal'}}>{proformaId}</span>
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
                    <span style={{fontWeight: '600'}}>Proforma Date:</span>{" "}
                    <span style={{fontWeight: 'normal'}}>
                      {proformaDate ? formatDate(proformaDate) : formatDate(quote.created_at?.toDate?.())}
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
                    <span style={{fontWeight: '600'}}>Proforma Title:</span> <span style={{fontWeight: 'normal'}}>{proformaTitle}</span>
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
                        if (showINRAmounts) {
                          return `INR ${fmt2(total)}`;
                        } else {
                          const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                          return `${currencySymbol}${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                      })()}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* ================== 2) Customer block — FORCE 50/50 COLUMNS ================== */}
          <table className="w-full border-collapse mb-3" style={{
            marginBottom: '8px',
            border: '1px solid #cccccc',
            backgroundColor: '#ffffff',
            fontFamily: 'Calibri, sans-serif',
            fontSize: '9px'
          }}>
            <colgroup>
              <col style={{ width: '50%' }} />
              <col style={{ width: '50%' }} />
            </colgroup>
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
                    <span style={{fontWeight: '600'}}>Customer Name:</span> <span style={{fontWeight: 'normal'}}>{displayClient.client_name}</span>
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
                    <span style={{fontWeight:'bold'}}>Customer Address:</span> {displayClient.address}
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
                    <span style={{fontWeight:'bold'}}>Customer GST IN:</span> {(displayClient.gst_number || "").trim() || "NA"}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Items table (unchanged) */}
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
                }}>Amount ({showINRAmounts ? 'INR' : displayCurrency})</th>
              </tr>
            </thead>
            <tbody>
              {normalizedItems.map((it, idx) => (
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
                      if (showINRAmounts) {
                        return fmt2(it.amount);
                      } else {
                        const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                        return `${currencySymbol}${it.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }
                    })()}
                  </td>
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
                }}>
                  {(() => {
                    if (showINRAmounts) {
                      return fmt2(subtotal);
                    } else {
                      const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                      return `${currencySymbol}${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }
                  })()}
                </td>
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
                    }}><span style={{fontWeight:'bold'}}>CGST @ {cgstRate}%</span></td>
                    <td className="p-1 text-[6px] text-center" style={{
                      padding: '3px 6px',
                      fontSize: '8px',
                      border: '1px solid #cccccc',
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                      whiteSpace: 'nowrap'
                    }}>
                      {(() => {
                        if (showINRAmounts) {
                          return fmt2(cgstAmount);
                        } else {
                          const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                          return `${currencySymbol}${cgstAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                      })()}
                    </td>
                  </tr>
                  <tr style={{ border: '1px solid #cccccc' }}>
                    <td className="p-1 text-[6px] text-center" style={{
                      padding: '3px 6px',
                      fontSize: '8px',
                      border: '1px solid #cccccc',
                      textAlign: 'center',
                      backgroundColor: '#ffffff'
                    }}><span style={{fontWeight:'bold'}}>SGST @ {sgstRate}%</span></td>
                    <td className="p-1 text-[6px] text-center" style={{
                      padding: '3px 6px',
                      fontSize: '8px',
                      border: '1px solid #cccccc',
                      textAlign: 'center',
                      backgroundColor: '#ffffff',
                      whiteSpace: 'nowrap'
                    }}>
                      {(() => {
                        if (showINRAmounts) {
                          return fmt2(sgstAmount);
                        } else {
                          const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                          return `${currencySymbol}${sgstAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                      })()}
                    </td>
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
                  }}>
                    {(() => {
                      if (showINRAmounts) {
                        return fmt2(igstAmount);
                      } else {
                        const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                        return `${currencySymbol}${igstAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }
                    })()}
                  </td>
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
                }}>
                  {(() => {
                    if (showINRAmounts) {
                      return fmt2(total);
                    } else {
                      const currencySymbol = CurrencyService.getCurrencySymbol(displayCurrency);
                      return `${currencySymbol}${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    }
                  })()}
                </td>
              </tr>

              {/* Amount in words row */}
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
                }}>
                  {(() => {
                    if (showINRAmounts) {
                      return numberToWordsINR(total);
                    } else {
                      const currencyName = CurrencyService.getCurrencyName(displayCurrency);
                      return `${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyName} only`;
                    }
                  })()}
                </td>
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
