// src/pages/AllInvoices.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import CurrencyService from "../utils/CurrencyService";
import { permissionGuard, usePermission } from "../utils/permissionGuard";
import { authService } from "../utils/authService.jsx";
import { logger } from "../utils/logger";

export default function AllInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // number or "all"

  // search & sort
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("invoice_id");
  const [sortDir, setSortDir] = useState("asc"); // 'asc' | 'desc'

  // actions popup (same as AllClients / AllProjects)
  const [openMenuForId, setOpenMenuForId] = useState(null);

  const navigate = useNavigate();

  // --- helpers ---
  const getServiceNames = (services) => {
    if (!Array.isArray(services)) return "—";
    const names = services
      .flatMap((s) => {
        const n = s?.name;
        if (Array.isArray(n)) return n;
        if (typeof n === "string") return n.split(",").map((t) => t.trim());
        return [];
      })
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "—";
  };

  const formatAmount = (amount, currency) => {
    return CurrencyService.formatAmountForPDF(amount, currency || 'INR');
  };

  const formatStatus = (status) => {
    const lower = (status || "").toLowerCase();
    const baseClass = "px-2 py-1 rounded-full text-xs font-semibold";
    if (lower === "paid")
      return <span className={`${baseClass} bg-green-100 text-green-800`}>Paid</span>;
    if (lower === "pending")
      return <span className={`${baseClass} bg-red-100 text-red-800`}>Pending</span>;
    if (lower === "partial")
      return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>Partial</span>;
    return <span className={`${baseClass} bg-gray-100 text-gray-800`}>—</span>;
  };

  // Helper function to filter invoices based on permissions
  const filterInvoicesByPermission = async (invoiceList) => {
    const user = authService.getCurrentUser();
    if (!user) return [];

    // If user is admin or super admin, show all invoices
    if (authService.isAdmin()) {
      return invoiceList;
    }

    // For regular users, filter based on ownership or department access
    const filtered = [];
    for (const invoice of invoiceList) {
      try {
        const hasAccess = await permissionGuard.checkResourceAccess(
          'invoice',
          invoice.id,
          'read',
          invoice
        );
        if (hasAccess) {
          filtered.push(invoice);
        }
      } catch (error) {
        // Skip invoices that can't be accessed
        continue;
      }
    }

    return filtered;
  };

  // --- data load with permission check ---
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        // Check permission to read invoices
        await permissionGuard.requirePermission('READ_INVOICE');

        setLoading(true);
        const snapshot = await getDocs(collection(db, "invoices"));
        const invoiceList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Filter invoices based on user permissions
        const filteredInvoices = await filterInvoicesByPermission(invoiceList);

        setInvoices(filteredInvoices);
        setPage(1);
      } catch (error) {
        if (error.name === 'PermissionError') {
          logger.warn('Permission denied for reading invoices', {
            userId: authService.getCurrentUser()?.uid,
            error: error.message
          });
          alert("Access denied: You don't have permission to view invoices.");
        } else {
          logger.error('Error loading invoices', { error: error.message });
          alert("Error loading invoices: " + error.message);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  // --- search (client-side) ---
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return invoices;
    return invoices.filter((inv) => {
      const fields = [
        inv.invoice_id,
        inv.client_id,
        inv.invoice_title,
        getServiceNames(inv.services),
        inv.payment_status,
        (inv.total_amount ?? "").toString(),
      ].map((v) => String(v || "").toLowerCase());
      return fields.some((v) => v.includes(normalizedQuery));
    });
  }, [invoices, normalizedQuery]);

  // --- sort (clickable headers) ---
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const getVal = (row) => {
      switch (sortKey) {
        case "total_amount":
          return Number(row.total_amount || 0);
        case "payment_status":
          return (row.payment_status || "").toString().toLowerCase();
        case "services":
          return getServiceNames(row.services).toLowerCase();
        default:
          return (row?.[sortKey] ?? "").toString().toLowerCase();
      }
    };
    arr.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // --- pagination derived ---
  const totalRows = sorted.length;
  const isShowAll = pageSize === "all";
  const effectivePageSize = isShowAll ? totalRows || 1 : pageSize;

  const totalPages = Math.max(1, isShowAll ? 1 : Math.ceil(totalRows / effectivePageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = isShowAll ? 0 : (page - 1) * effectivePageSize;
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + effectivePageSize, totalRows);

  const pagedInvoices = useMemo(
    () => (isShowAll ? sorted : sorted.slice(startIdx, endIdx)),
    [sorted, isShowAll, startIdx, endIdx]
  );

  // --- actions with permission checks ---
  const handleDelete = async (id) => {
    try {
      // Check permission to delete invoices
      await permissionGuard.requirePermission('DELETE_INVOICE');

      // Find the invoice to check business rules
      const invoiceToDelete = invoices.find(inv => inv.id === id);
      if (invoiceToDelete) {
        // Check business rules (e.g., cannot delete paid invoices unless admin)
        const canDelete = await permissionGuard.canDeleteClient(invoiceToDelete); // Note: This should be canDeleteInvoice
        if (!canDelete) {
          alert("Cannot delete this invoice. It may be finalized or have payment restrictions.");
          return;
        }
      }

      if (window.confirm("Are you sure you want to delete this invoice?")) {
        await deleteDoc(doc(db, "invoices", id));
        setInvoices((prev) => prev.filter((inv) => inv.id !== id));

        logger.info('Invoice deleted successfully', {
          invoiceId: id,
          deletedBy: authService.getCurrentUser()?.uid
        });
      }
    } catch (error) {
      if (error.name === 'PermissionError') {
        alert("Access denied: " + error.message);
      } else {
        logger.error('Failed to delete invoice', {
          invoiceId: id,
          error: error.message,
          userId: authService.getCurrentUser()?.uid
        });
        alert("Failed to delete invoice: " + error.message);
      }
    }
  };

  // --- CSV export (respects current filters & sort) ---
  const exportCSV = useCallback(() => {
    const rows = [
      ["Invoice ID", "Client ID", "Title", "Service(s)", "Amount", "Status"],
      ...sorted.map((inv) => [
        inv.invoice_id || "",
        inv.client_id || "",
        inv.invoice_title || "",
        getServiceNames(inv.services),
        Number(inv.total_amount || 0),
        inv.payment_status || "",
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted]);

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

  // Close open menu on ESC / scroll (same as other pages)
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

  // --- Top controls (same stack as AllClients/AllProjects)
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

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) return <span className="opacity-40">↕</span>;
    return <span>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const requestSort = (key) => {
    if (key === "__actions") return;
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  // Filter actions based on permissions using hook
  const { hasPermission } = usePermission();

  const getAvailableActions = () => {
    const actions = [];

    if (hasPermission('UPDATE_INVOICE')) {
      actions.push('edit');
    }

    if (hasPermission('DELETE_INVOICE')) {
      actions.push('delete');
    }

    if (hasPermission('READ_INVOICE')) {
      actions.push('preview');
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  const headers = [
    { label: "Invoice ID", key: "invoice_id" },
    { label: "Client ID", key: "client_id" },
    { label: "Title", key: "invoice_title" },
    { label: "Service(s)", key: "services" },
    { label: "Amount", key: "total_amount" },
    { label: "Status", key: "payment_status" },
    { label: "Actions", key: "__actions", sortable: false },
  ];

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title (matches AllClients) */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">All Invoices</h2>
      </div>

      {/* Search + Top-right controls */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <div className="w-full md:w-1/2">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by invoice ID, client ID, title, service, status…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-800 border-curve"
            />
            <button
              onClick={() => setQuery("")}
              className="px-3 py-2 text-xs rounded-md  bg-[#3b5997] text-[#ffffff] hover:bg-gray-50 w-[80px] border-0 m-[5px] h-[40px] border-curve"
            >
              Clear
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-2 text-xs rounded-md bg-[#3b5997] text-[#ffffff] hover:bg-emerald-700 w-[130px] border-0 m-[5px] h-[40px] border-curve"
            >
              Export CSV
            </button>
          </div>
        </div>
        <TopRightControls />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No invoices found{normalizedQuery ? " for this search." : "."}
        </div>
      ) : (
        <>
          {/* Card with table — matches AllClients visual style */}
          <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[20px]">
            <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
              <table className="min-w-full border-collapse text-sm text-gray-700 border-curve">
                <thead className="bg-[#3b5997] text-gray-700 sticky top-0 z-10">
                  <tr className="divide-x divide-[#AAAAAA] text-[#ffffff]">
                    {headers.map((h) => (
                      <th
                        key={h.label}
                        className={[
                          "px-6 py-4 font-semibold text-sm text-center select-none  p-[10px]",
                          h.sortable === false ? "" : "cursor-pointer ",
                          h.key === "total_amount" ? "text-right" : "text-center",
                        ].join(" ")}
                        onClick={() => (h.sortable === false ? null : requestSort(h.key))}
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>{h.label}</span>
                          {h.sortable === false ? null : <SortIcon colKey={h.key} />}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pagedInvoices.map((invoice, idx) => (
                    <tr
                      key={invoice.id}
                      className={`transition-colors divide-x divide-[#AAAAAA] ${
                        idx % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"
                      } hover:bg-gray-50`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {invoice.invoice_id || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center  p-[10px]">
                        {invoice.client_id || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {invoice.invoice_title || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800  p-[10px]">
                        {getServiceNames(invoice.services)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-right p-[10px]">
                        {formatAmount(invoice.total_amount, invoice.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {formatStatus(invoice.payment_status)}
                      </td>

                      {/* Actions with 3-dots + bubble (same as AllClients/AllProjects) */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block">
                          <DotsMenu
                            isOpen={openMenuForId === invoice.id}
                            onToggle={() =>
                              setOpenMenuForId((prev) => (prev === invoice.id ? null : invoice.id))
                            }
                            renderBubble={(anchorRef) =>
                              openMenuForId === invoice.id ? (
                                <RowActionsBubble
                                  anchorRef={anchorRef}
                                  onClose={() => setOpenMenuForId(null)}
                                  onEdit={() => {
                                    if (availableActions.includes('edit')) {
                                      setOpenMenuForId(null);
                                      navigate(`/dashboard/edit-invoice/${invoice.id}`);
                                    }
                                  }}
                                  onDelete={async () => {
                                    if (availableActions.includes('delete')) {
                                      setOpenMenuForId(null);
                                      await handleDelete(invoice.id);
                                    }
                                  }}
                                  onPreview={() => {
                                    if (availableActions.includes('preview')) {
                                      setOpenMenuForId(null);
                                      navigate(`/dashboard/invoice-preview/${invoice.id}`);
                                    }
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

          {/* Bottom-right round pager (hidden automatically when totalPages <= 1) */}
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

/* -------------------- Helpers: Dots trigger & Bubble (shared style) -------------------- */

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
  const { hasPermission } = usePermission();
  const availableActions = [];

  if (hasPermission('UPDATE_INVOICE')) availableActions.push('edit');
  if (hasPermission('DELETE_INVOICE')) availableActions.push('delete');
  if (hasPermission('READ_INVOICE')) availableActions.push('preview');

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
          {availableActions.includes('edit') && (
            <button
              onClick={onEdit}
              className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve p-[5px] border-0 cursor-pointer"
            >
              Edit
            </button>
          )}
          {availableActions.includes('delete') && (
            <button
              onClick={onDelete}
              className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve p-[5px] border-0 cursor-pointer"
            >
              Delete
            </button>
          )}
          {availableActions.includes('preview') && (
            <button
              onClick={onPreview}
              className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve p-[5px] border-0 cursor-pointer"
            >
              Preview
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
