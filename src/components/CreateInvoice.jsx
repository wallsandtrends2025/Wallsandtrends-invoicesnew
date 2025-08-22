// CreateInvoice.jsx
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
  const [services, setServices] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState("Pending");

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
    { label: "\u2060Brand Film", value: "\u2060Brand Film" },
    { label: "\u2060\u2060Corporate Film", value: "\u2060Corporate Film" },
    { label: "\u2060Teaser + Trailer + Business cut", value: "\u2060Teaser + Trailer + Business cut" },
  ];

  useEffect(() => {
    const fetchData = async () => {
      const clientSnap = await getDocs(collection(db, "clients"));
      const clientList = clientSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
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

  useEffect(() => {
    if (yourCompany && invoiceDate) generateInvoiceId(yourCompany);
  }, [yourCompany, invoiceDate]);

  const generateInvoiceId = async (company) => {
    const [yyyy, mm, dd] = invoiceDate.split("-");
    const yy = yyyy.slice(2);
    const dateStr = `${yy}${mm}`; // YYMM only
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
      console.error("\u274C Error generating invoice ID:", error);
    }
  };

  const amount = services.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  const getTaxBreakdown = () => {
    if (!selectedClient) return { cgst: 0, sgst: 0, igst: 0, totalTax: 0, totalAmount: 0 };
    const isIndian = selectedClient.country === "India";
    const isTelangana = selectedClient.state === "Telangana";

    const cgst = isIndian && isTelangana ? amount * 0.09 : 0;
    const sgst = isIndian && isTelangana ? amount * 0.09 : 0;
    const igst = isIndian && !isTelangana ? amount * 0.18 : 0;

    const totalTax = cgst + sgst + igst;
    const totalAmount = Number(amount) + totalTax;

    return { cgst, sgst, igst, totalTax, totalAmount };
  };

  const { cgst, sgst, igst, totalTax, totalAmount } = getTaxBreakdown();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient || !invoiceDate || !previewInvoiceNumber || !invoiceTitle || services.length === 0) {
      alert("Please fill in all required fields.");
      return;
    }

    const invoiceData = {
      invoice_id: previewInvoiceNumber,
      client_id: selectedClientId,
      project_id: selectedProject ? selectedProject.value : "",
      invoice_type: yourCompany,
      invoice_title: invoiceTitle,
      invoice_date: invoiceDate,
      services,
      subtotal: Number(amount),
      cgst,
      sgst,
      igst,
      tax_amount: totalTax,
      tax_type:
        selectedClient.country !== "India"
          ? "None"
          : selectedClient.state === "Telangana"
          ? "GST"
          : "IGST",
      total_amount: totalAmount,
      payment_status: paymentStatus,
      payment_date: null,
      pdf_url: "",
      created_at: new Date(),
    };

    try {
      await setDoc(doc(db, "invoices", previewInvoiceNumber), invoiceData);
      navigate(`/dashboard/invoice/${previewInvoiceNumber}`);
    } catch (error) {
      console.error("\u274C Error creating invoice:", error);
      alert("Failed to create invoice.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", justifyContent: "center", padding: "2rem" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: "10px", padding: "30px", width: "100%", maxWidth: "700px", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
        <h2 style={{ fontSize: "24px", fontWeight: "bold", textAlign: "center", marginBottom: "30px" }}>Create Invoice</h2>

       <label style={{ fontWeight: "600" }}>Select Company</label>
      <select value={yourCompany} onChange={(e) => setYourCompany(e.target.value)} required style={{ width: "100%", padding: "10px", marginBottom: "20px" }}>
        <option value="">Select Company</option>
        <option value="WT">WT</option>
        <option value="WTPL">WTPL</option>
        <option value="WTX">WTX</option>
        <option value="WTXPL">WTXPL</option>
      </select>

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: "600" }}>Invoice Date</label>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required style={{ width: "100%", padding: "10px" }} />
        </div>

        <div style={{ flex: 1 }}>
          <label style={{ fontWeight: "600" }}>Title of Invoice</label>
          <input type="text" value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} required style={{ width: "100%", padding: "10px" }} />
        </div>
      </div>

      <label style={{ fontWeight: "600" }}>Invoice Number</label>
      <input type="text" value={previewInvoiceNumber} disabled style={{ width: "100%", padding: "10px", marginBottom: "20px", background: "#eee", fontWeight: "bold" }} />

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
        onChange={(selected) => {
          setSelectedClientId(selected.value);
          const client = clients.find((c) => c.id === selected.value);
          setSelectedClient(client);
        }}
        placeholder="Select Client..."
        isSearchable
      />

      <label style={{ fontWeight: "600", marginTop: "20px", display: "block" }}>Link Project</label>
      <Select
        options={projects}
        value={selectedProject}
        onChange={(selected) => setSelectedProject(selected)}
        placeholder="Select Project..."
        isSearchable
        styles={{
          control: (base) => ({
            ...base,
            padding: "2px",
            marginBottom: "20px",
          }),
        }}
      />

     <h3 style={{ fontSize: "20px", fontWeight: "600", marginTop: "30px" }}>Services</h3>

{services.map((service, idx) => (
  <div key={idx} style={{ marginBottom: "25px", padding: "20px", background: "#fafafa", border: "1px solid #ddd", borderRadius: "8px" }}>
    
    {/* Service Name Multi-Select */}
    <div style={{ marginBottom: "15px" }}>
      <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>
        Service Name {idx + 1}
      </label>
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
      <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>Service Description</label>
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
      <label style={{ fontWeight: "600", display: "block", marginBottom: "6px" }}>Service Amount ₹</label>
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

{/* Add Service Button */}
<button
  type="button"
  onClick={() => setServices([...services, { name: [], description: "", amount: "" }])}
  style={{ marginBottom: "20px", padding: "10px 20px", background: "#000", color: "#fff", borderRadius: "5px", fontWeight: "bold" }}
>
  Add Another Service
</button>



      <div style={{ marginBottom: "20px" }}>
        <label style={{ fontWeight: "600" }}>Payment Status</label>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          style={{ width: "100%", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
        >
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
        </select>
      </div>

      <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
        <p>Subtotal: ₹{amount.toFixed(2)}</p>
        <p>CGST (9%): ₹{cgst.toFixed(2)}</p>
        <p>SGST (9%): ₹{sgst.toFixed(2)}</p>
        <p>IGST (18%): ₹{igst.toFixed(2)}</p>
        <p><b>Total Tax:</b> ₹{totalTax.toFixed(2)}</p>
        <p><b>Total Amount:</b> ₹{totalAmount.toFixed(2)}</p>
      </div>

       <button type="submit" style={{ width: "100%", padding: "15px", background: "#000000", color: "#fff", borderRadius: "5px", fontWeight: "bold", fontSize: "16px" }}>
        Submit Invoice
      </button>

      </form>
    </div>
  );
}
