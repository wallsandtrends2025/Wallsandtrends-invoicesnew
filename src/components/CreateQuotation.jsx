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

export default function CreateQuotation() {
  const [yourCompany, setYourCompany] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [previewQuotationNumber, setPreviewQuotationNumber] = useState("");
  const [quotationDate, setQuotationDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [quotationTitle, setQuotationTitle] = useState("");
  const [services, setServices] = useState([{ name: [], description: "", amount: "" }]);
  const [paymentStatus, setPaymentStatus] = useState("Pending");

  const navigate = useNavigate();

  const serviceOptions = [
    { label: "Lyrical Videos", value: "Lyrical Videos" },
    { label: "Posters", value: "Posters" },
    { label: "Marketing", value: "Marketing" },
    { label: "Web Development", value: "Web Development" },
    { label: "Ad Film", value: "Ad Film" },
    { label: "Editing", value: "Editing" },
    { label: "Meme Marketing", value: "Meme Marketing" },
    { label: "Creative design", value: "Creative design" },
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
    if (yourCompany && quotationDate) generateQuotationId(yourCompany);
  }, [yourCompany, quotationDate]);

  const generateQuotationId = async (company) => {
    const [yyyy, mm] = quotationDate.split("-");
    const yy = yyyy.slice(-2);
    const dateStr = `${yy}${mm}`; // YYMM format
    const counterKey = `${company}_${dateStr}_QUOTATION`;
    const counterRef = doc(db, "quotation_counters", counterKey);

    try {
      const count = await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(counterRef);
        const current = docSnap.exists() ? docSnap.data().count : 0;
        const next = current + 1;
        transaction.set(counterRef, { count: next });
        return next;
      });

      const formatted = `${company}${dateStr}QTN${String(count).padStart(3, "0")}`;
      setPreviewQuotationNumber(formatted);
    } catch (error) {
      console.error("Error generating quotation ID:", error);
    }
  };

  const handleClientSelect = (id) => {
    setSelectedClientId(id);
    const client = clients.find((c) => c.id === id);
    setSelectedClient(client);
  };

  const amount = services.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !selectedClient ||
      !quotationDate ||
      !previewQuotationNumber ||
      !quotationTitle ||
      services.some(s => s.name.length === 0 || !s.description.trim() || !s.amount)
    ) {
      alert("Please fill in all required fields.");
      return;
    }

    const quotationData = {
      quotation_id: previewQuotationNumber,
      client_id: selectedClientId,
      quotation_type: yourCompany,
      quotation_title: quotationTitle,
      quotation_date: quotationDate,
      services: services,
      subtotal: Number(amount),
      total_amount: amount,
      payment_status: paymentStatus,
      pdf_url: "",
      created_at: new Date(),
    };

    try {
      await setDoc(doc(db, "quotations", previewQuotationNumber), quotationData);
      navigate("/dashboard/quotations");
    } catch (error) {
      console.error("❌ Error creating quotation:", error);
      alert("Failed to create quotation.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", justifyContent: "center", padding: "2rem" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: "10px", padding: "30px", width: "100%", maxWidth: "700px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", marginBottom: "30px" }}>Create Quotation</h2>

        {/* Select Company */}
        <label style={{ fontWeight: "600" }}>Select Company</label>
        <select value={yourCompany} onChange={(e) => setYourCompany(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "20px" }}>
          <option value="">Select Company</option>
          <option value="WT">WT</option>
          <option value="WTPL">WTPL</option>
          <option value="WTX">WTX</option>
          <option value="WTXPL">WTXPL</option>
        </select>

        {/* Date & Title */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600" }}>Quotation Date</label>
            <input type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} required style={{ width: "100%", padding: "10px" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontWeight: "600" }}>Title of Quotation</label>
            <input type="text" value={quotationTitle} onChange={(e) => setQuotationTitle(e.target.value)} required style={{ width: "100%", padding: "10px" }} />
          </div>
        </div>

        {/* Quotation Number */}
        <label style={{ fontWeight: "600" }}>Quotation Number</label>
        <input type="text" value={previewQuotationNumber} disabled style={{ width: "100%", padding: "10px", marginBottom: "20px", background: "#eee", fontWeight: "bold" }} />

        {/* Client Selection */}
        <label style={{ fontWeight: "600" }}>Select Client</label>
        <Select
          options={clients.map(client => ({
            value: client.id,
            label: `${client.company_name} — ${client.client_name}`,
          }))}
          value={clients.find(c => c.id === selectedClientId) ? {
            value: selectedClientId,
            label: `${selectedClient?.company_name} — ${selectedClient?.client_name}`
          } : null}
          onChange={(selected) => handleClientSelect(selected.value)}
          placeholder="Select Client..."
          isSearchable
        />

        {/* Services */}
        <h3 style={{ fontSize: "20px", fontWeight: "600", marginTop: "30px" }}>Services</h3>
        {services.map((service, idx) => (
          <div key={idx} style={{ marginBottom: "25px", padding: "20px", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px" }}>
            
            {/* Multi-Select Service Name */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>Service Name {idx + 1}</label>
              <Select
                isMulti
                options={serviceOptions}
                value={service.name.map(n => serviceOptions.find(opt => opt.value === n))}
                onChange={(selectedOptions) => {
                  const updated = [...services];
                  updated[idx].name = selectedOptions.map(opt => opt.value);
                  setServices(updated);
                }}
                placeholder="Select Service(s)"
                isSearchable
                styles={{
                  control: (base) => ({
                    ...base,
                    minHeight: "44px",
                    padding: "2px",
                    borderColor: "#ccc",
                  }),
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ fontWeight: "600", display: "block" }}>Service Description</label>
              <textarea
                value={service.description}
                onChange={(e) => {
                  const updated = [...services];
                  updated[idx].description = e.target.value;
                  setServices(updated);
                }}
                placeholder="Enter Service Description"
                style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
                rows={3}
                required
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: "15px" }}>
              <label style={{ fontWeight: "600", display: "block" }}>Service Amount ₹</label>
              <input
                type="number"
                value={service.amount}
                onChange={(e) => {
                  const updated = [...services];
                  updated[idx].amount = e.target.value;
                  setServices(updated);
                }}
                placeholder="Enter Amount"
                style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
                required
              />
            </div>

            {services.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const updated = [...services];
                  updated.splice(idx, 1);
                  setServices(updated);
                }}
                style={{ backgroundColor: "#dc3545", color: "#fff", padding: "6px 12px", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
              >
                Remove Service
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setServices([...services, { name: [], description: "", amount: "" }])}
          style={{ marginBottom: "20px", padding: "10px 20px", background: "#000", color: "#fff", borderRadius: "5px", fontWeight: "bold" }}
        >
          Add Service
        </button>

        {/* Payment Status */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontWeight: "600" }}>Payment Status</label>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
          >
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        {/* Summary */}
        <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
          <p>Subtotal: ₹{amount.toFixed(2)}</p>
          <p><b>Total Amount:</b> ₹{amount.toFixed(2)}</p>
        </div>

        <button type="submit" style={{ width: "100%", padding: "15px", background: "#000000", color: "#fff", borderRadius: "5px", fontWeight: "bold", fontSize: "16px" }}>
          Submit Quotation
        </button>
      </form>
    </div>
  );
}
