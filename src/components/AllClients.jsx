// src/pages/AllClients.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // number or "all"

  const navigate = useNavigate();

  // Track which row's action menu is open
  const [openMenuForId, setOpenMenuForId] = useState(null);

  // --- Helper: format POC like "Name - WT120" from "Name WT120"
  const formatPocLabel = (s) => {
    const m = String(s || "").match(/^(.*\S)\s*-?\s*([A-Za-z]{2,}\d{2,})$/);
    return m ? `${m[1]} - ${m[2]}` : s || "—";
  };

  // --- Helper: format Firestore Timestamp to DD-MMM-YYYY (or "—")
  const fmtDate = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : null;
      if (!d) return "—";
      return d.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  // --- Helper: show the company we actually store
  const getCompany = (row) => row.company_group || row.company_name || "—";

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Sort by client_name (case-insensitive)
        list.sort((a, b) =>
          (a.client_name || "").toLowerCase().localeCompare((b.client_name || "").toLowerCase())
        );

        setClients(list);
        setPage(1);
      } catch (e) {
        console.error("Error loading clients:", e);
        alert("Error loading clients");
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const totalRows = clients.length;
  const isShowAll = pageSize === "all";
  const effectivePageSize = isShowAll ? totalRows || 1 : pageSize;

  const totalPages = Math.max(1, isShowAll ? 1 : Math.ceil(totalRows / effectivePageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = isShowAll ? 0 : (page - 1) * effectivePageSize;
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + effectivePageSize, totalRows);

  const pagedClients = useMemo(
    () => (isShowAll ? clients : clients.slice(startIdx, endIdx)),
    [clients, isShowAll, startIdx, endIdx]
  );

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      await deleteDoc(doc(db, "clients", id));
      setClients((prev) => {
        const next = prev.filter((c) => c.id !== id);
        next.sort((a, b) =>
          (a.client_name || "").toLowerCase().localeCompare((b.client_name || "").toLowerCase())
        );
        const nextTotalPages = isShowAll ? 1 : Math.max(1, Math.ceil(next.length / effectivePageSize));
        if (page > nextTotalPages) setPage(nextTotalPages);
        return next;
      });
    }
  };

  // -------- Round pagination pills --------
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

        <PagePill disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}>
          ›
        </PagePill>
      </div>
    );
  };

  // Close open menu on ESC / scroll
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

  // --- Top right: Items per page (top) + Showing count (below)
  const TopRightControls = () => (
    <div className="flex flex-col items-end gap-2 ml-auto">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Items per page:</label>
        <select
          value={pageSize}
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
      {/* Title */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">All Clients</h2>
      </div>

      {/* Top controls */}
      <div className="flex justify-end mb-4">
        <TopRightControls />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">Loading...</div>
      ) : totalRows === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">No clients found.</div>
      ) : (
        <>
          {/* Card with table */}
          <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[20px]">
            <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
              <table className="min-w-full border-collapse text-sm text-gray-700 border-curve">
                <thead className="bg-[#3b5997] text-[#ffffff] sticky top-0 z-10 p-[10px] ">
                  <tr className="divide-x divide-[#AAAAAA] p-[10px] text-[#ffffff]">
                    {[
                      "Client Name",
                      "Company",
                      "POC",
                      "Phone",
                      "Email",
                      "Client POC Name",
                      "Client POC Number",
                      "Client POC Email",
                      "Country",
                      "State",
                      "Address",
                      "Pan",
                      "GST",
                      "Created",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="px-6 py-4 font-semibold text-sm text-center p-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pagedClients.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={` p-[10px] transition-colors divide-x divide-[#AAAAAA] ${
                        idx % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"
                      } hover:bg-gray-50`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.client_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {getCompany(c)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {formatPocLabel(c.poc)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.phone || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.email || "—"}
                      </td>

                      {/* NEW: Client POC columns */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.client_poc_name || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.client_poc_phone || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.client_poc_email || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.country || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.state || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 p-[10px]">{c.address || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.pan_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {c.gst_number || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {fmtDate(c.created_at)}
                      </td>

                      {/* Actions with 3-dots + bubble */}
                      <td className="px-6 py-4 whitespace-nowrap p-[10px]">
                        <div className="relative">
                          <DotsMenu
                            isOpen={openMenuForId === c.id}
                            onToggle={() =>
                              setOpenMenuForId((prev) => (prev === c.id ? null : c.id))
                            }
                            renderBubble={(anchorRef) =>
                              openMenuForId === c.id ? (
                                <RowActionsBubble
                                  anchorRef={anchorRef}
                                  onClose={() => setOpenMenuForId(null)}
                                  onEdit={() => {
                                    setOpenMenuForId(null);
                                    navigate(`/dashboard/edit-client/${c.id}`);
                                  }}
                                  onDelete={async () => {
                                    setOpenMenuForId(null);
                                    await handleDelete(c.id);
                                  }}
                                  onPreview={() => {
                                    setOpenMenuForId(null);
                                    navigate(`/dashboard/client-preview/${c.id}`);
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

/* -------------------- Helpers: Dots trigger & Bubble -------------------- */

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
        className="inline-flex items-center justify-center w-9 h-9 rounded-full  border-[0] bg-[#ffffff] text-gray-600 hover:bg-gray-100 transition cursor-pointer"
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
      if (!bubbleRef.current.contains(e.target) && !anchorRef.current?.contains(e.target)) {
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
    const left = Math.max(12, rect.left + window.scrollX - (BUBBLE_W - rect.width) + 8);
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
        <div className=" rounded-full shadow-lg px-4 py-3 flex items-center gap-5 editpopup">
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
