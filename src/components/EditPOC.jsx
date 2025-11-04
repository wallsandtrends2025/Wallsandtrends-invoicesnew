// src/pages/EditPOC.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from "firebase/firestore";

export default function EditPOC() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- Loading + State ---
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Matches POCSignup shape
  const [poc, setPoc] = useState({
    company: "",
    poc_name: "",
    poc_id: "",
    project_ids: [], // array of project doc ids
  });

  const [errors, setErrors] = useState({
    company: "",
    poc_name: "",
    poc_id: "",
    project_ids: "",
  });

  // --- Projects dropdown data ---
  const [projectOptions, setProjectOptions] = useState([]); // [{value,label}]
  const [projectsLoadError, setProjectsLoadError] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(true);

  // ---- Company dropdown options (same as POCSignup) ----
  const companyOptions = useMemo(
    () => [
      { value: "WT", label: "WT" },
      { value: "WTPL", label: "WTPL" },
      { value: "WTX", label: "WTX" },
      { value: "WTXPL", label: "WTXPL" },
    ],
    []
  );

  // ===== Validation (mirror POCSignup) =====
  const pocIdRegex = /^[A-Za-z]{2,5}\d{2,4}$/;
  const validateCompany = (v) => (!v ? "Please select a company." : "");
  const validatePocName = (v) =>
    !v?.trim()
      ? "POC name is required."
      : v.trim().length < 3
      ? "POC name should be at least 3 characters."
      : "";
  const validatePocId = (v) => {
    const val = (v || "").toUpperCase().trim();
    if (!val) return "POC ID is required.";
    if (!pocIdRegex.test(val)) return "Invalid POC ID (e.g., WT120, WTX259, WTPL131).";
    return "";
  };
  const validateProjects = (ids) => (!ids?.length ? "Select at least one project." : "");

  const runFormValidation = (state) => {
    const e = {
      company: validateCompany(state.company),
      poc_name: validatePocName(state.poc_name),
      poc_id: validatePocId(state.poc_id),
      project_ids: validateProjects(state.project_ids),
    };
    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  // --- UI helpers (match your form styling) ---
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;

  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;

  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  const setField = (name, value) => {
    setPoc((prev) => ({ ...prev, [name]: value }));
    // live-clear error if user fixes
    if (errors[name]) {
      if (Array.isArray(value) ? value.length : String(value ?? "").trim()) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    }
  };

  const handleTextChange = (e) => {
    const { name, value } = e.target;
    if (name === "poc_name") {
      setField("poc_name", value);
      setErrors((p) => ({ ...p, poc_name: validatePocName(value) }));
      return;
    }
    if (name === "poc_id") {
      const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      setField("poc_id", v);
      setErrors((p) => ({ ...p, poc_id: validatePocId(v) }));
      return;
    }
  };

  // ---- Company dropdown handlers ----
  const selectedCompanyOption = useMemo(
    () => companyOptions.find((o) => o.value === poc.company) || null,
    [companyOptions, poc.company]
  );
  const handleCompanyChange = (opt) => {
    const value = opt?.value || "";
    setField("company", value);
    setErrors((p) => ({ ...p, company: validateCompany(value) }));
  };

  // Map current IDs to react-select value
  const selectedProjectOptions = useMemo(
    () => projectOptions.filter((opt) => poc.project_ids.includes(opt.value)),
    [projectOptions, poc.project_ids]
  );

  const handleProjectsChange = (opts) => {
    const ids = (opts || []).map((o) => o.value);
    setField("project_ids", ids);
    setErrors((p) => ({ ...p, project_ids: validateProjects(ids) }));
  };

  // --- Load POC + Projects ---
  useEffect(() => {
    (async () => {
      try {
        // Fetch POC
        const ref = doc(db, "pocs", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("POC not found!");
          navigate("/dashboard/all-pocs");
          return;
        }
        const data = snap.data() || {};

        // Fetch Projects (sorted by name)
        setLoadingProjects(true);
        const projQ = query(collection(db, "projects"), orderBy("projectName"));
        const projSnap = await getDocs(projQ);
        const opts = projSnap.docs.map((d) => {
          const proj = d.data() || {};
          const label = (proj.projectName || d.id).toString();
          return { value: d.id, label };
        });
        setProjectOptions(opts);
        setProjectsLoadError("");

        // Normalize legacy fields:
        // prefer project_ids; fallback to projects (legacy array of IDs)
        const initialProjectIds = Array.isArray(data.project_ids)
          ? data.project_ids
          : Array.isArray(data.projects)
          ? data.projects
          : [];

        setPoc({
          company: data.company || "",
          poc_name: data.poc_name || "",
          poc_id: (data.poc_id || "").toString().toUpperCase(),
          project_ids: initialProjectIds,
        });
      } catch (e) {
        console.error("Failed to load POC/Projects:", e);
        alert("Failed to load POC.");
        navigate("/dashboard/all-pocs");
      } finally {
        setLoading(false);
        setLoadingProjects(false);
      }
    })();
  }, [id, navigate]);

  // --- Save ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!runFormValidation(poc)) return;

    // derive project_names from selected options
    const project_names = projectOptions
      .filter((opt) => poc.project_ids.includes(opt.value))
      .map((opt) => opt.label);

    const payload = {
      company: poc.company,
      poc_name: poc.poc_name.trim(),
      poc_id: poc.poc_id.toUpperCase().trim(),
      project_ids: poc.project_ids,
      project_names,
      // keep legacy "projects" in sync if you still use it elsewhere (optional):
      // projects: poc.project_ids,
    };

    try {
      setSaving(true);
      await updateDoc(doc(db, "pocs", id), payload);
      navigate("/dashboard/all-pocs");
    } catch (e) {
      console.error("Update failed:", e);
      alert("Update failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F4F6FF] p-[10px]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
            <h2 className="font-semibold text-[#000000] m-[0]">Edit POC</h2>
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
          <h2 className="font-semibold text-[#000000] m-[0]">Edit POC</h2>
        </div>

        {/* Main form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          {/* Row 1: Company + Projects */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company */}
            <div className="pl-[15px] pr-[15px]">
              <label className={labelClass(!!errors.company)}>Select Company</label>
              <Select
                className="border-curve"
                classNamePrefix="rs"
                styles={selectStylesLight}
                options={companyOptions}
                value={companyOptions.find((o) => o.value === poc.company) || null}
                onChange={handleCompanyChange}
                isSearchable={false}
                placeholder="Select company"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
              {helpText(errors.company)}
            </div>

            {/* Projects */}
            <div className="pl-[15px] pr-[15px]">
              <label className={labelClass(!!errors.project_ids)}>POC Projects</label>
              <Select
                isMulti
                className="border-curve"
                classNamePrefix="rs"
                styles={selectStylesLight}
                options={projectOptions}
                value={selectedProjectOptions}
                onChange={handleProjectsChange}
                placeholder={
                  loadingProjects
                    ? "Loading projects…"
                    : projectOptions.length
                    ? "Select one or more projects"
                    : "No projects found"
                }
                isDisabled={loadingProjects || !!projectsLoadError}
                noOptionsMessage={() =>
                  loadingProjects ? "Loading..." : "No projects available"
                }
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
              {projectsLoadError && (
                <p className="text-red-600 text-sm mt-1">{projectsLoadError}</p>
              )}
              {helpText(errors.project_ids)}
            </div>
          </div>

          {/* Row 2: POC Name + POC ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* POC Name */}
            <div className="pl-[15px] pr-[15px]">
              <label className={labelClass(!!errors.poc_name)}>POC Name</label>
              <input
                name="poc_name"
                value={poc.poc_name}
                onChange={handleTextChange}
                className={`${inputClass(!!errors.poc_name)} border-curve`}
                placeholder="Full name"
                required
              />
              {helpText(errors.poc_name)}
            </div>

            {/* POC ID */}
            <div className="pl-[15px] pr-[15px]">
              <label className={labelClass(!!errors.poc_id)}>POC ID</label>
              <input
                name="poc_id"
                value={poc.poc_id}
                onChange={handleTextChange}
                className={`${inputClass(!!errors.poc_id)} border-curve`}
                placeholder="e.g., WT120 / WTX259 / WTPL131"
                maxLength={8}
                required
              />
              {helpText(errors.poc_id)}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-center pt-[10px] pb-[10px] mt-6">
            <div className="flex gap-3 w-full max-w-xs">
              <button
                type="submit"
                disabled={saving}
                className="bg-[#2f4fa1] text-[#ffffff] font-semibold rounded-[10px] flex-1 h-[40px] border-0 hover:opacity-95 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] flex-1 h-[40px] border-0 hover:opacity-95 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ✅ Clean light styles for react-select (same baseline as your forms)
const selectStylesLight = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "#fff",
    borderColor: state.isFocused ? "#e5e7eb" : "#e5e7eb",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(229,231,235,0.9)" : "none",
    minHeight: 44,
    borderRadius: 10,
    ":hover": { borderColor: "#e5e7eb" },
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
