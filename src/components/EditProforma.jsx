// src/components/EditProforma.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { InputSanitizer } from "../utils/sanitization";

// 🔁 Try these list paths in order until one succeeds
const CANDIDATE_LIST_PATHS = [
  "/dashboard/proformas",
  "/dashboard/quotations",
  "/dashboard/proforma-list",
  "/dashboard/proforma",
  "/dashboard/quotation-list",
];

export default function EditProforma() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);

  const companies = ["WT", "WTX", "WTPL", "WTXPL"];
  const paymentOptions = ["Pending", "Partial", "Paid"];

  const serviceOptions = useMemo(
    () =>
      [
        "Lyrical Videos","Posters","Digital Creatives","Motion Posters",
        "Title Animations","Marketing","Editing","Teaser","Trailer",
        "Promos","Google Ads","YouTube Ads","Influencer Marketing",
        "Meme Marketing","Open and end titles","Pitch Deck","Branding",
        "Strategy & Marketing","Creative design & editing","Digital Marketing",
        "Content & video production","Performance Marketing","Web Development",
        "Ad Film","Brand Film","Corporate Film","Shoot Camera Equipment",
      ].map((s) => ({ value: s, label: s })),
    []
  );

  const inputClass = (hasError) =>
    `border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;
  const labelClass = (hasError) =>
    `block mb-2 font-semibold ${hasError ? "text-red-700" : "text-black"}`;
  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  const COMPANY_OPTIONS = companies.map((c) => ({ value: c, label: c }));
  const PAYMENT_OPTIONS = paymentOptions.map((p) => ({ value: p, label: p }));

  const normalizeServices = (rawServices) => {
    if (!Array.isArray(rawServices)) return [];
    return rawServices.map((row) => {
      if (typeof row === "string") {
        return { name: [row], description: "", amount: 0 };
      }
      const name =
        Array.isArray(row?.name)
          ? row.name.filter(Boolean)
          : typeof row?.name === "string"
          ? row.name.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
      return {
        name,
        description: String(row?.description ?? ""),
        amount: Number(row?.amount ?? 0),
      };
    });
  };

  const normalizeForEdit = (raw) => {
    const proforma_id = raw.proforma_id || raw.quotation_id || "";
    const proforma_date = raw.proforma_date || raw.quotation_date || raw.date || "";
    const proforma_title = raw.proforma_title || raw.quotation_title || "";
    const company = raw.proforma_type || raw.quotation_type || raw.company || "WT";
    const payment_status = raw.payment_status || "Pending";
    const services = normalizeServices(raw.services);

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
          hardRedirectToAnyList();
          return;
        }
        setDocData(normalizeForEdit(snap.data()));
      } catch (error) {
        console.error("Error fetching proforma:", error);
        alert("Something went wrong.");
        hardRedirectToAnyList();
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---- Robust redirect helpers ----
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const tryNavigateSpa = async (path) => {
    const before = window.location.pathname;
    navigate(path, { replace: true });
    await sleep(150);
    return window.location.pathname === path || window.location.pathname !== before;
  };

  const goBackFirst = async () => {
    const before = window.location.pathname;
    // history back works if user came from list
    navigate(-1);
    await sleep(150);
    return window.location.pathname !== before;
  };

  const hardRedirectToAnyList = () => {
    // last resort: force full reload to the first candidate
    window.location.assign(CANDIDATE_LIST_PATHS[0]);
  };

  const redirectToList = async () => {
    // 1) try going back
    if (await goBackFirst()) return;

    // 2) try each known list route via SPA navigate
    for (const path of CANDIDATE_LIST_PATHS) {
      const ok = await tryNavigateSpa(path);
      if (ok) return;
    }

    // 3) force reload
    hardRedirectToAnyList();
  };
  // ---------------------------------

  const updateService = (idx, patch) => {
    setDocData((prev) => {
      const next = [...(prev.services || [])];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, services: next };
    });
  };

  const addService = () =>
    setDocData((prev) => ({
      ...prev,
      services: [...(prev.services || []), { name: [], description: "", amount: 0 }],
    }));

  const removeService = (idx) =>
    setDocData((prev) => {
      const next = [...(prev.services || [])];
      next.splice(idx, 1);
      return { ...prev, services: next };
    });

  const sanitizedServices = useMemo(
    () =>
      (docData?.services || []).map((s) => ({
        name: (Array.isArray(s.name) ? s.name : []).filter(Boolean).join(", "),
        description: String(s.description || ""),
        amount: Number(s.amount || 0),
      })),
    [docData?.services]
  );

  const subtotal = useMemo(
    () => sanitizedServices.reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [sanitizedServices]
  );

  // GST calculation logic (similar to preview)
  const toLower = (s) => (s || "").toString().trim().toLowerCase();
  const clientCountry = toLower(docData?.client_country || "india");
  const clientState = toLower(docData?.client_state || "telangana");
  const isIndian = clientCountry === "india";
  const isTelangana = isIndian && clientState === "telangana";

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isTelangana) {
    cgstRate = 9;
    sgstRate = 9;
  } else if (isIndian) {
    igstRate = 18;
  }

  const cgstAmount = +(subtotal * (cgstRate / 100)).toFixed(2);
  const sgstAmount = +(subtotal * (sgstRate / 100)).toFixed(2);
  const igstAmount = +(subtotal * (igstRate / 100)).toFixed(2);
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const total_amount = subtotal; // Keep total_amount as subtotal for preview consistency

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const servicesStructured = (docData.services || []).map((row) => ({
        name: Array.isArray(row?.name) ? row.name.filter(Boolean) : [],
        description: String(row?.description || ""),
        amount: Number(row?.amount || 0),
      }));
      const servicesFlat = servicesStructured.flatMap((r) => r.name).filter(Boolean);

      const payload = {
        proforma_id: docData.proforma_id || "",
        proforma_date: docData.proforma_date || "",
        proforma_title: docData.proforma_title || "",
        proforma_type: docData.company || "WT",

        // legacy mirrors
        quotation_id: docData.proforma_id || "",
        quotation_date: docData.proforma_date || "",
        quotation_title: docData.proforma_title || "",
        quotation_type: docData.company || "WT",

        company: docData.company || "WT",
        payment_status: docData.payment_status || "Pending",

        services: servicesStructured,
        services_flat: servicesFlat,

        subtotal: Number(subtotal.toFixed(2)),
        cgst: Number(cgstAmount.toFixed(2)),
        sgst: Number(sgstAmount.toFixed(2)),
        igst: Number(igstAmount.toFixed(2)),
        total_amount: Number(subtotal.toFixed(2)), // Save subtotal as total_amount for preview consistency
      };

      await updateDoc(doc(db, "quotations", id), payload);

      // 💡 NOW: aggressively redirect to a valid list page
      await redirectToList();
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
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Edit Proforma</h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          <div className="grid grid-cols-2 gap-6">
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

            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Proforma Title</label>
              <input
                type="text"
                value={docData.proforma_title}
                onChange={(e) => setDocData({ ...docData, proforma_title: InputSanitizer.sanitizeText(e.target.value) })}
                className={`${inputClass(false)} border-curve`}
                placeholder="e.g., Creative Services Quotation"
              />
              {helpText("")}
            </div>

            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Select Company</label>
              <Select
                options={COMPANY_OPTIONS}
                value={COMPANY_OPTIONS.find((o) => o.value === docData.company) || null}
                onChange={(opt) => setDocData({ ...docData, company: opt?.value || "WT" })}
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
              />
            </div>

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
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
              />
            </div>
          </div>

          {/* Services */}
          <div className="my-8 border-t border-gray-200" />
          <div className="mb-2 flow-root">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Services</h3>

            {(docData.services || []).map((row, idx) => (
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
                    onChange={(opts) => updateService(idx, { name: (opts || []).map((o) => o.value) })}
                    placeholder="Select Service(s)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Description
                  </label>
                  <textarea
                    value={row.description || ""}
                    onChange={(e) => updateService(idx, { description: InputSanitizer.sanitizeText(e.target.value) })}
                    className=" border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    rows={3}
                    placeholder="Enter Service Description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Amount ₹
                  </label>
                  <input
                    type="number"
                    value={row.amount || ""}
                    onChange={(e) => updateService(idx, { amount: Number(e.target.value || 0) })}
                    className="border border-gray-300 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Enter amount"
                  />
                </div>

                {(docData.services || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeService(idx)}
                    className="inline-flex items-center justify-center h-[40px] px-6 rounded-full font-semibold text-[#ffffff] bg-[#3b5998] hover:bg-[#2f497e] shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Remove Service
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addService}
              className="inline-flex items-center justify-center h-[40px] px-6 rounded-full font-semibold text-[#ffffff] bg-[#3b5998] hover:bg-[#2f497e] shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {docData.services?.length ? "Add Another Service" : "Add Service"}
            </button>
          </div>

          {/* Totals */}
          <div className="my-8 border-t border-gray-200" />
          <div className="mb-10 flow-root">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Totals</h3>
            <div className="flow-root bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="mb-1">
                <b>Subtotal:</b>{" "}
                ₹{new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(subtotal)}
              </p>
              {isTelangana && (
                <>
                  <p className="mb-1">
                    <b>CGST @ {cgstRate}%:</b>{" "}
                    ₹{new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cgstAmount)}
                  </p>
                  <p className="mb-1">
                    <b>SGST @ {sgstRate}%:</b>{" "}
                    ₹{new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(sgstAmount)}
                  </p>
                </>
              )}
              {isIndian && !isTelangana && (
                <p className="mb-1">
                  <b>IGST @ {igstRate}%:</b>{" "}
                  ₹{new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(igstAmount)}
                </p>
              )}
              <p className="mb-0">
                <b>Total Amount:</b>{" "}
                ₹{new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(subtotal + totalTax)}
              </p>
            </div>
          </div>

          <div className="flex justify-center pt-[10px] pb-[10px]">
            <button
              type="submit"
              className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] w-[30%] h-[40px] border-0"
            >
              Update Proforma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// react-select light styles
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

// react-select styles for service row
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