// EditInvoice.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import Select from "react-select";

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Persisted fields (amount_paid_total is persisted but non-editable in UI)
  const EDITABLE_FIELDS = new Set([
    "invoice_id",
    "client_id",
    "invoice_title",
    "invoice_date",
    "payment_date",
    "subtotal",
    "cgst",
    "sgst",
    "igst",
    "tax_amount",
    "total_amount",
    "total_in_words",
    "tax_type",
    "payment_status",
    "invoice_type",
    "services",
    "amount_paid_total",
  ]);

  const [invoice, setInvoice] = useState({
    invoice_id: "",
    client_id: "",
    invoice_title: "",
    invoice_date: "",
    payment_date: "",
    subtotal: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    tax_amount: 0,
    total_amount: 0,
    total_in_words: "",
    tax_type: "",
    payment_status: "",
    invoice_type: "",
    services: [],
    amount_paid_total: 0, // read-only in UI
  });

  const [saving, setSaving] = useState(false);

  // UI-only: amount being added now
  const [amountPayingNow, setAmountPayingNow] = useState(0);

  // helpers
  const toYMD = (val) => {
    if (!val) return "";
    if (typeof val === "string") return val.slice(0, 10);
    if (val?.seconds) return new Date(val.seconds * 1000).toISOString().slice(0, 10);
    if (val?.toDate) return val.toDate().toISOString().slice(0, 10);
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return "";
  };

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const ref = doc(db, "invoices", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("Invoice not found.");
          return;
        }

        const raw = snap.data();

        const cleaned = Object.fromEntries(
          Object.entries(raw).filter(([k]) => EDITABLE_FIELDS.has(k))
        );

        // dates to input-friendly YYYY-MM-DD
        cleaned.invoice_date = toYMD(cleaned.invoice_date);
        cleaned.payment_date = toYMD(cleaned.payment_date);

        // numbers
        cleaned.amount_paid_total = Number(cleaned.amount_paid_total ?? 0);
        cleaned.subtotal = Number(cleaned.subtotal ?? 0);
        cleaned.cgst = Number(cleaned.cgst ?? 0);
        cleaned.sgst = Number(cleaned.sgst ?? 0);
        cleaned.igst = Number(cleaned.igst ?? 0);
        cleaned.tax_amount = Number(cleaned.tax_amount ?? 0);
        cleaned.total_amount = Number(cleaned.total_amount ?? 0);

        // normalize services -> [{name}]
        if (Array.isArray(cleaned.services)) {
          cleaned.services = cleaned.services.map((s) =>
            typeof s === "string" ? { name: s } : { name: s?.name ?? "" }
          );
        } else {
          cleaned.services = [];
        }

        setInvoice((p) => ({ ...p, ...cleaned }));
        setAmountPayingNow(0);
      } catch (err) {
        console.error(err);
        alert("Failed to load invoice.");
      }
    };
    fetchInvoice();
  }, [id]);

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
    { label: "Pitch Deck", value: "Pitch Deck" },
    { label: "Branding", value: "Branding" },
    { label: "Strategy & Marketing", value: "Strategy & Marketing" },
    { label: "Web Development", value: "Web Development" },
    { label: "Ad Film", value: "Ad Film" },
    { label: "Corporate Film", value: "Corporate Film" },
  ];

  // derived math
  const totalAmount = useMemo(() => Number(invoice.total_amount || 0), [invoice.total_amount]);
  const alreadyPaid = useMemo(
    () => Number(invoice.amount_paid_total || 0),
    [invoice.amount_paid_total]
  );
  const payingNow = useMemo(() => Number(amountPayingNow || 0), [amountPayingNow]);

  const remainingBeforeThisPayment = Math.max(totalAmount - alreadyPaid, 0);
  const remainingAfterThisPayment = Math.max(totalAmount - (alreadyPaid + payingNow), 0);

  // handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    const numberFields = new Set(["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount"]);
    if (numberFields.has(name)) {
      setInvoice((prev) => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
    } else {
      setInvoice((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleServiceChange = (selectedOptions) => {
    const formatted = (selectedOptions || []).map((opt) => ({ name: opt.value }));
    setInvoice((prev) => ({ ...prev, services: formatted }));
  };

  const toDateOrNull = (ymd) => {
    if (!ymd) return null;
    // store as Date (midnight local). Firestore will coerce Date -> Timestamp.
    const d = new Date(`${ymd}T00:00:00`);
    return isNaN(d) ? null : d;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // guard rails
    if (invoice.payment_status === "Partial") {
      if (payingNow <= 0) return alert("Please enter the amount you are paying now.");
      if (alreadyPaid + payingNow > totalAmount)
        return alert("Please check your pending amount correctly.");
    }
    if (invoice.payment_status === "Paid") {
      if (alreadyPaid + payingNow > totalAmount)
        return alert("Please check your pending amount correctly.");
    }

    // Build payload (clean types)
    const draft = Object.fromEntries(
      Object.entries(invoice).filter(([k]) => EDITABLE_FIELDS.has(k))
    );

    // dates -> Date objects (not strings)
    draft.invoice_date = toDateOrNull(invoice.invoice_date);
    draft.payment_date = toDateOrNull(invoice.payment_date);

    // numbers (ensure no empty strings go up)
    const nums = ["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount", "amount_paid_total"];
    nums.forEach((k) => (draft[k] = Number(draft[k] || 0)));

    // Update cumulative paid
    if (invoice.payment_status === "Partial") {
      draft.amount_paid_total = Number(alreadyPaid + payingNow);
    } else if (invoice.payment_status === "Paid") {
      draft.amount_paid_total = Math.min(totalAmount, Number(alreadyPaid + payingNow));
    } else {
      draft.amount_paid_total = alreadyPaid; // Pending: don't change
    }

    const updates = {
      ...draft,
      updated_at: serverTimestamp(), // important
    };

    setSaving(true);
    try {
      await updateDoc(doc(db, "invoices", id), updates);
      navigate("/dashboard/pdf-manager");
    } catch (err) {
      console.error(err);
      alert("Failed to save invoice. Please check console for details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex justify-center items-start">
      <div className="w-full max-w-3xl bg-white p-8 rounded-2xl shadow-md  border-gray-100">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Edit Invoice</h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* ===== Invoice Basics ===== */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice ID</label>
                <input
                  type="text"
                  name="invoice_id"
                  value={invoice.invoice_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  type="text"
                  name="client_id"
                  value={invoice.client_id}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Title</label>
                <input
                  type="text"
                  name="invoice_title"
                  value={invoice.invoice_title}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  name="invoice_date"
                  value={invoice.invoice_date || ""}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  name="payment_date"
                  value={invoice.payment_date || ""}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* ===== Amounts ===== */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Amounts</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtotal</label>
                <input
                  type="number"
                  step="0.01"
                  name="subtotal"
                  value={invoice.subtotal}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CGST</label>
                <input
                  type="number"
                  step="0.01"
                  name="cgst"
                  value={invoice.cgst}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SGST</label>
                <input
                  type="number"
                  step="0.01"
                  name="sgst"
                  value={invoice.sgst}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IGST</label>
                <input
                  type="number"
                  step="0.01"
                  name="igst"
                  value={invoice.igst}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
                <input
                  type="number"
                  step="0.01"
                  name="tax_amount"
                  value={invoice.tax_amount}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                <input
                  type="number"
                  step="0.01"
                  name="total_amount"
                  value={invoice.total_amount}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Total in Words</label>
                <input
                  type="text"
                  name="total_in_words"
                  value={invoice.total_in_words}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* ===== Meta ===== */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Meta</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Type</label>
                <input
                  type="text"
                  name="tax_type"
                  value={invoice.tax_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
                <input
                  type="text"
                  name="invoice_type"
                  value={invoice.invoice_type}
                  onChange={handleChange}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* ===== Services ===== */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Services</h3>
            <Select
              isMulti
              name="services"
              value={(invoice.services || []).map((s) => ({ label: s.name, value: s.name }))}
              onChange={handleServiceChange}
              options={serviceOptions}
              className="select"
              classNamePrefix="select"
            />
          </section>

          {/* ===== Payment Status & Block ===== */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                <select
                  name="payment_status"
                  value={invoice.payment_status}
                  onChange={(e) => {
                    if (e.target.value !== "Partial" && e.target.value !== "Paid") {
                      setAmountPayingNow(0);
                    }
                    handleChange(e);
                  }}
                  className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  required
                >
                  <option value="" disabled>Select Status</option>
                  <option value="Pending">Pending</option>
                  <option value="Partial">Partial</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={totalAmount}
                  readOnly
                  className="w-full bg-gray-100 border border-gray-300 px-4 py-2 rounded-md text-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Already Paid</label>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Paying Amount (now)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter amount"
                    value={amountPayingNow}
                    onChange={(e) => setAmountPayingNow(Number(e.target.value || 0))}
                    className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                  />
                  {payingNow > remainingBeforeThisPayment && (
                    <p className="mt-2 text-sm text-red-600">
                      Please check your pending amount correctly.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Remaining Amount
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
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
          </section>

          {/* ===== Actions ===== */}
          <div className="flex justify-end gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
              disabled={saving}
            >
              ← Back
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`inline-flex items-center px-6 py-2 text-sm font-medium rounded-md ${
                saving ? "bg-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-900"
              } text-white`}
              onClick={(e) => {
                if (
                  (invoice.payment_status === "Partial" || invoice.payment_status === "Paid") &&
                  alreadyPaid + payingNow > totalAmount
                ) {
                  e.preventDefault();
                  alert("Please check your pending amount correctly.");
                }
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
