// src/pages/CreateProforma.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import Select from "react-select";

// helper label with red asterisk
const RequiredLabel = ({ children }) => (
  <span style={{ fontWeight: 600 }}>
    {children} <span style={{ color: "#d32f2f" }}>*</span>
  </span>
);

// ✅ Amount formatter (Indian style)
const formatAmount = (num) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(isNaN(num) ? 0 : num));

export default function CreateProforma() {
  const [yourCompany, setYourCompany] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [previewProformaNumber, setPreviewProformaNumber] = useState("");
  const [proformaDate, setProformaDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [proformaTitle, setProformaTitle] = useState("");
  const [services, setServices] = useState([{ name: [], description: "", amount: "" }]);
  const [paymentStatus, setPaymentStatus] = useState("Pending");
  const [errors, setErrors] = useState({});

  const navigate = useNavigate();

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

  useEffect(() => {
    const fetchClients = async () => {
      const snapshot = await getDocs(collection(db, "clients"));
      const clientList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClients(clientList);
    };
    fetchClients();
  }, []);

  useEffect(() => {
    if (yourCompany && proformaDate) generateProformaId(yourCompany);
  }, [yourCompany, proformaDate]);

  const generateProformaId = async (company) => {
    const [yyyy, mm] = proformaDate.split("-");
    const yy = yyyy.slice(-2);
    const dateStr = `${yy}${mm}`;
    const counterKey = `${company}_${dateStr}_PROFORMA`;
    const counterRef = doc(db, "quotation_counters", counterKey);

    try {
      const count = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(counterRef);
        const current = docSnap.exists() ? docSnap.data().count : 0;
        const next = current + 1;
        transaction.set(counterRef, { count: next });
        return next;
      });

      const formatted = `${company}${dateStr}PRF${String(count).padStart(3, "0")}`;
      setPreviewProformaNumber(formatted);
    } catch (error) {
      console.error("Error generating proforma ID:", error);
    }
  };

  const handleClientSelect = (id) => {
    setSelectedClientId(id);
    const client = clients.find((c) => c.id === id);
    setSelectedClient(client);
    setErrors((prev) => ({ ...prev, selectedClientId: "" }));
  };

  const amount = services.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const validateForm = () => {
    let newErrors = {};
    if (!yourCompany) newErrors.yourCompany = "Company is required";
    if (!proformaDate) newErrors.proformaDate = "Date is required";
    if (!proformaTitle.trim()) newErrors.proformaTitle = "Title is required";
    if (!selectedClientId) newErrors.selectedClientId = "Client is required";

    services.forEach((s, i) => {
      if (!s.name.length) newErrors[`serviceName_${i}`] = "Select at least one service";
      if (!String(s.description || "").trim()) newErrors[`serviceDesc_${i}`] = "Description required";
      const amt = Number(s.amount);
      if (isNaN(amt) || amt <= 0) newErrors[`serviceAmount_${i}`] = "Amount must be greater than 0.";
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const proformaData = {
      proforma_id: previewProformaNumber,
      client_id: selectedClientId,
      proforma_type: yourCompany,
      proforma_title: proformaTitle,
      proforma_date: proformaDate,
      services: services.map((s, i) => ({
        name: (Array.isArray(s.name) ? s.name : []).join(", "),
        description: String(s.description || ""),
        amount: Number(s.amount || 0),
      })),
      subtotal: Number(amount.toFixed(2)),
      total_amount: Number(amount.toFixed(2)),
      payment_status: paymentStatus,
      pdf_url: "",
      created_at: new Date(),
    };

    try {
      await setDoc(doc(db, "quotations", previewProformaNumber), proformaData);
      navigate("/dashboard/quotations");
    } catch (error) {
      console.error("❌ Error creating proforma:", error);
      alert("Failed to create proforma.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", justifyContent: "center", padding: "2rem" }}>
      <form onSubmit={handleSubmit} noValidate
        style={{ background: "#fff", borderRadius: "10px", padding: "30px", width: "100%", maxWidth: "700px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", marginBottom: "30px" }}>
          Create Proforma
        </h2>

        {/* Company */}
        <RequiredLabel>Select Company</RequiredLabel>
        <select
          value={yourCompany}
          onChange={(e) => setYourCompany(e.target.value)}
          aria-invalid={!!errors.yourCompany}
          style={{ width: "100%", padding: "10px", marginBottom: "6px", border: `1px solid ${errors.yourCompany ? "#d32f2f" : "#ccc"}` }}
        >
          <option value="">Select Company</option>
          <option value="WT">WT</option>
          <option value="WTPL">WTPL</option>
          <option value="WTX">WTX</option>
          <option value="WTXPL">WTXPL</option>
        </select>
        {errors.yourCompany && <small style={{ color: "#d32f2f" }}>{errors.yourCompany}</small>}

        <div style={{ display: "flex", gap: "20px", marginTop: 14, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <RequiredLabel>Proforma Date</RequiredLabel>
            <input
              type="date"
              value={proformaDate}
              onChange={(e) => setProformaDate(e.target.value)}
              aria-invalid={!!errors.proformaDate}
              style={{ width: "100%", padding: "10px", border: `1px solid ${errors.proformaDate ? "#d32f2f" : "#ccc"}` }}
            />
            {errors.proformaDate && <small style={{ color: "#d32f2f" }}>{errors.proformaDate}</small>}
          </div>
          <div style={{ flex: 1 }}>
            <RequiredLabel>Title of Proforma</RequiredLabel>
            <input
              type="text"
              value={proformaTitle}
              onChange={(e) => setProformaTitle(e.target.value)}
              aria-invalid={!!errors.proformaTitle}
              style={{ width: "100%", padding: "10px", border: `1px solid ${errors.proformaTitle ? "#d32f2f" : "#ccc"}` }}
            />
            {errors.proformaTitle && <small style={{ color: "#d32f2f" }}>{errors.proformaTitle}</small>}
          </div>
        </div>

        <RequiredLabel>Proforma Number</RequiredLabel>
        <input type="text" value={previewProformaNumber} disabled style={{ width: "100%", padding: "10px", marginBottom: "20px", background: "#eee", fontWeight: "bold" }} />

        {/* Client */}
        <RequiredLabel>Select Client</RequiredLabel>
        <Select
          options={clients.map((c) => ({ value: c.id, label: `${c.company_name} — ${c.client_name}` }))}
          value={
            clients.find((c) => c.id === selectedClientId)
              ? { value: selectedClientId, label: `${selectedClient?.company_name} — ${selectedClient?.client_name}` }
              : null
          }
          onChange={(selected) => handleClientSelect(selected?.value)}
          placeholder="Select Client..."
          isSearchable
          styles={{
            control: (base) => ({
              ...base,
              marginBottom: "6px",
              borderColor: errors.selectedClientId ? "#d32f2f" : base.borderColor,
              boxShadow: errors.selectedClientId ? "0 0 0 1px #d32f2f" : base.boxShadow,
            }),
          }}
        />
        {errors.selectedClientId && <small style={{ color: "#d32f2f" }}>{errors.selectedClientId}</small>}

        <h3 style={{ fontSize: "20px", fontWeight: "600", marginTop: "30px" }}>Services</h3>

        {services.map((service, idx) => (
          <div key={idx} style={{ marginBottom: "25px", padding: "20px", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px" }}>
            <RequiredLabel>Service Name {idx + 1}</RequiredLabel>
            <Select
              isMulti
              options={serviceOptions}
              value={(service.name || []).map((n) => serviceOptions.find((opt) => opt.value === n))}
              onChange={(selectedOptions) => {
                const updated = [...services];
                updated[idx].name = (selectedOptions || []).map((opt) => opt.value);
                setServices(updated);
              }}
              placeholder="Select Service(s)"
              isSearchable
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "44px",
                  borderColor: errors[`serviceName_${idx}`] ? "#d32f2f" : base.borderColor,
                }),
              }}
            />
            {errors[`serviceName_${idx}`] && <small style={{ color: "#d32f2f" }}>{errors[`serviceName_${idx}`]}</small>}

            <RequiredLabel>Service Description</RequiredLabel>
            <textarea
              value={service.description}
              onChange={(e) => {
                const updated = [...services];
                updated[idx].description = e.target.value;
                setServices(updated);
              }}
              style={{ width: "100%", padding: "10px", borderRadius: "5px", border: `1px solid ${errors[`serviceDesc_${idx}`] ? "#d32f2f" : "#ccc"}` }}
              rows={3}
            />
            {errors[`serviceDesc_${idx}`] && <small style={{ color: "#d32f2f" }}>{errors[`serviceDesc_${idx}`]}</small>}

            <RequiredLabel>Service Amount ₹</RequiredLabel>
            <input
              type="number"
              min="1"        // ✅ block negative and 0
              step="any"
              value={service.amount}
              onChange={(e) => {
                const val = e.target.value;
                const updated = [...services];
                updated[idx].amount = val === "" ? "" : Math.max(1, Number(val)); // ✅ keep empty or >=1
                setServices(updated);
              }}
              style={{ width: "100%", padding: "10px", border: `1px solid ${errors[`serviceAmount_${idx}`] ? "#d32f2f" : "#ccc"}` }}
            />
            {errors[`serviceAmount_${idx}`] && <small style={{ color: "#d32f2f" }}>{errors[`serviceAmount_${idx}`]}</small>}

            {services.length > 1 && (
              <button type="button" onClick={() => setServices(services.filter((_, i) => i !== idx))}
                style={{ backgroundColor: "#dc3545", color: "#fff", padding: "6px 12px", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
                Remove Service
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={() => setServices([...services, { name: [], description: "", amount: "" }])}
          style={{ marginBottom: "20px", padding: "10px 20px", background: "#000", color: "#fff", borderRadius: "5px", fontWeight: "bold" }}>
          Add Another Service
        </button>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontWeight: "600" }}>Payment Status</label>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
          <p>Subtotal: ₹{formatAmount(amount)}</p>
          <p><b>Total Amount:</b> ₹{formatAmount(amount)}</p>
        </div>

        <button type="submit" style={{ width: "100%", padding: "15px", background: "#000000", color: "#fff", borderRadius: "5px", fontWeight: "bold", fontSize: "16px" }}>
          Submit Proforma
        </button>

        {/* ✅ Remove arrows from number inputs */}
        <style jsx>{`
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          input[type=number] {
            -moz-appearance: textfield;
          }
        `}</style>
      </form>
    </div>
  );
}
