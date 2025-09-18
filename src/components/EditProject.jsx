// src/pages/EditProject.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);

  // Dropdown data
  const [clients, setClients] = useState([]);
  const [invoiceOptions, setInvoiceOptions] = useState([]);
  const [quotationOptions, setQuotationOptions] = useState([]);

  // ----- Service options (same as AddProject) -----
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
    { label: "⁠⁠Corporate Film", value: "⁠Corporate Film" },
    { label: "⁠Teaser + Trailer + Business cut", value: "⁠Teaser + Trailer + Business cut" },
  ];

  // ----- POC options by company GROUP (same as AddProject) -----
  const pocByGroup = {
    WT_WTPL: ["Abhilash", "Veda", "Sai"],
    WTX_WTXPL: ["Rohit", "Mohit", "Kamya", "Varshini", "Anoushka", "Vineel", "Shravya"],
  };

  const companyToGroup = (c) => (c === "WT" || c === "WTPL" ? "WT_WTPL" : "WTX_WTXPL");

  const pocOptions = useMemo(() => {
    const groupKey = companyToGroup(project?.company);
    return (pocByGroup[groupKey] || []).map((p) => ({ label: p, value: p }));
  }, [project?.company]);

  const isWTGroup = (c) => ["WT", "WTPL"].includes(c);
  const isWTXGroup = (c) => ["WTX", "WTXPL"].includes(c);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Load this project
        const projectRef = doc(db, "projects", id);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          alert("Project not found!");
          return navigate("/dashboard/all-projects");
        }
        const projectData = projectSnap.data();

        // Load clients, invoices, quotations
        const [clientsSnap, invoicesSnap, quotationsSnap] = await Promise.all([
          getDocs(collection(db, "clients")),
          getDocs(collection(db, "invoices")),
          getDocs(collection(db, "quotations")),
        ]);

        // Clients list for dropdown
        const clientsData = clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClients(clientsData);

        // Only this project's invoices/quotations by project_id
        const invoicesForProject = invoicesSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((inv) => inv.project_id === id);

        const quotationsForProject = quotationsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((q) => q.project_id === id);

        const invOptions = invoicesForProject.map((i) => ({
          value: i.id,
          label: i.invoice_id || i.id,
        }));
        const qtnOptions = quotationsForProject.map((q) => ({
          value: q.id,
          label: q.quotation_id || q.id,
        }));

        setInvoiceOptions(invOptions);
        setQuotationOptions(qtnOptions);

        // Preselect client
        const clientOption =
          clientsData
            .map((c) => ({
              value: c.id,
              label: c.name || c.companyName || c.client_name || c.company_name || c.id,
            }))
            .find((opt) => opt.value === projectData.clientId) || null;

        // Preselect invoices/quotations
        const preselectedInvoices = Array.isArray(projectData.invoiceIds)
          ? projectData.invoiceIds.map((invId) => invOptions.find((o) => o.value === invId)).filter(Boolean)
          : [];

        const preselectedQuotations = Array.isArray(projectData.quotationIds)
          ? projectData.quotationIds.map((qId) => qtnOptions.find((o) => o.value === qId)).filter(Boolean)
          : [];

        // Preselect services
        const preselectedServices = Array.isArray(projectData.services)
          ? projectData.services
              .map((sv) => serviceOptions.find((o) => o.value === sv))
              .filter(Boolean)
          : [];

        // Build edit state
        setProject({
          id: projectSnap.id,
          projectName: projectData.projectName || "",
          company: projectData.company || "WT",
          clientId: clientOption, // react-select option
          poc: projectData.poc || "",
          movieName: projectData.movieName || "",
          brandName: projectData.brandName || "",
          services: preselectedServices, // react-select options
          invoiceIds: preselectedInvoices, // react-select options
          quotationIds: preselectedQuotations, // react-select options
        });

        setLoading(false);
      } catch (err) {
        console.error("Error loading project:", err);
        alert("Failed to load project.");
      }
    };

    fetchAll();
  }, [id, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();

    if (!project.projectName || !project.clientId || !project.company || !project.poc) {
      alert("Project Name, Client, Company, and POC are required.");
      return;
    }

    // Persist exactly what AddProject saves (+ optional invoice/quotation links)
    const isWT = isWTGroup(project.company);
    const isWTX = isWTXGroup(project.company);

    const updated = {
      projectName: project.projectName,
      clientId: project.clientId?.value || "",
      company: project.company,
      movieName: isWT ? (project.movieName || "") : "",
      brandName: isWTX ? (project.brandName || "") : "",
      poc: project.poc || "",
      services: Array.isArray(project.services) ? project.services.map((s) => s.value) : [],
      // optional associations:
      invoiceIds: Array.isArray(project.invoiceIds) ? project.invoiceIds.map((i) => i?.value) : [],
      quotationIds: Array.isArray(project.quotationIds) ? project.quotationIds.map((q) => q?.value) : [],
    };

    try {
      await updateDoc(doc(db, "projects", id), updated);
      navigate("/dashboard/all-projects");
    } catch (error) {
      console.error("Error updating project:", error);
      alert("Update failed.");
    }
  };

  if (loading || !project)
    return <p className="p-6 text-center text-gray-300">Loading project...</p>;

  const companyOptions = [
    { label: "WT", value: "WT" },
    { label: "WTPL", value: "WTPL" },
    { label: "WTX", value: "WTX" },
    { label: "WTXPL", value: "WTXPL" },
  ];

  return (
    <div className="min-h-screen bg-black flex justify-center items-start p-6">
      <form
        onSubmit={handleUpdate}
        className="bg-gray-900 text-white rounded-xl shadow-xl p-8 w-full max-w-3xl"
      >
        <h2 className="text-3xl font-bold text-center mb-8">Edit Project</h2>

        {/* Company */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Company</label>
          <Select
            options={companyOptions}
            value={companyOptions.find((o) => o.value === project.company) || null}
            onChange={(opt) => {
              // when changing company, reset POC and conditional fields
              const nextCompany = opt?.value || "WT";
              setProject((prev) => ({
                ...prev,
                company: nextCompany,
                poc: "", // force re-pick valid POC for this company group
                movieName: isWTGroup(nextCompany) ? prev.movieName : "",
                brandName: isWTXGroup(nextCompany) ? prev.brandName : "",
              }));
            }}
            styles={selectStyles}
          />
        </div>

        {/* Client */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Client</label>
          <Select
            options={clients.map((c) => ({
              value: c.id,
              label: c.name || c.companyName || c.client_name || c.company_name || c.id,
            }))}
            value={project.clientId}
            onChange={(selected) => setProject({ ...project, clientId: selected })}
            placeholder="Select client"
            styles={selectStyles}
          />
        </div>

        {/* Project Name */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Project Name</label>
          <input
            type="text"
            value={project.projectName}
            onChange={(e) => setProject({ ...project, projectName: e.target.value })}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            required
          />
        </div>

        {/* Movie Name (WT/WTPL) */}
        {isWTGroup(project.company) && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1">Movie Name</label>
            <input
              type="text"
              value={project.movieName}
              onChange={(e) => setProject({ ...project, movieName: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            />
          </div>
        )}

        {/* Brand Name (WTX/WTXPL) */}
        {isWTXGroup(project.company) && (
          <div className="mb-5">
            <label className="block text-sm font-medium mb-1">Brand Name</label>
            <input
              type="text"
              value={project.brandName}
              onChange={(e) => setProject({ ...project, brandName: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            />
          </div>
        )}

        {/* POC (dropdown based on company group) */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">POC</label>
          <Select
            options={pocOptions}
            value={project.poc ? { label: project.poc, value: project.poc } : null}
            onChange={(selected) =>
              setProject({ ...project, poc: selected ? selected.value : "" })
            }
            placeholder="Select POC"
            styles={selectStyles}
            isClearable
          />
        </div>

        {/* Services (multi-select) */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Services</label>
          <Select
            isMulti
            options={serviceOptions}
            value={project.services}
            onChange={(selected) => setProject({ ...project, services: selected || [] })}
            placeholder="Select services"
            styles={selectStyles}
          />
        </div>

        {/* Invoices (optional linking) */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Invoices</label>
          <Select
            isMulti
            options={invoiceOptions}
            value={project.invoiceIds}
            onChange={(selected) => setProject({ ...project, invoiceIds: selected || [] })}
            styles={selectStyles}
            placeholder={
              invoiceOptions.length ? "Select invoices" : "No invoices for this project"
            }
            isDisabled={!invoiceOptions.length}
          />
        </div>

        {/* Quotations (optional linking) */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-1">Quotations</label>
          <Select
            isMulti
            options={quotationOptions}
            value={project.quotationIds}
            onChange={(selected) => setProject({ ...project, quotationIds: selected || [] })}
            styles={selectStyles}
            placeholder={
              quotationOptions.length ? "Select quotations" : "No quotations for this project"
            }
            isDisabled={!quotationOptions.length}
          />
        </div>

        <button
          type="submit"
          className="update-project-btn mt-6 mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold tracking-wide py-3 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out"
        >
          Update Project
        </button>
      </form>
    </div>
  );
}

// 🎨 Dark mode styles for react-select (matches your form)
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
