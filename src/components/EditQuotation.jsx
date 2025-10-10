// src/components/EditQuotation.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditQuotation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Choices (mirror EditProject tone)
  const companies = ["WT", "WTX", "WTPL", "WTXPL"];
  const paymentOptions = ["Pending", "Partial", "Paid"];

  // Options for chips
  const serviceOptions = useMemo(
    () =>
      [
        "Lyrical Videos",
        "Teasers",
        "Trailers",
        "Posters",
        "Promos",
        "Marketing",
        "Web Development",
        "Editing",
        "Meme Marketing",
        "Creative design",
        "Digital Creatives",
      ].map((s) => ({ value: s, label: s })),
    []
  );

  // --- UI helpers (same feel as EditProject) ---
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;
  const labelClass = (hasError) =>
    `block mb-2 font-semibold ${hasError ? "text-red-700" : "text-black"}`;
  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  const COMPANY_OPTIONS = companies.map((c) => ({ value: c, label: c }));
  const PAYMENT_OPTIONS = paymentOptions.map((p) => ({ value: p, label: p }));

  // --- Normalize: produce chip values from existing data (strings or {name}) ---
  const normalizeForEdit = (raw) => {
    const proforma_id = raw.proforma_id || raw.quotation_id || "";
    const proforma_date = raw.proforma_date || raw.quotation_date || raw.date || "";
    const proforma_title = raw.proforma_title || raw.quotation_title || "";
    const company = raw.proforma_type || raw.quotation_type || raw.company || "WT";
    const payment_status = raw.payment_status || "Pending";

    const names = Array.isArray(raw.services)
      ? raw.services
          .map((s) =>
            typeof s === "string" ? s : Array.isArray(s.name) ? s.name[0] : s.name
          )
          .filter(Boolean)
      : [];

    const servicesSelected = names.map((n) => ({ value: n, label: n }));

    return {
      ...raw,
      proforma_id,
      proforma_date,
      proforma_title,
      company,
      payment_status,
      servicesSelected, // react-select value ONLY
    };
  };

  // --- Fetch ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const ref = doc(db, "quotations", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("Document not found!");
          return navigate("/dashboard/all-quotations");
        }
        setDocData(normalizeForEdit(snap.data()));
      } catch (error) {
        console.error("Error fetching proforma:", error);
        alert("Something went wrong.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, navigate]);

  // --- Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        // ids/titles/dates
        proforma_id: docData.proforma_id || "",
        proforma_date: docData.proforma_date || "",
        proforma_title: docData.proforma_title || "",
        proforma_type: docData.company || "WT",

        // legacy mirrors
        quotation_id: docData.proforma_id || "",
        quotation_date: docData.proforma_date || "",
        quotation_title: docData.proforma_title || "",
        quotation_type: docData.company || "WT",

        // company & status
        company: docData.company || "WT",
        payment_status: docData.payment_status || "Pending",

        // services: array of strings (chips)
        services: (docData.servicesSelected || []).map((o) => o.value),
      };

      await updateDoc(doc(db, "quotations", id), payload);
      navigate("/dashboard/all-quotations");
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update.");
    }
  };

  if (loading || !docData) {
    return (
      <div className="bg-[#F4F6FF] p-[10px]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
            <h2 className="font-semibold text-[#000000] m-[0]">Edit Proforma</h2>
          </div>
          <div className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve">
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Title chip */}
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Edit Proforma</h2>
        </div>

        {/* Main form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Proforma Date */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Proforma Date</label>
              <input
                type="text"
                value={docData.proforma_date}
                onChange={(e) => setDocData({ ...docData, proforma_date: e.target.value })}
                className={`${inputClass(false)} border-curve`}
                placeholder="DD/MM/YYYY or YYYY-MM-DD"
              />
              {helpText("")}
            </div>

            {/* Proforma Title */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Proforma Title</label>
              <input
                type="text"
                value={docData.proforma_title}
                onChange={(e) => setDocData({ ...docData, proforma_title: e.target.value })}
                className={`${inputClass(false)} border-curve`}
                placeholder="e.g., Creative Services Quotation"
              />
              {helpText("")}
            </div>

            {/* Company */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Select Company</label>
              <Select
                options={COMPANY_OPTIONS}
                value={COMPANY_OPTIONS.find((o) => o.value === docData.company) || null}
                onChange={(opt) => setDocData({ ...docData, company: opt?.value || "WT" })}
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Payment Status */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Payment Status</label>
              <Select
                options={PAYMENT_OPTIONS}
                value={PAYMENT_OPTIONS.find((o) => o.value === docData.payment_status) || null}
                onChange={(opt) =>
                  setDocData({ ...docData, payment_status: opt?.value || "Pending" })
                }
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Services (chip multi-select) */}
            <div className="pl-[15px] pr-[15px] col-span-2 space-y-2">
              <label className={labelClass(false)}>Services</label>
              <Select
                isMulti
                closeMenuOnSelect={false}
                options={serviceOptions}
                value={docData.servicesSelected || []}
                onChange={(arr) => setDocData({ ...docData, servicesSelected: arr || [] })}
                placeholder="Select services"
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Submit */}
            <div className=" flex justify-center pl=[15px] pr-[15px] pt-[10px] pb-[10px] col-span-2">
              <button
                type="submit"
                className="bg-[#3b5997] text-[#ffffff] font-semibold  rounded-[10px] w-[30%] h-[40px] border-0"
              >
                Update Proforma
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ✅ Same clean light react-select styles as EditProject
const selectStylesLight = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "#fff",
    borderColor: state.isFocused ? "#c7d2fe" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(199,210,254,0.6)" : "none",
    minHeight: 48,
    borderRadius: 10,
    ":hover": { borderColor: "#d1d5db" },
    fontSize: 14,
  }),
  valueContainer: (b) => ({ ...b, padding: "6px 12px" }),
  input: (b) => ({ ...b, color: "#111827" }),
  placeholder: (b) => ({ ...b, color: "#9ca3af" }),
  singleValue: (b) => ({ ...b, color: "#111827" }),
  menu: (b) => ({ ...b, backgroundColor: "#fff", borderRadius: 10, overflow: "hidden" }),
  option: (b, s) => ({
    ...b,
    backgroundColor: s.isFocused ? "#f3f4f6" : "#fff",
    color: "#111827",
    cursor: "pointer",
  }),
  multiValue: (b) => ({ ...b, backgroundColor: "#eef2ff", borderRadius: 6 }),
  multiValueLabel: (b) => ({ ...b, color: "#3730a3", fontWeight: 600 }),
  multiValueRemove: (b) => ({
    ...b,
    ":hover": { backgroundColor: "#c7d2fe", color: "#111827", cursor: "pointer" },
  }),
  indicatorsContainer: (b) => ({ ...b, paddingRight: 8 }),
  indicatorsSeparator: () => ({ display: "none" }),
};
