// src/pages/PreviewPOC.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PreviewPOC() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [poc, setPoc] = useState(null);

  // (kept for parity/future use if you later group POCs by company)
  const isWTGroup = useMemo(() => (company) => ["WT", "WTPL"].includes(company), []);
  const isWTXGroup = useMemo(() => (company) => ["WTX", "WTXPL"].includes(company), []);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "pocs", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("POC not found!");
          return navigate("/dashboard/all-pocs");
        }

        const data = { id: snap.id, ...snap.data() };
        setPoc(data);
      } catch (e) {
        console.error("Failed to load POC:", e);
        alert("Failed to load POC.");
        navigate("/dashboard/all-pocs");
      }
    })();
  }, [id, navigate]);

  if (!poc) {
    return (
      <div className="p-[30px] bg-[#f5f7fb] min-h-screen flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  // ---------- helpers (mirroring PreviewProject) ----------
  const fmt = (v, fallback = "—") =>
    v === undefined || v === null || String(v).trim() === "" ? fallback : v;

  const fmtDateTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
      if (!d || isNaN(d)) return "—";
      return d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  const formatProjects = (projects) => {
    if (!projects) return "—";
    if (Array.isArray(projects)) {
      const items = projects
        .flatMap((p) => (typeof p === "string" ? p.split(/[,|]/g) : p?.name || p?.title || p?.id || []))
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      return items.length ? items.join(", ") : "—";
    }
    if (typeof projects === "string") {
      const parts = projects.split(/[,|]/g).map((s) => s.trim()).filter(Boolean);
      return parts.length ? parts.join(", ") : "—";
    }
    const guess = projects.name || projects.title || projects.id || "";
    return fmt(guess);
  };

  // Build rows in the same 2-column zebra style
  const rows = [
    { label: "POC Name", value: fmt(poc.poc_name) },
    { label: "POC ID", value: fmt(poc.poc_id || poc.id) },
    { label: "Projects", value: formatProjects(poc.projects) },
    { label: "Created At", value: fmtDateTime(poc.createdAt) },
  ];

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title chip (same as other pages) */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve mb-[30px]">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">POC Preview</h2>
      </div>

      {/* Card */}
      <div className="bg-[#ffffff] border-curve rounded-xl shadow p-[18px] md:p-[22px]">
        <div className="overflow-hidden rounded-xl">
          <table className="border-separate border-spacing-0 w-[100%]">
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.label}
                  className={i % 2 === 0 ? "bg-[#F3F7FF]" : "bg-[#ffffff]"}
                >
                  <td className="w-[50%] md:w-[35%] px-4 md:px-5 py-3 md:py-3.5 font-semibold text-gray-700 border-b border-[#E7ECF6] p-[10px] border-curve">
                    {r.label}
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-3.5 text-gray-800 border-b border-[#E7ECF6] p-[10px] w-[50%] border-curve">
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Buttons (identical classes to Client/Project Preview) */}
        <div className="mt-5 flex items-center gap-3 mt-[20px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-md bg-[#2E53A3] text-[#ffffff] hover:opacity-95 border-0 border-curve w-[100px] h-[40px] mr-[10px]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/edit-poc/${id}`)}
            className="px-4 py-2 rounded-md bg-[#28a745] text-[#ffffff] hover:opacity-95 border-0 border-curve w-[100px] h-[40px]"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
