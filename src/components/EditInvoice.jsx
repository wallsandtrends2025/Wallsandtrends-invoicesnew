import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import Select from "react-select";

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState({
    invoice_id: "",
    client_id: "",
    invoice_title: "",
    invoice_date: "",      // will be YYYY-MM-DD
    payment_date: "",      // will be YYYY-MM-DD
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
  });

  // 👉 Fields that should render as a calendar picker
  const dateFields = new Set(["invoice_date", "payment_date"]);

  // Helper: normalize Firestore Timestamp/Date/string to YYYY-MM-DD for <input type="date" />
  const toYMD = (val) => {
    if (!val) return "";
    if (typeof val === "string") {
      // Expecting ISO-like string; trim to YYYY-MM-DD if longer
      return val.slice(0, 10);
    }
    if (val?.seconds) {
      // Firestore Timestamp
      const d = new Date(val.seconds * 1000);
      return d.toISOString().slice(0, 10);
    }
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    return "";
  };

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

  useEffect(() => {
    const fetchInvoice = async () => {
      const ref = doc(db, "invoices", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        delete data.pdf_url;
        delete data.created_at;

        // Normalize date fields for the calendar input
        data.invoice_date = toYMD(data.invoice_date);
        data.payment_date = toYMD(data.payment_date);

        setInvoice((prev) => ({ ...prev, ...data }));
      }
    };
    fetchInvoice();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // If you want number fields to stay numeric in state (optional):
    const numberFields = new Set(["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount"]);
    if (numberFields.has(name)) {
      setInvoice((prev) => ({ ...prev, [name]: value === "" ? "" : Number(value) }));
      return;
    }

    // Date inputs already give YYYY-MM-DD strings; keep as-is
    setInvoice((prev) => ({ ...prev, [name]: value }));
  };

  const handleServiceChange = (selectedOptions) => {
    const formatted = (selectedOptions || []).map((opt) => ({ name: opt.value }));
    setInvoice((prev) => ({ ...prev, services: formatted }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // If your Firestore expects strings for dates, this is fine.
    // If you prefer Firestore Timestamp, convert here (optional).
    // Example:
    // import { Timestamp } from "firebase/firestore";
    // const toTimestamp = (ymd) => (ymd ? Timestamp.fromDate(new Date(`${ymd}T00:00:00`)) : null);

    const ref = doc(db, "invoices", id);
    await updateDoc(ref, {
      ...invoice,
      // invoice_date: toTimestamp(invoice.invoice_date),
      // payment_date: toTimestamp(invoice.payment_date),
    });

    navigate("/dashboard/all-invoices");
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex justify-center items-start">
      <div className="w-full max-w-2xl bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Edit Invoice</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {Object.keys(invoice).map((field) => {
            const isServiceField = field === "services";
            const isPaymentStatus = field === "payment_status";

            return (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </label>

                {isPaymentStatus ? (
                  <select
                    name="payment_status"
                    value={invoice.payment_status}
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                    required
                  >
                    <option value="" disabled>
                      Select Status
                    </option>
                    <option value="Pending">Pending</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid">Paid</option>
                  </select>
                ) : isServiceField ? (
                  <Select
                    isMulti
                    name="services"
                    value={(invoice.services || []).map((s) => ({
                      label: s.name,
                      value: s.name,
                    }))}
                    onChange={handleServiceChange}
                    options={serviceOptions}
                    className="basic-multi-select"
                    classNamePrefix="select"
                  />
                ) : dateFields.has(field) ? (
                  <input
                    type="date"
                    name={field}
                    value={invoice[field] || ""} // YYYY-MM-DD
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                    required
                  />
                ) : (
                  <input
                    type={
                      ["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount"].includes(field)
                        ? "number"
                        : "text"
                    }
                    step={["subtotal", "cgst", "sgst", "igst", "tax_amount", "total_amount"].includes(field) ? "0.01" : undefined}
                    name={field}
                    value={
                      typeof invoice[field] === "object"
                        ? JSON.stringify(invoice[field])
                        : invoice[field] ?? ""
                    }
                    onChange={handleChange}
                    className="w-full border border-gray-300 px-4 py-2 rounded-md focus:ring-2 focus:ring-black focus:outline-none"
                    required
                  />
                )}
              </div>
            );
          })}

          <div className="flex justify-end gap-4 pt-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              ← Back
            </button>

            <button
              type="submit"
              className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-md bg-black text-white hover:bg-gray-900"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
