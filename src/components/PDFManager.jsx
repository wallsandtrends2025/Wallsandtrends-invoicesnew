// PDFManager.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
  where,
  limit,
} from "firebase/firestore";
import { downloadChunkedPDF } from "../utils/pdfChunkedStorage";
// PDF generators removed - regeneration functionality removed

/* ---------------- helpers ---------------- */
const normalizeCompanyBucket = (val = "") => {
  const v = String(val || "").toUpperCase();
  if (v === "WT" || v === "WTPL") return "WT";
  if (v === "WTX" || v === "WTXPL") return "WTX";
  return "NA";
};
const normalizeLegalType = (val = "") => {
  const v = String(val || "").toUpperCase();
  if (v === "WTPL" || v === "WTXPL") return "Private Limited";
  if (v === "WT" || v === "WTX") return "Firm";
  return "Unknown";
};
const toMillis = (d) => {
  if (!d) return 0;
  if (typeof d?.toMillis === "function") return d.toMillis();
  if (typeof d?.toDate === "function") return d.toDate().getTime();
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? 0 : t;
};
const formatFileSize = (bytes) => {
  if (!bytes) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = date?.toDate ? date.toDate() : new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const pad2 = (n) => String(n).padStart(2, "0");

// Year folder label: "2025-26 Invoices"
const displayFinancialYear = (y) => {
  if (!y || typeof y !== "number") return String(y ?? "");
  const nextYY = pad2((y + 1) % 100);
  return `${y}-${nextYY} Invoices`;
};

// Generic year-month label (used in breadcrumb & table title)
const displayYearMonth = (y, m) => {
  if (!y || !m) return "N/A";
  return `${y}-${pad2(m)}`;
};

// Month *folder* label (YYYY_MM, no "Invoices")
const displayYearMonthFolder = (y, m) => {
  if (!y || !m) return "N/A";
  return `${y}_${pad2(m)}`;
};

// change this if your presign endpoint has a different path
async function getPresignedUrl(s3Key) {
  const res = await fetch(`/api/s3/presign?key=${encodeURIComponent(s3Key)}`);
  if (!res.ok) throw new Error(`Presign failed: ${res.status}`);
  const json = await res.json();
  if (!json?.url) throw new Error("No URL in presign response");
  return json.url;
}


/* ---------------- main component ---------------- */
export default function PDFManager() {
  const navigate = useNavigate();

  // raw data
  const [pdfMetadata, setPdfMetadata] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  // list page controls
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [sortBy, setSortBy] = useState("created");

  // selection (bulk preview)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isSelected = (rowId) => selectedIds.has(rowId);
  const toggleSelectRow = (rowId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const toggleSelectAllOnPage = () => {
    if (listRows.length === 0) return;
    const allSelected = listRows.every((r) => selectedIds.has(r.id));
    const next = new Set(selectedIds);
    if (allSelected) listRows.forEach((r) => next.delete(r.id));
    else listRows.forEach((r) => next.add(r.id));
    setSelectedIds(next);
  };

  // folder navigation state
  // levels: "root" -> "company" -> "legal" -> "year" -> "month" -> "status" -> "list"
  const [level, setLevel] = useState("root");
  const [selectedCompany, setSelectedCompany] = useState(null); // "WT" | "WTX"
  const [selectedLegalType, setSelectedLegalType] = useState(null); // "Firm" | "Private Limited"
  const [selectedYear, setSelectedYear] = useState(null);       // 2023, 2024...
  const [selectedMonth, setSelectedMonth] = useState(null);     // 1..12
  const [selectedStatus, setSelectedStatus] = useState(null);   // "Paid" | "Partial" | "Pending"

  useEffect(() => {
    fetchPDFMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const safeGetYearMonth = (dateLike) => {
    const ms = toMillis(dateLike);
    if (!ms) return { year: "NA", month: "NA" };
    const d = new Date(ms);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    };
  };

  const fetchPDFMetadata = async () => {
    try {
      setLoading(true);

      // 1) PDFs (existing metadata collection)
      let qPdf = query(collection(db, "pdf_metadata"), orderBy("createdAt", "desc"));
      const pdfSnap = await getDocs(qPdf);
      const pdfs = pdfSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

      // 2) Invoices (to get partitions, status, updated_at, S3 keys & optional docIds)
      const invSnap = await getDocs(collection(db, "invoices"));
      const invoiceMap = {};
      invSnap.forEach((d) => {
        const inv = d.data();
        const key = inv?.invoice_id;
        if (!key) return;

        const companyBucket = normalizeCompanyBucket(inv?.invoice_type);
        // 🚫 removed stray undeclared assignment

        const legalType = normalizeLegalType(inv?.invoice_type);

        invoiceMap[key] = {
          docId: d.id,
          client_id: inv?.client_id || null,
          paymentStatus: inv?.payment_status || "Pending",
          paymentDate: inv?.payment_date || null,
          updatedAt: inv?.updated_at || null,
          companyBucket,
          legalType,
          // keep S3 keys separate from chunked IDs
          s3TaxKey: inv?.tax_pdf_key || null,
          s3ProformaKey: inv?.proforma_pdf_key || null,
          chunkTaxId: inv?.tax_pdf_id || null,
          chunkProformaId: inv?.proforma_pdf_id || null,
        };
      });

      // 3) merge
      const merged = pdfs.map((p) => {
        const inv = invoiceMap[p.invoiceId] || {};
        const { year, month } = safeGetYearMonth(p.createdAt);

        return {
          ...p,
          paymentStatus: inv.paymentStatus || "Pending",
          paymentDate: inv.paymentDate || null,
          updatedAt: inv.updatedAt || null,
          companyBucket: inv.companyBucket || "NA",
          legalType: inv.legalType || "Unknown",
          // use S3 keys ONLY if they are truly keys
          s3Key:
            (String(p.type).toLowerCase() === "tax" ? inv.s3TaxKey
             : String(p.type).toLowerCase() === "proforma" ? inv.s3ProformaKey
             : null) || null,
          // fallback chunked ids (if pdf.pdfId is missing)
          fallbackChunkId:
            (String(p.type).toLowerCase() === "tax" ? inv.chunkTaxId
             : String(p.type).toLowerCase() === "proforma" ? inv.chunkProformaId
             : null) || null,
          invoiceDocId: inv.docId || null,
          invoiceClientId: inv.client_id || null,
          year,
          month,
        };
      });

      setPdfMetadata(merged);
    } catch (e) {
      console.error("Error fetching PDF metadata:", e);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- folder view derivations ---------------- */
  const companies = useMemo(() => {
    const found = new Set(pdfMetadata.map((p) => p.companyBucket).filter(Boolean));
    // If none found, still show both (UX choice)
    const list = ["WT", "WTX"].filter((c) => found.has(c) || found.size === 0);
    return list;
  }, [pdfMetadata]);

  const yearsForCompanyLegal = useMemo(() => {
    const map = new Map();
    pdfMetadata.forEach((p) => {
      const comp = p.companyBucket || "NA";
      const legal = p.legalType || "Unknown";
      const y = p.year;
      if (y === "NA") return;
      const key = `${comp}|${legal}`;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(y);
    });
    return map;
  }, [pdfMetadata]);

  const countsBy = useMemo(() => {
    const byCompany = new Map();
    const byCompanyLegal = new Map();
    const byCompanyLegalYear = new Map();
    const byCompanyLegalYearMonth = new Map();
    const byCompanyLegalYearMonthStatus = new Map();

    pdfMetadata.forEach((p) => {
      const c = p.companyBucket || "NA";
      const l = p.legalType || "Unknown";
      const y = p.year;
      const m = p.month;
      const s = p.paymentStatus || "Pending";

      byCompany.set(c, (byCompany.get(c) || 0) + 1);

      const cl = `${c}|${l}`;
      byCompanyLegal.set(cl, (byCompanyLegal.get(cl) || 0) + 1);

      if (y !== "NA") {
        const cly = `${c}|${l}|${y}`;
        byCompanyLegalYear.set(cly, (byCompanyLegalYear.get(cly) || 0) + 1);
      }

      if (y !== "NA" && m !== "NA") {
        const clym = `${c}|${l}|${y}|${m}`;
        byCompanyLegalYearMonth.set(clym, (byCompanyLegalYearMonth.get(clym) || 0) + 1);

        const clyms = `${c}|${l}|${y}|${m}|${s}`;
        byCompanyLegalYearMonthStatus.set(clyms, (byCompanyLegalYearMonthStatus.get(clyms) || 0) + 1);
      }
    });

    return {
      byCompany,
      byCompanyLegal,
      byCompanyLegalYear,
      byCompanyLegalYearMonth,
      byCompanyLegalYearMonthStatus,
    };
  }, [pdfMetadata]);

  // list rows (company+legal+year+month+optional status)
  const listRows = useMemo(() => {
    if (!selectedCompany || !selectedLegalType || !selectedYear || !selectedMonth) return [];

    let subset = pdfMetadata.filter(
      (p) =>
        p.companyBucket === selectedCompany &&
        (p.legalType || "Unknown") === selectedLegalType &&
        p.year === selectedYear &&
        p.month === selectedMonth
    );

    if (selectedStatus) {
      subset = subset.filter((p) => (p.paymentStatus || "Pending") === selectedStatus);
    }

    const term = searchTerm.toLowerCase();
    const filtered = subset.filter((pdf) => {
      const matchesSearch =
        (pdf.invoiceId || "").toLowerCase().includes(term) ||
        (pdf.filename || "").toLowerCase().includes(term);
      const matchesType = filterType === "all" || String(pdf.type).toLowerCase() === filterType;

      const paymentFilter = selectedStatus || filterPayment;
      const matchesPayment =
        paymentFilter === "all" ||
        (pdf.paymentStatus || "Pending") === paymentFilter;

      return matchesSearch && matchesType && matchesPayment;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "created":
          return toMillis(b.createdAt) - toMillis(a.createdAt);
        case "invoice":
          return (a.invoiceId || "").localeCompare(b.invoiceId || "");
        case "size":
          return (b.originalSize || 0) - (a.originalSize || 0);
        case "type":
          return String(a.type || "").localeCompare(String(b.type || ""));
        case "payment":
          return (a.paymentStatus || "").localeCompare(b.paymentStatus || "");
        default:
          return 0;
      }
    });
    return filtered;
  }, [
    pdfMetadata,
    selectedCompany,
    selectedLegalType,
    selectedYear,
    selectedMonth,
    selectedStatus,
    searchTerm,
    filterType,
    filterPayment,
    sortBy,
  ]);

  /* ---------------- actions ---------------- */
  const handleOpenInvoicesRoot = () => {
    setLevel("company");
    setSelectedCompany(null);
    setSelectedLegalType(null);
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedStatus(null);
  };
  const handleOpenCompany = (company) => {
    setSelectedCompany(company);
    setLevel("legal");
    setSelectedLegalType(null);
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedStatus(null);
  };
  const handleOpenLegal = (legal) => {
    setSelectedLegalType(legal);
    setLevel("year");
    setSelectedYear(null);
    setSelectedMonth(null);
    setSelectedStatus(null);
  };
  const handleOpenYear = (year) => {
    setSelectedYear(year);
    setLevel("month");
    setSelectedMonth(null);
    setSelectedStatus(null);
  };
  const handleOpenMonth = (month) => {
    setSelectedMonth(month);
    setLevel("status");
    setSelectedStatus(null);
  };
  const handleOpenStatus = (status) => {
    setSelectedStatus(status);
    setLevel("list");
  };

  const handleBack = () => {
    if (level === "list") setLevel("status");
    else if (level === "status") setLevel("month");
    else if (level === "month") setLevel("year");
    else if (level === "year") setLevel("legal");
    else if (level === "legal") setLevel("company");
    else if (level === "company") setLevel("root");
  };

  // Prefer doc id (invoiceDocId) → then invoiceId (with query flag) → then pdf viewer
  const handlePreview = (pdf) => {
    const pdfKey = pdf?.pdfId || pdf?.id; // for comparisons and fallbacks
    if (pdf?.invoiceDocId) {
      window.open(
        `/dashboard/invoice-preview/${encodeURIComponent(pdf.invoiceDocId)}`,
        "_blank",
        "noopener,noreferrer"
      );
    } else if (pdf?.invoiceId) {
      window.open(
        `/dashboard/invoice-preview/${encodeURIComponent(pdf.invoiceId)}?by=invoice_id`,
        "_blank",
        "noopener,noreferrer"
      );
    } else {
      window.open(
        `/dashboard/pdf-viewer/${encodeURIComponent(pdfKey)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };
  const handleView = (pdf) => {
    const pdfKey = pdf?.pdfId || pdf?.id;
    if (pdf?.invoiceDocId) {
      navigate(`/dashboard/invoice-preview/${encodeURIComponent(pdf.invoiceDocId)}`);
    } else if (pdf?.invoiceId) {
      navigate(`/dashboard/invoice-preview/${encodeURIComponent(pdf.invoiceId)}?by=invoice_id`);
    } else {
      navigate(`/dashboard/pdf-viewer/${encodeURIComponent(pdfKey)}`);
    }
  };

  const openPreviewsSelected = (batchSize = 6) => {
    const rows = listRows.filter((r) => selectedIds.has(r.id));
    if (!rows.length) {
      alert("Select at least one invoice to preview.");
      return;
    }
    let i = 0;
    while (i < rows.length) {
      rows.slice(i, i + batchSize).forEach((pdf) => handlePreview(pdf));
      i += batchSize;
    }
  };

  const handleDownload = async (pdf) => {
    try {
      const rowKey = pdf?.pdfId || pdf?.id;
      setDownloading(rowKey);

      const type = String(pdf?.type || "").toLowerCase();

      // 0) Preferred path: open InvoicePreview with autoDownload to capture exact DOM layout
      if (pdf?.invoiceDocId) {
        const url = `/dashboard/invoice-preview/${encodeURIComponent(pdf.invoiceDocId)}?autoDownload=${type === 'proforma' ? 'proforma' : 'tax'}&close=1`;
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      } else if (pdf?.invoiceId) {
        const url = `/dashboard/invoice-preview/${encodeURIComponent(pdf.invoiceId)}?by=invoice_id&autoDownload=${type === 'proforma' ? 'proforma' : 'tax'}&close=1`;
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      // 1) If we have chunked storage id
      if (pdf?.pdfId) {
        await downloadChunkedPDF(pdf.pdfId);
        return;
      }
      if (pdf?.fallbackChunkId) {
        await downloadChunkedPDF(pdf.fallbackChunkId);
        return;
      }

      // 2) If reconstructing from invoice (rare path now)
      if (pdf?.invoiceId) {
        const { invoice, client } = await fetchInvoiceAndClientByInvoiceId(pdf.invoiceId);
        if (type === "tax") {
          const docPDF = await generateInvoicePDF(invoice, client);
          if (docPDF?.save) { docPDF.save(`${invoice.invoice_id}.pdf`); return; }
        } else if (type === "proforma") {
          const docPDF = await generateProformaInvoicePDF(invoice, client);
          if (docPDF?.save) { docPDF.save(`${invoice.invoice_id}_PROFORMA.pdf`); return; }
        }
      }

      // 3) Use S3 presigned URL if we have a key
      if (pdf?.s3Key) {
        const url = await getPresignedUrl(pdf.s3Key);
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }

      // 4) Final fallback: try chunked by row id
      if (rowKey) {
        await downloadChunkedPDF(rowKey);
        return;
      }

      throw new Error("No valid download method found for this row.");
    } catch (e) {
      console.error(e);
      alert("Failed to download: " + (e?.message || e));
    } finally {
      setDownloading(null);
    }
  };


  /* ---------------- render ---------------- */
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
        <div className="flex flex-col items-center space-y-4 bg-white rounded-xl shadow-lg p-8">
          <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <h3 className="text-lg font-semibold text-gray-800">Loading your PDFs</h3>
          <p className="text-gray-500 text-sm">Please wait while we fetch your documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-[30px]">
      {/* HEADER */}
      <header className="bg-[#ffffff] shadow-none p-[10px] border-curve">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-0">
          <div className="flex items-center gap-3 border-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 m-[0] border-0">PDF Manager</h2>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={fetchPDFMetadata}
              className="px-5 py-2 m-2 text-sm font-medium rounded-md text-white bg-[#037f9e] hover:bg-[#026a83] edit border-0"
            >
              Refresh
            </button>
            <button
              onClick={() => navigate("/dashboard/create-invoice")}
              className="px-5 py-2 text-sm m-2 font-medium rounded-md text-white bg-[#037f9e] hover:bg-[#026a83] edit border-0"
            >
              + New Invoice
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 pdf-manager-block bg-[#ffffff] border-curve">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm text-gray-600 home-block">
          <span className="cursor-pointer hover:underline" onClick={() => setLevel("root")}>Home</span>
          {level !== "root" && (
            <>
              <span> / </span>
              <span className="cursor-pointer hover:underline" onClick={handleOpenInvoicesRoot}>Invoices</span>
            </>
          )}
          {(["legal","year","month","status","list"].includes(level)) && selectedCompany ? (
            <>
              <span> / </span>
              <span className="cursor-pointer hover:underline" onClick={() => handleOpenCompany(selectedCompany)}>{selectedCompany}</span>
            </>
          ) : null}
          {(["year","month","status","list"].includes(level)) && selectedLegalType ? (
            <>
              <span> / </span>
              <span className="cursor-pointer hover:underline" onClick={() => handleOpenLegal(selectedLegalType)}>{selectedLegalType}</span>
            </>
          ) : null}
          {(["month","status","list"].includes(level)) && selectedYear ? (
            <>
              <span> / </span>
              <span className="cursor-pointer hover:underline" onClick={() => handleOpenYear(selectedYear)}>
                {displayFinancialYear(selectedYear)}
              </span>
            </>
          ) : null}
          {(["status","list"].includes(level)) && selectedMonth ? (
            <>
              <span> / </span>
              <span className="cursor-pointer hover:underline" onClick={() => handleOpenMonth(selectedMonth)}>
                {displayYearMonth(selectedYear, selectedMonth)}
              </span>
            </>
          ) : null}
          {(level === "list") && selectedStatus ? (
            <>
              <span> / </span>
              <span className="font-semibold">{selectedStatus}</span>
            </>
          ) : null}
        </div>

        {level !== "list" && (
          <button
            onClick={handleBack}
            disabled={level === "root"}
            className="mb-4 text-sm  disabled:opacity-40  back-btn border-0 bg-[#3b5997] text-[#ffffff] p-[10px] border-curve w-[80px] mb-[20px]"
          >
            ← Back
          </button>
        )}

        {/* LEVEL 1: "invoices" */}
        {level === "root" && (
          <FolderGrid>
            <FolderCard name="invoices" count={pdfMetadata.length} onOpen={handleOpenInvoicesRoot} />
          </FolderGrid>
        )}

        {/* LEVEL 2: companies */}
        {level === "company" && (
          <FolderGrid>
            {companies.map((c) => (
              <FolderCard
                key={c}
                name={c}
                count={countsBy.byCompany.get(c) || 0}
                onOpen={() => handleOpenCompany(c)}
              />
            ))}
          </FolderGrid>
        )}

        {/* LEVEL 3: legal types */}
        {level === "legal" && (
          <FolderGrid>
            {["Firm", "Private Limited"].map((l) => {
              const cl = `${selectedCompany}|${l}`;
              const count = countsBy.byCompanyLegal.get(cl) || 0;
              return (
                <FolderCard
                  key={l}
                  name={l}
                  count={count}
                  onOpen={() => count > 0 && handleOpenLegal(l)}
                  disabled={count === 0}
                />
              );
            })}
          </FolderGrid>
        )}

        {/* LEVEL 4: years */}
        {level === "year" && (
          <FolderGrid>
            {Array.from(yearsForCompanyLegal.get(`${selectedCompany}|${selectedLegalType}`) || new Set())
              .sort((a, b) => b - a)
              .map((y) => (
                <FolderCard
                  key={y}
                  name={displayFinancialYear(y)}
                  count={countsBy.byCompanyLegalYear.get(`${selectedCompany}|${selectedLegalType}|${y}`) || 0}
                  onOpen={() => handleOpenYear(y)}
                />
              ))}
          </FolderGrid>
        )}

        {/* LEVEL 5: months (folder look → "YYYY_MM") */}
        {level === "month" && (
          <FolderGrid>
            {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => {
              const count =
                countsBy.byCompanyLegalYearMonth.get(
                  `${selectedCompany}|${selectedLegalType}|${selectedYear}|${m}`
                ) || 0;
              const label = displayYearMonthFolder(selectedYear, m); // → "2025_09"
              return (
                <FolderCard
                  key={m}
                  name={label}
                  count={count}
                  onOpen={() => count > 0 && handleOpenMonth(m)}
                  disabled={count === 0}
                />
              );
            })}
          </FolderGrid>
        )}

        {/* LEVEL 6: status inside month (Paid / Partial / Pending) */}
        {level === "status" && (
          <FolderGrid>
            {["Paid", "Partial", "Pending"].map((status) => {
              const key = `${selectedCompany}|${selectedLegalType}|${selectedYear}|${selectedMonth}|${status}`;
              const count = countsBy.byCompanyLegalYearMonthStatus.get(key) || 0;
              return (
                <FolderCard
                  key={status}
                  name={status}
                  count={count}
                  onOpen={() => count > 0 && handleOpenStatus(status)}
                  disabled={count === 0}
                />
              );
            })}
          </FolderGrid>
        )}

        {/* LEVEL 7: files list */}
        {level === "list" && (
          <>
            {/* Controls */}
            <div className="bg-white rounded-lg shadow p-5 mb-6 flex flex-col gap-4">
              <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                <input
                  type="text"
                  placeholder="Search invoices or filenames..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full lg:w-1/3 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex flex-wrap gap-3">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Types</option>
                    <option value="tax">Tax</option>
                    <option value="proforma">Proforma</option>
                  </select>

                  <select
                    value={selectedStatus ? selectedStatus : filterPayment}
                    onChange={(e) => setFilterPayment(e.target.value)}
                    disabled={!!selectedStatus}
                    className="px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                  >
                    <option value="all">All Payments</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial">Partial</option>
                    <option value="Pending">Pending</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="created">Sort by Date</option>
                    <option value="invoice">Sort by Invoice ID</option>
                    <option value="size">Sort by Size</option>
                    <option value="type">Sort by Type</option>
                    <option value="payment">Sort by Payment</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 justify-between pt-2 border-t">
                <div className="text-sm text-gray-600">
                  Selected: <b>{selectedIds.size}</b>
                  {selectedIds.size > 0 && (
                    <button onClick={clearSelection} className="ml-3 text-blue-700 hover:underline edit">
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={toggleSelectAllOnPage}
                    className="px-3 py-1.5 text-xs border rounded-lg hover:bg-[#3b5997] edit"
                  >
                    {listRows.length && listRows.every(r => selectedIds.has(r.id)) ? "Unselect All (Page)" : "Select All (Page)"}
                  </button>
                  <button
                    onClick={() => openPreviewsSelected(6)}
                    className="px-3 py-1.5 text-xs rounded-lg text-white bg-[#037f9e] hover:bg-[#3b5997] edit"
                  >
                    Open Previews (Selected)
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedCompany} / {selectedLegalType} / {displayFinancialYear(selectedYear)} / {displayYearMonth(selectedYear, selectedMonth)} / {selectedStatus ?? "All"} — Documents
                </h3>
                <p className="text-sm text-gray-500">{listRows.length} files</p>
              </div>

              {listRows.length === 0 ? (
                <div className="p-10 text-center text-gray-500">No documents found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3">
                          <input
                            type="checkbox"
                            aria-label="Select all on page"
                            checked={listRows.length > 0 && listRows.every(r => selectedIds.has(r.id))}
                            onChange={toggleSelectAllOnPage}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-[#037f9e]">Invoice</th>
                        <th className="px-6 py-3 text-left text-[#037f9e]">Type</th>
                        <th className="px-6 py-3 text-left text-[#037f9e]">Payment</th>
                        <th className="px-6 py-3 text-left text-[#037f9e]">Size</th>
                        <th className="px-6 py-3 text-left text-[#037f9e]">Created</th>
                        <th className="px-6 py-3 text-left text-[#037f9e]">Updated</th>
                        <th className="px-6 py-3 text-center text-[#037f9e]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {listRows.map((pdf) => {
                        const rowKey = pdf?.pdfId || pdf?.id;
                        return (
                          <tr key={pdf.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <input
                                type="checkbox"
                                checked={isSelected(pdf.id)}
                                onChange={() => toggleSelectRow(pdf.id)}
                                aria-label={`Select ${pdf.invoiceId}`}
                              />
                            </td>

                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{pdf.invoiceId}</div>
                            </td>

                            <td className="px-6 py-4">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  String(pdf.type).toLowerCase() === "tax"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {String(pdf.type || "").toLowerCase()}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <PaymentBadge status={pdf.paymentStatus} />
                              {pdf.paymentDate && (
                                <div className="text-[11px] text-gray-500 mt-1">
                                  {formatDate(pdf.paymentDate)}
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 text-sm">{formatFileSize(pdf.originalSize)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{formatDate(pdf.createdAt)}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{formatDate(pdf.updatedAt)}</td>
                         <td className="px-6 py-4 text-center">
  <div className="flex justify-center items-center space-x-2">
    <button
      onClick={() => handlePreview(pdf)}
      className="px-3 py-1 text-xs border rounded-lg edit  transition"
      title="Open invoice preview in a new tab"
    >
      Preview
    </button>

    <button
      onClick={() => handleDownload(pdf)}
      disabled={downloading === rowKey}
      className={`px-3 edit py-1 text-xs rounded-lg text-white transition ${
        downloading === rowKey
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-blue-600 "
      }`}
    >
      {downloading === rowKey ? "Downloading..." : "Download"}
    </button>
  </div>
</td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- small presentational bits ---------------- */
function FolderGrid({ children }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {children}
    </div>
  );
}

// Folder tile (teal folder + title + "N items")
function FolderCard({ name, count, onOpen, badge, disabled = false }) {
  const isDisabled = disabled || count === 0;

  return (
    <div
      onClick={() => { if (!isDisabled && onOpen) onOpen(); }}
      className={`cursor-pointer rounded-xl bg-white shadow p-5 transition flex items-center gap-4
        ${isDisabled ? "opacity-40 cursor-not-allowed hover:shadow-none" : "hover:shadow-lg"}`}
      title={isDisabled ? "No items" : `Open ${name}`}
      aria-disabled={isDisabled}
      role="button"
    >
      <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-blue-50">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="#355088" aria-hidden="true">
          <path d="M10 4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h6z" />
        </svg>
      </div>
      <div className="flex-1">
        <div className="font-semibold text-gray-900 flex items-center gap-2">
          {name}
          {badge && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-700">{badge}</span>
          )}
        </div>
        <div className="text-xs text-gray-500">{count} items</div>
      </div>
      <div className="text-gray-400">›</div>
    </div>
  );
}

function PaymentBadge({ status }) {
  const s = status || "Pending";
  let bgColor = "#dc3545"; // Pending -> red
  if (s === "Paid") bgColor = "#28a745";
  else if (s === "Partial") bgColor = "#f59e0b";

  return (
    <span
      style={{
        backgroundColor: bgColor,
        color: "#ffffff",
        padding: "4px 10px",
        borderRadius: "9999px",
        fontSize: "12px",
        fontWeight: "600",
        minWidth: "60px",
        display: "inline-block",
        textAlign: "center",
      }}
    >
      {s}
    </span>
  );
}
