// src/pages/PreviewProject.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PreviewProject() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [clientName, setClientName] = useState("");

  // Helpers
  const isWTGroup = useMemo(
    () => (company) => ["WT", "WTPL"].includes(company),
    []
  );
  const isWTXGroup = useMemo(
    () => (company) => ["WTX", "WTXPL"].includes(company),
    []
  );

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const projectRef = doc(db, "projects", id);
        const snap = await getDoc(projectRef);

        if (!snap.exists()) {
          alert("Project not found!");
          return navigate("/dashboard/all-projects");
        }

        const data = snap.data();

        // Resolve client display
        let display = data.clientId || "";
        try {
          if (data.clientId) {
            const clientRef = doc(db, "clients", data.clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
              const c = clientSnap.data();
              // falls back gracefully if any field missing
              display = `${c.company_name || ""} — ${c.client_name || data.clientId}`.trim();
            }
          }
        } catch {
          // keep fallback
        }

        setClientName(display);
        setProject(data);
      } catch (err) {
        console.error("Failed to load project:", err);
        alert("Failed to load project.");
        navigate("/dashboard/all-projects");
      }
    };

    fetchProject();
  }, [id, navigate]);

  if (!project) {
    return <div style={styles.loading}>Loading...</div>;
  }

  const showMovie = isWTGroup(project.company);
  const showBrand = isWTXGroup(project.company);

  // Optional legacy fields (only render if present in doc)
  const hasInvoices =
    Array.isArray(project.invoiceLabels) && project.invoiceLabels.length > 0;
  const hasQuotations =
    Array.isArray(project.quotationLabels) && project.quotationLabels.length > 0;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Project Preview</h2>
      <table style={styles.table}>
        <tbody>
          {row("Project Name", project.projectName)}
          {row("Company", project.company)}
          {row("Client", clientName)}
          {row("POC", project.poc)}
          {showMovie && row("Movie Name", project.movieName || "—")}
          {showBrand && row("Brand Name", project.brandName || "—")}
          {row(
            "Services",
            Array.isArray(project.services) && project.services.length
              ? <BadgeList items={project.services} />
              : "—"
          )}
          {row(
            "Created At",
            project.createdAt?.toDate
              ? project.createdAt.toDate().toLocaleString()
              : "—"
          )}

          {/* Optional legacy rows (only if your doc already has them) */}
          {hasInvoices &&
            row("Invoices", (project.invoiceLabels || []).join(", "))}
          {hasQuotations &&
            row("Quotations", (project.quotationLabels || []).join(", "))}
        </tbody>
      </table>

      <div style={styles.buttonWrapper}>
        <button style={styles.button} onClick={() => navigate(-1)}>
          Back
        </button>
        <button
          style={{ ...styles.button, backgroundColor: "#28a745", marginLeft: 12 }}
          onClick={() => navigate(`/dashboard/edit-project/${id}`)}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function row(label, value) {
  return (
    <tr>
      <td style={styles.label}>{label}</td>
      <td style={styles.value}>
        {typeof value === "string" || typeof value === "number" ? value : value}
      </td>
    </tr>
  );
}

function BadgeList({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((it, idx) => (
        <span key={idx} style={styles.badge}>{it}</span>
      ))}
    </div>
  );
}

const styles = {
  container: {
    padding: "40px",
    maxWidth: "780px",
    margin: "0 auto",
    fontFamily: "Arial, sans-serif",
  },
  heading: {
    fontSize: "32px",
    fontWeight: "bold",
    marginBottom: "30px",
    textAlign: "center",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1px solid #ddd",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
  },
  label: {
    padding: "16px",
    fontWeight: "bold",
    backgroundColor: "#f7f7f7",
    borderBottom: "1px solid #ddd",
    width: "38%",
  },
  value: {
    padding: "16px",
    borderBottom: "1px solid #ddd",
    verticalAlign: "top",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#111",
    color: "#fff",
    fontSize: 12,
    lineHeight: 1,
  },
  buttonWrapper: {
    textAlign: "center",
    marginTop: "30px",
  },
  button: {
    padding: "10px 30px",
    fontSize: "16px",
    backgroundColor: "#007BFF",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  loading: {
    textAlign: "center",
    fontSize: "20px",
    padding: "50px",
  },
};
