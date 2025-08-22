// Import Statements
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, getDoc, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function AllProjects() {
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const projectSnap = await getDocs(collection(db, 'projects'));
      const invoiceSnap = await getDocs(collection(db, 'invoices'));
      const quotationSnap = await getDocs(collection(db, 'quotations'));

      const invoiceList = invoiceSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      const quotationList = quotationSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const projectData = await Promise.all(
        projectSnap.docs.map(async (docSnap) => {
          const project = { id: docSnap.id, ...docSnap.data() };

          // Fetch client name
          let clientName = '';
          if (project.clientId) {
            const clientRef = doc(db, 'clients', project.clientId);
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const clientData = clientDoc.data();
              clientName =
                clientData.name ||
                clientData.companyName ||
                clientData.client_name ||
                clientData.company_name ||
                '';
            }
          }

          return {
            ...project,
            clientName,
          };
        })
      );

      setProjects(projectData.filter((p) => p.projectName?.trim()));
      setInvoices(invoiceList);
      setQuotations(quotationList);
    };

    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteDoc(doc(db, 'projects', id));
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const filteredProjects = projects.filter(
    (project) =>
      (project.projectName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.clientName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusBadge = (status) => {
    const colorMap = {
      Paid: 'bg-green-700 text-white',
      Partial: 'bg-yellow-600 text-white',
      Pending: 'bg-red-600 text-white',
    };
    return (
      <span
        className={`text-xs font-semibold px-3 py-1 rounded-full ${
          colorMap[status] || 'bg-gray-700 text-white'
        }`}
      >
        {status || 'N/A'}
      </span>
    );
  };

  const renderProjectInvoices = (projectId) => {
    const projectInvoices = invoices.filter((inv) => inv.project_id === projectId);
    if (projectInvoices.length === 0) return <span className="text-gray-400">N/A</span>;

    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {projectInvoices.map((inv) => (
          <span
            key={inv.id}
            onClick={() => navigate(`/dashboard/invoice-preview/${inv.id}`)}
            className="cursor-pointer bg-blue-500 text-white px-2 py-1 rounded-full text-xs hover:bg-blue-600"
            title="Click to view Invoice"
          >
            {inv.invoice_id || inv.id}
          </span>
        ))}
      </div>
    );
  };

  const renderProjectQuotations = (projectId) => {
    const projectQuotations = quotations.filter((qtn) => qtn.project_id === projectId);
    if (projectQuotations.length === 0) return <span className="text-gray-400">N/A</span>;

    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {projectQuotations.map((qtn) => (
          <span
            key={qtn.id}
            onClick={() => navigate(`/dashboard/quotation-preview/${qtn.id}`)}
            className="cursor-pointer bg-green-500 text-white px-2 py-1 rounded-full text-xs hover:bg-green-600"
            title="Click to view Quotation"
          >
            {qtn.quotation_id || qtn.id}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 min-h-screen bg-gray-100 all-projects-block">
      <div className="max-w-7xl mx-auto bg-white shadow-md rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">All Projects</h2>
          <input
            type="text"
            placeholder="Search by project or client"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mt-4 md:mt-0 px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-black w-full md:w-1/3"
          />
        </div>

        {filteredProjects.length === 0 ? (
          <p className="text-center text-gray-500 py-10">No projects found.</p>
        ) : (
          <div className="overflow-auto mt-6 rounded-lg">
            <table className="min-w-full text-sm text-white bg-black rounded-lg">
              <thead className="bg-gray-900 sticky top-0 z-10 text-white">
                <tr>
                  <th className="px-6 py-3 font-semibold border border-gray-800">Project Name</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800">Company</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800">Client</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800">POC</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800">Movie / Brand</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800">Services</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800">Payment</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800 text-center">Invoices</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800 text-center">Quotations</th>
                  <th className="px-6 py-3 font-semibold border border-gray-800 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project, index) => (
                  <tr
                    key={project.id}
                    className={`${
                      index % 2 === 0 ? 'bg-gray-950' : 'bg-black'
                    } hover:bg-gray-800 transition`}
                  >
                    <td className="px-6 py-3 border border-gray-800">{project.projectName}</td>
                    <td className="px-6 py-3 border border-gray-800">{project.company || '-'}</td>
                    <td className="px-6 py-3 border border-gray-800">{project.clientName || '-'}</td>
                    <td className="px-6 py-3 border border-gray-800">{project.poc || '-'}</td>
                    <td className="px-6 py-3 border border-gray-800">
                      {["WT", "WTPL"].includes(project.company)
                        ? project.movieName || "-"
                        : ["WTX", "WTXPL"].includes(project.company)
                        ? project.brandName || "-"
                        : "-"}
                    </td>
                    <td className="px-6 py-3 border border-gray-800">
                      {(project.services || []).join(", ") || "-"}
                    </td>
                    <td className="px-6 py-3 border border-gray-800">
                      {statusBadge(project.paymentStatus)}
                    </td>
                    <td className="px-6 py-3 text-center border border-gray-800">
                      {renderProjectInvoices(project.id)}
                    </td>
                    <td className="px-6 py-3 text-center border border-gray-800">
                      {renderProjectQuotations(project.id)}
                    </td>
                    <td className="px-6 py-3 border border-gray-800">
                      <div className="flex justify-center items-center gap-x-2">
                        <button
                          onClick={() => navigate(`/dashboard/edit-project/${project.id}`)}
                          className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded edit"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1 rounded edit"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => navigate(`/dashboard/project-preview/${project.id}`)}
                          className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded edit"
                        >
                          Preview
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
