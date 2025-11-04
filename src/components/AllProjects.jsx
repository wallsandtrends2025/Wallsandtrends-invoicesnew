// src/pages/AllProjects.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, getDoc, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllProjects() {
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);

  // pagination (applies to filtered list)
  const [page, setPage] = useState(1);
  // pageSize can be a number or the string 'all'
  const [pageSize, setPageSize] = useState(10);

  const navigate = useNavigate();

  // --- NEW: to match AllClients popup behaviour
  const [openMenuForId, setOpenMenuForId] = useState(null);

  // ---------- helpers ----------
  const safeJoin = (items, sep = ", ") => {
    return (items || [])
      .map((x) => (typeof x === "string" ? x : x?.name || ""))
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join(sep) || "—";
  };

  const formatServices = (services) => {
    if (!services) return "—";
    if (typeof services === "string") {
      const parts = services
        .split(/[,|]/g)
        .map((s) => s.trim())
        .filter(Boolean);
      return safeJoin(parts, ", ");
    }
    if (Array.isArray(services)) return safeJoin(services, ", ");
    const guess = services.name || services.serviceName || services.title || "";
    return guess ? guess : "—";
  };

  // --- Helpers borrowed from AllClients ---
  const formatPocLabel = (s) => {
    const m = String(s || "").match(/^(.*\S)\s*-?\s*([A-Za-z]{2,}\d{2,})$/);
    return m ? `${m[1]} - ${m[2]}` : s || "—";
  };

  // Show the company stored on the client document
  const getClientCompany = (row) => row?.company_group || row?.company_name || "—";

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const projectSnap = await getDocs(collection(db, "projects"));
        const invoiceSnap = await getDocs(collection(db, "invoices"));
        const quotationSnap = await getDocs(collection(db, "quotations"));

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

            // Pull client fields from clients/{clientId} like AllClients
            let clientName = "";
            let clientPocRaw = "";
            let clientPoc = "";
            let clientCompany = "—";

            // New: will use as fallback for client POC contact details
            let fallbackClientPOCName = "";
            let fallbackClientPOCPhone = "";
            let fallbackClientPOCEmail = "";

            if (project.clientId) {
              try {
                const clientRef = doc(db, "clients", project.clientId);
                const clientDoc = await getDoc(clientRef);
                if (clientDoc.exists()) {
                  const c = clientDoc.data();

                  clientName =
                    c.client_name ||
                    c.name ||
                    c.companyName || // legacy fallback
                    "";

                  clientPocRaw = c.poc || "";
                  clientPoc = formatPocLabel(clientPocRaw);

                  clientCompany = getClientCompany(c);

                  // fallbacks for the 3 client POC fields
                  fallbackClientPOCName = c.client_poc_name || "";
                  fallbackClientPOCPhone = c.client_poc_phone || "";
                  fallbackClientPOCEmail = (c.client_poc_email || "").trim();
                }
              } catch (err) {
                console.warn("Failed to read client:", project.clientId, err);
              }
            }

            // Prefer values saved on project; otherwise fallback to client doc
            const client_poc_name =
              (project.client_poc_name || "").trim() || fallbackClientPOCName || "";
            const client_poc_phone =
              (project.client_poc_phone || "").trim() || fallbackClientPOCPhone || "";
            const client_poc_email =
              (project.client_poc_email || "").trim() || fallbackClientPOCEmail || "";

            return {
              ...project,
              clientName,
              clientPoc,     // formatted like "Name - WT120" (internal POC)
              clientCompany, // resolved from company_group || company_name
              client_poc_name,
              client_poc_phone,
              client_poc_email,
            };
          })
        );

        // Sort projects alphabetically by projectName
        const sortedProjects = projectData
          .filter((p) => (p.projectName || "").trim())
          .sort((a, b) =>
            (a.projectName || "").localeCompare(b.projectName || "")
          );

        setProjects(sortedProjects);
        setInvoices(invoiceList);
        setQuotations(quotationList);
        setPage(1); // reset page on fresh load
      } catch (e) {
        console.error("Error loading projects:", e);
        alert("Error loading projects");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this project?")) {
      await deleteDoc(doc(db, "projects", id));
      setProjects((prev) => {
        const next = prev.filter((p) => p.id !== id);
        // keep list sorted
        next.sort((a, b) =>
          (a.projectName || "").localeCompare(b.projectName || "")
        );
        // recalc page bounds if last item on page removed
        const isShowAllLocal = pageSize === "all";
        const nextTotalPages = isShowAllLocal
          ? 1
          : Math.max(
              1,
              Math.ceil(next.length / (isShowAllLocal ? next.length || 1 : pageSize))
            );
        if (page > nextTotalPages) setPage(nextTotalPages);
        return next;
      });
    }
  };

  // ----- search + filtered list -----
  const filteredProjects = useMemo(() => {
    const q = (searchTerm || "").toLowerCase();
    if (!q) return projects;
    return projects.filter((project) =>
      [
        project.projectName,
        project.clientName,
        project.clientCompany,
        project.client_poc_name,
        project.client_poc_phone,
        project.client_poc_email,
        project.poc, // internal POC
      ]
        .map((s) => String(s || "").toLowerCase())
        .some((s) => s.includes(q))
    );
  }, [projects, searchTerm]);

  // Reset to page 1 when searchTerm or pageSize changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, pageSize]);

  // ----- pagination calculated from filtered list -----
  const totalRows = filteredProjects.length;
  const isShowAll = pageSize === "all";
  const effectivePageSize = isShowAll ? totalRows || 1 : pageSize;

  const totalPages = Math.max(1, isShowAll ? 1 : Math.ceil(totalRows / effectivePageSize));
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
      Paid: "bg-green-600 text-white",
      Partial: "bg-yellow-600 text-white",
      Pending: "bg-red-600 text-white",
    };
    return (
      <span
        className={`text-xs font-semibold px-3 py-1 rounded-full ${
          colorMap[status] || "bg-[#3b5997] text-white"
        }`}
      >
        {status || "N/A"}
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
                className="underline text-blue-700 hover:text-blue-900"
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

  // -------- Round pagination pills (same style as AllClients) --------
  const getVisiblePages = (current, total) => {
    const max = 7;
    if (total <= max) return [...Array(total)].map((_, i) => i + 1);

    const pages = [];
    const showLeftDots = current > 4;
    const showRightDots = current < total - 3;

    pages.push(1);
    if (showLeftDots) pages.push("dots-left");

    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let p = start; p <= end; p++) pages.push(p);

    if (showRightDots) pages.push("dots-right");
    pages.push(total);
    return pages;
  };

  const PagePill = ({ active, disabled, children, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "w-9 h-9 rounded-full border flex items-center justify-center text-sm transition-colors",
        active
          ? "bg-[#3b5997] text-white border-blue-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100",
        disabled ? "opacity-50 cursor-not-allowed hover:bg-white" : "cursor-pointer",
      ].join(" ")}
    >
      {children}
    </button>
  );

  const PaginationBar = () => {
    if (totalPages <= 1) return null;
    const visible = getVisiblePages(page, totalPages);
    return (
      <div className="flex items-center gap-2">
        <PagePill disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}>
          ‹
        </PagePill>

        {visible.map((p, i) =>
          typeof p === "number" ? (
            <PagePill key={`${p}-${i}`} active={p === page} onClick={() => setPage(p)}>
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

  // Close open menu on ESC / scroll (same as AllClients)
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpenMenuForId(null);
    const onScroll = () => setOpenMenuForId(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // --- Top-right controls (same component style as AllClients)
  const TopRightControls = () => (
    <div className="flex flex-col items-end gap-2 ml-auto">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Items per page:</label>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value === "all" ? "all" : Number(e.target.value);
            setPageSize(v);
            setPage(1);
          }}
          className="border border-gray-300 text-gray-700 bg-white rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
          <option value="all">Show all</option>
        </select>
      </div>

      <span className="text-sm text-gray-600">
        Showing <strong>{totalRows ? (isShowAll ? 1 : startIdx + 1) : 0}</strong>–
        <strong>{isShowAll ? totalRows : endIdx}</strong> of <strong>{totalRows}</strong>
      </span>
    </div>
  );

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title bar (same as AllClients) */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">All Projects</h2>
      </div>

      {/* Search + Top controls row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="w-full md:w-1/3">
          <input
            type="text"
            placeholder="Search by project, client, client POC, or client company"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white text-gray-800"
          />
        </div>
        <TopRightControls />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : totalRows === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No projects found.
        </div>
      ) : (
        <>
          {/* Card with table — matches AllClients visual style */}
          <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[20px]">
            <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
              <table className="min-w-full border-collapse text-sm text-gray-700 border-curve">
                <thead className="bg-[#3b5997] text-gray-700 sticky top-0 z-10">
                  <tr className="divide-x divide-[#AAAAAA] text-[#ffffff] p-[10px]">
                    {[
                      "Project Name",
                      "Company",
                      "Client",
                      "Client POC Name",
                      "Client POC Number",
                      "Client POC Email",
                      "POC",
                      "Movie / Brand",
                      "Services",
                      "Payment",
                      "Invoices",
                      "Quotations",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-6 py-4 font-semibold text-sm text-center p-[10px]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pagedProjects.map((project, index) => (
                    <tr
                      key={project.id}
                      className={`transition-colors divide-x divide-[#AAAAAA] ${
                        index % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"
                      } hover:bg-gray-50`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.projectName}
                      </td>

                      {/* Internal company (WT/WTPL/WTX/WTXPL) */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.company || "—"}
                      </td>

                      {/* Client name (with optional company suffix) */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.clientName ? `${project.clientName}` : "—"}
                        {project.clientCompany && project.clientCompany !== "—" ? (
                          <span className="text-gray-500"> — {project.clientCompany}</span>
                        ) : null}
                      </td>

                      {/* NEW: Client POC fields (from project or fallback to client) */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.client_poc_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.client_poc_phone || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.client_poc_email ? (
                          <a
                            href={`mailto:${project.client_poc_email}`}
                            className="underline text-blue-700 hover:text-blue-900"
                          >
                            {project.client_poc_email}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Internal POC formatted like AllClients */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {project.clientPoc || formatPocLabel(project.poc) || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {["WT", "WTPL"].includes(project.company)
                          ? project.movieName || "—"
                          : ["WTX", "WTXPL"].includes(project.company)
                          ? project.brandName || "—"
                          : "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-800 p-[10px]">
                        {formatServices(project.services)}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-800 text-center whitespace-nowrap p-[10px]">
                        {statusBadge(project.paymentStatus)}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-800 text-center p-[10px]">
                        {renderProjectInvoices(project.id)}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-800 text-center p-[10px]">
                        {renderProjectQuotations(project.id)}
                      </td>

                      {/* Actions with 3-dots + bubble (same as AllClients) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="relative">
                          <DotsMenu
                            isOpen={openMenuForId === project.id}
                            onToggle={() =>
                              setOpenMenuForId((prev) =>
                                prev === project.id ? null : project.id
                              )
                            }
                            renderBubble={(anchorRef) =>
                              openMenuForId === project.id ? (
                                <RowActionsBubble
                                  anchorRef={anchorRef}
                                  onClose={() => setOpenMenuForId(null)}
                                  onEdit={() => {
                                    setOpenMenuForId(null);
                                    navigate(`/dashboard/edit-project/${project.id}`);
                                  }}
                                  onDelete={async () => {
                                    setOpenMenuForId(null);
                                    await handleDelete(project.id);
                                  }}
                                  onPreview={() => {
                                    setOpenMenuForId(null);
                                    navigate(`/dashboard/project-preview/${project.id}`);
                                  }}
                                />
                              ) : null
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom pagination bar */}
          {pageSize !== "all" && (
            <div className="flex justify-end mt-6">
              <PaginationBar />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------- Helpers: Dots trigger & Bubble (same as AllClients) -------------------- */

function DotsMenu({ isOpen, onToggle, renderBubble }) {
  const btnRef = useRef(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center justify-center w-9 h-9 rounded-full border-[0] bg-[#ffffff] text-gray-600 hover:bg-gray-100 transition cursor-pointer"
        title="Actions"
      >
        {/* vertical three dots */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {isOpen && renderBubble(btnRef)}
    </>
  );
}

function RowActionsBubble({ onEdit, onDelete, onPreview, anchorRef, onClose }) {
  const bubbleRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (!bubbleRef.current) return;
      if (
        !bubbleRef.current.contains(e.target) &&
        !anchorRef.current?.contains(e.target)
      ) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [anchorRef, onClose]);

  // Compute position relative to the anchor
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP_Y = 56; // how far above the dots
    const BUBBLE_W = 360; // approximate width
    const top = rect.top + window.scrollY - GAP_Y;
    const left = Math.max(
      12,
      rect.left + window.scrollX - (BUBBLE_W - rect.width) + 8
    );
    setPos({ top, left });
  }, [anchorRef]);

  return (
    <div
      ref={bubbleRef}
      style={{
        position: "fixed",
        top: pos.top - window.scrollY,
        left: pos.left - window.scrollX,
        width: 360,
        zIndex: 50,
      }}
    >
      <div className="relative">
        {/* Bubble */}
        <div className="rounded-full shadow-lg px-4 py-3 flex items-center gap-5 editpopup">
          <button
            onClick={onEdit}
            className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve p-[5px] border-0 cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve p-[5px] border-0 cursor-pointer"
          >
            Delete
          </button>
          <button
            onClick={onPreview}
            className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve p-[5px] border-0 cursor-pointer"
          >
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
