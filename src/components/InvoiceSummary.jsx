import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function InvoiceSummary() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    const fetchClients = async () => {
      const snapshot = await getDocs(collection(db, "clients"));
      const clientsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setClients(clientsData);
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      const snapshot = await getDocs(collection(db, "projects"));
      const projectsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProjects(projectsData);
    };
    fetchProjects();
  }, []);

  const handlePresetChange = (e) => {
    const value = e.target.value;
    if (value === "") return;

    const today = new Date();
    let start, end;
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    if (value === "1month") {
      start = new Date(currentYear, currentMonth - 1, 1);
      end = new Date(currentYear, currentMonth, 0);
    } else if (value === "3months") {
      start = new Date(currentYear, currentMonth - 3, 1);
      end = new Date(currentYear, currentMonth, 0);
    } else if (value === "6months") {
      start = new Date(currentYear, currentMonth - 6, 1);
      end = new Date(currentYear, currentMonth, 0);
    } else if (value === "1year") {
      start = new Date(currentYear - 1, currentMonth, 1);
      end = new Date(currentYear, currentMonth, 0);
    }

    setFromDate(start.toISOString().substring(0, 10));
    setToDate(end.toISOString().substring(0, 10));
    setSelectedClient("");
    setSelectedProject("");
  };

  const handleGenerateReport = async () => {
    if (!fromDate || !toDate) {
      alert("Please select both dates");
      return;
    }

    setLoading(true);
    try {
      const startDate = new Date(fromDate);
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);

      const snapshot = await getDocs(collection(db, "invoices"));
      const invoices = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filtered = invoices.filter((inv) => {
        let invDate = inv.invoice_date;
        if (!invDate) return false;

        if (invDate.toDate) {
          invDate = invDate.toDate();
        } else {
          invDate = new Date(invDate);
        }

        const matchClient = selectedClient ? inv.client_id === selectedClient : true;
        const matchProject = selectedProject ? inv.project_id === selectedProject : true;

        return invDate >= startDate && invDate <= endDate && matchClient && matchProject;
      });

      filtered.sort((a, b) => {
        const dateA = a.invoice_date?.toDate?.() || new Date(a.invoice_date);
        const dateB = b.invoice_date?.toDate?.() || new Date(b.invoice_date);
        return dateB - dateA;
      });

      const total = filtered.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

      setSummaryData(filtered);
      setTotalAmount(total);
    } catch (err) {
      console.error("Error generating report:", err);
      alert("Error generating report");
    }
    setLoading(false);
  };

  // Filter project list based on selected client
  const filteredProjects = selectedClient
    ? projects.filter((p) => p.clientId === selectedClient)
    : projects;

  return (
    <div className="bg-white p-6 rounded shadow-md invoice-summary">
      <h2 className="text-2xl font-bold mb-6">Invoice Report (Date Range)</h2>

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="invoice-summary-cnt">
          <label>From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <div className="invoice-summary-cnt">
          <label>To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border p-2 rounded"
          />
        </div>
        <div className="invoice-summary-cnt">
          <label>Client:</label>
          <select
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setSelectedProject(""); // reset project when client changes
            }}
            className="border p-2 rounded"
          >
            <option value="">All Clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.client_name || client.companyName}
              </option>
            ))}
          </select>
        </div>
        <div className="invoice-summary-cnt">
          <label>Project:</label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">All Projects</option>
            {filteredProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_name || project.projectName}
              </option>
            ))}
          </select>
        </div>
        <div className="invoice-summary-cnt">
          <label>Quick Select:</label>
          <select onChange={handlePresetChange} className="border p-2 rounded">
            <option value="">Select Range</option>
            <option value="1month">Last 1 Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last 1 Year</option>
          </select>
        </div>
        <button
          onClick={handleGenerateReport}
          className="bg-black text-white px-4 py-2 rounded generate-btn"
        >
          Generate
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {summaryData.length === 0 ? (
            <p className="text-gray-600">No invoices found for the selected range.</p>
          ) : (
            <table className="border-collapse border mt-4 w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="border p-2">Invoice ID</th>
                  <th className="border p-2">Client</th>
                  <th className="border p-2">Project</th>
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((inv, i) => {
                  const dateObj = inv.invoice_date?.toDate?.() || new Date(inv.invoice_date);
                  const formattedDate = dateObj.toISOString().split("T")[0];
                  const clientName =
                    clients.find((c) => c.id === inv.client_id)?.client_name || inv.client_id;
                  const projectName =
                    projects.find((p) => p.id === inv.project_id)?.project_name ||
                    projects.find((p) => p.id === inv.project_id)?.projectName ||
                    "-";
                  return (
                    <tr key={i}>
                      <td className="border p-2">{inv.invoice_id || inv.id}</td>
                      <td className="border p-2">{clientName}</td>
                      <td className="border p-2">{projectName}</td>
                      <td className="border p-2">{formattedDate}</td>
                      <td className="border p-2">
                        ₹{" "}
                        {Number(inv.total_amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-gray-100">
                  <td colSpan="4" className="border p-2 text-right">
                    Total
                  </td>
                  <td className="border p-2">
                    ₹{" "}
                    {totalAmount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
