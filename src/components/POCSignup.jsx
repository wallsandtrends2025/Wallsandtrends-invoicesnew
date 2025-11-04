import { useEffect, useMemo, useState } from "react";
import { doc, setDoc, Timestamp, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import Select from "react-select";

export default function POCSignup() {
  const initialPoc = { company: "", poc_name: "", poc_id: "", project_ids: [] };
  const initialErrors = { company: "", poc_name: "", poc_id: "", project_ids: "" };

  const [poc, setPoc] = useState(initialPoc);
  const [errors, setErrors] = useState(initialErrors);

  // react-select options built from Firestore
  const [projectOptions, setProjectOptions] = useState([]); // [{ value: id, label: name }]
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsLoadError, setProjectsLoadError] = useState("");

  const navigate = useNavigate();

  // ---- Company dropdown options ----
  const companyOptions = useMemo(
    () => [
      { value: "WT", label: "WT" },
      { value: "WTPL", label: "WTPL" },
      { value: "WTX", label: "WTX" },
      { value: "WTXPL", label: "WTXPL" },
    ],
    []
  );

  // Load all projects (sorted)
  useEffect(() => {
    (async () => {
      try {
        setLoadingProjects(true);
        const qy = query(collection(db, "projects"), orderBy("projectName"));
        const snap = await getDocs(qy);
        const opts = snap.docs.map((d) => {
          const data = d.data() || {};
          const label = (data.projectName || d.id).toString();
          return { value: d.id, label };
        });
        setProjectOptions(opts);
      } catch (e) {
        console.error(e);
        setProjectsLoadError("Could not load projects. Please refresh.");
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, []);

  // ===== Validation =====
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

  // ===== UI helpers =====
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;
  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;
  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  // react-select theme to match inputs
  const rsStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 44,
      height: "auto",
      borderRadius: 10,
      borderColor: state.isFocused ? "#e5e7eb" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(229,231,235,0.9)" : "none",
      ":hover": { borderColor: "#e5e7eb" },
    }),
    valueContainer: (base) => ({ ...base, minHeight: 44, padding: "0 12px" }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    indicatorsContainer: (base) => ({ ...base, height: 44 }),
    multiValue: (base) => ({ ...base, borderRadius: 6 }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
    menu: (base) => ({ ...base, borderRadius: 10, overflow: "hidden" }),
  };

  const setField = (name, value) => {
    setPoc((prev) => ({ ...prev, [name]: value }));
    if (errors[name] && (Array.isArray(value) ? value.length : String(value).trim())) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
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

  const clearForm = (e) => {
    e?.preventDefault?.();
    setPoc(initialPoc);
    setErrors(initialErrors);
    console.log("Clear form clicked - cleared POC form as requested");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const companyErr = validateCompany(poc.company);
    const nameErr = validatePocName(poc.poc_name);
    const idErr = validatePocId(poc.poc_id);
    const projErr = validateProjects(poc.project_ids);

    setErrors((prev) => ({
      ...prev,
      company: companyErr,
      poc_name: nameErr,
      poc_id: idErr,
      project_ids: projErr,
    }));

    if (companyErr || nameErr || idErr || projErr) return;

    const project_names = projectOptions
      .filter((opt) => poc.project_ids.includes(opt.value))
      .map((opt) => opt.label);

    // Include company in doc id to avoid collisions
    const rawId = `${poc.company}_${poc.poc_id}_${poc.poc_name}`.trim();
    const docId = rawId.replace(/\s+/g, "_").replace(/[#/\\?%*:|"<>.]/g, "_");

    const finalData = {
      company: poc.company,
      poc_name: poc.poc_name.trim(),
      poc_id: poc.poc_id.toUpperCase().trim(),
      project_ids: poc.project_ids,
      project_names,
      created_at: Timestamp.now(),
    };

    try {
      await setDoc(doc(db, "pocs", docId), finalData);
      navigate("/dashboard/all-pocs");
    } catch (err) {
      console.error(err);
      alert("Submission failed.");
    }
  };

  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Title chip */}
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">POC Registration Form</h2>
        </div>

        {/* Main form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          {/* Row 1: Company (left) + Projects (right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Select Company */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.company)}>Select Company</label>
              <Select
                className="border-curve"
                classNamePrefix="rs"
                styles={rsStyles}
                options={companyOptions}
                value={selectedCompanyOption}
                onChange={handleCompanyChange}
                isSearchable={false}
                placeholder="Select company"
              />
              {helpText(errors.company)}
            </div>

            {/* POC Projects – react-select multi with chips */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.project_ids)}>POC Projects</label>
              <Select
                isMulti
                className="border-curve"
                classNamePrefix="rs"
                styles={rsStyles}
                options={projectOptions}
                value={selectedProjectOptions}
                onChange={handleProjectsChange}
                placeholder="Select one or more projects"
                isSearchable
                isDisabled={loadingProjects || !!projectsLoadError}
                noOptionsMessage={() => (loadingProjects ? "Loading..." : "No projects available")}
              />
              {projectsLoadError && <p className="text-red-600 text-sm mt-1">{projectsLoadError}</p>}
              {!loadingProjects && projectOptions.length === 0 && !projectsLoadError && (
                <p className="text-gray-500 text-sm mt-1">
                  No projects found. Add some in <strong>Add Project</strong> first.
                </p>
              )}
              {helpText(errors.project_ids)}
            </div>
          </div>

          {/* Row 2: POC Name + POC ID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* POC Name */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
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
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
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

          {/* Submit + Clear */}
          <div className="flex justify-center pt-[10px] pb-[10px] mt-6">
            <div className="flex gap-3 w-full max-w-xs">
              <button
                type="submit"
                className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] flex-1 h-[40px] border-0 hover:bg-[#3b5997] transition-colors"
              >
                Submit
              </button>

              <button
                type="button"
                onClick={clearForm}
                className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] flex-1 h-[40px] border-0 hover:bg-[#3b5997] transition-colors"
              >
                Clear form
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
