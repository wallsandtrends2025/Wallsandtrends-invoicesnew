// src/pages/InvoiceSummary.jsx
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

  // Totals
  const [totalSubtotal, setTotalSubtotal] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  // ---------- pagination ----------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // number | 'all'

  const totalRows = summaryData.length;
  const isShowAll = pageSize === "all";
  const effectivePageSize = isShowAll ? (totalRows || 1) : pageSize;
  const totalPages = isShowAll ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const startIdx = isShowAll ? 0 : (page - 1) * effectivePageSize;
  const endIdx = isShowAll ? totalRows : Math.min(startIdx + effectivePageSize, totalRows);
  const pagedData = isShowAll ? summaryData : summaryData.slice(startIdx, endIdx);

  const goToPage = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  // ---------- core loader ----------
  const fetchAndFilter = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "invoices"));
      const invoices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const hasFrom = Boolean(fromDate);
      const hasTo = Boolean(toDate);
      const startDate = hasFrom ? new Date(fromDate) : new Date(0);
      const endDate = hasTo ? new Date(toDate) : new Date(8640000000000000);
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

  // ---------- pagination UI (round pills like other pages) ----------
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
    if (isShowAll || totalPages <= 1) return null;
    const visible = getVisiblePages(page, totalPages);
    return (
      <div className="flex items-center gap-2">
        <PagePill disabled={page === 1} onClick={() => goToPage(page - 1)}>‹</PagePill>
        {visible.map((p, i) =>
          typeof p === "number" ? (
            <PagePill key={`${p}-${i}`} active={p === page} onClick={() => goToPage(p)}>
              {p}
            </PagePill>
          ) : (
            <span key={`${p}-${i}`} className="px-2 text-gray-400 select-none">…</span>
          )
        )}
        <PagePill disabled={page === totalPages} onClick={() => goToPage(page + 1)}>›</PagePill>
      </div>
    );
  };

  // ---------- TOP-RIGHT controls (STACKED like other pages) ----------
  const TopRightControls = () => (
    <div className="flex flex-col items-end gap-2 ml-auto">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Items per page:</label>
        <select
          value={String(pageSize)}
          onChange={(e) => {
            const v = e.target.value === "all" ? "all" : Number(e.target.value);
            setPageSize(v);
            setPage(1);
          }}
          className="border border-gray-300 text-gray-700 bg-white rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          <option value="all">Show All</option>
        </select>
      </div>

      <span className="text-sm text-gray-600">
        Showing <strong>{totalRows ? (isShowAll ? 1 : startIdx + 1) : 0}</strong>–
        <strong>{isShowAll ? totalRows : endIdx}</strong> of <strong>{totalRows}</strong>
      </span>
    </div>
  );

  // ---------- small formatter helpers ----------
  const badge = (status) => {
    const map = {
      Paid: "bg-green-100 text-green-800",
      Pending: "bg-red-100 text-red-800",
      Partial: "bg-yellow-100 text-yellow-800",
      NA: "bg-gray-100 text-gray-800",
    };
    const cls = map[status] || "bg-gray-100 text-gray-800";
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${cls}`}>{status || "—"}</span>;
  };

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title bar (same style as other pages) */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">Invoice Report</h2>
      </div>

      {/* Filters row */}
      <div className=" p-[20px] rounded-xl shadow border-[#E6E6E6] mb-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col invoice-summary-cnt">
            <label className="text-sm text-gray-700">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            />
            <small className="text-gray-500">Leave blank to include all</small>
          </div>

          <div className="flex flex-col invoice-summary-cnt">
            <label className="text-sm text-gray-700">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            />
            <small className="text-gray-500">Leave blank to include all</small>
          </div>

          <div className="flex flex-col invoice-summary-cnt min-w-[180px]">
            <label className="text-sm text-gray-700">Company</label>
            <select
              value={selectedCompanyGroup}
              onChange={(e) => {
                setSelectedCompanyGroup(e.target.value);
                setSelectedClient("");
                setSelectedProject("");
              }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            >
              <option value="">All Companies</option>
              <option value="WT">WT (incl. WTPL)</option>
              <option value="WTX">WTX (incl. WTXPL)</option>
            </select>
          </div>

          <div className="flex flex-col invoice-summary-cnt min-w-[220px]">
            <label className="text-sm text-gray-700">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => {
                setSelectedClient(e.target.value);
                setSelectedProject("");
              }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            >
              <option value="">All Clients</option>
              {filteredClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.client_name || client.company_name || client.companyName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col invoice-summary-cnt min-w-[220px]">
            <label className="text-sm text-gray-700">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            >
              <option value="">All Projects</option>
              {filteredProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.project_name || project.projectName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col invoice-summary-cnt">
            <label className="text-sm text-gray-700">Payment Status</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
            </select>
          </div>

          <div className="flex flex-col invoice-summary-cnt">
            <label className="text-sm text-gray-700">GST Payment Status</label>
            <select
              value={selectedGstPaymentStatus}
              onChange={(e) => setSelectedGstPaymentStatus(e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="NA">NA</option>
            </select>
          </div>

          <div className="flex flex-col invoice-summary-cnt">
            <label className="text-sm text-gray-700">Quick Select</label>
            <select onChange={handlePresetChange} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white border-curve">
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
              className="bg-[#2E53A3] text-[#ffffff] px-4 py-2 rounded-md hover:bg-[#234482] transition border-curve h-[40px] border-0"
            >
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* TOP RIGHT controls (stacked) */}
      <div className="flex justify-end mb-3">
        <TopRightControls />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : (
        <>
          {summaryData.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
              No invoices found for the selected filters.
            </div>
          ) : (
            <div className="bg-[#ffffff] p-[30px] border-curve rounded-xl shadow overflow-hidden mt-[10px]">
              <div className="relative overflow-x-auto table-height overflow-y-auto border border-[#AAAAAA] rounded-lg border-curve">
                <table className="min-w-full border-collapse text-sm text-gray-700 border-curve min-w-[1400px]">
                  <thead className="bg-[#3b5997] text-gray-700 sticky top-0 z-10">
                    <tr className="divide-x divide-[#AAAAAA] text-[#ffffff]">
                      {[
                        "Invoice ID",
                        "Company",
                        "Client",
                        "Project",
                        "Date",
                        "Last Updated",
                        "Invoice Value",
                        "Tax Value",
                        "Total Value",
                        "Paid Amount",
                        "Pending Amount",
                        "Invoice Status",
                        "GST Payment Status",
                        "Last Payment Update",
                        "Last GST Update",
                      ].map((h) => (
                        <th key={h} className="px-6 py-4 font-semibold text-sm text-center p-[10px]">{h}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {pagedData.map((inv, idx) => {
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
                        <tr
                          key={inv.id}
                          className={`transition-colors divide-x divide-[#AAAAAA] ${
                            idx % 2 === 0 ? "bg-white" : "bg-[#F9F9F9]"
                          } hover:bg-gray-50`}
                        >
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{inv.invoice_id || inv.id}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{companyGroup}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{clientName}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{projectName}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{formattedDate}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{lastUpdated}</td>

                          <td className="px-6 py-4 text-right whitespace-nowrap p-[10px]">
                            ₹ {invoiceValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap p-[10px]">
                            ₹ {taxValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap p-[10px]">
                            ₹ {totalValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-6 py-4 text-right whitespace-nowrap p-[10px]">
                            ₹ {paidValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap p-[10px]">
                            ₹ {pendingValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </td>

                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{badge(invoiceStatus)}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{badge(gstPaymentStatus)}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{fmtDateTime(lastPaymentAt)}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap p-[10px]">{fmtDateTime(lastGstAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Sticky totals footer */}
                  <tfoot className="sticky bottom-0 z-10">
                    <tr className="font-bold bg-[#F1F1F1] divide-x divide-[#AAAAAA]">
                      <td colSpan={6} className="px-6 py-3 text-right text-gray-700 p-[10px]">Totals</td>
                      <td className="px-6 py-3 text-right text-gray-800 p-[10px]">
                        ₹ {Number(totalSubtotal || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-800 p-[10px]">
                        ₹ {Number(totalTax || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-800 p-[10px]">
                        ₹ {Number(totalAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-800 p-[10px]">
                        ₹ {Number(totalPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-right text-gray-800 p-[10px]">
                        ₹ {Number(totalPending || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-3 text-center text-gray-700 p-[10px]">—</td>
                      <td className="px-6 py-3 text-center text-gray-700 p-[10px]">—</td>
                      <td className="px-6 py-3 text-center text-gray-700 p-[10px]">—</td>
                      <td className="px-6 py-3 text-center text-gray-700 p-[10px]">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Bottom-right round pager (hidden on "Show All") */}
          <div className="flex justify-end mt-6">
            <PaginationBar />
          </div>
        </>
      )}
    </div>
  );
}
