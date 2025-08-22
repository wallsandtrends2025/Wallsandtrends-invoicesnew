import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from 'firebase/firestore';

export default function EditProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [clients, setClients] = useState([]);
  const [invoiceOptions, setInvoiceOptions] = useState([]);
  const [quotationOptions, setQuotationOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Service options used for Work Type dropdown (same as your other pages)
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
    { label: "\u2060Brand Film", value: "\u2060Brand Film" },
    { label: "\u2060\u2060Corporate Film", value: "\u2060Corporate Film" },
    { label: "\u2060Teaser + Trailer + Business cut", value: "\u2060Teaser + Trailer + Business cut" },
  ];

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Load this project
        const projectRef = doc(db, 'projects', id);
        const projectSnap = await getDoc(projectRef);
        if (!projectSnap.exists()) {
          alert('Project not found!');
          return navigate('/dashboard/all-projects');
        }
        const projectData = projectSnap.data();

        // Load clients, invoices, quotations
        const [clientsSnap, invoicesSnap, quotationsSnap] = await Promise.all([
          getDocs(collection(db, 'clients')),
          getDocs(collection(db, 'invoices')),
          getDocs(collection(db, 'quotations')),
        ]);

        // Clients list
        const clientsData = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClients(clientsData);

        // Only invoices/quotations that belong to THIS project (by project_id)
        const invoicesForProject = invoicesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(inv => inv.project_id === id);

        const quotationsForProject = quotationsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(q => q.project_id === id);

        // Build options that display invoice_id / quotation_id as labels
        const invOptions = invoicesForProject.map(i => ({
          value: i.id,
          label: i.invoice_id || i.id,
        }));
        const qtnOptions = quotationsForProject.map(q => ({
          value: q.id,
          label: q.quotation_id || q.id,
        }));

        setInvoiceOptions(invOptions);
        setQuotationOptions(qtnOptions);

        // Preselect invoice/quotation values from project doc if stored
        const preselectedInvoices =
          Array.isArray(projectData.invoiceIds)
            ? projectData.invoiceIds
                .map(invId => invOptions.find(o => o.value === invId))
                .filter(Boolean)
            : [];

        const preselectedQuotations =
          Array.isArray(projectData.quotationIds)
            ? projectData.quotationIds
                .map(qId => qtnOptions.find(o => o.value === qId))
                .filter(Boolean)
            : [];

        // Preselect client field
        const clientOption =
          clientsData
            .map(c => ({
              value: c.id,
              label:
                c.name ||
                c.companyName ||
                c.client_name ||
                c.company_name,
            }))
            .find(opt => opt.value === projectData.clientId) || null;

        setProject({
          id: projectSnap.id,
          ...projectData,
          clientId: clientOption,
          invoiceIds: preselectedInvoices,     // react-select option objects
          quotationIds: preselectedQuotations, // react-select option objects
        });

        setLoading(false);
      } catch (error) {
        console.error('Error loading project:', error);
        alert('Failed to load project.');
      }
    };

    fetchAll();
  }, [id, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();

    const updated = {
      projectName: project.projectName || '',
      description: project.description || '',
      poc: project.poc || '',
      movieName: project.movieName || '',
      // Work Type saved as string from the dropdown
      workType: project.workType || '',
      paymentStatus: project.paymentStatus || 'Pending',
      clientId: project.clientId?.value || '',
      // Save selected IDs back to Firestore
      invoiceIds: Array.isArray(project.invoiceIds) ? project.invoiceIds.map(i => i?.value) : [],
      quotationIds: Array.isArray(project.quotationIds) ? project.quotationIds.map(q => q?.value) : [],
    };

    try {
      await updateDoc(doc(db, 'projects', id), updated);
      navigate('/dashboard/all-projects');
    } catch (error) {
      console.error('Error updating project:', error.message, error);
      alert('Update failed.');
    }
  };

  if (loading || !project) return <p className="p-6 text-center text-gray-700">Loading project...</p>;

  return (
    <div className="min-h-screen bg-black flex justify-center items-start p-6">
      <form
        onSubmit={handleUpdate}
        className="bg-gray-900 text-white rounded-xl shadow-xl p-8 w-full max-w-3xl"
      >
        <h2 className="text-3xl font-bold text-center mb-8">Edit Project</h2>

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

        {/* Description */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={project.description}
            onChange={(e) => setProject({ ...project, description: e.target.value })}
            rows={3}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            required
          />
        </div>

        {/* POC */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">POC</label>
          <input
            type="text"
            value={project.poc || ''}
            onChange={(e) => setProject({ ...project, poc: e.target.value })}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
          />
        </div>

        {/* Movie Name */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Movie Name</label>
          <input
            type="text"
            value={project.movieName || ''}
            onChange={(e) => setProject({ ...project, movieName: e.target.value })}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
          />
        </div>

        {/* Work Type (Service Dropdown - Single Select) */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Work Type</label>
          <Select
            options={serviceOptions}
            value={serviceOptions.find(opt => opt.value === project.workType) || null}
            onChange={(selected) =>
              setProject({ ...project, workType: selected ? selected.value : '' })
            }
            placeholder="Select work type"
            styles={selectStyles}
            isClearable
          />
        </div>

        {/* Payment Status */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Payment Status</label>
          <select
            value={project.paymentStatus || 'Pending'}
            onChange={(e) => setProject({ ...project, paymentStatus: e.target.value })}
            className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
          >
            <option value="Pending">Pending</option>
            <option value="Partial">Partial</option>
            <option value="Paid">Paid</option>
          </select>
        </div>

        {/* Client */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Client</label>
          <Select
            options={clients.map(c => ({
              value: c.id,
              label: c.name || c.companyName || c.client_name || c.company_name
            }))}
            value={project.clientId}
            onChange={(selected) => setProject({ ...project, clientId: selected })}
            placeholder="Select client"
            styles={selectStyles}
          />
        </div>

        {/* Invoices (only this project's invoices; labels show invoice_id) */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1">Invoices</label>
          <Select
            isMulti
            options={invoiceOptions}
            value={project.invoiceIds}
            onChange={(selected) => setProject({ ...project, invoiceIds: selected })}
            styles={selectStyles}
            placeholder={invoiceOptions.length ? 'Select invoices' : 'No invoices for this project'}
            isDisabled={!invoiceOptions.length}
          />
        </div>

        {/* Quotations (only this project's quotations; labels show quotation_id) */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-1">Quotations</label>
          <Select
            isMulti
            options={quotationOptions}
            value={project.quotationIds}
            onChange={(selected) => setProject({ ...project, quotationIds: selected })}
            styles={selectStyles}
            placeholder={quotationOptions.length ? 'Select quotations' : 'No quotations for this project'}
            isDisabled={!quotationOptions.length}
          />
        </div>

        <button
          type="submit"
          className=" update-project-btn mt-6 mb-4  bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold tracking-wide py-3 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out"
        >
          Update Project
        </button>
      </form>
    </div>
  );
}

// 🎨 Custom dark mode styles for react-select
const selectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    color: '#fff',
  }),
  input: (base) => ({ ...base, color: 'white' }),
  singleValue: (base) => ({ ...base, color: 'white' }),
  multiValue: (base) => ({ ...base, backgroundColor: '#374151' }),
  multiValueLabel: (base) => ({ ...base, color: 'white' }),
  menu: (base) => ({ ...base, backgroundColor: '#111827' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#374151' : '#111827',
    color: 'white',
  }),
};
