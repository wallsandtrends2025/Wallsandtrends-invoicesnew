// src/pages/AllProjects.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, getDoc, deleteDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function AllProjects() {
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  // pagination (applies to filtered list)
  const [page, setPage] = useState(1);
  // pageSize can be a number or the string 'all'
  const [pageSize, setPageSize] = useState(25);

  const navigate = useNavigate();

  // ---------- helpers ----------
  const safeJoin = (items, sep = ', ') => {
    return (items || [])
      .map((x) => (typeof x === 'string' ? x : x?.name || ''))
      .map((s) => String(s || '').trim())
      .filter(Boolean)
      .join(sep) || '-';
  };

  const formatServices = (services) => {
    if (!services) return '-';
    if (typeof services === 'string') {
      const parts = services.split(/[,|]/g).map((s) => s.trim()).filter(Boolean);
      return safeJoin(parts, ', ');
    }
    if (Array.isArray(services)) return safeJoin(services, ', ');
    const guess = services.name || services.serviceName || services.title || '';
    return guess ? guess : '-';
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
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
                const c = clientDoc.data();
                clientName =
                  c.name ||
                  c.companyName ||
                  c.client_name ||
                  c.company_name ||
                  '';
              }
            }

            return { ...project, clientName };
          })
        );

        // Sort projects alphabetically by projectName
        const sortedProjects = projectData
          .filter((p) => (p.projectName || '').trim())
          .sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));

        setProjects(sortedProjects);
        setInvoices(invoiceList);
        setQuotations(quotationList);
        setPage(1); // reset page on fresh load
      } catch (e) {
        console.error('Error loading projects:', e);
        alert('Error loading projects');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteDoc(doc(db, 'projects', id));
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        // keep list sorted
        next.sort((a, b) => (a.projectName || '').localeCompare(b.projectName || ''));
        // recalc page bounds if last item on page removed
        const isShowAllLocal = pageSize === 'all';
        const nextTotalPages = isShowAllLocal ? 1 : Math.max(1, Math.ceil(next.length / pageSize));
        if (page > nextTotalPages) setPage(nextTotalPages);
        return next;
      });
    }
  };

  // ----- search + filtered list -----
  const filteredProjects = useMemo(() => {
    const q = (searchTerm || '').toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (project) =>
        (project.projectName || '').toLowerCase().includes(q) ||
        (project.clientName || '').toLowerCase().includes(q)
    );
  }, [projects, searchTerm]);

  // Reset to page 1 when searchTerm or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  // ----- pagination calculated from filtered list -----
  const totalRows = filteredProjects.length;
  const isShowAll = pageSize === 'all';
  const effectivePageSize = isShowAll ? (totalRows || 1) : pageSize;

  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const startIdx = isShowAll ? 0 : (page - 1) * effectivePageSize;
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + effectivePageSize, totalRows);

  // keep page in range when filtered list shrinks or grows
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedProjects = useMemo(
    () => (isShowAll ? filteredProjects : filteredProjects.slice(startIdx, endIdx)),
    [filteredProjects, isShowAll, startIdx, endIdx]
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

  // Comma-separated, clickable list
  const renderCommaSeparatedLinks = (items, getId, onClick) => {
    if (!items.length) return <span className="text-gray-400">N/A</span>;

    return (
      <div className="flex flex-wrap gap-x-1 justify-center">
        {items.map((item, idx) => {
          const label = getId(item);
          return (
            <React.Fragment key={item.id}>
              <button
                type="button"
                title="Click to view"
                className="underline text-blue-300 hover:text-blue-100"
                onClick={() => onClick(item)}
              >
                {label}
              </button>
              {idx !== items.length - 1 && <span>,&nbsp;</span>}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderProjectInvoices = (projectId) => {
    const projectInvoices = invoices.filter((inv) => inv.project_id === projectId);
    return renderCommaSeparatedLinks(
      projectInvoices,
      (inv) => inv.invoice_id || inv.id,
      (inv) => navigate(`/dashboard/invoice-preview/${inv.id}`)
    );
  };

  const renderProjectQuotations = (projectId) => {
    const projectQuotations = quotations.filter((qtn) => qtn.project_id === projectId);
    return renderCommaSeparatedLinks(
      projectQuotations,
      (qtn) => qtn.quotation_id || qtn.id,
      (qtn) => navigate(`/dashboard/quotation-preview/${qtn.id}`)
    );
  };

  // --------- Round-numbered pager ----------
  const getVisiblePages = (current, total) => {
    const max = 7;
    if (total <= max) return [...Array(total)].map((_, i) => i + 1);

    const pages = [];
    const showLeftDots = current > 4;
    const showRightDots = current < total - 3;

    pages.push(1);
    if (showLeftDots) pages.push('dots-left');

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let p = start; p <= end; p++) pages.push(p);

    if (showRightDots) pages.push('dots-right');
    pages.push(total);
    return pages;
  };

  const PagePill = ({ active, disabled, children, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'w-9 h-9 rounded-full border flex items-center justify-center text-sm',
        active
          ? 'bg-blue-500 text-white border-blue-500'
          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100',
        disabled ? 'opacity-50 cursor-not-allowed hover:bg-white' : 'cursor-pointer',
      ].join(' ')}
    >
      {children}
    </button>
  );

  const PaginationBar = () => {
    // hide pager entirely on "Show All"
    if (isShowAll) return null;
    const visible = getVisiblePages(page, totalPages);
    return (
      <div className="flex items-center gap-2">
        <PagePill
          disabled={page === 1}
          onClick={() => setPage(Math.max(1, page - 1))}
        >
          ‹
        </PagePill>

        {visible.map((p, i) =>
          typeof p === 'number' ? (
            <PagePill
              key={`${p}-${i}`}
              active={p === page}
              onClick={() => setPage(p)}
            >
              {p}
            </PagePill>
          ) : (
            <span key={`${p}-${i}`} className="px-2 text-gray-400 select-none">
              …
            </span>
          )
        )}

        <PagePill
          disabled={page === totalPages}
          onClick={() => setPage(Math.min(totalPages, page + 1))}
        >
          ›
        </PagePill>
      </div>
    );
  };

  // --- Top-right controls (stacked)
  const TopRightControls = () => (
    <div className="flex flex-col items-end gap-2 ml-auto">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-700">Items per page:</label>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value === 'all' ? 'all' : Number(e.target.value);
            setPageSize(v);
            setPage(1);
          }}
          className="border p-1 rounded"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="all">Show All</option>
        </select>
      </div>

      <span className="text-sm text-gray-700">
        Showing <strong>{totalRows ? (isShowAll ? 1 : startIdx + 1) : 0}</strong>–
        <strong>{isShowAll ? totalRows : endIdx}</strong> of <strong>{totalRows}</strong>
      </span>
    </div>
  );

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

        {/* Top-right items-per-page control */}
        <div className="flex justify-end my-4">
          <TopRightControls />
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-10">Loading…</p>
        ) : totalRows === 0 ? (
          <p className="text-center text-gray-500 py-10">No projects found.</p>
        ) : (
          <>
            <div className="relative overflow-x-auto max-h-[600px] overflow-y-auto mt-2 rounded-lg">
              <table className="min-w-full text-sm text-white bg-black rounded-lg min-w-[1200px]">
                <thead className="bg-gray-900 sticky top-0 z-10 text-white">
                  <tr>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">Project Name</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">Company</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">Client</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">POC</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">Movie / Brand</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">Services</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-left">Payment</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-center">Invoices</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-center">Quotations</th>
                    <th className="px-6 py-3 font-semibold border border-gray-800 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProjects.map((project, index) => (
                    <tr
                      key={project.id}
                      className={`${index % 2 === 0 ? 'bg-gray-950' : 'bg-black'} hover:bg-gray-800 transition`}
                    >
                      <td className="px-6 py-3 border border-gray-800">{project.projectName}</td>
                      <td className="px-6 py-3 border border-gray-800">{project.company || '-'}</td>
                      <td className="px-6 py-3 border border-gray-800">{project.clientName || '-'}</td>
                      <td className="px-6 py-3 border border-gray-800">{project.poc || '-'}</td>
                      <td className="px-6 py-3 border border-gray-800">
                        {['WT', 'WTPL'].includes(project.company)
                          ? project.movieName || '-'
                          : ['WTX', 'WTXPL'].includes(project.company)
                          ? project.brandName || '-'
                          : '-'}
                      </td>
                      <td className="px-6 py-3 border border-gray-800">
                        {formatServices(project.services)}
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

            {/* Bottom-right round pager (hidden when Show All) */}
            <div className="flex justify-end my-6">
              <PaginationBar />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
