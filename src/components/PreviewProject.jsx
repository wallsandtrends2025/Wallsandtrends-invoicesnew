import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "../firebase";

export default function PreviewProject() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [clientName, setClientName] = useState("");
  const [invoiceLabels, setInvoiceLabels] = useState([]);
  const [quotationLabels, setQuotationLabels] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProject = async () => {
      const projectRef = doc(db, "projects", id);
      const projectSnap = await getDoc(projectRef);

      if (!projectSnap.exists()) {
        alert("Project not found!");
        return navigate("/dashboard/all-projects");
      }

      const projectData = projectSnap.data();

      // Fetch Client Name
      let clientDisplay = "";
      try {
        const clientRef = doc(db, "clients", projectData.clientId);
        const clientSnap = await getDoc(clientRef);
        const client = clientSnap.data();
        clientDisplay = client ? `${client.company_name} — ${client.client_name}` : projectData.clientId;
      } catch {
        clientDisplay = projectData.clientId;
      }

      // Fetch Invoice Numbers
      let invoiceList = [];
      if (projectData.invoiceIds?.length > 0) {
        const allInvoices = await getDocs(collection(db, "invoices"));
        invoiceList = projectData.invoiceIds.map(id => {
          const found = allInvoices.docs.find(doc => doc.id === id);
          return found?.data()?.invoice_id || id;
        });
      }

      // Fetch Quotation Numbers
      let quotationList = [];
      if (projectData.quotationIds?.length > 0) {
        const allQuotations = await getDocs(collection(db, "quotations"));
        quotationList = projectData.quotationIds.map(id => {
          const found = allQuotations.docs.find(doc => doc.id === id);
          return found?.data()?.quotation_id || id;
        });
      }

      setClientName(clientDisplay);
      setInvoiceLabels(invoiceList);
      setQuotationLabels(quotationList);
      setProject(projectData);
    };

    fetchProject();
  }, [id, navigate]);

  if (!project) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Project Preview</h2>
      <table style={styles.table}>
        <tbody>
          {renderRow("Project Name", project.projectName)}
          {renderRow("Client", clientName)}
          {renderRow("POC", project.poc)}
          {renderRow("Movie Name", project.movieName)}
          {renderRow("Work Type", project.workType)}
          {renderRow("Payment Status", project.paymentStatus)}
          {renderRow("Invoices", invoiceLabels.length ? invoiceLabels.join(", ") : "—")}
          {renderRow("Quotations", quotationLabels.length ? quotationLabels.join(", ") : "—")}
          {renderRow("Created At", project.createdAt?.toDate().toLocaleString())}
        </tbody>
      </table>

      <div style={styles.buttonWrapper}>
        <button style={styles.button} onClick={() => navigate(-1)}>Back</button>
        <button
          style={{ ...styles.button, backgroundColor: "#28a745", marginLeft: "12px" }}
          onClick={() => navigate(`/dashboard/edit-project/${id}`)}
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function renderRow(label, value) {
  return (
    <tr>
      <td style={styles.label}>{label}</td>
      <td style={styles.value}>{value || "—"}</td>
    </tr>
  );
}

const styles = {
  container: {
    padding: "40px",
    maxWidth: "700px",
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
    width: "40%",
  },
  value: {
    padding: "16px",
    borderBottom: "1px solid #ddd",
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
