// src/components/AllPOCs.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

/* ---------- Static Master POC List (grouped) ---------- */
const pocByGroup = {
  WT: [
    "Suryadevara Veda sai Krishna - WT120",
    "Koduru Abhilash Reddy - WT146",
    "Sajja Seshasai - WT131",
  ],
  WTPL: [
    "Suryadevara Veda sai Krishna - WT120",
    "Koduru Abhilash Reddy - WT146",
    "Sajja Seshasai - WT131",
  ],
  WTX: [
    "Lingareddy Navya - WT122",
    "Rohith Gali - WT259",
    "Mohit Vamsi - WT274",
    "Anouska Panda - WT286",
    "Kamya Mogulagani - WT262",
    "Varshini Suragowni - WT263",
    "Addanki Sai Durga - WT284",
    "Sharvana Sandhya - WT266",
    "Vineel Raj - WT321",
  ],
  WTXPL: [
    "Lingareddy Navya - WT122",
    "Rohith Gali - WT259",
    "Mohit Vamsi - WT274",
    "Anouska Panda - WT286",
    "Kamya Mogulagani - WT262",
    "Varshini Suragowni - WT263",
    "Addanki Sai Durga - WT284",
    "Sharvana Sandhya - WT266",
    "Vineel Raj - WT321",
  ],
};

const parseFormatted = (label) => {
  const [name, poc_id] = (label || "").split(" - ");
  return { poc_name: (name || "").trim(), poc_id: (poc_id || "").trim() };
};

const MASTER_ROWS = Object.entries(pocByGroup).flatMap(([company, list]) =>
  list.map((s) => ({
    ...parseFormatted(s),
    company,
    id: `master:${company}:${s}`,
    __source: "master",
  }))
);

// Useful for filters
const COMPANY_OPTIONS = ["WT", "WTPL", "WTX", "WTXPL"];

export default function AllPOCs() {
  const [savedPocs, setSavedPocs] = useState([]); // Firestore rows
  const [loading, setLoading] = useState(false);

  // pagination (combined -> deduped)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // number or "all"

  // filters
  const [queryText, setQueryText] = useState("");
  const [companyFilter, setCompanyFilter] = useState(new Set()); // Set<string>

  const navigate = useNavigate();
  const [openMenuForId, setOpenMenuForId] = useState(null); // which row menu is open
  const [dismissedMaster, setDismissedMaster] = useState(new Set()); // soft-delete for masters

  // Live Firestore subscription (Saved POCs)
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(
      collection(db, "pocs"),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          __source: "saved",
          ...d.data(),
        }));
        list.sort((a, b) => (a.poc_name || "").localeCompare(b.poc_name || ""));
        setSavedPocs(list);
        setPage(1);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading POCs:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // ---------------- Build base + de-duplicated rows ----------------

  // Base set (Saved + Master minus dismissed masters)
  const baseRows = useMemo(() => {
    const normalizedSaved = savedPocs.map((r) => ({
      ...r,
      company: r.company || "", // ensure present for aggregation
      // normalize in case older docs used "projects"
      project_ids: r.project_ids || r.projects || [],
      project_names: r.project_names || [],
    }));
    const visibleMaster = MASTER_ROWS.filter((m) => !dismissedMaster.has(m.id));
    return [...normalizedSaved, ...visibleMaster];
  }, [savedPocs, dismissedMaster]);

  // Deduplicate by (poc_name + poc_id) and aggregate companies. Prefer saved Firestore as "primary".
  const dedupedRows = useMemo(() => {
    const map = {};

    for (const r of baseRows) {
      const key = `${(r.poc_name || "").toLowerCase()}|${(r.poc_id || "").toLowerCase()}`;
      if (!map[key]) {
        map[key] = {
          ...r,
          companiesSet: new Set(),
          sourceRows: [],
          display_companies: "",
          primary: null,
        };
      }
      if (r.company) map[key].companiesSet.add(r.company);
      map[key].sourceRows.push(r);

      // Saved row takes precedence for display/links
      if (r.__source === "saved") {
        map[key] = {
          ...map[key],
          ...r,
          companiesSet: map[key].companiesSet,
          sourceRows: map[key].sourceRows,
        };
      }
    }

    const out = Object.values(map).map((row) => {
      const companyList = Array.from(row.companiesSet).filter(Boolean).sort();
      const primary = row.sourceRows.find((s) => s.__source === "saved") || row.sourceRows[0];

      return {
        ...row,
        display_companies: companyList.length ? companyList.join(", ") : "—",
        primary,
        // ensure normalized fields on the primary for UI
        project_ids:
          (primary && (primary.project_ids || primary.projects)) || row.project_ids || [],
        project_names:
          (primary && primary.project_names) || row.project_names || [],
      };
    });

    out.sort((a, b) => (a.poc_name || "").localeCompare(b.poc_name || ""));
    return out;
  }, [baseRows]);

  // ---------------- Filters (company + search) ----------------
  const filteredRows = useMemo(() => {
    let rows = dedupedRows;

    // company filter
    if (companyFilter.size > 0) {
      rows = rows.filter((r) =>
        r.display_companies
          .split(",")
          .map((s) => s.trim())
          .some((c) => companyFilter.has(c))
      );
    }

    // text search (name or id)
    const q = queryText.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) => {
        const n = (r.poc_name || "").toLowerCase();
        const id = (r.poc_id || "").toLowerCase();
        return n.includes(q) || id.includes(q);
      });
    }

    return rows;
  }, [dedupedRows, queryText, companyFilter]);

  // ---------------- Pagination over filtered list ----------------
  const totalRows = filteredRows.length;
  const isShowAll = pageSize === "all";
  const effectivePageSize = isShowAll ? totalRows || 1 : pageSize;
  const totalPages = Math.max(1, isShowAll ? 1 : Math.ceil(totalRows / effectivePageSize));
  const startIdx = isShowAll ? 0 : (page - 1) * effectivePageSize;
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + effectivePageSize, totalRows);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedRows = useMemo(
    () => (isShowAll ? filteredRows : filteredRows.slice(startIdx, endIdx)),
    [filteredRows, isShowAll, startIdx, endIdx]
  );

  const safeJoin = (arr, sep = ", ") =>
    (arr || [])
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .join(sep) || "—";

  // Delete handler (saved → Firestore; master → UI soft-hide)
  const handleDelete = async (row) => {
    if (row.__source === "saved") {
      if (!window.confirm("Delete this saved POC?")) return;
      try {
        await deleteDoc(doc(db, "pocs", row.id));
      } catch (e) {
        console.error("Delete POC failed:", e);
        alert("Failed to delete POC.");
      }
    } else {
      if (!window.confirm("Remove this master POC from the list (UI only)?")) return;
      setDismissedMaster((prev) => new Set(prev).add(row.id));
    }
  };

  // -------- Round pagination pills (same as AllClients) --------
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

  // --- Top: Add POC + Filters + Items per page + Showing count
  const TopRightControls = () => (
    <div className="flex items-center gap-3  flex-wrap justify-between">
      {/* Left cluster: Add + Search + Companies */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/dashboard/add-poc")}
          className="bg-[#3b5997] text-white text-sm font-semibold rounded-[10px] h-[36px] px-4 border-0 hover:opacity-95 transition-colors"
        >
          + Add POC
        </button>

        <div className="relative">
          <input
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setPage(1);
            }}
            className="border border-gray-300 rounded-md px-3 h-[36px] w-64 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            placeholder="Search by name or ID"
          />
        </div>

      
      </div>

      {/* Right cluster: Items per page + counts */}
      <div className="flex flex-col items-end gap-1 ml-auto">
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
    </div>
  );

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">All POCs</h2>
      </div>

      {/* Top controls */}
      <div className="mb-4">
        <TopRightControls />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">Loading...</div>
      ) : totalRows === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No POCs found.
          <div className="mt-4">
            <button
              onClick={() => navigate("/dashboard/add-poc")}
              className="bg-[#3b5997] text-white text-sm font-semibold rounded-[10px] h-[36px] px-4 border-0 hover:opacity-95 transition-colors"
            >
              + Add your first POC
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Card with table */}
          <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[20px]">
            <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
              <table className="min-w-full border-collapse text-sm text-gray-700 border-curve">
                <thead className="bg-[#3b5997] text-[#ffffff] sticky top-0 z-10 p-[10px]">
                  <tr className="divide-x divide-[#AAAAAA] p-[10px] text-[#ffffff]">
                    {["Company", "POC Name", "POC ID", "Projects", "Actions"].map((h) => (
                      <th key={h} className="px-6 py-4 font-semibold text-sm text-center p-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {pagedRows.map((row, idx) => (
                    <tr
                      key={row.primary?.id || row.id}
                      className={`p-[10px] transition-colors divide-x divide-[#AAAAAA] ${
                        idx % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"
                      } hover:bg-gray-50`}
                    >
                      {/* Company: aggregated */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px] text-center">
                        {row.display_companies}
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px]">
                        {row.poc_name || "—"}
                      </td>

                      {/* POC ID */}
                      <td className="px-6 py-4 text-sm text-gray-800 whitespace-nowrap p-[10px] text-center">
                        {row.poc_id || "—"}
                      </td>

                      {/* Projects (saved records only) */}
                      <td className="px-6 py-4 text-sm text-gray-800 p-[10px] text-center">
                        {row.primary?.__source === "saved" ? (
                          <div className="inline-block group relative">
                            <span className="underline text-blue-700">
                              {(row.project_ids || []).length} selected
                            </span>
                            <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 mt-2 w-64 bg-white border rounded-md shadow p-2 text-left z-20">
                              <div className="text-xs text-gray-500 mb-1">Projects</div>
                              <div className="text-sm text-gray-800">
                                {safeJoin(row.project_names)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Actions with 3-dots + bubble (operate on primary) */}
                      <td className="px-6 py-4 whitespace-nowrap p-[10px]">
                        <div className="relative">
                          <DotsMenu
                            isOpen={openMenuForId === (row.primary?.id || row.id)}
                            onToggle={() =>
                              setOpenMenuForId((prev) =>
                                prev === (row.primary?.id || row.id) ? null : (row.primary?.id || row.id)
                              )
                            }
                            renderBubble={(anchorRef) =>
                              openMenuForId === (row.primary?.id || row.id) ? (
                                <RowActionsBubble
                                  row={row.primary}
                                  anchorRef={anchorRef}
                                  onClose={() => setOpenMenuForId(null)}
                                  onEdit={() => {
                                    const base = row.primary;
                                    const to =
                                      base.__source === "saved"
                                        ? `/dashboard/edit-poc/${encodeURIComponent(base.id)}`
                                        : `/dashboard/add-poc?poc_id=${encodeURIComponent(
                                            base.poc_id || ""
                                          )}&poc_name=${encodeURIComponent(base.poc_name || "")}`;
                                    setOpenMenuForId(null);
                                    setTimeout(() => navigate(to), 0);
                                  }}
                                  onDelete={async () => {
                                    setOpenMenuForId(null);
                                    await handleDelete(row.primary);
                                  }}
                                  onPreview={() => {
                                    const base = row.primary;
                                    const to =
                                      base.__source === "saved"
                                        ? `/dashboard/preview-poc/${encodeURIComponent(base.id)}`
                                        : `/dashboard/add-poc?poc_id=${encodeURIComponent(
                                            base.poc_id || ""
                                          )}&poc_name=${encodeURIComponent(
                                            base.poc_name || ""
                                          )}&mode=view`;
                                    setOpenMenuForId(null);
                                    setTimeout(() => navigate(to), 0);
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

/* -------------------- Helpers: Dots trigger & Bubble (styled like AllClients) -------------------- */

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

function RowActionsBubble({ onEdit, onDelete, onPreview, anchorRef, onClose, row }) {
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
