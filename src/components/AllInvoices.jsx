// src/pages/AllInvoices.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // number or "all"

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
      .filter((n) => n);
    return names.length > 0 ? names.join(", ") : "—";
  };

  const formatStatus = (status) => {
    const lower = (status || "").toLowerCase();
    const baseClass = "px-2 py-1 rounded-full text-xs font-semibold";
    if (lower === "paid") return <span className={`${baseClass} bg-green-100 text-green-800`}>Paid</span>;
    if (lower === "pending") return <span className={`${baseClass} bg-red-100 text-red-800`}>Pending</span>;
    if (lower === "partial") return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>Partial</span>;
    return <span className={`${baseClass} bg-gray-100 text-gray-800`}>—</span>;
  };

  // --- data load ---
  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "invoices"));
        const invoiceList = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Sort alphabetically by invoice_id (fallback to id)
        invoiceList.sort((a, b) =>
          (a.invoice_id || a.id || "").localeCompare(b.invoice_id || b.id || "")
        );

        setInvoices(invoiceList);
        setPage(1); // go to first page when fresh data is loaded
      } catch (e) {
        console.error("Error loading invoices:", e);
        alert("Error loading invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  // pagination derived
  const totalRows = invoices.length;
  const isShowAll = pageSize === "all";
  const effectivePageSize = isShowAll ? (totalRows || 1) : pageSize;

  const totalPages = Math.max(1, isShowAll ? 1 : Math.ceil(totalRows / effectivePageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = isShowAll ? 0 : (page - 1) * effectivePageSize;
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + effectivePageSize, totalRows);

  const pagedInvoices = useMemo(
    () => (isShowAll ? invoices : invoices.slice(startIdx, endIdx)),
    [invoices, isShowAll, startIdx, endIdx]
  );

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      await deleteDoc(doc(db, "invoices", id));
      setInvoices((prev) => {
        const next = prev.filter((inv) => inv.id !== id);
        // keep page valid after delete
        const nextTotalPages = isShowAll ? 1 : Math.max(1, Math.ceil(next.length / effectivePageSize));
        if (page > nextTotalPages) setPage(nextTotalPages);
        // keep sort
        next.sort((a, b) =>
          (a.invoice_id || a.id || "").localeCompare(b.invoice_id || b.id || "")
        );
        return next;
      });
    }
  };

  // -------- Round-numbered pagination like other pages --------
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
        "w-9 h-9 rounded-full border flex items-center justify-center text-sm",
        active
          ? "bg-blue-500 text-white border-blue-500"
          : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100",
        disabled ? "opacity-50 cursor-not-allowed hover:bg-white" : "cursor-pointer",
      ].join(" ")}
    >
      {children}
    </button>
  );

  const PaginationBar = () => {
    if (totalPages <= 1) return null; // hide when single page or "Show all"
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
          typeof p === "number" ? (
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
          className="border p-1 rounded"
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
        <strong>{isShowAll ? totalRows : endIdx}</strong> of{" "}
        <strong>{totalRows}</strong>
      </span>
    </div>
  );

  return (
    <div className="p-6 all-invoices">
      <h2 className="text-2xl font-bold mb-4">All Invoices</h2>

      {/* Top-right controls */}
      <div className="flex justify-end my-4">
        <TopRightControls />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="table-auto border border-gray-300 text-sm w-full min-w-[1100px]">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="border px-4 py-2 text-left">Invoice ID</th>
                  <th className="border px-4 py-2 text-left">Client ID</th>
                  <th className="border px-4 py-2 text-left">Title</th>
                  <th className="border px-4 py-2 text-left">Service(s)</th>
                  <th className="border px-4 py-2 text-right">Amount</th>
                  <th className="border px-4 py-2 text-center">Status</th>
                  <th className="border px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{invoice.invoice_id || "—"}</td>
                    <td className="border px-4 py-2">{invoice.client_id || "—"}</td>
                    <td className="border px-4 py-2">{invoice.invoice_title || "—"}</td>
                    <td className="border px-4 py-2">{getServiceNames(invoice.services)}</td>
                    <td className="border px-4 py-2 text-right">
                      ₹{Number(invoice.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border px-4 py-2 text-center">
                      {formatStatus(invoice.payment_status)}
                    </td>
                    <td className="border px-4 py-2 text-center space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/dashboard/edit-invoice/${invoice.id}`)}
                        className="bg-blue-600 text-white px-3 py-1 rounded edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded edit"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/invoice-preview/${invoice.id}`)}
                        className="bg-green-600 text-white px-3 py-1 rounded edit"
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom-right round pager (hidden on "Show all") */}
          <div className="flex justify-end my-6">
            <PaginationBar />
          </div>
        </>
      )}
    </div>
  );
}
