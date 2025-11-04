// src/pages/ProformaList.jsx
import { useEffect, useState, useCallback, useRef } from "react";
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
import CurrencyService from "../utils/CurrencyService";

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

  const navigate = useNavigate();

  // three-dots popup state (same as other pages)
  const [openMenuForId, setOpenMenuForId] = useState(null);

  // order
  const ORDER_FIELD = "created_at";
  const ORDER_DIR = "desc";
  const baseColRef = collection(db, "quotations");

  // ---- helpers to match AllInvoices rendering ----
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
    return names.length ? names.join(", ") : "—";
  };

  const formatAmount = (amount, currency) => {
    return CurrencyService.formatAmountForPDF(amount, currency || 'INR');
  };

  const rawStatus = (p) =>
    (p.status ??
      p.payment_status ??
      p.proforma_status ??
      p.quotation_status ??
      "").toString();

  const formatStatus = (statusLike) => {
    const lower = (statusLike || "").toLowerCase();
    const base = "px-2 py-1 rounded-full text-xs font-semibold";
    if (lower === "paid") return <span className={`${base} bg-green-100 text-green-800`}>Paid</span>;
    if (lower === "pending") return <span className={`${base} bg-red-100 text-red-800`}>Pending</span>;
    if (lower === "partial") return <span className={`${base} bg-yellow-100 text-yellow-800`}>Partial</span>;
    return <span className={`${base} bg-gray-100 text-gray-800`}>—</span>;
  };

  // ---- count total once ----
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // ---- goToPage for numbered pills ----
  const goToPage = async (target) => {
    if (loading) return;
    if (target < 1 || target > totalPages || target === page) return;

    const jumpCursor = cursors[target - 1];
    if (target === 1) {
      await runPageQuery({ direction: "first" });
      return;
    }
    if (jumpCursor) {
      await runPageQuery({ direction: "jump", jumpDoc: jumpCursor, targetPage: target });
      return;
    }

    // otherwise, step forward building cursors
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
          return;
        }
      }
    } catch (e) {
      console.error("goToPage error:", e);
    } finally {
      setLoading(false);
    }
  };

  // ---- delete (refresh current page) ----
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this proforma/quotation?")) return;
    try {
      await deleteDoc(doc(db, "quotations", id));
      setTotalCount((c) => Math.max(0, c - 1));
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


  // --- close popup on ESC / scroll
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

  // ---------- UI bits (same look as other pages) ----------
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
          <label className="text-sm text-gray-600">Items per page:</label>
          <select
            value={pageSize}
            onChange={async (e) => {
              setPageSize(Number(e.target.value));
              await runPageQuery({ direction: "first" });
            }}
            className="border border-gray-300 text-gray-700 bg-white rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <span className="text-sm text-gray-600">
          Showing <strong>{shownFrom || 0}</strong>–<strong>{shownTo || 0}</strong> of{" "}
          <strong>{totalCount}</strong>
        </span>
      </div>
    );
  };

  // helper to format services
  const renderServices = (services) => getServiceNames(services);

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title bar */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">All Proformas</h2>
      </div>

      {/* Top-right items-per-page & count */}
      <div className="flex justify-end mb-4">
        <TopRightControls />
      </div>

      {/* Card with table — same look as AllInvoices */}
      <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[20px]">
        <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
          <table className="min-w-full border-collapse text-sm text-gray-700 border-curve">
            <thead className="bg-[#3b5997] text-gray-700 sticky top-0 z-10">
              <tr className="divide-x divide-[#AAAAAA] text-[#ffffff]">
                {[
                  "Proforma ID",
                  "Client ID",
                  "Title",
                  "Service(s)",
                  "Amount",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-6 py-4 font-semibold text-sm text-center p-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500 p-[10px]">
                    Loading...
                  </td>
                </tr>
              ) : proformas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No proformas found.
                  </td>
                </tr>
              ) : (
                proformas.map((p, idx) => {
                  const amount = p.total_amount ?? p.amount;
                  const statusNode = formatStatus(rawStatus(p));

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors divide-x divide-[#AAAAAA] ${
                        idx % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"
                      } hover:bg-gray-50`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {p.proforma_id || p.quotation_id || p.id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {p.client_id || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 text-center p-[10px]">
                        {p.proforma_title || p.quotation_title || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 p-[10px]">
                        {renderServices(p.services)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-right p-[10px]">
                        {formatAmount(amount, p.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {statusNode}
                      </td>

                      {/* Actions with 3-dots + bubble */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block">
                          <DotsMenu
                            isOpen={openMenuForId === p.id}
                            onToggle={() =>
                              setOpenMenuForId((prev) => (prev === p.id ? null : p.id))
                            }
                            renderBubble={(anchorRef) =>
                              openMenuForId === p.id ? (
                                <RowActionsBubble
                                  anchorRef={anchorRef}
                                  onClose={() => setOpenMenuForId(null)}
                                  onEdit={() => {
                                    setOpenMenuForId(null);
                                    // Check if it's a proforma or quotation to route correctly
                                    const isProforma = p.proforma_id && !p.quotation_id;
                                    if (isProforma) {
                                      navigate(`/dashboard/edit-proforma/${p.id}`);
                                    } else {
                                      navigate(`/dashboard/edit-quotation/${p.id}`);
                                    }
                                  }}
                                  onDelete={async () => {
                                    setOpenMenuForId(null);
                                    await handleDelete(p.id);
                                  }}
                                  onPreview={() => {
                                    console.log("🔍 DEBUG: Preview clicked for proforma:", {
                                      documentId: p.id,
                                      proforma_id: p.proforma_id,
                                      quotation_id: p.quotation_id,
                                      finalId: p.proforma_id || p.quotation_id || p.id,
                                      client_id: p.client_id
                                    });
                                    setOpenMenuForId(null);
                                    navigate(`/dashboard/quotation/${p.proforma_id || p.quotation_id || p.id}`);
                                  }}
                                />
                              ) : null
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom-right round pager */}
      <div className="flex justify-end mt-6">
        <PaginationBar />
      </div>
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

  // DEBUG: Log available actions
  console.log("🔍 DEBUG: RowActionsBubble rendered with actions: Edit, Delete, Preview.");

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
    const BUBBLE_W = 360; // back to original width for 3 buttons
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
