import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25); // number or "all"

  const navigate = useNavigate();

  // --- Helper: format POC like "Name - WT120" from "Name WT120"
  const formatPocLabel = (s) => {
    const m = String(s || "").match(/^(.*\S)\s*-?\s*([A-Za-z]{2,}\d{2,})$/);
    return m ? `${m[1]} - ${m[2]}` : (s || "—");
  };

  // --- Helper: format Firestore Timestamp to DD-MMM-YYYY (or "—")
  const fmtDate = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
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

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Sort by client_name (case-insensitive)
        list.sort((a, b) =>
          (a.client_name || "")
            .toLowerCase()
            .localeCompare((b.client_name || "").toLowerCase())
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
  const effectivePageSize = isShowAll ? (totalRows || 1) : pageSize;

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
        // Re-sort
        next.sort((a, b) =>
          (a.client_name || "")
            .toLowerCase()
            .localeCompare((b.client_name || "").toLowerCase())
        );
        // Recompute pages
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
    <div className="p-6 all-clients">
      <h2 className="text-xl font-semibold mb-4">All Clients</h2>

      {/* Top controls (items per page on top, showing below) */}
      <div className="flex justify-end my-4">
        <TopRightControls />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : totalRows === 0 ? (
        <p>No clients found.</p>
      ) : (
        <>
          <div className="relative overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full border border-gray-300 text-sm min-w-[1200px]">
              <thead className="bg-gray-100 text-left sticky top-0 z-10">
                <tr>
                  <th className="p-2 border">Client Name</th>
                  <th className="p-2 border">Company Name</th>
                  <th className="p-2 border">POC</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Country</th>
                  <th className="p-2 border">State</th>
                  <th className="p-2 border">Address</th>
                  <th className="p-2 border">PAN</th>
                  <th className="p-2 border">GST</th>
                  <th className="p-2 border">Created</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedClients.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{c.client_name || "—"}</td>
                    <td className="p-2 border">{c.company_name || "—"}</td>
                    <td className="p-2 border">{formatPocLabel(c.poc)}</td>
                    <td className="p-2 border">{c.phone || "—"}</td>
                    <td className="p-2 border">{c.email || "—"}</td>
                    <td className="p-2 border">{c.country || "—"}</td>
                    <td className="p-2 border">{c.state || "—"}</td>
                    <td className="p-2 border">{c.address || "—"}</td>
                    <td className="p-2 border">{c.pan_number || "—"}</td>
                    <td className="p-2 border">{c.gst_number || "—"}</td>
                    <td className="p-2 border">{fmtDate(c.created_at)}</td>
                    <td className="p-2 border whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/dashboard/edit-client/${c.id}`)}
                        className="mr-2 text-blue-600 hover:underline edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="mr-2 text-red-600 hover:underline edit"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/client-preview/${c.id}`)}
                        className="text-green-600 hover:underline edit"
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination bar (hidden when "Show all") */}
          <div className="flex justify-end my-6">
            <PaginationBar />
          </div>
        </>
      )}
    </div>
  );
}
