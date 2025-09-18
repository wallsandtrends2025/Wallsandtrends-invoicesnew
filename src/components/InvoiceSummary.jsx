import { useState, useEffect, useCallback } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function InvoiceSummary() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [summaryData, setSummaryData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedCompanyGroup, setSelectedCompanyGroup] = useState(""); // "" | "WT" | "WTX"
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedProject, setSelectedProject] = useState("");

  // Status filters
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("");       // "" | Pending | Paid | Partial
  const [selectedGstPaymentStatus, setSelectedGstPaymentStatus] = useState(""); // "" | Pending | Paid | Partial | NA

  // Totals (overall totals for filtered dataset)
  const [totalSubtotal, setTotalSubtotal] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  // ---------- pagination ----------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalRows = summaryData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pagedData = summaryData.slice(startIdx, endIdx);

  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  // ---------- helpers ----------
  const normalizeGroup = (val = "") => {
    const v = String(val || "").toUpperCase();
    if (v === "WT" || v === "WTPL") return "WT";
    if (v === "WTX" || v === "WTXPL") return "WTX";
    return "";
  };

  const getInvoiceCompanyGroup = (inv) => {
    const raw =
      inv.invoice_type ||
      inv.company ||
      inv.company_code ||
      inv.company_name ||
      inv.companyName ||
      "";
    return normalizeGroup(raw);
  };

  const getTaxValue = (inv) => {
    if (inv.tax_amount != null) return Number(inv.tax_amount) || 0;
    const cgst = Number(inv.cgst || 0);
    const sgst = Number(inv.sgst || 0);
    const igst = Number(inv.igst || 0);
    return cgst + sgst + igst;
  };

  const toMillis = (x) => {
    if (!x) return 0;
    if (typeof x?.toMillis === "function") return x.toMillis();
    if (typeof x?.toDate === "function") return x.toDate().getTime();
    const n = new Date(x).getTime();
    return Number.isNaN(n) ? 0 : n;
  };

  const fmtDateTime = (v) => {
    if (!v) return "-";
    const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
    if (isNaN(d)) return "-";
    return d.toLocaleString("en-IN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // pick latest item by "at" from history list, else fallback fields
  const latestHistoryAt = (inv, listField, fallbacks = []) => {
    const list = Array.isArray(inv?.[listField]) ? inv[listField] : [];
    const latestFromList = list.reduce((best, cur) => {
      const curMs = toMillis(cur?.at);
      return curMs > toMillis(best?.at) ? cur : best;
    }, null);

    if (latestFromList?.at) return latestFromList.at;

    for (const f of fallbacks) {
      if (inv?.[f]) return inv[f];
    }
    return null;
  };

  // ---------- load base data once ----------
  useEffect(() => {
    (async () => {
      const cs = await getDocs(collection(db, "clients"));
      setClients(cs.docs.map((d) => ({ id: d.id, ...d.data() })));
      const ps = await getDocs(collection(db, "projects"));
      setProjects(ps.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, []);

  // ---------- quick ranges ----------
  const handlePresetChange = (e) => {
    const value = e.target.value;
    if (!value) return;

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    let start, end;

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

  // ---------- core loader (handles empty date => "all") ----------
  const fetchAndFilter = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "invoices"));
      const invoices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const hasFrom = Boolean(fromDate);
      const hasTo = Boolean(toDate);
      const startDate = hasFrom ? new Date(fromDate) : new Date(0); // -infinity
      const endDate = hasTo ? new Date(toDate) : new Date(8640000000000000); // +infinity
      if (hasTo) endDate.setHours(23, 59, 59, 999);

      const filtered = invoices.filter((inv) => {
        // date
        let invDate = inv.invoice_date;
        if (!invDate) return false;
        invDate = invDate?.toDate ? invDate.toDate() : new Date(invDate);

        // company bucket
        const invGroup = getInvoiceCompanyGroup(inv);
        const matchCompany = selectedCompanyGroup ? invGroup === selectedCompanyGroup : true;

        // client & project
        const matchClient = selectedClient ? inv.client_id === selectedClient : true;
        const matchProject = selectedProject ? inv.project_id === selectedProject : true;

        // statuses
        const matchPayment = selectedPaymentStatus
          ? (inv.payment_status || "") === selectedPaymentStatus
          : true;

        const matchGstPayment = selectedGstPaymentStatus
          ? (inv.gst_payment_status || "NA") === selectedGstPaymentStatus
          : true;

        return (
          invDate >= startDate &&
          invDate <= endDate &&
          matchCompany &&
          matchClient &&
          matchProject &&
          matchPayment &&
          matchGstPayment
        );
      });

      // sort by date desc
      filtered.sort((a, b) => {
        const dateA = a.invoice_date?.toDate?.() || new Date(a.invoice_date);
        const dateB = b.invoice_date?.toDate?.() || new Date(b.invoice_date);
        return dateB - dateA;
      });

      // totals
      const subtotalSum = filtered.reduce((sum, inv) => sum + Number(inv.subtotal || 0), 0);
      const taxSum = filtered.reduce((sum, inv) => sum + getTaxValue(inv), 0);
      const grandSum = filtered.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

      // NEW: paid & pending sums
      const paidSum = filtered.reduce(
        (sum, inv) => sum + Number(inv.amount_paid_total ?? inv.paid_amount ?? 0),
        0
      );
      const pendingSum = filtered.reduce((sum, inv) => {
        const total = Number(inv.total_amount || 0);
        const paid = Number(inv.amount_paid_total ?? inv.paid_amount ?? 0);
        return sum + Math.max(total - paid, 0);
      }, 0);

      setSummaryData(filtered);
      setTotalSubtotal(subtotalSum);
      setTotalTax(taxSum);
      setTotalAmount(grandSum);
      setTotalPaid(paidSum);
      setTotalPending(pendingSum);

      // reset to page 1 whenever data is regenerated
      setPage(1);
    } catch (e) {
      console.error("Error loading invoices:", e);
      alert("Error loading invoices");
    }
    setLoading(false);
  }, [
    fromDate,
    toDate,
    selectedCompanyGroup,
    selectedClient,
    selectedProject,
    selectedPaymentStatus,
    selectedGstPaymentStatus,
  ]);

  // auto-run on mount & whenever filters/dates change
  useEffect(() => {
    fetchAndFilter();
  }, [fetchAndFilter]);

  // ---------- dependent dropdowns ----------
  const filteredClients = clients.filter((c) =>
    selectedCompanyGroup ? normalizeGroup(c.company_name) === selectedCompanyGroup : true
  );

  const filteredProjects = projects
    .filter((p) => (selectedCompanyGroup ? normalizeGroup(p.company) === selectedCompanyGroup : true))
    .filter((p) => (selectedClient ? p.clientId === selectedClient : true));

  // ---------- pagination controls ----------
  const PaginationControls = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Rows per page:</label>
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          className="border p-1 rounded"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <span className="text-sm text-gray-600">
          Showing <strong>{totalRows ? startIdx + 1 : 0}</strong>–<strong>{endIdx}</strong> of <strong>{totalRows}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => goToPage(1)}
          disabled={page === 1}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          « First
        </button>
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          ‹ Prev
        </button>

        <div className="flex items-center gap-1">
          <span className="text-sm">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={page}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="w-16 border p-1 rounded text-center"
          />
          <span className="text-sm">of {totalPages}</span>
        </div>

        <button
          onClick={() => goToPage(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Next ›
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1 border rounded disabled:opacity-50"
        >
          Last »
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 rounded shadow-md invoice-summary">
      <h2 className="text-2xl font-bold mb-6">Invoice Report</h2>

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="invoice-summary-cnt">
          <label>From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border p-2 rounded"
          />
          <small className="block text-gray-500">Leave blank to include all</small>
        </div>

        <div className="invoice-summary-cnt">
          <label>To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border p-2 rounded"
          />
          <small className="block text-gray-500">Leave blank to include all</small>
        </div>

        <div className="invoice-summary-cnt">
          <label>Company:</label>
          <select
            value={selectedCompanyGroup}
            onChange={(e) => {
              setSelectedCompanyGroup(e.target.value);
              setSelectedClient("");
              setSelectedProject("");
            }}
            className="border p-2 rounded"
          >
            <option value="">All Companies</option>
            <option value="WT">WT (incl. WTPL)</option>
            <option value="WTX">WTX (incl. WTXPL)</option>
          </select>
        </div>

        <div className="invoice-summary-cnt">
          <label>Client:</label>
          <select
            value={selectedClient}
            onChange={(e) => {
              setSelectedClient(e.target.value);
              setSelectedProject("");
            }}
            className="border p-2 rounded"
          >
            <option value="">All Clients</option>
            {filteredClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.client_name || client.company_name || client.companyName}
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
          <label>Payment Status:</label>
          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
          </select>
        </div>

        <div className="invoice-summary-cnt">
          <label>GST Payment Status:</label>
          <select
            value={selectedGstPaymentStatus}
            onChange={(e) => setSelectedGstPaymentStatus(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="NA">NA</option>
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

        <div className="self-end">
          <button
            onClick={fetchAndFilter}
            className="bg-black text-white px-4 py-2 rounded generate-btn"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Top pagination controls */}
      <PaginationControls />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {summaryData.length === 0 ? (
            <p className="text-gray-600 mt-4">No invoices found for the selected filters.</p>
          ) : (
            <div className="relative overflow-x-auto max-h-[600px] overflow-y-auto mt-2">
              <table className="border-collapse border mt-0 w-full min-w-[2000px]">
                <thead className="bg-blue-600 text-white sticky top-0 z-10">
                  <tr>
                    <th className="border p-2">Invoice ID</th>
                    <th className="border p-2">Company</th>
                    <th className="border p-2">Client</th>
                    <th className="border p-2">Project</th>
                    <th className="border p-2">Date</th>
                    {/* NEW */}
                    <th className="border p-2">Last Updated</th>
                    <th className="border p-2">Invoice Value</th>
                    <th className="border p-2">Tax Value</th>
                    <th className="border p-2">Total Value</th>
                    <th className="border p-2">Paid Amount</th>
                    <th className="border p-2">Pending Amount</th>
                    <th className="border p-2">Invoice Status</th>
                    <th className="border p-2">GST Payment Status</th>
                    <th className="border p-2">Last Payment Update</th>
                    <th className="border p-2">Last GST Update</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedData.map((inv) => {
                    const dateObj = inv.invoice_date?.toDate?.() || new Date(inv.invoice_date);
                    const formattedDate = isNaN(dateObj) ? "-" : dateObj.toISOString().split("T")[0];

                    const clientObj = clients.find((c) => c.id === inv.client_id);
                    const clientName = clientObj?.client_name || clientObj?.company_name || inv.client_id;

                    const projObj = projects.find((p) => p.id === inv.project_id);
                    const projectName = projObj?.project_name || projObj?.projectName || "-";

                    const companyGroup = getInvoiceCompanyGroup(inv) || "-";

                    const invoiceValue = Number(inv.subtotal || 0);
                    const taxValue = getTaxValue(inv);
                    const totalValue = Number(inv.total_amount || 0);

                    const paidValue = Number(inv.amount_paid_total ?? inv.paid_amount ?? 0);
                    const pendingValue = Math.max(totalValue - paidValue, 0);

                    const invoiceStatus = inv.payment_status || "-";
                    const gstPaymentStatus = inv.gst_payment_status || "NA";

                    const lastPaymentAt = latestHistoryAt(
                      inv,
                      "payment_status_history",
                      ["payment_date", "updated_at"]
                    );
                    const lastGstAt = latestHistoryAt(
                      inv,
                      "gst_payment_status_history",
                      ["updated_at"]
                    );

                    const lastUpdated = inv.updated_at ? fmtDateTime(inv.updated_at) : "-";

                    return (
                      <tr key={inv.id}>
                        <td className="border p-2">{inv.invoice_id || inv.id}</td>
                        <td className="border p-2">{companyGroup}</td>
                        <td className="border p-2">{clientName}</td>
                        <td className="border p-2">{projectName}</td>
                        <td className="border p-2">{formattedDate}</td>
                        {/* NEW */}
                        <td className="border p-2">{lastUpdated}</td>

                        <td className="border p-2">
                          ₹ {invoiceValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="border p-2">
                          ₹ {taxValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="border p-2">
                          ₹ {totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="border p-2">
                          ₹ {paidValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="border p-2">
                          ₹ {pendingValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        <td className="border p-2">{invoiceStatus}</td>
                        <td className="border p-2">{gstPaymentStatus}</td>
                        <td className="border p-2">{fmtDateTime(lastPaymentAt)}</td>
                        <td className="border p-2">{fmtDateTime(lastGstAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Sticky totals footer */}
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="font-bold bg-gray-100">
                    {/* colSpan increased from 5 -> 6 to account for new "Last Updated" column */}
                    <td colSpan="6" className="border p-2 text-right">Totals</td>
                    <td className="border p-2">
                      ₹ {Number(totalSubtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border p-2">
                      ₹ {Number(totalTax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border p-2">
                      ₹ {Number(totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border p-2">
                      ₹ {Number(totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border p-2">
                      ₹ {Number(totalPending || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="border p-2">—</td>
                    <td className="border p-2">—</td>
                    <td className="border p-2">—</td>
                    <td className="border p-2">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Bottom pagination controls */}
          {summaryData.length > 0 && <PaginationControls />}
        </>
      )}
    </div>
  );
}
