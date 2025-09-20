// src/pages/ProformaList.jsx
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit as fbLimit,
  startAfter,
  endBefore,
  limitToLast,
  startAt,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function ProformaList() {
  const [proformas, setProformas] = useState([]);
  const [loading, setLoading] = useState(false);

  // top-right
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // paging (server-side)
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState([]); // first doc of each page (index = page-1)
  const [firstDoc, setFirstDoc] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const navigate = useNavigate();

  // order
  const ORDER_FIELD = "created_at";
  const ORDER_DIR = "desc";
  const baseColRef = collection(db, "quotations");

  // ---- count total once (or when collection logic changes) ----
  useEffect(() => {
    (async () => {
      try {
        const snap = await getCountFromServer(query(baseColRef));
        setTotalCount(snap.data().count || 0);
      } catch (e) {
        console.error("count error", e);
        setTotalCount(0);
      }
    })();
  }, [baseColRef]);

  const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize));

  // ---- core page loader ----
  const runPageQuery = useCallback(
    async ({ direction = "first", jumpDoc = null, targetPage = null } = {}) => {
      setLoading(true);
      try {
        let qy;

        if (direction === "first") {
          qy = query(baseColRef, orderBy(ORDER_FIELD, ORDER_DIR), fbLimit(pageSize));
        } else if (direction === "next" && lastDoc) {
          qy = query(
            baseColRef,
            orderBy(ORDER_FIELD, ORDER_DIR),
            startAfter(lastDoc),
            fbLimit(pageSize)
          );
        } else if (direction === "prev" && firstDoc) {
          qy = query(
            baseColRef,
            orderBy(ORDER_FIELD, ORDER_DIR),
            endBefore(firstDoc),
            limitToLast(pageSize)
          );
        } else if (direction === "jump" && jumpDoc) {
          // start directly at the stored first doc of that page
          qy = query(
            baseColRef,
            orderBy(ORDER_FIELD, ORDER_DIR),
            startAt(jumpDoc),
            fbLimit(pageSize)
          );
        } else {
          qy = query(baseColRef, orderBy(ORDER_FIELD, ORDER_DIR), fbLimit(pageSize));
        }

        const snap = await getDocs(qy);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data(), _snap: d }));
        setProformas(rows);

        const first = snap.docs[0] ?? null;
        const last = snap.docs[snap.docs.length - 1] ?? null;
        setFirstDoc(first);
        setLastDoc(last);

        // cursors book-keeping
        if (direction === "first") {
          setCursors(first ? [first] : []);
          setPage(1);
        } else if (direction === "next") {
          setCursors((prev) => {
            const nextArr = [...prev];
            if (first) nextArr[page] = first; // store first of the new page at index = newPage-1
            return nextArr;
          });
          setPage((p) => p + 1);
        } else if (direction === "prev") {
          setPage((p) => Math.max(1, p - 1));
        } else if (direction === "jump") {
          const pg = targetPage ?? 1;
          setCursors((prev) => {
            const nextArr = [...prev];
            if (first) nextArr[pg - 1] = first;
            return nextArr;
          });
          setPage(pg);
        }

        // peek next
        if (last) {
          const peek = await getDocs(
            query(baseColRef, orderBy(ORDER_FIELD, ORDER_DIR), startAfter(last), fbLimit(1))
          );
          setHasNext(!peek.empty);
        } else {
          setHasNext(false);
        }

        setHasPrev((direction === "prev" ? page - 1 : page) > 1 || (targetPage ?? page) > 1);
      } catch (err) {
        console.error("Error fetching page:", err);
      } finally {
        setLoading(false);
      }
    },
    [baseColRef, pageSize, lastDoc, firstDoc, page]
  );

  // first load and when pageSize changes
  useEffect(() => {
    runPageQuery({ direction: "first" });
  }, [pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- goToPage for numbered pills ----
  const goToPage = async (target) => {
    if (loading) return;
    if (target < 1 || target > totalPages || target === page) return;

    // quick jump if we already have its cursor
    const jumpCursor = cursors[target - 1];
    if (target === 1) {
      await runPageQuery({ direction: "first" });
      return;
    }
    if (jumpCursor) {
      await runPageQuery({ direction: "jump", jumpDoc: jumpCursor, targetPage: target });
      return;
    }

    // otherwise, advance forward until we build cursors up to that page
    setLoading(true);
    try {
      let currentLast = lastDoc;
      let currentPage = page;
      let nextCursors = [...cursors];

      while (currentPage < target && currentLast) {
        const snap = await getDocs(
          query(baseColRef, orderBy(ORDER_FIELD, ORDER_DIR), startAfter(currentLast), fbLimit(pageSize))
        );
        if (snap.empty) break;
        const first = snap.docs[0];
        const last = snap.docs[snap.docs.length - 1];
        currentLast = last;
        currentPage += 1;
        nextCursors[currentPage - 1] = first;

        if (currentPage === target) {
          setProformas(snap.docs.map((d) => ({ id: d.id, ...d.data(), _snap: d })));
          setFirstDoc(first);
          setLastDoc(last);
          setCursors(nextCursors);
          setPage(target);
          const peek = await getDocs(
            query(baseColRef, orderBy(ORDER_FIELD, ORDER_DIR), startAfter(last), fbLimit(1))
          );
          setHasNext(!peek.empty);
          setHasPrev(target > 1);
          return;
        }
      }
    } catch (e) {
      console.error("goToPage error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ---- delete (refreshes current page) ----
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this proforma/quotation?")) return;
    try {
      await deleteDoc(doc(db, "quotations", id));
      setTotalCount((c) => Math.max(0, c - 1));
      // reload current page (keep position if we have its cursor)
      const currentCursor = cursors[page - 1];
      if (page === 1 || !currentCursor) {
        await runPageQuery({ direction: "first" });
      } else {
        await runPageQuery({ direction: "jump", jumpDoc: currentCursor, targetPage: page });
      }
    } catch (e) {
      console.error("delete error", e);
      alert("Failed to delete");
    }
  };

  // ---- UI bits (same look as other pages) ----
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
        <PagePill disabled={page === 1} onClick={() => goToPage(page - 1)}>
          ‹
        </PagePill>
        {visible.map((p, i) =>
          typeof p === "number" ? (
            <PagePill key={`${p}-${i}`} active={p === page} onClick={() => goToPage(p)}>
              {p}
            </PagePill>
          ) : (
            <span key={`${p}-${i}`} className="px-2 text-gray-400 select-none">
              …
            </span>
          )
        )}
        <PagePill disabled={page === totalPages} onClick={() => goToPage(page + 1)}>
          ›
        </PagePill>
      </div>
    );
  };

  // --- Top-right controls (STACKED like other pages)
  const TopRightControls = () => {
    const shownFrom = totalCount ? (page - 1) * pageSize + (proformas.length ? 1 : 0) : 0;
    const shownTo = totalCount ? Math.min(page * pageSize, totalCount) : proformas.length;
    return (
      <div className="flex flex-col items-end gap-2 ml-auto">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">Items per page:</label>
          <select
            value={pageSize}
            onChange={async (e) => {
              setPageSize(Number(e.target.value));
              // reset to first page with new page size
              await runPageQuery({ direction: "first" });
            }}
            className="border p-1 rounded"
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm text-gray-700">
          Showing <strong>{shownFrom || 0}</strong>–<strong>{shownTo || 0}</strong> of{" "}
          <strong>{totalCount}</strong>
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-10 font-inter">
      <h2 className="text-3xl font-bold mb-6 text-black">All Proformas</h2>

      {/* Top-right items-per-page & count */}
      <div className="flex justify-end mb-4">
        <TopRightControls />
      </div>

      <div className="rounded-xl shadow-lg overflow-hidden">
        <table className="table-auto w-full text-sm bg-black text-white">
          <thead className="bg-gray-900 text-white sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 border border-gray-700 text-left">Proforma ID</th>
              <th className="px-6 py-3 border border-gray-700 text-left">Client</th>
              <th className="px-6 py-3 border border-gray-700 text-left">Title</th>
              <th className="px-6 py-3 border border-gray-700 text-left">Services</th>
              <th className="px-6 py-3 border border-gray-700 text-center">Amount</th>
              <th className="px-6 py-3 border border-gray-700 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-300">
                  Loading…
                </td>
              </tr>
            ) : proformas.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-300">
                  No proformas found.
                </td>
              </tr>
            ) : (
              proformas.map((p, index) => (
                <tr
                  key={p.id}
                  className={`transition ${index % 2 === 0 ? "bg-gray-950" : "bg-black"} hover:bg-gray-800`}
                >
                  <td className="px-6 py-3 border border-gray-800">
                    {p.proforma_id || p.quotation_id}
                  </td>
                  <td className="px-6 py-3 border border-gray-800">
                    {p.client_name || p.client_id}
                  </td>
                  <td className="px-6 py-3 border border-gray-800">
                    {p.proforma_title || p.quotation_title}
                  </td>
                  <td className="px-6 py-3 border border-gray-800">
                    {Array.isArray(p.services) ? p.services.map((s) => s.name).join(" + ") : "—"}
                  </td>
                  <td className="px-6 py-3 border border-gray-800 text-center">
                    ₹{Number(p.total_amount || p.amount || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-3 border border-gray-800">
                    <div className="flex flex-col items-center gap-y-2">
                      <button
                        onClick={() => navigate(`/dashboard/edit-quotation/${p.id}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-xs edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-xs edit"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/dashboard/quotation/${p.proforma_id || p.quotation_id}`)
                        }
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-xs edit"
                      >
                        Preview
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Bottom-right round pager */}
        <div className="flex justify-end bg-gray-900 px-4 py-4 border-t border-gray-800">
          <PaginationBar />
        </div>
      </div>
    </div>
  );
}
