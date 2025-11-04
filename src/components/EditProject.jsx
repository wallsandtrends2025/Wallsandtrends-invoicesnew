// src/components/EditProject.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- Loading + State ---
  const [loading, setLoading] = useState(true);

  const [project, setProject] = useState({
    id: "",
    projectName: "",
    company: "",           // WT | WTPL | WTX | WTXPL
    clientId: null,        // react-select option { value, label }
    poc: "",               // "Name - WT###"
    movieName: "",
    brandName: "",
    services: [],          // react-select options
    invoiceIds: [],        // react-select options
    quotationIds: [],      // react-select options
    // ✨ Editable client POC fields (saved on project)
    client_poc_name: "",
    client_poc_phone: "",
    client_poc_email: "",
  });

  const [errors, setErrors] = useState({
    projectName: "",
    company: "",
    clientId: "",
    poc: "",
    movieName: "",
    brandName: "",
  });

  // --- Dropdown data ---
  const [clientsData, setClientsData] = useState({}); // { [id]: doc.data() }
  const [invoiceOptions, setInvoiceOptions] = useState([]);     // [{value,label}]
  const [quotationOptions, setQuotationOptions] = useState([]); // [{value,label}]

  // ----- Service options (as Select options) -----
  const serviceOptions = [
    "Lyrical Videos","Posters","Digital Creatives","Motion Posters","Title Animations",
    "Marketing","Editing","Teaser","Trailer","Promos","Google Ads","YouTube Ads",
    "Influencer Marketing","Meme Marketing","Open and end titles","Pitch Deck","Branding",
    "Strategy & Marketing","Creative design & editing","Digital Marketing",
    "Content & video production","Performance Marketing","Web Development",
    "Ad Film","⁠Brand Film","⁠Corporate Film","⁠Teaser + Trailer + Business cut",
  ].map((s) => ({ label: s, value: s }));

  // ----- Company grouping (strict) -----
  const COMPANY_OPTIONS = ["WT", "WTPL", "WTX", "WTXPL"].map((c) => ({ label: c, value: c }));
  const isWTGroup  = (c) => ["WT", "WTPL"].includes(c);
  const isWTXGroup = (c) => ["WTX", "WTXPL"].includes(c);

  const companyToGroup = { WT: "WT", WTPL: "WT", WTX: "WTX", WTXPL: "WTX" };
  const normalize = (s) => String(s || "").toUpperCase().trim();

  const isClientInCompanyGroup = (clientDoc, comp) => {
    if (!comp) return false;
    const targetGroup = companyToGroup[comp];
    if (!targetGroup) return false;

    const cg = normalize(clientDoc.company_group);
    const cn = normalize(clientDoc.company_name);

    if (cg) return cg === normalize(targetGroup);
    if (targetGroup === "WT")  return cn === "WT"  || cn === "WTPL";
    if (targetGroup === "WTX") return cn === "WTX" || cn === "WTXPL";
    return false;
  };

  const filteredClientOptions = useMemo(() => {
    if (!project.company) return [];
    return Object.entries(clientsData)
      .filter(([, data]) => isClientInCompanyGroup(data, project.company))
      .map(([id, data]) => ({ value: id, label: data.client_name ? data.client_name : id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientsData, project.company]);

  // ----- POC lists -----
  const WT_WTPL_POCs_BASE = [
    "Suryadevara Veda sai Krishna WT120",
    "Koduru Abhilash Reddy WT146",
    "Sajja Seshasai WT131",
  ];
  const WTX_WTXPL_POCs_BASE = [
    "Lingareddy Navya WT122",
    "Rohith Gali WT259",
    "Mohit Vamsi WT274",
    "Anouska Panda WT286",
    "Kamya Mogulagani WT262",
    "Varshini Suragowni WT263",
    "Addanki Sai Durga WT284",
    "Sharvana Sandhya WT266",
    "Vineel Raj WT321",
  ];
  const formatPoc = (entry) => {
    if (!entry) return "";
    const parts = String(entry).trim().split(/\s+/);
    const code = parts.pop();
    const name = parts.join(" ");
    return code && name ? `${name} - ${code}` : String(entry);
  };
  const normalizeToFormattedPoc = (raw) => {
    if (!raw) return "";
    const s = String(raw).trim();
    if (/\s-\s[A-Za-z]{2,}\d{2,}$/i.test(s)) return s;
    if (/\s[A-Za-z]{2,}\d{2,}$/i.test(s)) return formatPoc(s);
    return s;
  };
  const mapShortPocToFull = (shortName, comp) => {
    if (!shortName) return "";
    const base = isWTGroup(comp) ? WT_WTPL_POCs_BASE : WTX_WTXPL_POCs_BASE;
    const list = base.map(formatPoc);
    const lower = shortName.toLowerCase().trim();
    return (
      list.find((lbl) => lbl.toLowerCase().startsWith(lower)) ||
      list.find((lbl) => lbl.toLowerCase().includes(lower)) ||
      shortName
    );
  };
  const pocOptions = useMemo(() => {
    const base = isWTGroup(project.company) ? WT_WTPL_POCs_BASE : WTX_WTXPL_POCs_BASE;
    return base.map(formatPoc).map((label) => ({ label, value: label }));
  }, [project.company]);

  // --- UI helpers ---
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;
  const labelClass = (hasError) => `block mb-2 font-semibold ${hasError ? "text-red-700" : "text-black"}`;
  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  const setField = (name, value) => {
    setProject((prev) => ({ ...prev, [name]: value }));
    if (errors[name] && (Array.isArray(value) ? value.length : String(value ?? "").trim())) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // --- Validation (movie/brand required based on company) ---
  const validateRequired = (label, raw) =>
    (Array.isArray(raw) ? raw.length : String(raw || "").trim()) ? "" : `${label} is required.`;

  const runFormValidation = (state) => {
    const e = { ...errors };
    e.projectName = validateRequired("Project Name", state.projectName);
    e.company = validateRequired("Company", state.company);
    e.clientId = state.clientId?.value ? "" : "Client is required.";

    const allowed = new Set(pocOptions.map((o) => o.value));
    const normalizedPoc = normalizeToFormattedPoc(state.poc);
    e.poc = normalizedPoc && allowed.has(normalizedPoc) ? "" : "Please select a valid POC for the chosen company.";

    if (isWTGroup(state.company)) {
      e.movieName = validateRequired("Movie Name", state.movieName);
      e.brandName = "";
    } else if (isWTXGroup(state.company)) {
      e.brandName = validateRequired("Brand Name", state.brandName);
      e.movieName = "";
    } else {
      e.movieName = "";
      e.brandName = "";
    }

    setErrors(e);
    return !Object.values(e).some(Boolean);
  };

  // --- Fetch project + dropdowns ---
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const projectRef = doc(db, "projects", id);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          alert("Project not found!");
          return navigate("/dashboard/all-projects");
        }
        const projectData = projectSnap.data();

        const [clientsSnap, invoicesSnap, quotationsSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "invoices")),
          getDocs(collection(db, "quotations")),
        ]);

        const cMap = {};
        clientsSnap.forEach((d) => (cMap[d.id] = d.data() || {}));
        setClientsData(cMap);

        const invoicesForProject = invoicesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((inv) => inv.project_id === id);

        const quotationsForProject = quotationsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((q) => q.project_id === id);

        const invOptions = invoicesForProject.map((i) => ({ value: i.id, label: i.invoice_id || i.id }));
        const qtnOptions = quotationsForProject.map((q) => ({ value: q.id, label: q.quotation_id || q.id }));

        setInvoiceOptions(invOptions);
        setQuotationOptions(qtnOptions);

        const allClientOptions = Object.entries(cMap).map(([cid, data]) => ({
          value: cid,
          label: data.client_name ? data.client_name : cid,
        }));

        const clientIdRaw = projectData.clientId || projectData.client_id || projectData.client || projectData.clientID;
        const clientOption = allClientOptions.find((opt) => opt.value === clientIdRaw) || null;

        const normalizedPoc = normalizeToFormattedPoc(projectData.poc);

        // Prefill editable POC fields:
        // Priority: project’s stored values -> client doc values -> empty
        const fromClient = clientOption ? cMap[clientOption.value] : null;

        setProject({
          id: projectSnap.id,
          projectName: projectData.projectName || "",
          company: projectData.company || "",
          clientId: clientOption,
          poc: normalizedPoc || "",
          movieName: projectData.movieName || "",
          brandName: projectData.brandName || "",
          services: Array.isArray(projectData.services)
            ? projectData.services.map((sv) => ({ label: sv, value: sv }))
            : [],
          invoiceIds: Array.isArray(projectData.invoiceIds)
            ? projectData.invoiceIds.map((invId) => invOptions.find((o) => o.value === invId)).filter(Boolean)
            : [],
          quotationIds: Array.isArray(projectData.quotationIds)
            ? projectData.quotationIds.map((qId) => qtnOptions.find((o) => o.value === qId)).filter(Boolean)
            : [],
          client_poc_name: projectData.client_poc_name ?? fromClient?.client_poc_name ?? "",
          client_poc_phone: projectData.client_poc_phone ?? fromClient?.client_poc_phone ?? "",
          client_poc_email: projectData.client_poc_email?.trim?.() ?? (fromClient?.client_poc_email || "").trim() ?? "",
        });

        setErrors({
          projectName: "",
          company: "",
          clientId: "",
          poc: "",
          movieName: "",
          brandName: "",
        });

        setLoading(false);
      } catch (err) {
        console.error("Error loading project:", err);
        alert("Failed to load project.");
      }
    };

    fetchAll();
  }, [id, navigate]);

  // --- Handlers ---
  const onCompanyChange = (opt) => {
    const nextCompany = opt?.value || "";
    setProject((prev) => {
      const currClientValid =
        prev.clientId &&
        clientsData[prev.clientId.value] &&
        isClientInCompanyGroup(clientsData[prev.clientId.value], nextCompany);

      const allowedNext = new Set(
        (isWTGroup(nextCompany) ? WT_WTPL_POCs_BASE : WTX_WTXPL_POCs_BASE).map(formatPoc)
      );
      const nextPoc = allowedNext.has(normalizeToFormattedPoc(prev.poc))
        ? normalizeToFormattedPoc(prev.poc)
        : "";

      return {
        ...prev,
        company: nextCompany,
        clientId: currClientValid ? prev.clientId : null,
        poc: nextPoc,
        movieName: isWTGroup(nextCompany) ? prev.movieName : "",
        brandName: isWTXGroup(nextCompany) ? prev.brandName : "",
        // keep editable client POC values as-is; they are per-project overrides
      };
    });

    setErrors((prev) => ({ ...prev, company: "", clientId: "", poc: "", movieName: "", brandName: "" }));
  };

  const onClientChange = (opt) => {
    const docData = opt ? clientsData[opt.value] : null;
    const autoPoc = docData?.poc ? mapShortPocToFull(docData.poc, project.company) : "";

    setProject((prev) => ({
      ...prev,
      clientId: opt,
      poc: autoPoc,
      // overwrite editable POC fields from the chosen client
      client_poc_name: docData?.client_poc_name || "",
      client_poc_phone: docData?.client_poc_phone || "",
      client_poc_email: (docData?.client_poc_email || "").trim(),
    }));

    setErrors((prev) => ({ ...prev, clientId: "", poc: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isValid = runFormValidation(project);
    if (!isValid) return;

    const updated = {
      projectName: (project.projectName || "").trim(),
      clientId: project.clientId?.value || "",
      company: project.company,
      movieName: isWTGroup(project.company) ? project.movieName || "" : "",
      brandName: isWTXGroup(project.company) ? project.brandName || "" : "",
      poc: normalizeToFormattedPoc(project.poc) || "",
      services: Array.isArray(project.services) ? project.services.map((s) => s.value) : [],
      invoiceIds: Array.isArray(project.invoiceIds) ? project.invoiceIds.map((i) => i?.value) : [],
      quotationIds: Array.isArray(project.quotationIds) ? project.quotationIds.map((q) => q?.value) : [],
      // ✅ Save editable client POC fields on the project
      client_poc_name: project.client_poc_name || "",
      client_poc_phone: project.client_poc_phone || "",
      client_poc_email: (project.client_poc_email || "").trim(),
    };

    try {
      await updateDoc(doc(db, "projects", id), updated);
      navigate("/dashboard/all-projects");
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Update failed.");
    }
  };

  if (loading) {
    return (
      <div className="bg-[#F4F6FF] p-[10px]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
            <h2 className="font-semibold text-[#000000] m-[0]">Edit project</h2>
          </div>
          <div className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve">
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  // UI
  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Title chip */}
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Edit project</h2>
        </div>

        {/* Main form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Row 1: Project Name | Company */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(!!errors.projectName)}>Project Name</label>
              <input
                name="projectName"
                value={project.projectName}
                onChange={(e) => setField("projectName", e.target.value)}
                className={`${inputClass(!!errors.projectName)} border-curve`}
                placeholder="Enter project name"
                required
              />
              {helpText(errors.projectName)}
            </div>

            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(!!errors.company)}>Company</label>
              <Select
                options={COMPANY_OPTIONS}
                value={COMPANY_OPTIONS.find((o) => o.value === project.company) || null}
                onChange={onCompanyChange}
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
                placeholder="Select Company"
              />
              {helpText(errors.company)}
            </div>

            {/* Row 2: Client | Movie/Brand (conditional) */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(!!errors.clientId)}>Client</label>
              <Select
                options={filteredClientOptions}
                value={project.clientId}
                onChange={onClientChange}
                placeholder={project.company ? "Select Client" : "Select company first"}
                styles={selectStylesLight}
                classNamePrefix="rs"
                isDisabled={!project.company}
                isClearable
                isSearchable
                menuPortalTarget={document.body}
                menuPosition="fixed"
                noOptionsMessage={() =>
                  project.company ? "No clients for this company" : "Select company first"
                }
              />
              {helpText(errors.clientId)}
            </div>

            {isWTGroup(project.company) ? (
              <div className="pl-[15px] pr-[15px] space-y-2">
                <label className={labelClass(!!errors.movieName)}>Movie Name</label>
                <input
                  name="movieName"
                  value={project.movieName}
                  onChange={(e) => setField("movieName", e.target.value)}
                  className={`${inputClass(!!errors.movieName)} border-curve`}
                  placeholder="Movie Name (derived from show)"
                  required
                />
                {helpText(errors.movieName)}
              </div>
            ) : (
              <div className="pl-[15px] pr-[15px] space-y-2">
                <label className={labelClass(!!errors.brandName)}>Brand Name</label>
                <input
                  name="brandName"
                  value={project.brandName}
                  onChange={(e) => setField("brandName", e.target.value)}
                  className={`${inputClass(!!errors.brandName)} border-curve`}
                  placeholder="Brand Name (from show)"
                  required
                />
                {helpText(errors.brandName)}
              </div>
            )}

            {/* Row 3: Client POC Name | Client POC Number (EDITABLE) */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Client POC Name</label>
              <input
                name="client_poc_name"
                value={project.client_poc_name}
                onChange={(e) => setField("client_poc_name", e.target.value)}
                className={`${inputClass(false)} border-curve`}
                placeholder="Client POC Name"
              />
            </div>

            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Client POC Number</label>
              <input
                name="client_poc_phone"
                type="tel"
                value={project.client_poc_phone}
                onChange={(e) => {
                  // keep numeric-only like your client form
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
                  setField("client_poc_phone", digits);
                }}
                className={`${inputClass(false)} border-curve`}
                placeholder="9876543210"
              />
            </div>

            {/* Row 4: Client POC Email (EDITABLE) | POC (internal) */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Client POC Email</label>
              <input
                name="client_poc_email"
                type="email"
                value={project.client_poc_email}
                onChange={(e) => setField("client_poc_email", e.target.value)}
                className={`${inputClass(false)} border-curve`}
                placeholder="poc.name@client.com"
              />
            </div>

            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(!!errors.poc)}>POC</label>
              <Select
                options={pocOptions}
                value={project.poc ? { label: project.poc, value: project.poc } : null}
                onChange={(selected) => setField("poc", selected ? selected.value : "")}
                placeholder='Select POC (e.g., "Lingareddy Navya - WT122")'
                styles={selectStylesLight}
                classNamePrefix="rs"
                isClearable
                isDisabled={!project.company}
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
              {helpText(errors.poc)}
            </div>

            {/* Row 5: Services | Invoices */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Services</label>
              <Select
                isMulti
                options={serviceOptions}
                value={project.services}
                onChange={(selected) => setField("services", selected || [])}
                placeholder="Select services"
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Invoices</label>
              <Select
                isMulti
                options={invoiceOptions}
                value={project.invoiceIds}
                onChange={(selected) => setField("invoiceIds", selected || [])}
                placeholder={invoiceOptions.length ? "Select invoices" : "No invoices for this project"}
                isDisabled={!invoiceOptions.length}
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            {/* Row 6: Quotations | Submit */}
            <div className="pl-[15px] pr-[15px] space-y-2">
              <label className={labelClass(false)}>Quotations</label>
              <Select
                isMulti
                options={quotationOptions}
                value={project.quotationIds}
                onChange={(selected) => setField("quotationIds", selected || [])}
                placeholder={quotationOptions.length ? "Select quotations" : "No quotations for this project"}
                isDisabled={!quotationOptions.length}
                styles={selectStylesLight}
                classNamePrefix="rs"
                menuPortalTarget={document.body}
                menuPosition="fixed"
              />
            </div>

            <div className="flex justify-center pt-[10px] pb-[10px] col-span-2">
              <button
                type="submit"
                className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] w-[30%] h-[40px] border-0"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Clean light styles for react-select
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
