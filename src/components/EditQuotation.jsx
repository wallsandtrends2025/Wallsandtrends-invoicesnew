import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export default function EditQuotation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);

  // same options; keep your existing choices
  const companies = ["WT", "WTX", "WTPL", "WTXPL"];
  const paymentOptions = ["Pending", "Partial", "Paid"];
  const serviceOptions = [
    { value: "Lyrical Videos", label: "Lyrical Videos" },
    { value: "Teasers", label: "Teasers" },
    { value: "Trailers", label: "Trailers" },
    { value: "Posters", label: "Posters" },
    { value: "Promos", label: "Promos" },
    { value: "Marketing", label: "Marketing" },
    { value: "Web Development", label: "Web Development" },
    { value: "Editing", label: "Editing" },
    { value: "Meme Marketing", label: "Meme Marketing" },
    { value: "Creative design", label: "Creative design" },
  ];

  // normalize incoming record to a consistent shape for editing
  const normalizeForEdit = (raw) => {
    const proforma_id = raw.proforma_id || raw.quotation_id || "";
    const proforma_date = raw.proforma_date || raw.quotation_date || raw.date || "";
    const proforma_title = raw.proforma_title || raw.quotation_title || "";
    const company = raw.proforma_type || raw.quotation_type || raw.company || "";
    const payment_status = raw.payment_status || "Pending";

    // services: if name is array (from multi-select), pick first for single-select display
    const services = (raw.services || []).map((s) => {
      const nameStr = Array.isArray(s.name) ? (s.name[0] || "") : (s.name || "");
      return {
        ...s,
        // for react-select single
        serviceType: nameStr ? { value: nameStr, label: nameStr } : null,
        description: s.description || "",
        amount: s.amount || "",
      };
    });

    return {
      ...raw,
      proforma_id,
      proforma_date,
      proforma_title,
      company,
      payment_status,
      services,
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ref = doc(db, "quotations", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("Document not found!");
          return navigate("/dashboard/all-quotations");
        }

        const normalized = normalizeForEdit(snap.data());
        setDocData(normalized);
      } catch (error) {
        console.error("Error fetching proforma:", error);
        alert("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleServiceChange = (index, field, value) => {
    const updated = [...docData.services];
    if (field === "serviceType") {
      updated[index].serviceType = value;
      updated[index].name = value?.value || "";
    } else {
      updated[index][field] = value;
    }
    setDocData({ ...docData, services: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // prepare services back to persisted shape
      const persistedServices = (docData.services || []).map((s) => ({
        name: s.serviceType?.value || s.name || "",
        description: s.description || "",
        amount: s.amount ? Number(s.amount) : 0,
      }));

      // write BOTH proforma_* and quotation_* for backward compatibility
      const payload = {
        ...docData,
        proforma_id: docData.proforma_id,
        proforma_date: docData.proforma_date,
        proforma_title: docData.proforma_title,
        proforma_type: docData.company,

        // legacy mirrors
        quotation_id: docData.proforma_id,
        quotation_date: docData.proforma_date,
        quotation_title: docData.proforma_title,
        quotation_type: docData.company,

        company: docData.company,
        payment_status: docData.payment_status || "Pending",
        services: persistedServices,
      };

      await updateDoc(doc(db, "quotations", id), payload);
      navigate("/dashboard/all-quotations");
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update.");
    }
  };

  if (loading || !docData) {
    return <p className="text-center p-6">Loading...</p>;
  }

  return (
    <div className="min-h-screen bg-black flex justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 text-white rounded-xl shadow-xl p-8 w-full max-w-4xl"
      >
        {/* Heading changed */}
        <h2 className="text-3xl font-bold text-center mb-8">Edit Proforma</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Proforma Date */}
          <div>
            <label className="block text-sm font-medium mb-1">Proforma Date</label>
            <input
              type="text"
              value={docData.proforma_date}
              onChange={(e) => setDocData({ ...docData, proforma_date: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            />
          </div>

          {/* Proforma Title */}
          <div>
            <label className="block text-sm font-medium mb-1">Proforma Title</label>
            <input
              type="text"
              value={docData.proforma_title}
              onChange={(e) => setDocData({ ...docData, proforma_title: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium mb-1">Select Company</label>
            <select
              value={docData.company}
              onChange={(e) => setDocData({ ...docData, company: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Payment Status</label>
            <select
              value={docData.payment_status}
              onChange={(e) => setDocData({ ...docData, payment_status: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {paymentOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Services */}
        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-semibold text-white">Services</h3>

          {docData.services.map((s, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Name</label>
                <Select
                  options={serviceOptions}
                  value={s.serviceType}
                  onChange={(val) => handleServiceChange(index, "serviceType", val)}
                  styles={selectStyles}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={s.description || ""}
                  onChange={(e) => handleServiceChange(index, "description", e.target.value)}
                  className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={s.amount || ""}
                  onChange={(e) => handleServiceChange(index, "amount", e.target.value)}
                  className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="update-project-btn mt-10 mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold tracking-wide py-3 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out"
        >
          Update Proforma
        </button>
      </form>
    </div>
  );
}

const selectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: "#1f2937",
    borderColor: "#374151",
    color: "#fff",
  }),
  input: (base) => ({ ...base, color: "white" }),
  singleValue: (base) => ({ ...base, color: "white" }),
  multiValue: (base) => ({ ...base, backgroundColor: "#374151" }),
  multiValueLabel: (base) => ({ ...base, color: "white" }),
  menu: (base) => ({ ...base, backgroundColor: "#111827" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#374151" : "#111827",
    color: "white",
  }),
};
