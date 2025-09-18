import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, "clients"));
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

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
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pagedClients = useMemo(
    () => clients.slice(startIdx, endIdx),
    [clients, startIdx, endIdx]
  );

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this client?")) {
      await deleteDoc(doc(db, "clients", id));
      setClients((prev) => {
        const next = prev.filter((c) => c.id !== id);
        const nextTotalPages = Math.max(1, Math.ceil(next.length / pageSize));
        if (page > nextTotalPages) setPage(nextTotalPages);
        next.sort((a, b) =>
          (a.client_name || "").toLowerCase().localeCompare((b.client_name || "").toLowerCase())
        );
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

  // --- Top right: Items per page + Showing count ---
  const TopRightControls = () => (
    <div className="flex items-center gap-2 ml-auto">
      <label className="text-sm text-gray-600">Items per page:</label>
      <select
        value={pageSize}
        onChange={(e) => {
          setPageSize(Number(e.target.value));
          setPage(1);
        }}
        className="border p-1 rounded"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className="text-sm text-gray-600">
        Showing <strong>{totalRows ? startIdx + 1 : 0}</strong>–
        <strong>{endIdx}</strong> of <strong>{totalRows}</strong>
      </span>
    </div>
  );

  return (
    <div className="p-6 all-clients">
      <h2 className="text-xl font-semibold mb-4">All Clients</h2>

      {/* Top controls (items per page in top-right) */}
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
                  <th className="p-2 border">Company</th>
                  <th className="p-2 border">POC</th>
                  <th className="p-2 border">Phone</th>
                  <th className="p-2 border">Email</th>
                  <th className="p-2 border">Country</th>
                  <th className="p-2 border">State</th>
                  <th className="p-2 border">Address</th>
                  <th className="p-2 border">PAN</th>
                  <th className="p-2 border">GST</th>
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedClients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="p-2 border">{client.client_name || "—"}</td>
                    <td className="p-2 border">{client.company_name || "—"}</td>
                    <td className="p-2 border">{client.poc || "—"}</td>
                    <td className="p-2 border">{client.phone || "—"}</td>
                    <td className="p-2 border">{client.email || "—"}</td>
                    <td className="p-2 border">{client.country || "—"}</td>
                    <td className="p-2 border">{client.state || "—"}</td>
                    <td className="p-2 border">{client.address || "—"}</td>
                    <td className="p-2 border">{client.pan_number || "—"}</td>
                    <td className="p-2 border">{client.gst_number || "—"}</td>
                    <td className="p-2 border whitespace-nowrap">
                      <button
                        onClick={() => navigate(`/dashboard/edit-client/${client.id}`)}
                        className="mr-2 text-blue-600 hover:underline edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="mr-2 text-red-600 hover:underline edit"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/client-preview/${client.id}`)}
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

          {/* Bottom pagination bar */}
          <div className="flex justify-end my-6">
            <PaginationBar />
          </div>
        </>
      )}
    </div>
  );
}
