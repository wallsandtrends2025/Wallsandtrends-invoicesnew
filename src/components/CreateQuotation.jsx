// src/pages/CreateQuotation.jsx
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

// formatter like INR style commas, but we won't force INR symbol
const formatAmount = (num) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(isNaN(num) ? 0 : num));

export default function CreateQuotation() {
  const navigate = useNavigate();

  // form state
  const [yourCompany, setYourCompany] = useState("");
  const [quotationDate, setQuotationDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // yyyy-mm-dd
  });
  const [quotationTitle, setQuotationTitle] = useState("");

  const [quotationNumber, setQuotationNumber] = useState("");

  // clients
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  // line items / services
  const [services, setServices] = useState([
    { name: [], description: "", amount: "" },
  ]);

  // payment status (you had this for proforma; keep same for quotation)
  const [paymentStatus, setPaymentStatus] = useState("Pending");

  // currency
  const [selectedCurrency, setSelectedCurrency] = useState("INR");

  // ui state
  const [submitting, setSubmitting] = useState(false);

  // validation state
  const [errors, setErrors] = useState({
    yourCompany: "",
    quotationDate: "",
    quotationTitle: "",
    selectedClientId: "",
    services: "",
    serviceRows: {}, // { idx: { name, description, amount } }
  });

  // options for services (copied from your CreateProforma)
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

  // map companies to "group" like your Proforma code
  // so WT and WTPL share one pool, WTX and WTXPL share one pool
  const companyToGroup = {
    WT: "WT",
    WTPL: "WT",
    WTX: "WTX",
    WTXPL: "WTX",
  };

  // currency dropdown options:
  // client currency first, then INR fallback
  const currencyOptions = useMemo(() => {
    if (!selectedClient?.country) {
      return getCurrencyOptionsForSelect(["INR"]);
    }
    const clientCurrency =
      CurrencyService.getDefaultCurrencyForClient(selectedClient);

    const currencies = [clientCurrency];
    if (clientCurrency !== "INR") {
      currencies.push("INR");
    }
    return getCurrencyOptionsForSelect(currencies);
  }, [selectedClient]);

  // load all clients once
  useEffect(() => {
    (async () => {
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClients(list);
      } catch (err) {
        console.error("❌ CreateQuotation: failed loading clients", err);
      }
    })();
  }, []);

  // sort clients alphabetically like you did
  const sortedClients = useMemo(() => {
    const copy = [...clients];
    copy.sort((a, b) => {
      const aCo = (a.company_name || "").toLowerCase();
      const bCo = (b.company_name || "").toLowerCase();
      if (aCo !== bCo) return aCo.localeCompare(bCo);
      return (a.client_name || "")
        .toLowerCase()
        .localeCompare((b.client_name || "").toLowerCase());
    });
    return copy;
  }, [clients]);

  // filter clients based on company group
  const filteredClients = useMemo(() => {
    const group = companyToGroup[yourCompany];
    if (!group) return [];

    // primary filter: company_group
    let filtered = sortedClients.filter((c) => c.company_group === group);

    // fallback: match by company_name mapping logic
    if (filtered.length === 0) {
      filtered = sortedClients.filter(
        (c) =>
          c.company_name === yourCompany ||
          (c.company_name === "WT" &&
            (yourCompany === "WT" || yourCompany === "WTPL")) ||
          (c.company_name === "WTPL" &&
            (yourCompany === "WT" || yourCompany === "WTPL")) ||
          (c.company_name === "WTX" &&
            (yourCompany === "WTX" || yourCompany === "WTXPL")) ||
          (c.company_name === "WTXPL" &&
            (yourCompany === "WTX" || yourCompany === "WTXPL"))
      );
    }

    // final fallback: if we still have nothing but we DO have clients globally, expose all
    if (filtered.length === 0 && sortedClients.length > 0) {
      filtered = sortedClients;
    }

    return filtered;
  }, [sortedClients, yourCompany]);

  // if user switches company, nuke incompatible client
  useEffect(() => {
    if (!yourCompany) {
      setSelectedClientId("");
      setSelectedClient(null);
      return;
    }
    if (selectedClientId) {
      const stillValid = filteredClients.find(
        (c) => c.id === selectedClientId
      );
      if (!stillValid) {
        setSelectedClientId("");
        setSelectedClient(null);
      }
    }
  }, [yourCompany, filteredClients, selectedClientId]);

  // subtotal calculation
  const subtotal = services.reduce(
    (sum, s) => sum + Number(s.amount || 0),
    0
  );

  // sanitize service rows for Firestore
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

  // validate form
  const validate = () => {
    const next = {
      yourCompany: "",
      quotationDate: "",
      quotationTitle: "",
      selectedClientId: "",
      services: "",
      serviceRows: {},
    };

    if (!yourCompany) next.yourCompany = "Select your company.";
    if (!quotationDate) next.quotationDate = "Select quotation date.";
    if (!quotationTitle.trim())
      next.quotationTitle = "Enter quotation title.";
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
        if (
          amt === "" ||
          amt === undefined ||
          isNaN(Number(amt))
        ) {
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
      next.quotationDate ||
      next.quotationTitle ||
      next.selectedClientId ||
      next.services ||
      Object.keys(next.serviceRows).length > 0
    );
  };

  // generate quotation ID whenever company/date changes
  useEffect(() => {
    if (yourCompany && quotationDate) {
      generateQuotationId(yourCompany);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourCompany, quotationDate]);

  // counter logic (similar to your proforma generator, but fixed)
  const generateQuotationId = async (company) => {
    const [yyyy, mm] = quotationDate.split("-"); // YYYY-MM-DD
    const yy = yyyy.slice(-2); // last 2 of year
    const dateStr = `${yy}${mm}`; // YYMM

    // counter doc key per company+YYMM
    const counterKey = `${company}_${dateStr}_QUOTATION`;
    const counterRef = doc(db, "quotation_counters", counterKey);

    try {
      const nextCount = await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(counterRef);
        const current = snap.exists() ? snap.data().count : 0;
        const next = current + 1;
        transaction.set(counterRef, { count: next });
        return next;
      });

      // WT2510QTN003 style
      const formatted = `${company}${dateStr}QTN${String(
        nextCount
      ).padStart(3, "0")}`;

      setQuotationNumber(formatted);
    } catch (e) {
      console.error("Error generating quotation ID:", e);
    }
  };

  // submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);

    const sanitized = sanitizeServices();
    const amount = sanitized.reduce(
      (sum, s) => sum + Number(s.amount || 0),
      0
    );

    // snapshot essential client details to freeze this version
    const quotationData = {
      quotation_id: quotationNumber,
      quotation_type: yourCompany, // WT / WTX etc.
      quotation_title: quotationTitle,
      quotation_date: quotationDate,

      currency: selectedCurrency,
      payment_status: paymentStatus,

      services: sanitized,
      subtotal: Number(amount.toFixed(2)),
      total_amount: Number(amount.toFixed(2)),

      client_id: selectedClientId,
      client_name: selectedClient?.client_name || "",
      client_company: selectedClient?.company_name || "",
      client_country: selectedClient?.country || "",
      client_email: selectedClient?.email || "",
      client_poc: selectedClient?.poc || "",

      pdf_url: "",
      created_at: new Date(),
    };

    try {
      await setDoc(
        doc(db, "quotations", quotationNumber),
        quotationData
      );
      navigate("/dashboard/quotations");
    } catch (error) {
      console.error("❌ Error creating quotation:", error);
      alert("Failed to create quotation.");
    } finally {
      setSubmitting(false);
    }
  };

  // computed object for <Select value={...}> to avoid flicker
  const selectedClientObj = filteredClients.find(
    (c) => c.id === selectedClientId
  );

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen flex justify-center">
      <form onSubmit={handleSubmit} noValidate style={{ width: "100%" }}>
        {/* Title bar */}
        <div className="bg-[#ffffff] shadow-sm mb-[20px] p-[15px] border-curve">
          <h2 className="font-semibold text-[#000000] m-[0]">
            Create Quotation
          </h2>
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
              border: `1px solid ${
                errors.yourCompany ? "#d32f2f" : "#ccc"
              }`,
            }}
          >
            <option value="">Select Company</option>
            <option value="WT">WT</option>
            <option value="WTPL">WTPL</option>
            <option value="WTX">WTX</option>
            <option value="WTXPL">WTXPL</option>
          </select>
          {errors.yourCompany && (
            <small style={{ color: "#d32f2f" }}>
              {errors.yourCompany}
            </small>
          )}

          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: 14,
              marginBottom: 8,
            }}
          >
            <div style={{ flex: 1 }} className="mr-[10px]">
              <RequiredLabel>Quotation Date</RequiredLabel>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                aria-invalid={!!errors.quotationDate}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${
                    errors.quotationDate ? "#d32f2f" : "#ccc"
                  }`,
                }}
              />
              {errors.quotationDate && (
                <small style={{ color: "#d32f2f" }}>
                  {errors.quotationDate}
                </small>
              )}
            </div>

            <div style={{ flex: 1 }}>
              <RequiredLabel>Title of Quotation</RequiredLabel>
              <input
                type="text"
                value={quotationTitle}
                onChange={(e) => setQuotationTitle(InputSanitizer.sanitizeText(e.target.value))}
                aria-invalid={!!errors.quotationTitle}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: 10,
                  border: `1px solid ${
                    errors.quotationTitle ? "#d32f2f" : "#ccc"
                  }`,
                }}
              />
              {errors.quotationTitle && (
                <small style={{ color: "#d32f2f" }}>
                  {errors.quotationTitle}
                </small>
              )}
            </div>
          </div>

          {/* Quotation Number (disabled) */}
          <label style={{ fontWeight: 600 }}>Quotation Number</label>
          <input
            type="text"
            value={quotationNumber}
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

          {/* Client */}
          <RequiredLabel>Select Client</RequiredLabel>
          <Select
            isDisabled={!yourCompany}
            options={filteredClients.map((c) => ({
              value: c.id,
              label: c.client_name || "",
            }))}
            value={
              selectedClientObj
                ? {
                    value: selectedClientObj.id,
                    label: selectedClientObj.client_name || "",
                  }
                : null
            }
            onChange={(opt) => {
              const id = opt?.value || "";
              const client = filteredClients.find((c) => c.id === id);

              setSelectedClientId(id);
              setSelectedClient(client || null);

              // set default currency when client chosen
              if (client?.country) {
                const clientCurrency =
                  CurrencyService.getDefaultCurrencyForClient(client);
                setSelectedCurrency(clientCurrency);
              } else {
                setSelectedCurrency("INR");
              }

              setErrors((prev) => ({
                ...prev,
                selectedClientId: "",
              }));
            }}
            placeholder={
              yourCompany
                ? "Select Client..."
                : "Select company first"
            }
            isSearchable
            styles={{
              control: (base) => ({
                ...base,
                padding: 2,
                marginBottom: 6,
                borderRadius: 10,
                opacity: yourCompany ? 1 : 0.7,
                borderColor: errors.selectedClientId
                  ? "#d32f2f"
                  : base.borderColor,
                boxShadow: errors.selectedClientId
                  ? "0 0 0 1px #d32f2f"
                  : base.boxShadow,
                "&:hover": {
                  borderColor: errors.selectedClientId
                    ? "#d32f2f"
                    : base.borderColor,
                },
              }),
            }}
            noOptionsMessage={() =>
              yourCompany
                ? "No clients for this company"
                : "Select company first"
            }
          />
          {errors.selectedClientId && (
            <small style={{ color: "#d32f2f" }}>
              {errors.selectedClientId}
            </small>
          )}

          {/* Services */}
          <h3
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginTop: 30,
            }}
          >
            Services
          </h3>
          {errors.services && (
            <small style={{ color: "#d32f2f" }}>
              {errors.services}
            </small>
          )}

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
                {/* Service Name */}
                <div
                  className="services-block"
                  style={{ marginBottom: 15 }}
                >
                  <RequiredLabel>
                    Service Name {idx + 1}
                  </RequiredLabel>
                  <Select
                    isMulti
                    options={serviceOptions}
                    value={(service.name || []).map((n) =>
                      serviceOptions.find(
                        (opt) => opt.value === n
                      )
                    )}
                    onChange={(opts) => {
                      const updated = [...services];
                      updated[idx].name = (opts || []).map(
                        (o) => o.value
                      );
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (next.serviceRows[idx]?.name) {
                          next.serviceRows = {
                            ...next.serviceRows,
                            [idx]: {
                              ...next.serviceRows[idx],
                              name: "",
                            },
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
                        minHeight: 44,
                        padding: 2,
                        borderColor: rowErr.name
                          ? "#d32f2f"
                          : "#ccc",
                      }),
                    }}
                  />
                  {rowErr.name && (
                    <small style={{ color: "#d32f2f" }}>
                      {rowErr.name}
                    </small>
                  )}
                </div>

                {/* Description */}
                <div style={{ marginBottom: 15 }}>
                  <RequiredLabel>
                    Service Description
                  </RequiredLabel>
                  <textarea
                    value={service.description || ""}
                    onChange={(e) => {
                      const updated = [...services];
                      updated[idx].description = InputSanitizer.sanitizeText(e.target.value);
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (
                          next.serviceRows[idx]?.description
                        ) {
                          next.serviceRows = {
                            ...next.serviceRows,
                            [idx]: {
                              ...next.serviceRows[idx],
                              description: "",
                            },
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
                      border: `1px solid ${
                        rowErr.description
                          ? "#d32f2f"
                          : "#ccc"
                      }`,
                    }}
                    rows={3}
                  />
                  {rowErr.description && (
                    <small style={{ color: "#d32f2f" }}>
                      {rowErr.description}
                    </small>
                  )}
                </div>

                {/* Amount */}
                <div style={{ marginBottom: 15 }}>
                  <RequiredLabel>
                    Service Amount (
                    {
                      CurrencyService.getCurrencySymbol(
                        selectedCurrency
                      )
                    }
                    )
                  </RequiredLabel>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={service.amount ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      const updated = [...services];
                      updated[idx].amount =
                        val === ""
                          ? ""
                          : Math.max(1, Number(val));
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        if (
                          next.serviceRows[idx]?.amount
                        ) {
                          next.serviceRows = {
                            ...next.serviceRows,
                            [idx]: {
                              ...next.serviceRows[idx],
                              amount: "",
                            },
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
                      border: `1px solid ${
                        rowErr.amount ? "#d32f2f" : "#ccc"
                      }`,
                    }}
                  />
                  {rowErr.amount && (
                    <small style={{ color: "#d32f2f" }}>
                      {rowErr.amount}
                    </small>
                  )}
                </div>

                {/* Remove service row */}
                {services.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...services];
                      updated.splice(idx, 1);
                      setServices(updated);
                      setErrors((prev) => {
                        const next = { ...prev };
                        const {
                          [idx]: _gone,
                          ...rest
                        } = next.serviceRows;
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
            onClick={() =>
              setServices([
                ...services,
                { name: [], description: "", amount: "" },
              ])
            }
            style={{
              marginBottom: 20,
              padding: "10px 20px",
              background: "rgb(59 89 151)",
              color: "#fff",
              borderRadius: 5,
              fontWeight: "bold",
            }}
          >
            {services.length === 0
              ? "Add Service"
              : "Add Another Service"}
          </button>

          {/* Currency */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Currency</label>
            <Select
              options={currencyOptions}
              value={currencyOptions.find(
                (opt) => opt.value === selectedCurrency
              )}
              onChange={(option) => {
                const newCurrency =
                  option?.value || "INR";
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
            <label style={{ fontWeight: 600 }}>
              Payment Status
            </label>
            <select
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(e.target.value)
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 10,
                border: "1px solid #ccc",
              }}
            >
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Rejected">Rejected</option>
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
              Subtotal:{" "}
              {
                CurrencyService.getCurrencySymbol(
                  selectedCurrency
                )
              }
              {formatAmount(subtotal)}
            </p>
            <p>
              <b>Total Amount:</b>{" "}
              {
                CurrencyService.getCurrencySymbol(
                  selectedCurrency
                )
              }
              {formatAmount(subtotal)}
            </p>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "16px",
                maxWidth: "400px",
                width: "100%",
              }}
            >
              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 h-[44px] flex items-center justify-center rounded-[12px] font-bold text-[18px] text-white border-2 transition-all ${
                  submitting
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                } bg-[#1E3A8A] border-[#1E3A8A] shadow-[0_3px_6px_rgba(30,58,138,0.2)] hover:bg-[#3b5997] hover:border-[#3b5997] hover:shadow-[0_5px_10px_rgba(59,89,151,0.5)]`}
              >
                {submitting ? "Submitting..." : "Submit Quotation"}
              </button>

              {/* Clear */}
              <button
                type="button"
                onClick={() => {
                  setYourCompany("");
                  setSelectedClientId("");
                  setSelectedClient(null);

                  setQuotationNumber("");
                  setQuotationTitle("");
                  setQuotationDate(
                    new Date()
                      .toISOString()
                      .split("T")[0]
                  );

                  setServices([
                    {
                      name: [],
                      description: "",
                      amount: "",
                    },
                  ]);

                  setPaymentStatus("Pending");
                  setSelectedCurrency("INR");

                  setErrors({
                    yourCompany: "",
                    quotationDate: "",
                    quotationTitle: "",
                    selectedClientId: "",
                    services: "",
                    serviceRows: {},
                  });

                  console.log(
                    "Clear Form clicked - quotation form cleared"
                  );
                  alert("Form has been cleared!");
                }}
                className="flex-1 h-[44px] flex items-center justify-center rounded-[12px] font-bold text-[18px] text-white cursor-pointer border-2 bg-[#3b5997] border-[#3b5997] shadow-[0_3px_6px_rgba(59,89,151,0.5)] hover:bg-[#3b5997] hover:border-[#3b5997] hover:shadow-[0_5px_10px_rgba(59,89,151,0.8)] transition-all"
              >
                Clear Form
              </button>
            </div>
          </div>

          {/* remove number spinners (global for this component render) */}
          <style>{`
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
