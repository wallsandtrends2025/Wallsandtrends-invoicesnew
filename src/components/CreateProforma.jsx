// src/pages/CreateProforma.jsx
import { useEffect, useMemo, useState } from "react";
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
import CurrencyService from "../utils/CurrencyService";
import { getCurrencyOptionsForSelect } from "../constants/currencies";
import { InputSanitizer } from "../utils/sanitization";

// helper: "Label *"
const RequiredLabel = ({ children }) => (
  <span style={{ fontWeight: 600 }}>
    {children} <span style={{ color: "#d32f2f" }}>*</span>
  </span>
);

// INR formatter-like with 2 decimals
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

  const [services, setServices] = useState([
    { name: [], description: "", amount: "" },
  ]);

  // Payment status aligned with list & edit screens
  const [paymentStatus, setPaymentStatus] = useState("Pending");

  // Currency states
  const [selectedCurrency, setSelectedCurrency] = useState("INR");

  // inline validation
  const [errors, setErrors] = useState({
    yourCompany: "",
    proformaDate: "",
    proformaTitle: "",
    selectedClientId: "",
    services: "",
    serviceRows: {}, // { idx: { name, description, amount } }
  });

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
    { label: "Shoot Camera Equipment", value: "Shoot Camera Equipment" },
  ];

  // Currency options for React Select - Show client currency first, then INR
  const currencyOptions = useMemo(() => {
    if (!selectedClient?.country) {
      return getCurrencyOptionsForSelect(["INR"]);
    }
    const clientCurrency = CurrencyService.getDefaultCurrencyForClient(selectedClient);
    const currencies = [clientCurrency];
    if (clientCurrency !== "INR") currencies.push("INR");
    return getCurrencyOptionsForSelect(currencies);
  }, [selectedClient]);

  // load clients
  useEffect(() => {
    (async () => {
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClients(list);
      } catch (error) {
        console.error("Error loading clients:", error);
      }
    })();
  }, []);

  // generate proforma id when company/date changes
  useEffect(() => {
    if (yourCompany && proformaDate) {
      generateProformaId(yourCompany);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourCompany, proformaDate]);

  const generateProformaId = async (company) => {
    const [yyyy, mm] = proformaDate.split("-"); // YYYY-MM-DD
    const yy = yyyy.slice(-2);
    const dateStr = `${yy}${mm}`; // YYMM
    const counterKey = `${company}_${dateStr}_PROFORMA`;
    const counterRef = doc(db, "quotation_counters", counterKey);

    try {
      const count = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterRef);
        const current = snap.exists() ? snap.data().count : 0;
        const next = current + 1;
        transaction.set(counterRef, { count: next });
        return next;
      });

      const formatted = `${company}${dateStr}PRF${String(count).padStart(3, "0")}`;
      setPreviewProformaNumber(formatted);
    } catch (e) {
      console.error("Error generating proforma ID:", e);
    }
  };

  // match CreateInvoice UX: company → group → filtered clients
  const companyToGroup = {
    WT: "WT",
    WTPL: "WT", // WTPL should show same clients as WT
    WTX: "WTX",
    WTXPL: "WTX", // WTXPL should show same clients as WTX
  };

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

  const filteredClients = useMemo(() => {
    const group = companyToGroup[yourCompany];
    if (!group) return [];
    // Primary filter: by company_group
    let filtered = sortedClients.filter((c) => c.company_group === group);
    // Fallback by company_name
    if (filtered.length === 0) {
      filtered = sortedClients.filter(
        (c) =>
          c.company_name === yourCompany ||
          (c.company_name === "WT" && (yourCompany === "WT" || yourCompany === "WTPL")) ||
          (c.company_name === "WTPL" && (yourCompany === "WT" || yourCompany === "WTPL")) ||
          (c.company_name === "WTX" && (yourCompany === "WTX" || yourCompany === "WTXPL")) ||
          (c.company_name === "WTXPL" && (yourCompany === "WTX" || yourCompany === "WTXPL"))
      );
    }
    if (filtered.length === 0 && sortedClients.length > 0) filtered = sortedClients; // last resort
    return filtered;
  }, [sortedClients, yourCompany]);

  // clear client when company changes and no longer matches
  useEffect(() => {
    if (!yourCompany) {
      setSelectedClientId("");
      setSelectedClient(null);
      return;
    }
    if (selectedClientId) {
      const still = filteredClients.find((c) => c.id === selectedClientId);
      if (!still) {
        setSelectedClientId("");
        setSelectedClient(null);
      }
    }
  }, [yourCompany, filteredClients, selectedClientId]);

  // computed totals
  const subtotal = services.reduce((sum, s) => sum + Number(s.amount || 0), 0);

  // sanitize services
  const sanitizeServices = () =>
    services.map((s, i) => {
      const nameStr = Array.isArray(s?.name)
        ? s.name.filter(Boolean).join(", ")
        : s?.name ?? "";
      const amountNum = Number(s?.amount ?? 0);
      return {
        name: String(nameStr || `Service ${i + 1}`),
        description: String(s?.description ?? ""),
        amount: isNaN(amountNum) ? 0 : amountNum,
      };
    });

  // validation
  const validate = () => {
    const next = {
      yourCompany: "",
      proformaDate: "",
      proformaTitle: "",
      selectedClientId: "",
      services: "",
      serviceRows: {},
    };

    if (!yourCompany) next.yourCompany = "Select your company.";
    if (!proformaDate) next.proformaDate = "Select proforma date.";
    if (!proformaTitle.trim()) next.proformaTitle = "Enter proforma title.";
    if (!selectedClientId) next.selectedClientId = "Select a client.";

    if (services.length === 0) {
      next.services = "Add at least one service.";
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
        if (Object.keys(rowErr).length) next.serviceRows[idx] = rowErr;
      });
    }

    setErrors(next);
    return !(
      next.yourCompany ||
      next.proformaDate ||
      next.proformaTitle ||
      next.selectedClientId ||
      next.services ||
      Object.keys(next.serviceRows).length > 0
    );
  };

  // submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const sanitized = sanitizeServices();
    const amount = sanitized.reduce((sum, s) => sum + Number(s.amount || 0), 0);

    const proformaData = {
      proforma_id: previewProformaNumber,
      client_id: selectedClientId,
      proforma_type: yourCompany,
      proforma_title: proformaTitle,
      proforma_date: proformaDate,
      currency: selectedCurrency,
      services: sanitized,
      subtotal: Number(amount.toFixed(2)),
      total_amount: Number(amount.toFixed(2)),
      payment_status: paymentStatus,
      pdf_url: "",
      created_at: new Date(),
    };

    try {
      await setDoc(doc(db, "quotations", previewProformaNumber), proformaData);
      // ✅ Correct list route
      navigate("/dashboard/proformas");
    } catch (error) {
      console.error("❌ Error creating proforma:", error);
      alert("Failed to create proforma.");
    }
  };

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen flex justify-center">
      <form onSubmit={handleSubmit} noValidate style={{ width: "100%" }}>
        {/* Title bar */}
        <div className="bg-[#ffffff] shadow-sm mb-[20px] p-[15px] border-curve">
          <h2 className="font-semibold text-[#000000] m-[0]">Create Proforma</h2>
        </div>

        {/* Card body */}
        <div className="p-[15px] bg-[#ffffff] border-curve">
          {/* Company */}
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
              <RequiredLabel>Proforma Date</RequiredLabel>
              <input
                type="date"
                value={proformaDate}
                onChange={(e) => setProformaDate(e.target.value)}
                aria-invalid={!!errors.proformaDate}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${errors.proformaDate ? "#d32f2f" : "#ccc"}`,
                }}
              />
              {errors.proformaDate && <small style={{ color: "#d32f2f" }}>{errors.proformaDate}</small>}
            </div>

            <div style={{ flex: 1 }}>
              <RequiredLabel>Title of Proforma</RequiredLabel>
              <input
                type="text"
                value={proformaTitle}
                onChange={(e) => setProformaTitle(InputSanitizer.sanitizeText(e.target.value))}
                aria-invalid={!!errors.proformaTitle}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${errors.proformaTitle ? "#d32f2f" : "#ccc"}`,
                }}
              />
              {errors.proformaTitle && <small style={{ color: "#d32f2f" }}>{errors.proformaTitle}</small>}
            </div>
          </div>

          {/* Proforma Number (disabled) */}
          <label style={{ fontWeight: 600 }}>Proforma Number</label>
          <input
            type="text"
            value={previewProformaNumber}
            disabled
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "20px",
              background: "#ffffff",
              fontWeight: "bold",
              borderRadius: "10px",
            }}
          />

          {/* Client (filtered by group) */}
          <RequiredLabel>Select Client</RequiredLabel>
          <Select
            isDisabled={!yourCompany}
            options={filteredClients.map((c) => ({
              value: c.id,
              label: c.client_name || "",
            }))}
            value={
              filteredClients.find((c) => c.id === selectedClientId)
                ? {
                    value: selectedClientId,
                    label: selectedClient?.client_name || "",
                  }
                : null
            }
            onChange={(selected) => {
              const id = selected?.value || "";
              setSelectedClientId(id);
              const client = filteredClients.find((c) => c.id === id) || null;
              setSelectedClient(client);

              // Default currency: client's local currency (fallback INR)
              if (client?.country) {
                const clientCurrency = CurrencyService.getDefaultCurrencyForClient(client);
                setSelectedCurrency(clientCurrency);
              } else {
                setSelectedCurrency("INR");
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

          {/* Services */}
          <h3 style={{ fontSize: 20, fontWeight: 600, marginTop: 30 }}>Services</h3>
          {errors.services && <small style={{ color: "#d32f2f" }}>{errors.services}</small>}

          {services.map((service, idx) => {
            const rowErr = errors.serviceRows[idx] || {};
            return (
              <div
                key={idx}
                style={{
                  marginBottom: 25,
                  padding: 20,
                  background: "#fafafa",
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              >
                <div className="services-block" style={{ marginBottom: 15 }}>
                  <RequiredLabel>Service Name {idx + 1}</RequiredLabel>
                  <Select
                    isMulti
                    options={serviceOptions}
                    value={(service.name || []).map((n) => serviceOptions.find((opt) => opt.value === n))}
                    onChange={(opts) => {
                      const updated = [...services];
                      updated[idx].name = (opts || []).map((o) => o.value);
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
                      control: (base, state) => ({
                        ...base,
                        minHeight: 44,
                        padding: 2,
                        borderColor: rowErr.name ? "#d32f2f" : state.isFocused ? "#000000" : "#ccc",
                        boxShadow: state.isFocused ? "0 0 0 1px #000000" : "none",
                      }),
                    }}
                  />
                  {rowErr.name && <small style={{ color: "#d32f2f" }}>{rowErr.name}</small>}
                </div>

                <div style={{ marginBottom: 15 }}>
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
                          next.serviceRows = {
                            ...next.serviceRows,
                            [idx]: { ...next.serviceRows[idx], description: "" },
                          };
                        }
                        return next;
                      });
                    }}
                    placeholder="Enter Service Description"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 5,
                      border: `1px solid ${rowErr.description ? "#d32f2f" : "#ccc"}`,
                    }}
                    rows={3}
                  />
                  {rowErr.description && <small style={{ color: "#d32f2f" }}>{rowErr.description}</small>}
                </div>

                <div style={{ marginBottom: 15 }}>
                  <RequiredLabel>
                    Service Amount ({CurrencyService.getCurrencySymbol(selectedCurrency)})
                  </RequiredLabel>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={service.amount ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = [...services];
                      updated[idx].amount = val === "" ? "" : Math.max(1, Number(val));
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (next.serviceRows[idx]?.amount) {
                          next.serviceRows = {
                            ...next.serviceRows,
                            [idx]: { ...next.serviceRows[idx], amount: "" },
                          };
                        }
                        return next;
                      });
                    }}
                    placeholder="Enter Amount"
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 5,
                      border: `1px solid ${rowErr.amount ? "#d32f2f" : "#ccc"}`,
                    }}
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
                        const { [idx]: _gone, ...rest } = next.serviceRows;
                        next.serviceRows = rest;
                        return next;
                      });
                    }}
                    style={{
                      backgroundColor: "#dc3545",
                      color: "#fff",
                      padding: "6px 12px",
                      border: "none",
                      borderRadius: 4,
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
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
            style={{
              marginBottom: 20,
              padding: "10px 20px",
              background: "rgb(59 89 151)",
              color: "#fff",
              borderRadius: 5,
              fontWeight: "bold",
            }}
          >
            {services.length === 0 ? "Add Service" : "Add Another Service"}
          </button>

          {/* Currency Selection */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Currency</label>
            <Select
              options={currencyOptions}
              value={currencyOptions.find((opt) => opt.value === selectedCurrency)}
              onChange={(option) => {
                const newCurrency = option?.value || "INR";
                setSelectedCurrency(newCurrency);
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
          </div>

          {/* Payment Status */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Payment Status</label>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            >
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          {/* Totals */}
          <div
            style={{
              background: "#f9f9f9",
              padding: 20,
              borderRadius: 8,
              marginBottom: 20,
            }}
          >
            <p>
              Subtotal: {CurrencyService.getCurrencySymbol(selectedCurrency)}
              {formatAmount(subtotal)}
            </p>
            <p>
              <b>Total Amount:</b> {CurrencyService.getCurrencySymbol(selectedCurrency)}
              {formatAmount(subtotal)}
            </p>
          </div>

          {/* Submit Buttons */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}>
            <div style={{ display: "flex", gap: "16px", maxWidth: "400px", width: "100%" }}>
              <button
                type="submit"
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
                  boxShadow: "0 3px 6px rgba(59, 89, 151, 0.2)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  transition: "all .15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#2f497e";
                  e.currentTarget.style.borderColor = "#2f497e";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#3b5997";
                  e.currentTarget.style.borderColor = "#3b5997";
                }}
              >
                Submit Proforma
              </button>
              <button
                type="button"
                onClick={() => {
                  // Clear all form fields (including date & title)
                  const today = new Date().toISOString().split("T")[0];
                  setYourCompany("");
                  setSelectedClientId("");
                  setSelectedClient(null);
                  setPreviewProformaNumber("");
                  setProformaDate(today);
                  setProformaTitle("");
                  setServices([{ name: [], description: "", amount: "" }]);
                  setPaymentStatus("Pending");
                  setSelectedCurrency("INR");
                  setErrors({
                    yourCompany: "",
                    proformaDate: "",
                    proformaTitle: "",
                    selectedClientId: "",
                    services: "",
                    serviceRows: {},
                  });
                  alert("Form has been cleared!");
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
                  boxShadow: "0 3px 6px rgba(59, 89, 151, 0.2)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  transition: "all .15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#2f497e";
                  e.currentTarget.style.borderColor = "#2f497e";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#3b5997";
                  e.currentTarget.style.borderColor = "#3b5997";
                }}
              >
                Clear Form
              </button>
            </div>
          </div>

          {/* number input spinners off */}
          <style jsx>{`
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"] {
              -moz-appearance: textfield;
            }
          `}</style>
        </div>
      </form>
    </div>
  );
}