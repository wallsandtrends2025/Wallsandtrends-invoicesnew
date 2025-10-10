// src/pages/PreviewProject.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PreviewProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [clientName, setClientName] = useState("");

  // group helpers
  const isWTGroup = useMemo(() => (company) => ["WT", "WTPL"].includes(company), []);
  const isWTXGroup = useMemo(() => (company) => ["WTX", "WTXPL"].includes(company), []);

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "projects", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          alert("Project not found!");
          return navigate("/dashboard/all-projects");
        }

        const data = { id: snap.id, ...snap.data() };
        setProject(data);

        // resolve client display (Company — Client) but only if company exists
        if (data.clientId) {
          try {
            const cRef = doc(db, "clients", data.clientId);
            const cSnap = await getDoc(cRef);
            if (cSnap.exists()) {
              const c = cSnap.data();

              const company =
                (c.company_group && String(c.company_group).trim()) ||
                (c.company_name && String(c.company_name).trim()) ||
                "";

              const name =
                (c.client_name && String(c.client_name).trim()) ||
                "";

              // Build display: "Company — Name" only when company exists; otherwise just Name.
              const display =
                name && company
                  ? `${company} — ${name}`
                  : (name || data.clientId || "—");

              setClientName(display);
            } else {
              setClientName(data.clientId || "—");
            }
          } catch {
            setClientName(data.clientId || "—");
          }
        } else {
          setClientName("—");
        }
      } catch (e) {
        console.error("Failed to load project:", e);
        alert("Failed to load project.");
        navigate("/dashboard/all-projects");
      }
    })();
  }, [id, navigate]);

  if (!project) {
    return (
      <div className="p-[30px] bg-[#f5f7fb] min-h-screen flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  // ---------- helpers ----------
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

  const formatServices = (services) => {
    if (!services) return "—";

    if (Array.isArray(services)) {
      const items = services
        .flatMap((s) => {
          if (typeof s === "string") return s.split(/[,|]/g);
          if (Array.isArray(s?.name)) return s.name;
          if (typeof s?.name === "string") return s.name.split(/[,|]/g);
          return s?.serviceName || s?.title || [];
        })
        .map((x) => String(x || "").trim())
        .filter(Boolean);
      return items.length ? items.join(", ") : "—";
    }

    if (typeof services === "string") {
      const parts = services.split(/[,|]/g).map((s) => s.trim()).filter(Boolean);
      return parts.length ? parts.join(", ") : "—";
    }

    const guess =
      services.name ||
      services.serviceName ||
      services.title ||
      "";
    return fmt(guess);
  };

  const showMovie = isWTGroup(project.company);
  const showBrand = isWTXGroup(project.company);

  const projectName = project.projectName || project.project_name;

  const rows = [
    { label: "Project Name", value: fmt(projectName) },
    { label: "Company", value: fmt(project.company) },
    { label: "Client", value: fmt(clientName) },
    { label: "POC", value: fmt(project.poc) },
    {
      label: "Movie / Brand",
      value: showMovie
        ? fmt(project.movieName, "—")
        : showBrand
        ? fmt(project.brandName, "—")
        : "—",
    },
    { label: "Services", value: formatServices(project.services) },
    { label: "Created At", value: fmtDateTime(project.createdAt) },
  ];

  if (Array.isArray(project.invoiceLabels) && project.invoiceLabels.length) {
    rows.push({
      label: "Invoices",
      value: project.invoiceLabels.join(", "),
    });
  }

  if (Array.isArray(project.quotationLabels) && project.quotationLabels.length) {
    rows.push({
      label: "Quotations",
      value: project.quotationLabels.join(", "),
    });
  }

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve mb-[30px]">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">
          Project Preview
        </h2>
      </div>

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
            onClick={() => navigate(`/dashboard/edit-project/${id}`)}
            className="px-4 py-2 rounded-md bg-[#28a745] text-[#ffffff] hover:opacity-95 border-0 border-curve w-[100px] h-[40px]"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}