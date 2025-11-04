// src/components/QuotationList.jsx
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
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function QuotationList() {
  const navigate = useNavigate();

  // table data
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination state
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState([]); // first doc of each page
  const [firstDoc, setFirstDoc] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);

  // action menu (3-dot bubble)
  const [openMenuForId, setOpenMenuForId] = useState(null);

  const ORDER_FIELD = "created_at";
  const ORDER_DIR = "desc";
  const BASE_REF = collection(db, "quotations");

  // helpers
  const getServiceNames = (services) => {
    if (!Array.isArray(services)) return "—";
    const names = services
      .flatMap((s) => {
        const n = s?.name;
        if (Array.isArray(n)) return n;
        if (typeof n === "string")
          return n.split(",").map((t) => t.trim());
        return [];
      })
      .filter(Boolean);
    return names.length ? names.join(", ") : "—";
  };

  const formatINR = (n) =>
    `₹${Number(n || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
    })}`;

  const rawStatus = (q) =>
    (
      q.status ||
      q.payment_status ||
      q.quotation_status ||
      q.proforma_status ||
      ""
    ).toString();

  const formatStatus = (statusLike) => {
    const lower = (statusLike || "").toLowerCase();
    const base =
      "px-2 py-1 rounded-full text-xs font-semibold";
    if (lower === "paid")
      return (
        <span
          className={`${base} bg-green-100 text-green-800`}
        >
          Paid
        </span>
      );
    if (lower === "pending")
      return (
        <span
          className={`${base} bg-red-100 text-red-800`}
        >
          Pending
        </span>
      );
    if (lower === "partial")
      return (
        <span
          className={`${base} bg-yellow-100 text-yellow-800`}
        >
          Partial
        </span>
      );
    return (
      <span className={`${base} bg-gray-100 text-gray-800`}>
        —
      </span>
    );
  };

  // ------------------ total count ------------------
  // We'll scan & count only quotation-like docs:
  // Rule: quotation_id / proforma_id / doc.id contains "QTN"
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(BASE_REF));
        const allDocs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          _snap: d,
        }));
        const onlyQuotations = allDocs.filter((q) => {
          const candidateId =
            q.quotation_id || q.proforma_id || q.id || "";
          return candidateId.includes("QTN");
        });
        setTotalCount(onlyQuotations.length);
      } catch (err) {
        console.error("count error", err);
        setTotalCount(0);
      }
    })();
  }, []);

  const totalPages = Math.max(
    1,
    Math.ceil((totalCount || 0) / pageSize)
  );

  // ------------------ page loader ------------------
  const runPageQuery = useCallback(
    async ({
      direction = "first",
      jumpDoc = null,
      targetPage = null,
    } = {}) => {
      setLoading(true);
      try {
        let qRef;

        if (direction === "first") {
          qRef = query(
            BASE_REF,
            orderBy(ORDER_FIELD, ORDER_DIR),
            fbLimit(pageSize)
          );
        } else if (direction === "next" && lastDoc) {
          qRef = query(
            BASE_REF,
            orderBy(ORDER_FIELD, ORDER_DIR),
            startAfter(lastDoc),
            fbLimit(pageSize)
          );
        } else if (direction === "prev" && firstDoc) {
          qRef = query(
            BASE_REF,
            orderBy(ORDER_FIELD, ORDER_DIR),
            endBefore(firstDoc),
            limitToLast(pageSize)
          );
        } else if (direction === "jump" && jumpDoc) {
          qRef = query(
            BASE_REF,
            orderBy(ORDER_FIELD, ORDER_DIR),
            startAt(jumpDoc),
            fbLimit(pageSize)
          );
        } else {
          qRef = query(
            BASE_REF,
            orderBy(ORDER_FIELD, ORDER_DIR),
            fbLimit(pageSize)
          );
        }

        const snap = await getDocs(qRef);

        // map and filter to only quotation docs
        const mapped = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          _snap: d,
        }));
        const onlyQuotations = mapped.filter((q) => {
          const candidateId =
            q.quotation_id || q.proforma_id || q.id || "";
          return candidateId.includes("QTN");
        });

        setRows(onlyQuotations);

        // update pagination anchors
        const first = snap.docs[0] ?? null;
        const last = snap.docs[snap.docs.length - 1] ?? null;
        setFirstDoc(first);
        setLastDoc(last);

        if (direction === "first") {
          setCursors(first ? [first] : []);
          setPage(1);
        } else if (direction === "next") {
          setCursors((prev) => {
            const nextArr = [...prev];
            if (first) {
              nextArr[page] = first; // index for the new page
            }
            return nextArr;
          });
          setPage((p) => p + 1);
        } else if (direction === "prev") {
          setPage((p) => Math.max(1, p - 1));
        } else if (direction === "jump") {
          const pg = targetPage ?? 1;
          setCursors((prev) => {
            const nextArr = [...prev];
            if (first) {
              nextArr[pg - 1] = first;
            }
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
    [BASE_REF, pageSize, lastDoc, firstDoc, page]
  );

  // initial load + whenever pageSize changes
  useEffect(() => {
    runPageQuery({ direction: "first" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // jump to a given page index
  const goToPage = async (target) => {
    if (loading) return;
    if (
      target < 1 ||
      target > totalPages ||
      target === page
    )
      return;

    // if we already have a stored cursor for that page
    const jumpCursor = cursors[target - 1];
    if (target === 1) {
      await runPageQuery({ direction: "first" });
      return;
    }
    if (jumpCursor) {
      await runPageQuery({
        direction: "jump",
        jumpDoc: jumpCursor,
        targetPage: target,
      });
      return;
    }

    // fallback: walk forward until we reach that page
    setLoading(true);
    try {
      let currentLast = lastDoc;
      let currentPage = page;
      let nextCursors = [...cursors];
      while (currentPage < target && currentLast) {
        const snap = await getDocs(
          query(
            BASE_REF,
            orderBy(ORDER_FIELD, ORDER_DIR),
            startAfter(currentLast),
            fbLimit(pageSize)
          )
        );
        if (snap.empty) break;
        const first = snap.docs[0];
        const last = snap.docs[snap.docs.length - 1];
        currentLast = last;
        currentPage += 1;
        nextCursors[currentPage - 1] = first;

        if (currentPage === target) {
          const mapped = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
            _snap: d,
          }));
          const onlyQuotations = mapped.filter((q) => {
            const candidateId =
              q.quotation_id ||
              q.proforma_id ||
              q.id ||
              "";
            return candidateId.includes("QTN");
          });

          setRows(onlyQuotations);
          setFirstDoc(first);
          setLastDoc(last);
          setCursors(nextCursors);
          setPage(target);
          return;
        }
      }
    } catch (err) {
      console.error("goToPage error", err);
    } finally {
      setLoading(false);
    }
  };

  // delete quotation
  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this quotation?"
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "quotations", id));
      setTotalCount((c) => Math.max(0, c - 1));

      const currentCursor = cursors[page - 1];
      if (page === 1 || !currentCursor) {
        await runPageQuery({
          direction: "first",
        });
      } else {
        await runPageQuery({
          direction: "jump",
          jumpDoc: currentCursor,
          targetPage: page,
        });
      }
    } catch (err) {
      console.error("delete error", err);
      alert("Failed to delete");
    }
  };

  // close bubble on ESC / scroll
  useEffect(() => {
    const onKey = (e) =>
      e.key === "Escape" && setOpenMenuForId(null);
    const onScroll = () => setOpenMenuForId(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, {
      passive: true,
    });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // ----- pagination bar helpers -----
  const getVisiblePages = (current, total) => {
    const max = 7;
    if (total <= max)
      return [...Array(total)].map((_, i) => i + 1);

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
        disabled
          ? "opacity-50 cursor-not-allowed hover:bg-white"
          : "cursor-pointer",
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
        <PagePill
          disabled={page === 1}
          onClick={() => goToPage(page - 1)}
        >
          ‹
        </PagePill>

        {visible.map((p, i) =>
          typeof p === "number" ? (
            <PagePill
              key={`${p}-${i}`}
              active={p === page}
              onClick={() => goToPage(p)}
            >
              {p}
            </PagePill>
          ) : (
            <span
              key={`${p}-${i}`}
              className="px-2 text-gray-400 select-none"
            >
              …
            </span>
          )
        )}

        <PagePill
          disabled={page === totalPages}
          onClick={() => goToPage(page + 1)}
        >
          ›
        </PagePill>
      </div>
    );
  };

  // top-right controls (items per page / range)
  const TopRightControls = () => {
    const shownFrom = totalCount
      ? (page - 1) * pageSize + (rows.length ? 1 : 0)
      : 0;
    const shownTo = totalCount
      ? Math.min(page * pageSize, totalCount)
      : rows.length;
    return (
      <div className="flex flex-col items-end gap-2 ml-auto">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            Items per page:
          </label>
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
          Showing <strong>{shownFrom || 0}</strong>–
          <strong>{shownTo || 0}</strong> of{" "}
          <strong>{totalCount}</strong>
        </span>
      </div>
    );
  };

  // Actions menu bubble
  function RowActionsBubble({
    onEdit,
    onDelete,
    onPreview,
    anchorRef,
    onClose,
  }) {
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
      return () =>
        document.removeEventListener("mousedown", onClick);
    }, [anchorRef, onClose]);

    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const GAP_Y = 56; // vertical offset
      const BUBBLE_W = 360;
      const top = rect.top + window.scrollY - GAP_Y;
      const left = Math.max(
        12,
        rect.left +
          window.scrollX -
          (BUBBLE_W - rect.width) +
          8
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
          <div className="rounded-full shadow-lg px-4 py-3 flex items-center gap-5 editpopup bg-white">
            <button
              onClick={onEdit}
              className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve border-0 cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve border-0 cursor-pointer"
            >
              Delete
            </button>
            <button
              onClick={onPreview}
              className="px-4 py-1.5 bg-[#ffffff] text-[#2E53A3] rounded-md text-sm font-medium hover:bg-gray-100 transition m-[5px] border-curve border-0 cursor-pointer"
            >
              Preview
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {/* vertical dots */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>

        {isOpen && renderBubble(btnRef)}
      </>
    );
  }

  // ---------- RENDER ----------
  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title bar */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">
          All Quotations
        </h2>
      </div>

      {/* Top-right controls */}
      <div className="flex justify-end mb-4">
        <TopRightControls />
      </div>

      {/* table card */}
      <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[20px]">
        <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
          <table className="min-w-full border-collapse text-sm text-gray-700 border-curve">
            <thead className="bg-[#3b5997] text-gray-700 sticky top-0 z-10">
              <tr className="divide-x divide-[#AAAAAA] text-[#ffffff]">
                {[
                  "Quotation ID",
                  "Client ID",
                  "Title",
                  "Service(s)",
                  "Amount",
                  "Status",
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
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-gray-500 p-[10px]"
                  >
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-gray-500 p-[10px]"
                  >
                    No quotations found.
                  </td>
                </tr>
              ) : (
                rows.map((q, idx) => {
                  const idToShow =
                    q.quotation_id || q.proforma_id || q.id;
                  const amount =
                    q.total_amount || q.amount;
                  const statusNode = formatStatus(
                    rawStatus(q)
                  );

                  return (
                    <tr
                      key={q.id}
                      className={`transition-colors divide-x divide-[#AAAAAA] ${
                        idx % 2 === 0
                          ? "bg-white"
                          : "bg-[#F9F9F9]"
                      } hover:bg-gray-50`}
                    >
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {idToShow}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {q.client_id || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 text-center p-[10px]">
                        {q.quotation_title ||
                          q.proforma_title ||
                          "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 p-[10px]">
                        {getServiceNames(q.services)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-right p-[10px]">
                        {formatINR(amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap text-center p-[10px]">
                        {statusNode}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="relative inline-block">
                          <DotsMenu
                            isOpen={openMenuForId === q.id}
                            onToggle={() =>
                              setOpenMenuForId((prev) =>
                                prev === q.id
                                  ? null
                                  : q.id
                              )
                            }
                            renderBubble={(anchorRef) =>
                              openMenuForId === q.id ? (
                                <RowActionsBubble
                                  anchorRef={anchorRef}
                                  onClose={() =>
                                    setOpenMenuForId(
                                      null
                                    )
                                  }
                                  onEdit={() => {
                                    setOpenMenuForId(
                                      null
                                    );
                                    // ✍️ EDIT QUOTATION ROUTE
                                    navigate(
                                      `/dashboard/edit-quotation/${q.id}`
                                    );
                                  }}
                                  onDelete={async () => {
                                    setOpenMenuForId(
                                      null
                                    );
                                    await handleDelete(
                                      q.id
                                    );
                                  }}
                                  onPreview={() => {
                                    setOpenMenuForId(
                                      null
                                    );
                                    // 👀 PREVIEW QUOTATION ROUTE
                                    navigate(
                                      `/dashboard/quotation/${idToShow}`
                                    );
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

      {/* pagination */}
      <div className="flex justify-end mt-6">
        <PaginationBar />
      </div>
    </div>
  );
}
