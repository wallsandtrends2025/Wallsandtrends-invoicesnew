// src/pages/AddProject.jsx
import React, { useEffect, useMemo, useState } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Select from "react-select";
import { useNavigate } from "react-router-dom";

export default function AddProject() {
  const [projectName, setProjectName] = useState("");
  const [company, setCompany] = useState("");
  const [movieName, setMovieName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [poc, setPoc] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [clientsData, setClientsData] = useState({});

  // SHOWING PURPOSE ONLY: auto-filled, read-only
  const [clientPocName, setClientPocName] = useState("");
  const [clientPocPhone, setClientPocPhone] = useState("");
  const [clientPocEmail, setClientPocEmail] = useState("");

  const [errors, setErrors] = useState({
    projectName: "",
    company: "",
    movieName: "",
    brandName: "",
    client: "",
    poc: "",
  });
  const navigate = useNavigate();

  // ----- POC options by company -----
  const WT_WTPL_POCs = [
    "Suryadevara Veda sai Krishna WT120",
    "Koduru Abhilash Reddy WT146",
    "Sajja Seshasai WT131",
  ];
  const WTX_WTXPL_POCs = [
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
    const parts = entry.split(" ");
    const code = parts.pop();
    const name = parts.join(" ");
    return `${name} - ${code}`;
  };

  const pocByCompany = {
    WT: WT_WTPL_POCs.map(formatPoc),
    WTPL: WT_WTPL_POCs.map(formatPoc),
    WTX: WTX_WTXPL_POCs.map(formatPoc),
    WTXPL: WTX_WTXPL_POCs.map(formatPoc),
  };

  const currentPocOptions = useMemo(() => {
    const list = pocByCompany[company] || [];
    return list.map((label) => ({ label, value: label }));
  }, [company]);

  const mapShortPocToFull = (shortName, comp) => {
    if (!shortName) return "";
    const list = pocByCompany[comp] || [];
    const lower = shortName.toLowerCase().trim();
    let found = list.find((lbl) => lbl.toLowerCase().startsWith(lower));
    if (found) return found;
    found = list.find((lbl) => lbl.toLowerCase().includes(lower));
    return found || shortName;
  };

  // ----- Services -----
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
    { label: "⁠Brand Film", value: "⁠Brand Film" },
    { label: "⁠Corporate Film", value: "⁠Corporate Film" },
    { label: "⁠Teaser + Trailer + Business cut", value: "⁠Teaser + Trailer + Business cut" },
  ];

  // ----- Load all clients once -----
  useEffect(() => {
    const fetchClients = async () => {
      const snap = await getDocs(collection(db, "clients"));
      const map = {};
      snap.forEach((d) => {
        map[d.id] = d.data() || {};
      });
      setClientsData(map);
    };
    fetchClients();
  }, []);

  // Company→Group mapping (WT & WTPL share; WTX & WTXPL share)
  const companyToGroup = {
    WT: "WT",
    WTPL: "WT",
    WTX: "WTX",
    WTXPL: "WTX",
  };

  const normalize = (s) => String(s || "").toUpperCase().trim();

  // STRICT group match: show only the group’s clients; show none until company chosen.
  const isClientInCompanyGroup = (clientDoc, comp) => {
    if (!comp) return false;
    const targetGroup = companyToGroup[comp];
    if (!targetGroup) return false;

    const cg = normalize(clientDoc.company_group);
    const cn = normalize(clientDoc.company_name);

    if (cg) return cg === normalize(targetGroup);

    if (targetGroup === "WT") {
      return cn === "WT" || cn === "WTPL";
    }
    if (targetGroup === "WTX") {
      return cn === "WTX" || cn === "WTXPL";
    }
    return false;
  };

  const filteredClientOptions = useMemo(() => {
    if (!company) return [];
    return Object.entries(clientsData)
      .filter(([, data]) => isClientInCompanyGroup(data, company))
      .map(([id, data]) => ({
        value: id,
        label: data.client_name ? data.client_name : id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clientsData, company]);

  const handleClientChange = (opt) => {
    setSelectedClient(opt);
    const docData = opt ? clientsData[opt.value] : null;

    // Internal POC prefill
    if (docData?.poc) {
      setPoc(mapShortPocToFull(docData.poc, company));
    } else {
      setPoc("");
    }

    // DISPLAY-ONLY: auto-fill from client; no validation, not saved
    setClientPocName(docData?.client_poc_name || "");
    setClientPocPhone(docData?.client_poc_phone || "");
    setClientPocEmail(docData?.client_poc_email || "");

    setErrors((prev) => ({ ...prev, client: "" }));
  };

  const validate = () => {
    const next = {
      projectName: projectName ? "" : "Project Name is required.",
      company: company ? "" : "Company is required.",
      client: selectedClient ? "" : "Client is required.",
      poc: poc ? "" : "POC is required.",
    };

    if (company === "WT" || company === "WTPL") {
      next.movieName = movieName ? "" : "Movie Name is required.";
    } else if (company === "WTX" || company === "WTXPL") {
      next.brandName = brandName ? "" : "Brand Name is required.";
    }

    setErrors(next);
    return !Object.values(next).some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const projectData = {
        projectName,
        company,
        clientId: selectedClient.value,
        poc,
        services: selectedServices.map((s) => s.value),
        createdAt: new Date(),
        // NOTE: NOT including client_poc_* here (display only)
      };

      if (company === "WT" || company === "WTPL") {
        projectData.movieName = movieName;
      } else if (company === "WTX" || company === "WTXPL") {
        projectData.brandName = brandName;
      }

      await addDoc(collection(db, "projects"), projectData);

      alert("Project added successfully!");
      navigate("/dashboard/all-projects");
    } catch (err) {
      console.error("Error adding project:", err);
      alert("Failed to add project.");
    }
  };

  // --- UI helpers ---
  const inputClass = (hasError, readonly = false) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : `border-gray-300 text-black focus:outline-none ${readonly ? "bg-gray-50" : "focus:ring-2 focus:ring-gray-200"}`
    }`;

  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;

  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  // react-select theme
  const rsStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 44,
      height: 44,
      borderRadius: 10,
      borderColor: "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 2px rgba(229,231,235,0.9)" : "none",
      ":hover": { borderColor: "#e5e7eb" },
    }),
    valueContainer: (base) => ({ ...base, height: 44, padding: "0 12px" }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    indicatorsContainer: (base) => ({ ...base, height: 44 }),
    multiValue: (base) => ({ ...base, borderRadius: 6 }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
    menu: (base) => ({ ...base, borderRadius: 10, overflow: "hidden" }),
  };

  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Title chip */}
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Add New Project</h2>
        </div>

        {/* Main form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          <div className="grid grid-cols-2 gap-6">
            {/* Row 1: Project Name | Company */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.projectName)}>Project Name</label>
              <input
                value={projectName}
                onChange={(e) => {
                  setProjectName(e.target.value);
                  if (errors.projectName) setErrors((p) => ({ ...p, projectName: "" }));
                }}
                className={`${inputClass(!!errors.projectName)} border-curve`}
                placeholder="Enter project name"
                required
              />
              {helpText(errors.projectName)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.company)}>Company</label>
              <select
                value={company}
                onChange={(e) => {
                  const next = e.target.value;
                  setCompany(next);
                  setSelectedClient(null);
                  setPoc("");
                  setMovieName("");
                  setBrandName("");
                  // clear display-only fields
                  setClientPocName("");
                  setClientPocPhone("");
                  setClientPocEmail("");
                  setErrors((p) => ({
                    ...p,
                    company: "",
                    client: "",
                    poc: "",
                    movieName: "",
                    brandName: "",
                  }));
                }}
                className={`${inputClass(!!errors.company)} border-curve `}
                required
              >
                <option value="">Select Company</option>
                <option value="WT">WT</option>
                <option value="WTPL">WTPL</option>
                <option value="WTX">WTX</option>
                <option value="WTXPL">WTXPL</option>
              </select>
              {helpText(errors.company)}
            </div>

            {/* Row 2: Client | Movie/Brand (conditional) */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client)}>Select Client</label>
              <Select
                className="border-curve mt-[10px] mb-[10px]"
                classNamePrefix="rs"
                styles={rsStyles}
                options={filteredClientOptions}
                value={selectedClient}
                onChange={handleClientChange}
                placeholder={company ? "Select Client" : "Select company first"}
                isSearchable
                isClearable
                isDisabled={!company}
                noOptionsMessage={() =>
                  company ? "No clients for this company" : "Select company first"
                }
              />
              {helpText(errors.client)}
            </div>

            {(company === "WT" || company === "WTPL") && (
              <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
                <label className={labelClass(!!errors.movieName)}>Movie Name</label>
                <input
                  value={movieName}
                  onChange={(e) => {
                    setMovieName(e.target.value);
                    if (errors.movieName) setErrors((p) => ({ ...p, movieName: "" }));
                  }}
                  className={`${inputClass(!!errors.movieName)} border-curve`}
                  placeholder="Movie Name (derived from show)"
                  required
                />
                {helpText(errors.movieName)}
              </div>
            )}
            {(company === "WTX" || company === "WTXPL") && (
              <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
                <label className={labelClass(!!errors.brandName)}>Brand Name</label>
                <input
                  value={brandName}
                  onChange={(e) => {
                    setBrandName(e.target.value);
                    if (errors.brandName) setErrors((p) => ({ ...p, brandName: "" }));
                  }}
                  className={`${inputClass(!!errors.brandName)} border-curve`}
                  placeholder="Brand Name (from show)"
                  required
                />
                {helpText(errors.brandName)}
              </div>
            )}

            {/* Row 3: Client POC Name | Client POC Number (DISPLAY ONLY) */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(false)}>Client POC Name (from client)</label>
              <input
                value={clientPocName}
                readOnly
                className={`${inputClass(false, true)} border-curve`}
                placeholder="—"
              />
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(false)}>Client POC Number (from client)</label>
              <input
                value={clientPocPhone}
                readOnly
                className={`${inputClass(false, true)} border-curve`}
                placeholder="—"
              />
            </div>

            {/* Row 4: Client POC Email (DISPLAY ONLY) | POC (internal) */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(false)}>Client POC Email (from client)</label>
              <input
                value={clientPocEmail}
                readOnly
                className={`${inputClass(false, true)} border-curve`}
                placeholder="—"
              />
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.poc)}>POC</label>
              <Select
                className="border-curve"
                classNamePrefix="rs"
                styles={rsStyles}
                options={currentPocOptions}
                value={poc ? { label: poc, value: poc } : null}
                onChange={(opt) => {
                  setPoc(opt?.value || "");
                  if (errors.poc) setErrors((p) => ({ ...p, poc: "" }));
                }}
                placeholder='Select POC (e.g., "Lingareddy Navya - WT122")'
                isSearchable
                isClearable
                isDisabled={!company}
              />
              {helpText(errors.poc)}
            </div>

            {/* Row 5: Services | spacer */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(false)}>Select Services</label>
              <Select
                isMulti
                className="border-curve"
                classNamePrefix="rs"
                styles={rsStyles}
                options={serviceOptions}
                value={selectedServices}
                onChange={setSelectedServices}
                placeholder="Select Services"
                isSearchable
              />
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">{/* spacer */}</div>

            {/* Submit Buttons */}
           <div className="col-span-2 flex justify-center items-center pt-[10px] pb-[10px]">
  <div className="flex gap-3">
    <button
      type="submit"
      className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[8px] px-4 py-2 text-sm hover:bg-[#3b5997] transition"
    >
      Submit Project
    </button>
    <button
      type="button"
      onClick={() => {
        setProjectName("");
        setCompany("");
        setMovieName("");
        setBrandName("");
        setSelectedClient(null);
        setPoc("");
        setSelectedServices([]);
        setClientPocName("");
        setClientPocPhone("");
        setClientPocEmail("");
        setErrors({
          projectName: "",
          company: "",
          movieName: "",
          brandName: "",
          client: "",
          poc: "",
        });
      }}
      className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[8px] px-4 py-2 text-sm hover:bg-[#3b5997] transition"
    >
      Clear Form
    </button>
  </div>
</div>

          </div>
        </form>
      </div>
    </div>
  );
}
