// src/pages/CreateInvoice.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  runTransaction,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Select from "react-select";
import { generateAndSaveBothChunkedPDFs } from "../utils/pdfChunkedStorage";

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

  // ✅ Amount formatter (Indian style, 30,000.00)
  const formatAmount = (num) => {
    if (isNaN(num)) return "0.00";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(num));
  };

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
  const sanitizeServices = () =>
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
    });

  // computed amounts
  const sanitized = sanitizeServices();
  const subtotal = sanitized.reduce((sum, s) => sum + Number(s.amount || 0), 0);

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

    const sanitizedNow = sanitizeServices();
    const subtotalNow = sanitizedNow.reduce((sum, s) => sum + Number(s.amount || 0), 0);

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

    const invoiceData = {
      invoice_id: previewInvoiceNumber,
      client_id: selectedClientId,
      project_id: selectedProject ? selectedProject.value : "",
      invoice_type: yourCompany,
      invoice_title: invoiceTitle,
      invoice_date: invoiceDate,
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
    };

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
        line_items: sanitizedNow.map((s) => ({
          name: s.name,
          description: s.description,
          amount: Number(s.amount || 0),
        })),
      };

      const { taxPdfId, proformaPdfId } = await generateAndSaveBothChunkedPDFs(
        pdfInvoiceData,
        selectedClient
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
      {/* Turn OFF native HTML5 validation */}
        {/* Title chip */}
     
     
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
              onChange={(e) => setInvoiceTitle(e.target.value)}
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
            label: `${client.client_name ?? "—"}`,
          }))}
          value={
            filteredClients.find((c) => c.id === selectedClientId)
              ? {
                  value: selectedClientId,
                  label: `${selectedClient?.company_name ?? "—"} — ${selectedClient?.client_name ?? "—"}`,
                }
              : null
          }
          onChange={(selected) => {
            setSelectedClientId(selected?.value || "");
            const client = filteredClients.find((c) => c.id === selected?.value);
            setSelectedClient(client || null);
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
            <div key={idx} style={{ marginBottom: "25px", padding: "20px", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px" }}>
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
                    updated[idx].description = e.target.value;
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
                <RequiredLabel>Service Amount ₹</RequiredLabel>
                <input
                  type="number"
                  min="1"             // ✅ Prevent negative and 0
                  step="any"
                  value={service.amount ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = [...services];
                    updated[idx].amount = val === "" ? "" : Math.max(1, Number(val)); // ✅ Force >= 1
                    setServices(updated);
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

        {/* GST Payment Status */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontWeight: "600" }}>GST Payment Status</label>
          <select
            value={gstPaymentStatus}
            onChange={(e) => setGstPaymentStatus(e.target.value)}
            disabled={!(selectedClient && selectedClient.country === "India")}
            style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid #ccc", background: !(selectedClient && selectedClient.country === "India") ? "#f3f4f6" : "#fff" }}
            title={!(selectedClient && selectedClient.country === "India") ? "GST not applicable for this client" : ""}
          >
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
          </select>
          {!(selectedClient && selectedClient.country === "India") && (
            <small style={{ color: "#666" }}>
              GST not applicable (international client) — saved as "NA".
            </small>
          )}
        </div>

        {/* Totals — show only applicable GST lines */}
        <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
          <p>Subtotal: ₹{formatAmount(subtotal)}</p>
          {cgst > 0 && <p>CGST ({cgstRate}%): ₹{formatAmount(cgst)}</p>}
          {sgst > 0 && <p>SGST ({sgstRate}%): ₹{formatAmount(sgst)}</p>}
          {igst > 0 && <p>IGST ({igstRate}%): ₹{formatAmount(igst)}</p>}
          <p><b>Total Tax:</b> ₹{formatAmount(tax_amount)}</p>
          <p><b>Total Amount:</b> ₹{formatAmount(grand_total)}</p>
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
