// src/components/PreviewQuotation.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import CurrencyService from "../utils/CurrencyService";

// Formatter (mirrors CreateQuotation): Indian-style grouping, 2 decimals
const formatAmount = (num) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(isNaN(num) ? 0 : num));

// Currency names for amount-in-words (fallbacks included)
const CURRENCY_NAMES = {
  INR: { major: "Rupees", minor: "Paise" },
  USD: { major: "Dollars", minor: "Cents" },
  EUR: { major: "Euros", minor: "Cents" },
  GBP: { major: "Pounds", minor: "Pence" },
  AED: { major: "Dirhams", minor: "Fils" },
  AUD: { major: "Dollars", minor: "Cents" },
  NZD: { major: "Dollars", minor: "Cents" },
  CAD: { major: "Dollars", minor: "Cents" },
  SGD: { major: "Dollars", minor: "Cents" },
};

function numberToWords(amountInput, currencyCode = "INR") {
  const { major, minor } =
    CURRENCY_NAMES[currencyCode] || { major: "Units", minor: "Subunits" };

  const amount = Number(amountInput ?? 0);
  if (!isFinite(amount)) return "";

  // Convert to paise/cents… (2 decimal places)
  const totalSub = Math.round(amount * 100);
  const whole = Math.floor(totalSub / 100);
  const fraction = totalSub % 100;

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const twoDigitWords = (n) => {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? " " + ones[o] : ""}`.trim();
  };

  const threeDigitWords = (n) => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let out = "";
    if (h) out += `${ones[h]} Hundred`;
    if (rem) out += `${out ? " " : ""}${twoDigitWords(rem)}`;
    return out.trim();
  };

  // Indian numbering system for consistency with Create (lakh/crore)
  const segmentWordsIndian = (n) => {
    if (n === 0) return "Zero";
    let out = "";
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = n % 1000;

    if (crore) out += `${threeDigitWords(crore)} Crore`;
    if (lakh) out += `${out ? " " : ""}${threeDigitWords(lakh)} Lakh`;
    if (thousand) out += `${out ? " " : ""}${threeDigitWords(thousand)} Thousand`;
    if (hundred) out += `${out ? " " : ""}${threeDigitWords(hundred)}`;

    return out.trim();
  };

  const wholeWords = `${segmentWordsIndian(whole)} ${major}`;
  const fracWords = fraction ? ` and ${twoDigitWords(fraction)} ${minor}` : "";
  return `${wholeWords}${fracWords} only`;
}

export default function PreviewQuotation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quote, setQuote] = useState(null);
  const [clientDoc, setClientDoc] = useState(null);

  // Build a display client using (1) live client doc if present, else (2) snapshot frozen in quotation
  const displayClient = useMemo(() => {
    const snapshot = {
      client_name: quote?.client_name || "Client Not Found",
      address:
        quote?.client_address ||
        "Please update address in client profile",
      gst_number: (quote?.client_gst_number || quote?.gst_number || "").trim(),
      country: (quote?.client_country || "india").toLowerCase(),
      state: (quote?.client_state || "telangana").toLowerCase(),
      email: quote?.client_email || "",
      poc: quote?.client_poc || "",
      company: quote?.client_company || "",
    };
    // If we have a fresh client doc, prefer its fields
    return clientDoc
      ? {
          client_name: clientDoc.client_name || snapshot.client_name,
          address: clientDoc.address || snapshot.address,
          gst_number:
            (clientDoc.gst_number || "").trim() || snapshot.gst_number || "NA",
          country: (clientDoc.country || snapshot.country || "india").toLowerCase(),
          state: (clientDoc.state || snapshot.state || "telangana").toLowerCase(),
          email: clientDoc.email || snapshot.email,
          poc: clientDoc.poc || snapshot.poc,
          company: clientDoc.company_name || snapshot.company,
        }
      : snapshot;
  }, [clientDoc, quote]);

  // Fetch quotation + client (if available)
  useEffect(() => {
    (async () => {
      try {
        if (!id?.trim()) return;
        const qRef = doc(db, "quotations", id);
        const qSnap = await getDoc(qRef);
        if (!qSnap.exists()) return;

        const qData = qSnap.data();
        setQuote(qData);

        if (qData.client_id) {
          const cRef = doc(db, "clients", qData.client_id);
          const cSnap = await getDoc(cRef);
          setClientDoc(cSnap.exists() ? cSnap.data() : null);
        } else {
          setClientDoc(null);
        }
      } catch (err) {
        console.error("Error loading quotation:", err);
      }
    })();
  }, [id]);

  const handleEdit = () => navigate(`/dashboard/edit-quotation/${id}`);

  const handleDownloadQuotation = async () => {
    if (!quote) return alert("Quotation not loaded yet");
    try {
      const { generateQuotationPDF } = await import("../utils/generateQuotationPDF");
      await generateQuotationPDF(quote, displayClient).then((pdfDoc) => {
        const timestamp = Date.now();
        const fileName = `${
          quote.quotation_id || id
        }_QUOTATION_${timestamp}.pdf`;
        pdfDoc.save(fileName);
      });
    } catch (error) {
      console.error("Quotation PDF generation failed:", error);
      alert(
        "Error generating Quotation PDF. See console for details (fonts/images/data)."
      );
    }
  };

  const formatDate = (dateObj) => {
    const d =
      typeof dateObj?.toDate === "function" ? dateObj.toDate() : new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const month = d.toLocaleString("default", { month: "long" });
    return `${dd} ${month} ${yyyy}`;
  };

  if (!quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading quotation...
      </div>
    );
  }

  // ====== Values mirrored from CreateQuotation ======
  const quotationId = quote.quotation_id || id;
  const quotationDate = quote.quotation_date || quote.created_at?.toDate?.();
  const quotationTitle = quote.quotation_title || "";

  // Currency/PaymentStatus come from CreateQuotation
  const currencyCode = (quote.currency || "INR").toUpperCase();
  const currencySymbol = CurrencyService.getCurrencySymbol(currencyCode);
  const paymentStatus = quote.payment_status || "Pending";

  // Services snapshot (Create stores array of { name, description, amount })
  const servicesArray = Array.isArray(quote.services) ? quote.services : [];
  const normalizedItems =
    servicesArray.length > 0
      ? servicesArray.map((s, i) => {
          const nameStr = Array.isArray(s?.name)
            ? s.name.filter(Boolean).join(", ")
            : s?.name ?? `Service ${i + 1}`;
          const amtNum = Number(s?.amount ?? 0);
          return {
            name: String(nameStr || `Service ${i + 1}`),
            description: String(s?.description ?? ""),
            amount: isNaN(amtNum) ? 0 : amtNum,
          };
        })
      : [
          {
            name: quotationTitle || "Service",
            description: "",
            amount: Number(quote.subtotal || quote.total_amount || 0),
          },
        ];

  // Totals (CreateQuotation sets subtotal and total_amount to the same — no taxes)
  const subtotal =
    Number(quote.subtotal ?? 0) ||
    normalizedItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);

  const total = Number(quote.total_amount ?? subtotal);

  // Company -> logo + heading color (same logic you used)
  const type = (quote.quotation_type || "").toString().toUpperCase().trim();
  const isWTX = type === "WTX" || type === "WTXPL" || type.includes("WTX");
  const headingColor = isWTX ? "#ffde58" : "#3b5998";
  const logoPath = isWTX ? "/wtx_logo.png" : "/wt-logo.png";

  // If any saved tax fields exist (>0), we’ll render them; otherwise we keep CreateQuotation parity (no tax rows)
  const savedCGST = Number(quote.cgst || 0);
  const savedSGST = Number(quote.sgst || 0);
  const savedIGST = Number(quote.igst || 0);
  const showAnyTax = savedCGST > 0 || savedSGST > 0 || savedIGST > 0;

  return (
    <div className="bg-gray-100 font-sans text-[13px] text-gray-900 preview" style={{ margin: "0 auto", padding: "0" }}>
      {/* Actions */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex gap-2 justify-center">
        <button
          onClick={handleEdit}
          className="bg-[#3b5999] text-white px-4 py-2 rounded hover:bg-[#2d4373] text-sm"
        >
          Edit Quotation
        </button>
        <button
          onClick={handleDownloadQuotation}
          className="bg-[#3b5999] text-white px-4 py-2 rounded hover:bg-[#2d4373] text-sm"
        >
          Download Quotation PDF
        </button>
      </div>

      <div
        className="flex justify-center items-start bg-gray-100"
        style={{
          padding: "10px",
          minHeight: "100vh",
          width: "100%",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: "15px",
        }}
      >
        <div
          className="a4-preview bg-white"
          style={{
            width: "210mm",
            padding: "10mm 15mm",
            boxShadow:
              "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
            fontSize: "10px",
            lineHeight: "1.2",
            zoom: "1.15",
          }}
        >
          {/* Logo + address */}
          <div className="mb-2" style={{ marginBottom: "8px", textAlign: "left" }}>
            <img
              src={logoPath}
              alt="Company Logo"
              className="h-12"
              style={{ height: "44px", width: "auto" }}
              onError={(e) => {
                const fallbackPaths = ["/wtx_logo.png", "/wt-logo.png", "/invoice-logo.png"];
                let i = 0;
                const tryFallback = () => {
                  if (i < fallbackPaths.length) e.target.src = fallbackPaths[i++];
                };
                e.target.onerror = tryFallback;
                tryFallback();
              }}
            />
            <div
              className="text-left text-[9px] leading-tight"
              style={{ fontSize: "9px", lineHeight: "1.2", marginTop: "10px" }}
            >
              <p>
                19/B, 3rd Floor, Progressive Tower
                <br />
                100 Ft Road, Siddhi Vinayak Nagar
                <br />
                Madhapur, Hyderabad, Telangana - 500081
              </p>
            </div>
          </div>

          {/* Heading */}
          <h1
            className="text-xl mb-4"
            style={{
              color: headingColor,
              fontSize: "20px",
              marginBottom: "10px",
              marginTop: "0px",
              fontFamily: "Calibri, sans-serif",
              fontWeight: "normal",
            }}
          >
            Quotation
          </h1>

          {/* 1) Top info table */}
          <table
            className="w-full border-collapse mb-3"
            style={{
              marginBottom: "8px",
              border: "1px solid #cccccc",
              backgroundColor: "#ffffff",
              fontFamily: "Calibri, sans-serif",
              fontSize: "9px",
            }}
          >
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "50%" }} />
            </colgroup>
            <tbody>
              <tr style={{ border: "1px solid #cccccc" }}>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {isWTX ? "Walls And Trends X" : "Walls And Trends"}
                  </span>
                </td>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>GST IN:</span>{" "}
                  <span style={{ fontWeight: "normal" }}>
                    {isWTX ? "36AAACW8991C1Z9" : "36AACFW6827B1Z8"}
                  </span>
                </td>
              </tr>

              <tr style={{ border: "1px solid #cccccc" }}>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Quotation Number:</span>{" "}
                    <span style={{ fontWeight: "normal" }}>{quotationId}</span>
                  </div>
                </td>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Quotation Date:</span>{" "}
                    <span style={{ fontWeight: "normal" }}>
                      {quotationDate ? formatDate(quotationDate) : ""}
                    </span>
                  </div>
                </td>
              </tr>

              <tr style={{ border: "1px solid #cccccc" }}>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Quotation Title:</span>{" "}
                    <span style={{ fontWeight: "normal" }}>{quotationTitle}</span>
                  </div>
                </td>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Total Cost:</span>{" "}
                    <span style={{ fontWeight: "normal" }}>
                      {currencySymbol}
                      {formatAmount(total)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 2) Customer block */}
          <table
            className="w-full border-collapse mb-3"
            style={{
              marginBottom: "8px",
              border: "1px solid #cccccc",
              backgroundColor: "#ffffff",
              fontFamily: "Calibri, sans-serif",
              fontSize: "9px",
            }}
          >
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "50%" }} />
            </colgroup>
            <tbody>
              <tr style={{ border: "1px solid #cccccc" }}>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                    lineHeight: "1.2",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>Customer Name:</span>{" "}
                    <span style={{ fontWeight: "normal" }}>
                      {displayClient.client_name}
                    </span>
                  </div>
                </td>

                <td
                  className="p-1 text-[8px] text-left"
                  rowSpan={2}
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                    lineHeight: "1.2",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700 }}>Customer Address:</span>{" "}
                    {displayClient.address}
                  </div>
                </td>
              </tr>

              <tr style={{ border: "1px solid #cccccc" }}>
                <td
                  className="p-1 text-[8px] text-left"
                  style={{
                    padding: "3px 6px",
                    fontSize: "8px",
                    border: "1px solid #cccccc",
                    verticalAlign: "top",
                    lineHeight: "1.2",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700 }}>Customer GST IN:</span>{" "}
                    {(displayClient.gst_number || "NA") || "NA"}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 3) Items table */}
          <table
            className="w-full border-collapse mb-3 text-center"
            style={{
              marginBottom: "12px",
              fontSize: "10px",
              border: "1px solid #cccccc",
              backgroundColor: "#ffffff",
              fontFamily: "Calibri, sans-serif",
            }}
          >
            <thead className="text-black" style={{ border: "1px solid #cccccc" }}>
              <tr style={{ border: "1px solid #cccccc", backgroundColor: "#ffffff" }}>
                <th
                  className="p-1 text-[8px] font-bold"
                  style={{ padding: "3px 6px", border: "1px solid #cccccc" }}
                >
                  HSN / SAC Code
                </th>
                <th
                  className="p-1 text-[8px] font-bold"
                  style={{ padding: "3px 6px", border: "1px solid #cccccc" }}
                >
                  Item
                </th>
                <th
                  className="p-1 text-[8px] font-bold"
                  style={{ padding: "3px 6px", border: "1px solid #cccccc" }}
                >
                  Description
                </th>
                <th
                  className="p-1 text-[8px] font-bold"
                  style={{ padding: "3px 6px", border: "1px solid #cccccc" }}
                >
                  Amount ({currencyCode})
                </th>
              </tr>
            </thead>
            <tbody>
              {normalizedItems.map((it, idx) => (
                <tr key={idx} style={{ border: "1px solid #cccccc" }}>
                  <td
                    className="p-1 text-[8px]"
                    style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "center" }}
                  >
                    9983
                  </td>
                  <td
                    className="p-1 text-[8px]"
                    style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "left" }}
                  >
                    {it.name}
                  </td>
                  <td
                    className="p-1 text-[8px]"
                    style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "left" }}
                  >
                    {it.description}
                  </td>
                  <td
                    className="p-1 text-[8px]"
                    style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", whiteSpace: "nowrap" }}
                  >
                    {currencySymbol}
                    {formatAmount(it.amount)}
                  </td>
                </tr>
              ))}

              {/* Summary (CreateQuotation has no taxes; show taxes only if present in stored doc) */}
              <tr style={{ border: "1px solid #cccccc" }}>
                <td colSpan={3} className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", fontWeight: "bold" }}>
                  Gross
                </td>
                <td className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", whiteSpace: "nowrap" }}>
                  {currencySymbol}
                  {formatAmount(subtotal)}
                </td>
              </tr>

              {showAnyTax && (
                <>
                  {savedCGST > 0 && (
                    <tr style={{ border: "1px solid #cccccc" }}>
                      <td colSpan={3} className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", fontWeight: "bold" }}>
                        CGST
                      </td>
                      <td className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", whiteSpace: "nowrap" }}>
                        {currencySymbol}
                        {formatAmount(savedCGST)}
                      </td>
                    </tr>
                  )}
                  {savedSGST > 0 && (
                    <tr style={{ border: "1px solid #cccccc" }}>
                      <td colSpan={3} className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", fontWeight: "bold" }}>
                        SGST
                      </td>
                      <td className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", whiteSpace: "nowrap" }}>
                        {currencySymbol}
                        {formatAmount(savedSGST)}
                      </td>
                    </tr>
                  )}
                  {savedIGST > 0 && (
                    <tr style={{ border: "1px solid #cccccc" }}>
                      <td colSpan={3} className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", fontWeight: "bold" }}>
                        IGST
                      </td>
                      <td className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", whiteSpace: "nowrap" }}>
                        {currencySymbol}
                        {formatAmount(savedIGST)}
                      </td>
                    </tr>
                  )}
                </>
              )}

              <tr className="font-bold" style={{ border: "1px solid #cccccc" }}>
                <td colSpan={3} className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", fontWeight: "bold" }}>
                  Total
                </td>
                <td className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", whiteSpace: "nowrap" }}>
                  {currencySymbol}
                  {formatAmount(total)}
                </td>
              </tr>

              {/* Amount in words */}
              <tr style={{ border: "1px solid #cccccc" }}>
                <td colSpan={3} className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "right", fontWeight: "bold" }}>
                  (Total Amount In Words)
                </td>
                <td className="p-1 text-[8px]" style={{ padding: "3px 6px", border: "1px solid #cccccc", textAlign: "left" }}>
                  {numberToWords(total, currencyCode)}
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ fontSize: "8px", marginBottom: "8px" }}>
            NOTE: No files will be delivered until the final payment is done.
          </p>

          <div className="flex justify-start" style={{ marginTop: "12px" }}>
            <div className="text-center">
              <img
                src="/csh-sign.PNG"
                alt="Signature"
                className="h-8 mx-auto mb-1"
                style={{ height: "32px" }}
              />
              <p className="text-[8px]" style={{ color: "#9ca3af" }}>
                Authorised Signature for {isWTX ? "Walls & Trends X" : "Walls & Trends"}
              </p>
            </div>
          </div>

          <div className="flex justify-end" style={{ marginTop: "12px" }}>
            <div className="text-right">
              <p
                className="text-[8px] italic"
                style={{
                  color: headingColor,
                  fontFamily: "calibri, sans-serif",
                  fontStyle: "italic",
                }}
              >
                Authenticity Promised. Creativity Published
              </p>
              <p
                className="text-[8px] italic"
                style={{
                  color: headingColor,
                  fontFamily: "calibri, sans-serif",
                  fontStyle: "italic",
                  marginTop: "2px",
                }}
              >
                Thank you for your business!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}