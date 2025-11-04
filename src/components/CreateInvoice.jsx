import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
   collection,
   getDocs,
   doc,
   setDoc,
   runTransaction,
   updateDoc,
   getDoc,
   Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Select from "react-select";
import { generateAndSaveBothChunkedPDFs } from "../utils/pdfChunkedStorage";
import CurrencyService, { LiveExchangeRateService } from "../utils/CurrencyService";
import { getCurrencyOptionsForSelect, getSuggestedCurrencyForCountry, STATIC_EXCHANGE_RATES } from "../constants/currencies";
import { sanitizeAmountInput } from "../utils/generateInvoicePDF";
import { InputSanitizer } from "../utils/sanitization";

export default function CreateInvoice() {
  const [yourCompany, setYourCompany] = useState("");
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [previewInvoiceNumber, setPreviewInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [services, setServices] = useState([]); // [{ name: string[]|string, description: string, amount: string|number }]
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [gstPaymentStatus, setGstPaymentStatus] = useState("Pending");

  // PDF generation states
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ stage: "", progress: 0, message: "" });

  // Currency states
  const [availableCurrencies, setAvailableCurrencies] = useState(["INR"]);
  const [selectedCurrency, setSelectedCurrency] = useState("INR");
  const [currencyCalculations, setCurrencyCalculations] = useState(null);
  const [gstApplicable, setGstApplicable] = useState(true);
  const [isLoadingCurrency, setIsLoadingCurrency] = useState(false);

  // Inline errors (custom validation)
  const [errors, setErrors] = useState({
    yourCompany: "",
    invoiceDate: "",
    invoiceTitle: "",
    selectedClientId: "",
    services: "",
    serviceRows: {}, // { idx: { name, amount, description } }
  });

  const navigate = useNavigate();

  // ✅ Multi-currency amount formatter (sync wrapper using pre-calculated values)
  const formatAmount = (numINR) => {
    if (isNaN(numINR)) return "0.00";
    // Use the currencyCalculations state for display values
    return currencyCalculations ?
      CurrencyService.formatCurrencyDisplay(numINR, selectedCurrency) :
      "0.00";
  };

  // Format amount in selected currency (primary display)
  const formatPrimaryAmount = (amountINR) => {
    if (isNaN(amountINR)) return `0.00 ${CurrencyService.getCurrencySymbol(selectedCurrency)}`;
    return CurrencyService.formatCurrencyDisplay(amountINR, selectedCurrency);
  };

  // Currency options for React Select - Show client currency first, then INR
  const currencyOptions = useMemo(() => {
    if (!selectedClient?.country) {
      // No client selected - show only INR
      return getCurrencyOptionsForSelect(['INR']);
    }

    // Get client's local currency
    const clientCurrency = CurrencyService.getDefaultCurrencyForClient(selectedClient);

    // Create options array: client currency first, then INR
    const currencies = [clientCurrency];
    if (clientCurrency !== 'INR') {
      currencies.push('INR');
    }

    return getCurrencyOptionsForSelect(currencies);
  }, [availableCurrencies, selectedClient]);

  // helper: renders "Label *" with red asterisk
  const RequiredLabel = ({ children }) => (
    <span style={{ fontWeight: 600 }}>
      {children} <span style={{ color: "#d32f2f" }}>*</span>
    </span>
  );

  const serviceOptions = [
    { label: "Lyrical Videos", value: "Lyrical Videos" },
    { label: "Posters", value: "Posters" },
    { label: "Digital Creatives", value: "Digital Creatives" },
    { label: "Motion Posters", value: "Motion Posters" },
    { label: "Title Animations", value: "Title Animations" },
    { label: "Marketing", value: "Marketing" },
    { label: "Editing", value: "Editing" },
    { label: "Teaser", value: "Teaser" },
    { label: "Trailer", value: "Trailer" },
    { label: "Promos", value: "Promos" },
    { label: "Google Ads", value: "Google Ads" },
    { label: "YouTube Ads", value: "YouTube Ads" },
    { label: "Influencer Marketing", value: "Influencer Marketing" },
    { label: "Meme Marketing", value: "Meme Marketing" },
    { label: "Open and end titles", value: "Open and end titles" },
    { label: "Pitch Deck", value: "Pitch Deck" },
    { label: "Branding", value: "Branding" },
    { label: "Strategy & Marketing", value: "Strategy & Marketing" },
    { label: "Creative design & editing", value: "Creative design & editing" },
    { label: "Digital Marketing", value: "Digital Marketing" },
    { label: "Content & video production", value: "Content & video production" },
    { label: "Performance Marketing", value: "Performance Marketing" },
    { label: "Web Development", value: "Web Development" },
    { label: "Ad Film", value: "Ad Film" },
    { label: "Brand Film", value: "Brand Film" },
    { label: "Corporate Film", value: "Corporate Film" },
    { label: "Shoot Camera Equipment", value: "Shoot Camera Equipment" },
  ];

  // fetch clients & projects
  useEffect(() => {
    const fetchData = async () => {
      const clientSnap = await getDocs(collection(db, "clients"));
      const clientList = clientSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Debug logging for client data
      console.log('🔍 DEBUG: CreateInvoice - Total clients loaded:', clientList.length);
      console.log('🔍 DEBUG: CreateInvoice - Sample client data:', clientList.slice(0, 3));
      console.log('🔍 DEBUG: CreateInvoice - All company_group values:', [...new Set(clientList.map(c => c.company_group))]);
      console.log('🔍 DEBUG: CreateInvoice - All company_name values:', [...new Set(clientList.map(c => c.company_name))]);

      setClients(clientList);

      const projectSnap = await getDocs(collection(db, "projects"));
      const projectList = projectSnap.docs.map((doc) => ({
        value: doc.id,
        label: doc.data().projectName,
      }));
      setProjects(projectList);
    };
    fetchData();
  }, []);

  // generate invoice id on company/date
  useEffect(() => {
    if (yourCompany && invoiceDate) generateInvoiceId(yourCompany);
  }, [yourCompany, invoiceDate]);

  const generateInvoiceId = async (company) => {
    const [yyyy, mm] = invoiceDate.split("-");
    const yy = yyyy.slice(2);
    const dateStr = `${yy}${mm}`; // YYMM
    const counterKey = `${company}_${dateStr}`;
    const counterRef = doc(db, "invoice_counters", counterKey);

    try {
      const count = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(counterRef);
        const current = docSnap.exists() ? docSnap.data().count : 0;
        const next = current + 1;
        transaction.set(counterRef, { count: next });
        return next;
      });

      const invoiceId = `${company}${dateStr}INV${String(count).padStart(3, "0")}`;
      setPreviewInvoiceNumber(invoiceId);
    } catch (error) {
      console.error("❌ Error generating invoice ID:", error);
    }
  };

  // sanitize services
  const sanitizeServices = useMemo(() =>
    services.map((s, i) => {
      const nameStr = Array.isArray(s?.name)
        ? s.name.filter(Boolean).join(", ")
        : (s?.name ?? "");
      const amountNum = Number(s?.amount ?? 0);
      return {
        name: String(nameStr || `Service ${i + 1}`),
        description: String(s?.description ?? ""),
        amount: isNaN(amountNum) ? 0 : amountNum,
      };
    }), [services]);

  // computed amounts
  const sanitized = sanitizeServices;
  const subtotal = sanitized.reduce((sum, s) => {
    const sanitizedAmount = CurrencyService.sanitizeAmount(s.amount || 0);
    console.log(`🔍 DEBUG: Service amount sanitization: "${s.amount}" → ${sanitizedAmount}`);
    return sum + sanitizedAmount;
  }, 0);

  const isIndian = selectedClient?.country === "India";
  const isTelangana = selectedClient?.state === "Telangana";

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) { cgstRate = 9; sgstRate = 9; }
  else if (isIndian) { igstRate = 18; }

  const cgst = (subtotal * cgstRate) / 100;
  const sgst = (subtotal * sgstRate) / 100;
  const igst = (subtotal * igstRate) / 100;

  const tax_amount = cgst + sgst + igst;
  const grand_total = subtotal + tax_amount;

  // company -> group mapping & filtered clients
  const companyToGroup = {
    WT: "WT",
    WTPL: "WT",  // WTPL should show same clients as WT
    WTX: "WTX",
    WTXPL: "WTX", // WTXPL should show same clients as WTX
  };

  // sort clients A→Z (company_name, then client_name)
  const sortedClients = useMemo(() => {
    const copy = [...clients];
    copy.sort((a, b) => {
      const aCo = (a.company_name || "").toLowerCase();
      const bCo = (b.company_name || "").toLowerCase();
      if (aCo !== bCo) return aCo.localeCompare(bCo);
      return (a.client_name || "").toLowerCase().localeCompare((b.client_name || "").toLowerCase());
    });
    return copy;
  }, [clients]);

  // filter by selected company group
  const filteredClients = useMemo(() => {
    const group = companyToGroup[yourCompany];
    console.log('🔍 DEBUG: CreateInvoice - Filtering clients for company:', yourCompany, 'group:', group);
    console.log('🔍 DEBUG: CreateInvoice - Total sorted clients:', sortedClients.length);
    if (!group) {
      console.log('⚠️ DEBUG: CreateInvoice - No group found for company:', yourCompany);
      return [];
    }

    // Primary filter: by company_group
    let filtered = sortedClients.filter((c) => c.company_group === group);

    // Fallback: if no clients found by company_group, try by company_name
    if (filtered.length === 0) {
      console.log('⚠️ DEBUG: CreateInvoice - No clients found by company_group, trying company_name fallback');
      filtered = sortedClients.filter((c) =>
        c.company_name === yourCompany ||
        (c.company_name === 'WT' && (yourCompany === 'WT' || yourCompany === 'WTPL')) ||
        (c.company_name === 'WTPL' && (yourCompany === 'WT' || yourCompany === 'WTPL')) ||
        (c.company_name === 'WTX' && (yourCompany === 'WTX' || yourCompany === 'WTXPL')) ||
        (c.company_name === 'WTXPL' && (yourCompany === 'WTX' || yourCompany === 'WTXPL'))
      );
    }

    // Last resort: if still no clients and we have clients in total, show all clients
    if (filtered.length === 0 && sortedClients.length > 0) {
      console.log('⚠️ DEBUG: CreateInvoice - No clients found with filtering, showing all clients as fallback');
      filtered = sortedClients;
    }

    console.log('✅ DEBUG: CreateInvoice - Filtered clients:', filtered.length, 'clients for group:', group);
    console.log('✅ DEBUG: CreateInvoice - Filtered client sample:', filtered.slice(0, 3));
    return filtered;
  }, [sortedClients, yourCompany]);

  // clear selected client if mismatch after company change
  useEffect(() => {
    if (!yourCompany) {
      setSelectedClientId("");
      setSelectedClient(null);
      return;
    }
    if (selectedClientId) {
      const stillThere = filteredClients.find((c) => c.id === selectedClientId);
      if (!stillThere) {
        setSelectedClientId("");
        setSelectedClient(null);
      }
    }
  }, [yourCompany, filteredClients, selectedClientId]);

  // Handle async currency calculations
  useEffect(() => {
    let isCancelled = false;

    const performCurrencyCalculations = async () => {
      try {
        console.log('🔄 DEBUG: Starting currency calculations...', {
          servicesCount: services.length,
          selectedCurrency,
          hasClient: !!selectedClient
        });

        if (services.length === 0) {
          console.log('ℹ️ DEBUG: No services, clearing calculations');
          if (!isCancelled) {
            setCurrencyCalculations(null);
            setIsLoadingCurrency(false);
          }
          return;
        }

        if (!isCancelled) {
          setIsLoadingCurrency(true);
          console.log('⏳ DEBUG: Set loading state, starting calculations...');
        }

        // Use setTimeout to avoid blocking UI during calculations
        setTimeout(async () => {
          try {
            console.log('🔢 DEBUG: Processing services for calculations...');
            const sanitized = sanitizeServices || [];
            const subtotalInSelectedCurrency = sanitized.reduce((sum, s) => sum + CurrencyService.sanitizeAmount(s.amount || 0), 0);

            console.log('💰 DEBUG: Subtotal calculated:', {
              subtotalInSelectedCurrency,
              services: sanitized.map(s => ({ name: s.name, amount: s.amount }))
            });

            if (!isCancelled) {
              // Convert to INR for GST calculations (GST only applies to INR)
              console.log('🔄 DEBUG: Converting to INR for GST calculations...', {
                subtotalInSelectedCurrency,
                selectedCurrency,
                isInternationalClient: selectedClient?.country && !selectedClient.country.toLowerCase().includes('india')
              });
              const subtotalINR = await CurrencyService.convertCurrencyToINR(subtotalInSelectedCurrency, selectedCurrency);

              // Enhanced GST logic: Apply GST for INR currency regardless of client country
              const isINRSelected = selectedCurrency === 'INR';
              const gstApplicable = isINRSelected; // GST applies when INR is selected

              let gstCalculation;
              if (gstApplicable) {
                // Check if client is international but INR is selected - apply 18% international tax
                const isInternationalClient = selectedClient?.country && !selectedClient.country.toLowerCase().includes('india');
                if (isInternationalClient && isINRSelected) {
                  // Apply 18% international tax for non-Indian clients using INR
                  const internationalTaxAmount = (subtotalINR * 18) / 100;
                  gstCalculation = {
                    cgstAmount: 0,
                    sgstAmount: 0,
                    igstAmount: internationalTaxAmount,
                    cgstRate: 0,
                    sgstRate: 0,
                    igstRate: 18,
                    totalTax: internationalTaxAmount,
                    totalAmount: subtotalINR + internationalTaxAmount,
                    isInternationalTax: true,
                    taxType: 'international'
                  };
                  console.log('🌍 DEBUG: Applied 18% international tax for non-Indian client using INR');
                } else {
                  // Regular GST calculation for Indian clients or when GST is applicable
                  gstCalculation = CurrencyService.calculateGST(subtotalINR, selectedClient?.state, selectedClient);
                }
              } else {
                gstCalculation = { cgstAmount: 0, sgstAmount: 0, igstAmount: 0, totalTax: 0, totalAmount: subtotalINR };
              }

              // Final amounts
              const subtotal = gstApplicable ? subtotalINR : subtotalINR;
              const tax_amount = gstCalculation.totalTax;
              const grand_total = gstCalculation.totalAmount;

              // Display amounts in selected currency
              const subtotalDisplay = CurrencyService.formatCurrencyDisplay(subtotalINR, selectedCurrency);
              const taxDisplay = CurrencyService.formatCurrencyDisplay(tax_amount, selectedCurrency);
              const grandTotalDisplay = CurrencyService.formatCurrencyDisplay(grand_total, selectedCurrency);

              console.log('✅ DEBUG: Calculations completed:', {
                subtotalINR,
                gstApplicable,
                grand_total,
                subtotalDisplay,
                taxDisplay,
                grandTotalDisplay
              });

              if (!isCancelled) {
                setCurrencyCalculations({
                  subtotalInSelectedCurrency,
                  subtotalINR,
                  gstCalculation,
                  gstApplicable,
                  subtotal,
                  tax_amount,
                  grand_total,
                  subtotalDisplay,
                  taxDisplay,
                  grandTotalDisplay
                });

                console.log(`✅ DEBUG: Currency calculations state updated for ${selectedCurrency}`);
              }
            }
          } catch (error) {
            if (!isCancelled) {
              console.error('❌ Error in currency calculations:', error);
              console.error('❌ Error details:', {
                services: services.length,
                selectedCurrency,
                selectedClient: !!selectedClient
              });
            }
          } finally {
            if (!isCancelled) {
              setIsLoadingCurrency(false);
              console.log('🏁 DEBUG: Currency calculations finished');
            }
          }
        }, 100); // Small delay to prevent blocking UI

      } catch (error) {
        if (!isCancelled) {
          console.error('❌ Error setting up currency calculations:', error);
          setIsLoadingCurrency(false);
        }
      }
    };

    performCurrencyCalculations();

    // Cleanup function to prevent state updates after component unmount
    return () => {
      isCancelled = true;
    };
  }, [services, selectedCurrency, selectedClient?.state]);

  // Periodic cache cleanup to prevent memory leaks
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (CurrencyService.cleanup && typeof CurrencyService.cleanup === 'function') {
        CurrencyService.cleanup();
      }
    }, 60000); // Cleanup every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  // validation
  const validate = () => {
    const nextErrors = {
      yourCompany: "",
      invoiceDate: "",
      invoiceTitle: "",
      selectedClientId: "",
      services: "",
      serviceRows: {},
    };

    if (!yourCompany) nextErrors.yourCompany = "Select your company.";
    if (!invoiceDate) nextErrors.invoiceDate = "Select invoice date.";
    if (!invoiceTitle.trim()) nextErrors.invoiceTitle = "Enter invoice title.";
    if (!selectedClientId) nextErrors.selectedClientId = "Select a client.";

    if (services.length === 0) {
      nextErrors.services = "Add at least one service.";
    } else {
      services.forEach((s, idx) => {
        const rowErr = {};
        const amt = s?.amount;

        if (!s?.name || (Array.isArray(s.name) && s.name.length === 0)) {
          rowErr.name = "Select at least one service name.";
        }
        if (amt === "" || amt === undefined || isNaN(Number(amt))) {
          rowErr.amount = "Enter a valid amount.";
        } else if (Number(amt) <= 0) {
          rowErr.amount = "Amount must be greater than 0.";
        } else if (selectedCurrency === "INR" && Number(amt) < 1) {
          rowErr.amount = "INR amount must be at least ₹1.";
        } else if (selectedCurrency !== "INR" && Number(amt) < 0.01) {
          rowErr.amount = `Amount must be at least ${CurrencyService.getCurrencySymbol(selectedCurrency)}0.01.`;
        }
        if (!String(s?.description || "").trim()) {
          rowErr.description = "Enter a short description.";
        }
        if (Object.keys(rowErr).length) {
          nextErrors.serviceRows[idx] = rowErr;
        }
      });
    }

    setErrors(nextErrors);
    const hasRowErrors = Object.keys(nextErrors.serviceRows).length > 0;
    const hasTopErrors =
      nextErrors.yourCompany ||
      nextErrors.invoiceDate ||
      nextErrors.invoiceTitle ||
      nextErrors.selectedClientId ||
      nextErrors.services;
    return !(hasTopErrors || hasRowErrors);
  };

  // submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsGeneratingPDF(true);
    setPdfProgress({ stage: "starting", progress: 5, message: "Creating invoice..." });

    const sanitizedNow = sanitizeServices;
    const subtotalNow = sanitizedNow.reduce((sum, s) => {
      const sanitizedAmount = CurrencyService.sanitizeAmount(s.amount || 0);
      console.log(`🔍 DEBUG: Service amount sanitization: "${s.amount}" → ${sanitizedAmount}`);
      return sum + sanitizedAmount;
    }, 0);

    const isIndianNow = selectedClient?.country === "India";
    const isTelanganaNow = selectedClient?.state === "Telangana";

    let cgstRateNow = 0, sgstRateNow = 0, igstRateNow = 0;
    if (isIndianNow && isTelanganaNow) { cgstRateNow = 9; sgstRateNow = 9; }
    else if (isIndianNow) { igstRateNow = 18; }

    const cgstNow = (subtotalNow * cgstRateNow) / 100;
    const sgstNow = (subtotalNow * sgstRateNow) / 100;
    const igstNow = (subtotalNow * igstRateNow) / 100;

    const tax_amountNow = cgstNow + sgstNow + igstNow;
    const grand_totalNow = subtotalNow + tax_amountNow;

    const isGSTApplicable = !!selectedClient && isIndianNow;

    // Get current exchange rate for storage
    const currentExchangeRate = await CurrencyService.getExchangeRateWithRefresh(selectedCurrency);
    const isLive = LiveExchangeRateService.isUsingLiveRates();

    const invoiceData = {
      invoice_id: previewInvoiceNumber,
      client_id: selectedClientId,
      project_id: selectedProject ? selectedProject.value : "",
      invoice_type: yourCompany,
      invoice_title: invoiceTitle,
      invoice_date: invoiceDate,
      currency: selectedCurrency, // Add currency field
      exchange_rate: currentExchangeRate, // Add exchange rate
      services: sanitizedNow,
      subtotal: Number(subtotalNow.toFixed(2)),
      cgst: Number(cgstNow.toFixed(2)),
      sgst: Number(sgstNow.toFixed(2)),
      igst: Number(igstNow.toFixed(2)),
      tax_amount: Number(tax_amountNow.toFixed(2)),
      total_amount: Number(grand_totalNow.toFixed(2)),
      payment_status: paymentStatus,
      gst_payment_status: isGSTApplicable ? gstPaymentStatus : "NA",
      payment_date: null,
      pdf_url: "",
      tax_pdf_url: "",
      proforma_pdf_url: "",
      created_at: Timestamp.now(),
      // Metadata
      live_rates_used: isLive,
      static_rates_used: !isLive,
      rate_source: isLive ? 'live_api' : 'static_fallback'
    };

    console.log('🔍 DEBUG: CreateInvoice - Invoice data being saved:', {
      invoice_id: invoiceData.invoice_id,
      client_id: invoiceData.client_id,
      selectedCurrency: selectedCurrency,
      currency: selectedCurrency,
      clientCountry: selectedClient?.country,
      isJapaneseClient: selectedClient?.country?.toLowerCase().includes('japan'),
      subtotal: invoiceData.subtotal,
      total_amount: invoiceData.total_amount
    });

    try {
      setPdfProgress({ stage: "saving", progress: 15, message: "Saving invoice to database..." });
      await setDoc(doc(db, "invoices", previewInvoiceNumber), invoiceData);

      setPdfProgress({ stage: "generating", progress: 30, message: "Generating and saving PDF files..." });

      const pdfInvoiceData = {
        ...invoiceData,
        invoice_id: previewInvoiceNumber,
        invoice_date_display: new Date(invoiceDate).toLocaleDateString("en-IN"),
        client_display_name: `${selectedClient?.company_name ?? ""} — ${selectedClient?.client_name ?? ""}`,
        client_address: selectedClient?.address ?? "",
        client_email: selectedClient?.email ?? "",
        client_phone: selectedClient?.phone ?? "",
        project_name: selectedProject?.label ?? "",
        company_bucket: ["WT", "WTPL"].includes(yourCompany) ? "WT" : "WTX",
        gst_payment_status: invoiceData.gst_payment_status,
        currency: selectedCurrency, // Ensure currency is included in PDF data
        line_items: sanitizedNow.map((s) => ({
          name: s.name,
          description: s.description,
          amount: Number(s.amount || 0),
        })),
      };

      const { taxPdfId, proformaPdfId } = await generateAndSaveBothChunkedPDFs(
        pdfInvoiceData,
        selectedClient,
        selectedCurrency
      );

      setPdfProgress({ stage: "updating", progress: 90, message: "Updating invoice with PDF references..." });
      await updateDoc(doc(db, "invoices", previewInvoiceNumber), {
        pdf_url: `firestore:${taxPdfId}`,
        tax_pdf_id: taxPdfId,
        proforma_pdf_id: proformaPdfId,
      });

      setPdfProgress({ stage: "complete", progress: 100, message: "Invoice and PDFs saved successfully!" });

      setTimeout(() => {
        setIsGeneratingPDF(false);
        navigate(`/dashboard/invoice/${previewInvoiceNumber}`);
      }, 1200);
    } catch (error) {
      console.error("❌ Error creating invoice:", error);
      setPdfProgress({ stage: "error", progress: 0, message: `Error: ${error.message}` });
      setIsGeneratingPDF(false);
      alert(`Failed to create invoice and/or generate PDFs.\n\nDetails: ${error.message}`);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
      <form onSubmit={handleSubmit} noValidate
        style={{  borderRadius: "10px", padding: "20px", width: "100%",  }}>
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Create Invoice</h2>
        </div>
        <div className="p-[15px] bg-[#ffffff] border-curve">

          {/* Company (required) */}
          <RequiredLabel>Select Company</RequiredLabel>
          <select
            value={yourCompany}
            onChange={(e) => setYourCompany(e.target.value)}
            aria-invalid={!!errors.yourCompany}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "6px",
              borderRadius: 10,
              border: `1px solid ${errors.yourCompany ? "#d32f2f" : "#ccc"}`,
            }}
          >
            <option value="">Select Company</option>
            <option value="WT">WT</option>
            <option value="WTPL">WTPL</option>
            <option value="WTX">WTX</option>
            <option value="WTXPL">WTXPL</option>
          </select>
          {errors.yourCompany && <small style={{ color: "#d32f2f" }}>{errors.yourCompany}</small>}

          <div style={{ display: "flex", gap: "20px", marginTop: 14, marginBottom: 8 }}>
            <div style={{ flex: 1 }} className="mr-[10px]">
              <RequiredLabel>Invoice Date</RequiredLabel>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                aria-invalid={!!errors.invoiceDate}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${errors.invoiceDate ? "#d32f2f" : "#ccc"}`,
                }}
              />
              {errors.invoiceDate && <small style={{ color: "#d32f2f" }}>{errors.invoiceDate}</small>}
            </div>

            <div style={{ flex: 1 }}>
              <RequiredLabel>Title of Invoice</RequiredLabel>
                  <input
                    type="text"
                    value={invoiceTitle}
                    onChange={(e) => setInvoiceTitle(InputSanitizer.sanitizeText(e.target.value))}
                    aria-invalid={!!errors.invoiceTitle}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 10,
                      border: `1px solid ${errors.invoiceTitle ? "#d32f2f" : "#ccc"}`,
                    }}
                  />
              {errors.invoiceTitle && <small style={{ color: "#d32f2f" }}>{errors.invoiceTitle}</small>}
            </div>
          </div>

          {/* Invoice Number */}
          <label style={{ fontWeight: "600" }}>Invoice Number</label>
          <input type="text" value={previewInvoiceNumber} disabled style={{ width: "100%", padding: "10px", marginBottom: "20px", background: "#ffffff", fontWeight: "bold", borderRadius: "10px" }} />

          {/* Client (filtered by company) */}
          <RequiredLabel>Select Client</RequiredLabel>
          <Select
            isDisabled={!yourCompany}
            options={filteredClients.map((client) => ({
              value: client.id,
              // ✅ Only client name; no dashes or placeholders
              label: client.client_name || "",
            }))}
            value={
              filteredClients.find((c) => c.id === selectedClientId)
                ? {
                    value: selectedClientId,
                    // ✅ Only client name; no dashes or placeholders
                    label: selectedClient?.client_name || "",
                  }
                : null
            }
            onChange={(selected) => {
              setSelectedClientId(selected?.value || "");
              const client = filteredClients.find((c) => c.id === selected?.value);
              setSelectedClient(client || null);

              // Set default currency to client's local currency (not INR)
              if (client?.country) {
                const clientCurrency = CurrencyService.getDefaultCurrencyForClient(client);
                console.log('🔍 DEBUG: CreateInvoice - Client selected:', {
                  clientName: client.client_name,
                  clientCountry: client.country,
                  clientCurrency: clientCurrency,
                  isJapaneseClient: client.country?.toLowerCase().includes('japan')
                });
                setSelectedCurrency(clientCurrency);

                // Update GST payment status based on client's local currency
                const gstApplicable = CurrencyService.isGSTApplicable(clientCurrency);
                if (!gstApplicable) {
                  setGstPaymentStatus("NA");
                } else {
                  setGstPaymentStatus("Pending");
                }

                // Update gstApplicable state for UI display
                setGstApplicable(gstApplicable);
              } else {
                // No client selected - default to INR
                setSelectedCurrency("INR");
                setGstApplicable(true);
                setGstPaymentStatus("Pending");
              }

              setErrors((prev) => ({ ...prev, selectedClientId: "" }));
            }}
            placeholder={yourCompany ? "Select Client..." : "Select company first"}
            isSearchable
            styles={{
              control: (base) => ({
                ...base,
                padding: 2,
                marginBottom: 6,
                borderRadius: 10,
                opacity: yourCompany ? 1 : 0.7,
                borderColor: errors.selectedClientId ? "#d32f2f" : base.borderColor,
                boxShadow: errors.selectedClientId ? "0 0 0 1px #d32f2f" : base.boxShadow,
                "&:hover": { borderColor: errors.selectedClientId ? "#d32f2f" : base.borderColor },
              }),
            }}
            noOptionsMessage={() => (yourCompany ? "No clients for this company" : "Select company first")}
          />
          {errors.selectedClientId && <small style={{ color: "#d32f2f" }}>{errors.selectedClientId}</small>}

          <label style={{ fontWeight: "600", marginTop: "20px", display: "block" }}>Link Project</label>
          <Select
            options={projects}
            value={selectedProject}
            onChange={(selected) => setSelectedProject(selected)}
            placeholder="Select Project..."
            className="link-poject-field"
            isSearchable
            styles={{
              control: (base) => ({
                ...base,
                padding: "2px",
                borderRadius: "10px",
                marginBottom: "20px",
              }),
            }}
          />

          {/* Services */}
          <h3 style={{ fontSize: "20px", fontWeight: "600", marginTop: "30px" }}>Services</h3>
          {errors.services && <small style={{ color: "#d32f2f" }}>{errors.services}</small>}

          {services.map((service, idx) => {
            const rowErr = errors.serviceRows[idx] || {};
            return (
              <div key={idx} className="services-block" style={{ marginBottom: "25px", padding: "20px", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px" }}>
                <div style={{ marginBottom: "15px" }}>
                  <RequiredLabel>Service Name {idx + 1}</RequiredLabel>
                  <Select
                    isMulti
                    options={serviceOptions}
                    value={(service.name || []).map((n) => serviceOptions.find((opt) => opt.value === n))}
                    onChange={(selectedOptions) => {
                      const updated = [...services];
                      updated[idx].name = (selectedOptions || []).map((opt) => opt.value);
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (next.serviceRows[idx]?.name) {
                          next.serviceRows = {
                            ...next.serviceRows,
                            [idx]: { ...next.serviceRows[idx], name: "" },
                          };
                        }
                        return next;
                      });
                    }}
                    placeholder="Select Service(s)"
                    isSearchable
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: "44px",
                        padding: "2px",
                        borderColor: rowErr.name ? "#d32f2f" : "#ccc",
                      }),
                    }}
                  />
                  {rowErr.name && <small style={{ color: "#d32f2f" }}>{rowErr.name}</small>}
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <RequiredLabel>Service Description</RequiredLabel>
                  <textarea
                    value={service.description || ""}
                    onChange={(e) => {
                      const updated = [...services];
                      updated[idx].description = InputSanitizer.sanitizeText(e.target.value);
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (next.serviceRows[idx]?.description) {
                          next.serviceRows = { ...next.serviceRows, [idx]: { ...next.serviceRows[idx], description: "" } };
                        }
                        return next;
                      });
                    }}
                    placeholder="Enter Service Description"
                    style={{ width: "100%", padding: "10px", borderRadius: "5px", border: `1px solid ${rowErr.description ? "#d32f2f" : "#ccc"}` }}
                    rows={3}
                  />
                  {rowErr.description && <small style={{ color: "#d32f2f" }}>{rowErr.description}</small>}
                </div>

                <div style={{ marginBottom: "15px" }}>
                  <RequiredLabel>Service Amount ({CurrencyService.getCurrencySymbol(selectedCurrency)})</RequiredLabel>
                  <input
                    type="number"
                    min={selectedCurrency === "INR" ? "1" : "0.01"}
                    step="any"
                    value={service.amount ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;

                      // Sanitize the input value to remove malformed characters
                      const sanitizedVal = CurrencyService.sanitizeAmount(val);
                      const numVal = sanitizedVal === 0 ? "" : sanitizedVal;

                      // For non-INR currencies, allow decimal values
                      if (selectedCurrency !== "INR" && val !== "" && numVal !== "") {
                        // Allow any positive number for international currencies
                        if (numVal > 0) {
                          const updated = [...services];
                          updated[idx].amount = numVal;
                          setServices(updated);
                        }
                      } else {
                        // For INR, maintain minimum value of 1
                        const updated = [...services];
                        updated[idx].amount = val === "" ? "" : Math.max(1, numVal || 0);
                        setServices(updated);
                      }

                      setErrors((prev) => {
                        const next = { ...prev };
                        if (next.serviceRows[idx]?.amount) {
                          next.serviceRows = { ...next.serviceRows, [idx]: { ...next.serviceRows[idx], amount: "" } };
                        }
                        return next;
                      });
                    }}
                    placeholder="Enter Amount"
                    style={{ width: "100%", padding: "10px", borderRadius: "5px", border: `1px solid ${rowErr.amount ? "#d32f2f" : "#ccc"}` }}
                  />
                  {rowErr.amount && <small style={{ color: "#d32f2f" }}>{rowErr.amount}</small>}
                </div>

                {services.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...services];
                      updated.splice(idx, 1);
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        const { [idx]: _, ...rest } = next.serviceRows;
                        next.serviceRows = rest;
                        return next;
                      });
                    }}
                    style={{ backgroundColor: "#dc3545", color: "#fff", padding: "6px 12px", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Remove Service
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Service Button */}
          <button
            type="button"
            onClick={() => setServices([...services, { name: [], description: "", amount: "" }])}
            style={{ marginBottom: "20px", padding: "10px 20px", background: "rgb(59 89 151)", color: "#fff", borderRadius: "5px", fontWeight: "bold" }}
          >
            {services.length === 0 ? "Add Service" : "Add Another Service"}
          </button>

          {/* Payment Status */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "600" }}>Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #ccc" }}
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
            </select>
          </div>

          {/* Currency Selection */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "600" }}>Currency</label>
            <Select
              options={currencyOptions}
              value={currencyOptions.find(opt => opt.value === selectedCurrency)}
              onChange={(option) => {
                const newCurrency = option?.value || "INR";
                setSelectedCurrency(newCurrency);

                // Enhanced GST logic: Apply GST for INR currency regardless of client country
                const isINRSelected = newCurrency === 'INR';
                const gstApplicable = isINRSelected; // GST applies when INR is selected

                if (!gstApplicable) {
                  setGstPaymentStatus("NA");
                } else if (gstPaymentStatus === "NA") {
                  setGstPaymentStatus("Pending");
                }

                // Update gstApplicable state for UI display
                setGstApplicable(gstApplicable);
              }}
              styles={{
                control: (base) => ({
                  ...base,
                  padding: "2px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                }),
              }}
              isSearchable={false}
            />

            {/* Rate Source Status */}
            {(() => {
              const rateInfo = CurrencyService.getRateSourceInfo();
              return (
                <div style={{
                  marginTop: "8px",
                  padding: "8px",
                  background: rateInfo.usingLiveRates ? "#e8f5e8" : "#fff3e0",
                  border: `1px solid ${rateInfo.usingLiveRates ? "#4caf50" : "#ff9800"}`,
                  borderRadius: "4px",
                  fontSize: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{
                      color: rateInfo.usingLiveRates ? "#2e7d32" : "#e65100",
                      fontWeight: "bold"
                    }}>
                      {rateInfo.usingLiveRates ? "🟢 Live API Rates" : "🟡 Static Rates"}
                    </span>
                    <span style={{ color: "#666", fontSize: "11px" }}>
                      Updated: {rateInfo.lastUpdated}
                    </span>
                  </div>
                  {rateInfo.usingLiveRates && (
                    <div style={{ fontSize: "11px", color: "#2e7d32", marginTop: "2px" }}>
                      ✅ Using fresh rates from live API
                    </div>
                  )}
                  {!rateInfo.usingLiveRates && (
                    <div style={{ fontSize: "11px", color: "#e65100", marginTop: "2px" }}>
                      ⚠️ Using static rates (API unavailable) - Click "Refresh" to retry
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

          {/* GST Payment Status */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontWeight: "600" }}>GST Payment Status</label>
            <select
              value={gstPaymentStatus}
              onChange={(e) => setGstPaymentStatus(e.target.value)}
              disabled={!gstApplicable}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                background: !gstApplicable ? "#f3f4f6" : "#fff"
              }}
              title={!gstApplicable ? `GST not applicable for ${selectedCurrency} currency` : ""}
            >
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="NA">NA</option>
            </select>
            {!gstApplicable && (
              <small style={{ color: "#666" }}>
                GST not applicable ({selectedCurrency} currency) — saved as "NA".
                {selectedCurrency === "INR" && selectedClient?.country && !selectedClient.country.toLowerCase().includes('india') && (
                  <span style={{ color: "#d32f2f", fontWeight: "bold" }}>
                    {" "}Note: INR selected for international client - 18% tax will apply.
                  </span>
                )}
              </small>
            )}
          </div>

          {/* Totals — show only applicable GST lines with currency info */}
          <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
            {isLoadingCurrency ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                <div style={{ width: "20px", height: "20px", border: "2px solid #2196f3", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 10px" }}></div>
                Calculating amounts...
              </div>
            ) : currencyCalculations ? (
              <>
                <div style={{ marginBottom: "10px", fontSize: "14px", color: "#666" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div>
                      <strong>Currency:</strong> {CurrencyService.getCurrencyName(selectedCurrency)} ({CurrencyService.getCurrencySymbol(selectedCurrency)})
                    </div>
                    {selectedCurrency !== "INR" && (
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        <strong>Rate:</strong> 1 {selectedCurrency} = {(() => {
                          // Use cached rate if available, otherwise fallback to static
                          const cachedRates = LiveExchangeRateService.cache.get('rates');
                          return cachedRates && cachedRates[selectedCurrency] ? cachedRates[selectedCurrency] : (STATIC_EXCHANGE_RATES[selectedCurrency] || 1);
                        })()} INR
                      </div>
                    )}
                  </div>
                  {selectedCurrency !== "INR" && currencyCalculations?.subtotalINR && (
                    <div style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
                      <em>Subtotal in INR: ₹{currencyCalculations.subtotalINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                    </div>
                  )}
                </div>
                {/* Enhanced Currency Display Logic */}
                {(() => {
                  const gstCalc = currencyCalculations.gstCalculation;
                  const isInternationalClient = selectedClient?.country && !selectedClient.country.toLowerCase().includes('india');
                  const isINRSelected = selectedCurrency === 'INR';

                  // For international clients using local currency - show amounts in their currency
                  if (isInternationalClient && !isINRSelected) {
                    // For international clients using local currency:
                    // - The amounts entered are already in the client's local currency
                    // - No GST applies since GST only applies to INR invoices
                    // - Show amounts in local currency with INR equivalent

                    const subtotalInLocalCurrency = currencyCalculations.subtotalInSelectedCurrency;
                    const totalInLocalCurrency = subtotalInLocalCurrency; // No tax applies

                    // Format amounts directly in the selected currency (they're already in the correct currency)
                    const formatCurrencyAmount = (amount, currency) => {
                      const symbol = CurrencyService.getCurrencySymbol(currency);
                      return `${symbol}${Number(amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    };

                    const formattedSubtotal = formatCurrencyAmount(subtotalInLocalCurrency, selectedCurrency);
                    const formattedTotal = formatCurrencyAmount(totalInLocalCurrency, selectedCurrency);

                    return (
                      <>
                        <p><strong>Subtotal ({CurrencyService.getCurrencyName(selectedCurrency)}):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formattedSubtotal}</span></p>
                        <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                          <em>INR: ₹{currencyCalculations.subtotalINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                        </p>

                        <p style={{ fontSize: "12px", color: "#d32f2f", margin: "5px 0" }}>
                          <em>No GST applicable for international clients using local currency</em>
                        </p>

                        <p><strong>Total Amount ({CurrencyService.getCurrencyName(selectedCurrency)}):</strong> <span style={{ fontSize: "18px", fontWeight: "bold", color: "#1E3A8A" }}>{formattedTotal}</span></p>
                        <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                          <em>INR: ₹{currencyCalculations.subtotalINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                        </p>
                      </>
                    );
                  }

                  // For international clients using INR - show 18% IGST
                  if (isInternationalClient && isINRSelected) {
                    return (
                      <>
                        <p><strong>Subtotal (INR):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(currencyCalculations.subtotalINR)}</span></p>

                        <p><strong>IGST (18%):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(gstCalc.igstAmount)}</span></p>
                        <p style={{ fontSize: "12px", color: "#d32f2f", marginTop: "-5px" }}>
                          <em>International client - 18% tax applied</em>
                        </p>

                        <p><strong>Total Tax (INR):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(currencyCalculations.tax_amount)}</span></p>

                        <p><strong>Total Amount (INR):</strong> <span style={{ fontSize: "18px", fontWeight: "bold", color: "#1E3A8A" }}>{formatPrimaryAmount(currencyCalculations.grand_total)}</span></p>
                      </>
                    );
                  }

                  // For Indian clients - show regular GST
                  return (
                    <>
                      <p><strong>Subtotal ({isINRSelected ? 'INR' : CurrencyService.getCurrencyName(selectedCurrency)}):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(currencyCalculations.subtotalINR)}</span></p>
                      {selectedCurrency !== "INR" && (
                        <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                          <em>INR: ₹{currencyCalculations.subtotalINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                        </p>
                      )}

                      {/* Regular GST Display */}
                      {(() => {
                        if (gstCalc.cgstAmount > 0 && gstCalc.sgstAmount > 0) {
                          return (
                            <>
                              <p><strong>CGST ({gstCalc.cgstRate}%):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(gstCalc.cgstAmount)}</span></p>
                              {selectedCurrency !== "INR" && (
                                <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                                  <em>INR: ₹{gstCalc.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                                </p>
                              )}
                              <p><strong>SGST ({gstCalc.sgstRate}%):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(gstCalc.sgstAmount)}</span></p>
                              {selectedCurrency !== "INR" && (
                                <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                                  <em>INR: ₹{gstCalc.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                                </p>
                              )}
                            </>
                          );
                        } else if (gstCalc.igstAmount > 0) {
                          return (
                            <>
                              <p><strong>IGST ({gstCalc.igstRate}%):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(gstCalc.igstAmount)}</span></p>
                              {selectedCurrency !== "INR" && (
                                <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                                  <em>INR: ₹{gstCalc.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                                </p>
                              )}
                            </>
                          );
                        }
                        return null;
                      })()}

                      <p><strong>Total Tax ({isINRSelected ? 'INR' : CurrencyService.getCurrencyName(selectedCurrency)}):</strong> <span style={{ fontSize: "16px", fontWeight: "bold" }}>{formatPrimaryAmount(currencyCalculations.tax_amount)}</span></p>
                      {selectedCurrency !== "INR" && (
                        <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                          <em>INR: ₹{currencyCalculations.tax_amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                        </p>
                      )}

                      <p><strong>Total Amount ({isINRSelected ? 'INR' : CurrencyService.getCurrencyName(selectedCurrency)}):</strong> <span style={{ fontSize: "18px", fontWeight: "bold", color: "#1E3A8A" }}>{formatPrimaryAmount(currencyCalculations.grand_total)}</span></p>
                      {selectedCurrency !== "INR" && (
                        <p style={{ fontSize: "12px", color: "#666", marginTop: "-5px" }}>
                          <em>INR: ₹{currencyCalculations.grand_total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</em>
                        </p>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                Add services to see calculations
              </div>
            )}
          </div>

          {/* Progress Box */}
          {isGeneratingPDF && (
            <div style={{ background: "#e3f2fd", padding: "20px", borderRadius: "8px", marginBottom: "20px", border: "1px solid #2196f3" }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                <div style={{ width: "20px", height: "20px", border: "2px solid #2196f3", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin 1s linear infinite", marginRight: "10px" }}></div>
                <span style={{ fontWeight: "bold", color: "#1976d2" }}>{pdfProgress.message}</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${pdfProgress.progress}%`, height: "100%", backgroundColor: "#2196f3", transition: "width 0.3s ease" }}></div>
              </div>
              <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#666" }}>
                {pdfProgress.progress}% Complete
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <div style={{ display: "flex", gap: "16px", maxWidth: "400px", width: "100%" }}>
              <button
                type="submit"
                disabled={isGeneratingPDF}
                style={{
                  flex: 1,
                  padding: "16px 24px",
                  background: isGeneratingPDF ? "#cccccc" : "#1E3A8A",
                  color: "#fff",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "18px",
                  border: "2px solid #1E3A8A",
                  cursor: isGeneratingPDF ? "not-allowed" : "pointer",
                  opacity: isGeneratingPDF ? 0.7 : 1,
                  height: "44px",
                  boxShadow: "0 3px 6px rgba(30, 58, 138, 0.2)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onMouseOver={(e) => {
                  if (!isGeneratingPDF) {
                    e.target.style.backgroundColor = "#3b5997";
                    e.target.style.borderColor = "#3b5997";
                    e.target.style.boxShadow = "0 5px 10px #3b5997";
                  }
                }}
                onMouseOut={(e) => {
                  if (!isGeneratingPDF) {
                    e.target.style.backgroundColor = "#3b5997";
                    e.target.style.borderColor = "#3b5997";
                    e.target.style.boxShadow = "0 3px 6px #3b5997";
                  }
                }}
              >
                {isGeneratingPDF ? "Processing..." : "Submit Invoice"}
              </button>
              <button
                type="button"
                onClick={() => {
                  // Clear all form fields
                  setYourCompany("");
                  setSelectedClientId("");
                  setSelectedClient(null);
                  setSelectedProject(null);
                  setPreviewInvoiceNumber("");
                  setInvoiceTitle("");
                  setServices([]);
                  setPaymentStatus("Pending");
                  setGstPaymentStatus("Pending");
                  setErrors({
                    yourCompany: "",
                    invoiceDate: "",
                    invoiceTitle: "",
                    selectedClientId: "",
                    services: "",
                    serviceRows: {},
                  });

                }}
                style={{
                  flex: 1,
                  padding: "16px 24px",
                  background: "#3b5997",
                  color: "#fff",
                  borderRadius: "12px",
                  fontWeight: "bold",
                  fontSize: "18px",
                  border: "2px solid #3b5997",
                  cursor: "pointer",
                  height: "44px",
                  boxShadow: "0 3px 6px #3b5997",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onMouseOver={(e) => {
                  e.target.style.backgroundColor = "#3b5997";
                  e.target.style.borderColor = "#3b5997";
                  e.target.style.boxShadow = "0 5px 10px #3b5997";
                }}
                onMouseOut={(e) => {
                  e.target.style.backgroundColor = "#3b5997";
                  e.target.style.borderColor = "#3b5997";
                  e.target.style.boxShadow = "0 3px 6px #3b5997";
                }}
              >
                Clear Form
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            /* ✅ Remove arrows from number inputs (Chrome/Safari/Edge/Opera + Firefox) */
            input[type=number]::-webkit-inner-spin-button,
            input[type=number]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type=number] {
              -moz-appearance: textfield;
            }
          `}</style>
        </div>
      </form>
    </div>
  );
}
