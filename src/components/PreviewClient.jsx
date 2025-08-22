import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PreviewClient() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClient = async () => {
      const clientRef = doc(db, "clients", id);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        setClient(clientSnap.data());
      } else {
        alert("Client not found!");
        navigate("/dashboard/all-clients");
      }
    };
    fetchClient();
  }, [id, navigate]);

  if (!client) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Client Preview</h2>

      <table style={styles.table}>
        <tbody>
          {renderRow("Client Name", client.client_name)}
          {renderRow("Company Name", client.company_name)}
          {renderRow("POC", client.poc)}
          {renderRow("Phone Number", client.phone)}
          {renderRow("Email", client.email)}
          {renderRow("Address", client.address)}
          {renderRow("Country", client.country)}
          {renderRow("State", client.state)}
          {renderRow("PAN Number", client.pan_number)}
          {renderRow("GST Number", client.gst_number)}
          {renderRow("Created At", client.created_at?.toDate().toLocaleString())}
        </tbody>
      </table>

      <div style={styles.buttonWrapper}>
        <button style={styles.button} onClick={() => navigate(-1)}>Back</button>
        <button
          style={{ ...styles.button, backgroundColor: "#28a745", marginLeft: "12px" }}
          onClick={() => navigate(`/dashboard/edit-client/${id}`)}
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
