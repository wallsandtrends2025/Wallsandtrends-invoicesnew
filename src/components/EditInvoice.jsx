// src/pages/EditInvoice.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import Select from "react-select";

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const EDITABLE_FIELDS = new Set([
    "invoice_id",
    "client_id",
    "project_id",
    "invoice_title",
    "invoice_date",
    "payment_date",
    "subtotal",
    "cgst",
    "sgst",
    "igst",
    "tax_amount",
    "total_amount",
    "payment_status",
    "gst_payment_status",
    "invoice_type",
    "services",
    "amount_paid_total",
  ]);

  const [invoice, setInvoice] = useState({
    invoice_id: "",
    client_id: "",
    project_id: "",
    invoice_title: "",
    invoice_date: "",
    payment_date: "",
    subtotal: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    tax_amount: 0,
    total_amount: 0,
    payment_status: "Pending",
    gst_payment_status: "Pending",
    invoice_type: "",
    services: [], // [{ name: string[], description: string, amount: number }]
    amount_paid_total: 0,
  });

  const [client, setClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [amountPayingNow, setAmountPayingNow] = useState(0);

  // 🔹 Unified blue rounded button (matches your screenshot)
  const btn =
      "inline-flex items-center justify-center h-[40px] px-6 rounded-full font-semibold text-[#ffffff] " +
  "bg-[#3b5998] hover:bg-[#2f497e] shadow-sm transition-colors " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

  // Service options
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

  // react-select styles
  const rsStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 44,
      borderColor: state.isFocused ? "#000000" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 1px #000000" : "none",
      "&:hover": { borderColor: state.isFocused ? "#000000" : "#9ca3af" },
    }),
    valueContainer: (b) => ({ ...b, padding: "2px 10px" }),
    multiValue: (b) => ({ ...b, borderRadius: 6 }),
    placeholder: (b) => ({ ...b, color: "#6b7280" }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  // utils
  const toYMD = (val) => {
    if (!val) return "";
    if (typeof val === "string") return val.slice(0, 10);
    if (val?.seconds) return new Date(val.seconds * 1000).toISOString().slice(0, 10);
    if (val?.toDate) return val.toDate().toISOString().slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return "";
  };
  const toDateOrNull = (ymd) => {
    if (!ymd) return null;
    const d = new Date(`${ymd}T00:00:00`);
    return isNaN(d) ? null : d;
  };
  const isIndian = (c) => (c?.country || "").toLowerCase() === "india";
  const isTelangana = (c) => (c?.state || "").toLowerCase() === "telangana";

  // Load invoice
  useEffect(() => {
    const load = async () => {
      const ref = doc(db, "invoices", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        alert("Invoice not found.");
        navigate(-1);
        return;
      }
      const raw = snap.data();
      const data = Object.fromEntries(Object.entries(raw).filter(([k]) => EDITABLE_FIELDS.has(k)));

      data.invoice_date = toYMD(data.invoice_date);
      data.payment_date = toYMD(data.payment_date);

      ["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount", "amount_paid_total"].forEach(
        (k) => (data[k] = Number(data[k] ?? 0))
      );

      // normalize services
      const normalizeRow = (row) => {
        const name =
          Array.isArray(row?.name)
            ? row.name
            : typeof row?.name === "string"
            ? row.name.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
        return {
          name,
          description: String(row?.description ?? ""),
          amount: Number(row?.amount ?? 0),
        };
      };
      data.services = Array.isArray(data.services) ? data.services.map(normalizeRow) : [];

      data.payment_status = data.payment_status || "Pending";
      data.gst_payment_status = data.gst_payment_status || "Pending";

      setInvoice((p) => ({ ...p, ...data }));
      setAmountPayingNow(0);
    };
    load();
  }, [id, navigate]);

  // Load client for GST logic
  useEffect(() => {
    const fetchClient = async () => {
      if (!invoice.client_id) return setClient(null);
      try {
        const c = await getDoc(doc(db, "clients", invoice.client_id));
        setClient(c.exists() ? c.data() : null);
      } catch {
        setClient(null);
      }
    };
    fetchClient();
  }, [invoice.client_id]);

  // Service row helpers
  const updateService = (idx, patch) => {
    setInvoice((prev) => {
      const next = [...(prev.services || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, services: next };
    });
  };
  const addService = () =>
    setInvoice((prev) => ({
      ...prev,
      services: [...(prev.services || []), { name: [], description: "", amount: 0 }],
    }));
  const removeService = (idx) =>
    setInvoice((prev) => {
      const next = [...(prev.services || [])];
      next.splice(idx, 1);
      return { ...prev, services: next };
    });

  // Totals
  const sanitizedServices = useMemo(
    () =>
      (invoice.services || []).map((s) => ({
        name: (Array.isArray(s.name) ? s.name : []).filter(Boolean).join(", "),
        description: String(s.description || ""),
        amount: Number(s.amount || 0),
      })),
    [invoice.services]
  );

  const subtotal = useMemo(
    () => sanitizedServices.reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [sanitizedServices]
  );

  let cgstRate = 0,
    sgstRate = 0,
    igstRate = 0;
  if (isIndian(client) && isTelangana(client)) {
    cgstRate = 9;
    sgstRate = 9;
  } else if (isIndian(client)) {
    igstRate = 18;
  }

  const cgst = (subtotal * cgstRate) / 100;
  const sgst = (subtotal * sgstRate) / 100;
  const igst = (subtotal * igstRate) / 100;
  const tax_amount = cgst + sgst + igst;
  const total_amount = subtotal + tax_amount;

  // Payment math
  const totalAmount = Number(total_amount || 0);
  const alreadyPaid = Number(invoice.amount_paid_total || 0);
  const payingNow = Number(amountPayingNow || 0);
  const remainingBeforeThisPayment = Math.max(totalAmount - alreadyPaid, 0);
  const remainingAfterThisPayment = Math.max(totalAmount - (alreadyPaid + payingNow), 0);

  const handleField = (e) => {
    const { name, value } = e.target;
    setInvoice((prev) => ({ ...prev, [name]: value }));
  };

  const currency = (n) =>
    new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
      Number(n || 0)
    );

  // Save submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!invoice.invoice_title.trim()) return alert("Invoice title is required.");
    if ((invoice.services || []).length === 0) return alert("Add at least one service.");

    if (invoice.payment_status === "Partial") {
      if (payingNow <= 0 || alreadyPaid + payingNow > totalAmount)
        return alert("Please check your pending amount correctly.");
    }
    if (invoice.payment_status === "Paid" && alreadyPaid + payingNow > totalAmount)
      return alert("Please check your pending amount correctly.");

    const draft = Object.fromEntries(Object.entries(invoice).filter(([k]) => EDITABLE_FIELDS.has(k)));

    draft.invoice_date = toDateOrNull(invoice.invoice_date);
    draft.payment_date = toDateOrNull(invoice.payment_date);

    draft.services = sanitizedServices;
    draft.subtotal = Number(subtotal.toFixed(2));
    draft.cgst = Number(cgst.toFixed(2));
    draft.sgst = Number(sgst.toFixed(2));
    draft.igst = Number(igst.toFixed(2));
    draft.tax_amount = Number(tax_amount.toFixed(2));
    draft.total_amount = Number(total_amount.toFixed(2));

    const gstApplicable = isIndian(client);
    draft.gst_payment_status = gstApplicable ? invoice.gst_payment_status : "NA";

    if (invoice.payment_status === "Partial") {
      draft.amount_paid_total = Number(alreadyPaid + payingNow);
    } else if (invoice.payment_status === "Paid") {
      draft.amount_paid_total = Math.min(totalAmount, Number(alreadyPaid + payingNow));
    } else {
      draft.amount_paid_total = alreadyPaid;
    }

    draft.updated_at = serverTimestamp();

    setSaving(true);
    try {
      await updateDoc(doc(db, "invoices", id), draft);
      navigate("/dashboard/pdf-manager");
    } catch (err) {
      console.error(err);
      alert("Failed to save invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex justify-center items-start">
      <div className="w-full max-w-3xl bg-white p-8 rounded-2xl shadow-md border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Edit Invoice</h2>

        <form onSubmit={handleSubmit}>
          {/* ===== Invoice Details ===== */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID</label>
                <input
                  type="text"
                  name="invoice_id"
                  value={invoice.invoice_id}
                  onChange={handleField}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  type="text"
                  name="client_id"
                  value={invoice.client_id}
                  onChange={handleField}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Title</label>
                <input
                  type="text"
                  name="invoice_title"
                  value={invoice.invoice_title}
                  onChange={handleField}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  name="invoice_date"
                  value={invoice.invoice_date || ""}
                  onChange={handleField}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  name="payment_date"
                  value={invoice.payment_date || ""}
                  onChange={handleField}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
                <select
                  name="invoice_type"
                  value={invoice.invoice_type || ""}
                  onChange={handleField}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black bg-white"
                >
                  <option value="">Select Company</option>
                  <option value="WT">WT</option>
                  <option value="WTPL">WTPL</option>
                  <option value="WTX">WTX</option>
                  <option value="WTXPL">WTXPL</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Payment Status</label>
                <select
                  name="gst_payment_status"
                  value={isIndian(client) ? (invoice.gst_payment_status || "Pending") : "NA"}
                  onChange={handleField}
                  disabled={!isIndian(client)}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black bg-white disabled:bg-gray-100"
                >
                  <option value="Pending">Pending</option>
                  <option value="Paid">Paid</option>
                  <option value="Partial">Partial</option>
                  {!isIndian(client) && <option value="NA">NA</option>}
                </select>
                {!isIndian(client) && (
                  <p className="text-xs text-gray-500 mt-1">
                    GST not applicable (international client) — saved as “NA”.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ===== Services ===== */}
          <div className="mb-2 flow-root">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Services</h3>

            {(invoice.services || []).map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  background: "#f9fafb",
                  marginBottom: 24,
                  position: "relative",
                  overflow: "visible",
                  clear: "both",
                  
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Name {idx + 1}
                  </label>
                  <Select
                    isMulti
                    options={serviceOptions}
                    styles={rsStyles}
                    menuPosition="fixed"
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    value={(row.name || []).map((n) => ({ label: n, value: n }))}
                    onChange={(opts) =>
                      updateService(idx, { name: (opts || []).map((o) => o.value) })
                    }
                    placeholder="Select Service(s)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Description
                  </label>
                  <textarea
                    value={row.description || ""}
                    onChange={(e) => updateService(idx, { description: e.target.value })}
                    className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    rows={3}
                    placeholder="Enter Service Description"
                    style={{ display: "block" }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Amount ₹
                  </label>
                  <input
                    type="number"
                    value={row.amount ?? 0}
                    onChange={(e) =>
                      updateService(idx, { amount: Number(e.target.value || 0) })
                    }
                    className="w-full border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    style={{ display: "block" }}
                  />
                </div>

                {(invoice.services || []).length > 1 && (
                  <button type="button" onClick={() => removeService(idx)} className={btn}>
                    Remove Service
                  </button>
                )}
              </div>
            ))}

            <button type="button" onClick={addService} className={btn}>
              {invoice.services?.length ? "Add Another Service" : "Add Service"}
            </button>
          </div>

          {/* ===== Totals ===== */}
          <div className="my-8 border-t border-gray-200" />
          <div className="mb-10 flow-root">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Totals</h3>
            <div className="flow-root bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="mb-1">Subtotal: ₹{currency(subtotal)}</p>
              {cgst > 0 && <p className="mb-1">CGST ({cgstRate}%): ₹{currency(cgst)}</p>}
              {sgst > 0 && <p className="mb-1">SGST ({sgstRate}%): ₹{currency(sgst)}</p>}
              {igst > 0 && <p className="mb-1">IGST ({igstRate}%): ₹{currency(igst)}</p>}
              <p className="mb-1"><b>Total Tax:</b> ₹{currency(tax_amount)}</p>
              <p className="mb-0"><b>Total Amount:</b> ₹{currency(total_amount)}</p>
            </div>
          </div>

          {/* ===== Payment ===== */}
          <div className="my-4 border-t border-gray-200 edit-invoice-payment" />
          <div className="mb-4 mt-20 flow-root clear-both pt-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment</h3>

            {/* Balance after this payment */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
              <b>Balance Due (after this payment):</b>{" "}
              ₹{currency(
                (invoice.payment_status === "Partial" || invoice.payment_status === "Paid")
                  ? remainingAfterThisPayment
                  : remainingBeforeThisPayment
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Status
                </label>
                <select
                  name="payment_status"
                  value={invoice.payment_status}
                  onChange={(e) => {
                    if (e.target.value !== "Partial" && e.target.value !== "Paid") {
                      setAmountPayingNow(0);
                    }
                    handleField(e);
                  }}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black bg-white"
                  required
                >
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={total_amount}
                  readOnly
                  className="w-full bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Already Paid
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={alreadyPaid}
                  readOnly
                  className="w-full bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-gray-700"
                />
              </div>
            </div>

            {(invoice.payment_status === "Partial" || invoice.payment_status === "Paid") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paying Amount (now)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountPayingNow}
                    onChange={(e) => setAmountPayingNow(Number(e.target.value || 0))}
                    className="w-full border border-gray-300 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Enter amount"
                  />
                  {Number(amountPayingNow || 0) > remainingBeforeThisPayment && (
                    <p className="mt-2 text-sm text-red-600">
                      Please check your pending amount correctly.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remaining Amount (after this payment)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={remainingAfterThisPayment}
                    readOnly
                    className="w-full bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-gray-700"
                  />
                </div>
              </div>
            )}

            {invoice.payment_status === "Pending" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remaining Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={remainingBeforeThisPayment}
                    readOnly
                    className="w-full bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status Note
                  </label>
                  <input
                    type="text"
                    value="No payment recorded yet"
                    readOnly
                    className="w-full bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-gray-700"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ===== Actions ===== */}
          <div className="flex justify-end gap-4 mt-10">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={btn}
              disabled={saving}
            >
              ← Back
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                ((invoice.payment_status === "Partial" || invoice.payment_status === "Paid") &&
                  Number(invoice.amount_paid_total || 0) + Number(amountPayingNow || 0) >
                    Number(total_amount || 0))
              }
              className={btn}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
