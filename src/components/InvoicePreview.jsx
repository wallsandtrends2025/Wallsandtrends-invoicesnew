// src/pages/InvoicePreview.jsx
import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const previewRef = useRef();

  const [invoice, setInvoice] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const invoiceRef = doc(db, "invoices", id);
        const invoiceSnap = await getDoc(invoiceRef);
        if (invoiceSnap.exists()) {
          const invoiceData = invoiceSnap.data();
          setInvoice(invoiceData);

          const clientRef = doc(db, "clients", invoiceData.client_id);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }
      } catch (err) {
        console.error("Error loading invoice:", err);
      }
    };

    fetchInvoice();
  }, [id]);

  const handleEdit = () => {
    navigate(`/dashboard/edit-invoice/${id}`);
  };

  const handleDownloadTax = async () => {
    if (!invoice || !client || !previewRef.current) return;
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`${invoice.invoice_id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const handleDownloadProforma = async () => {
    if (!invoice || !client || !previewRef.current) return;
    try {
      // Temporarily change the title to Proforma Invoice
      const titleElement = previewRef.current.querySelector('h1');
      const originalTitle = titleElement.textContent;
      const originalColor = titleElement.style.color;
      titleElement.textContent = 'Proforma Invoice';
      // Keep the same color

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`${invoice.invoice_id}_PROFORMA.pdf`);

      // Restore original title and color
      titleElement.textContent = originalTitle;
      titleElement.style.color = originalColor;
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const formatDate = (dateObj) => {
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const yyyy = d.getFullYear();
    const month = d.toLocaleString("default", { month: "long" });
    return `${dd} ${month} ${yyyy}`;
  };

  // ---------- NEW: robust Indian-numbering converter (Rupees & Paise) ----------
  function numberToWordsINR(amountInput) {
    const amount = Number(amountInput ?? 0);
    if (!isFinite(amount)) return "";

    // use paise to avoid floating point issues
    const totalPaise = Math.round(amount * 100);
    const rupees = Math.floor(totalPaise / 100);
    const paise = totalPaise % 100;

    const ones = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
      "Sixteen", "Seventeen", "Eighteen", "Nineteen"
    ];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

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

    const segmentWords = (n) => {
      if (n === 0) return "Zero";
      let out = "";

      const crore = Math.floor(n / 10000000);                 // 1,00,00,000
      const lakh = Math.floor((n % 10000000) / 100000);       // 1,00,000
      const thousand = Math.floor((n % 100000) / 1000);       // 1,000
      const hundred = n % 1000;                               // 0..999

      if (crore)   out += `${threeDigitWords(crore)} Crore`;
      if (lakh)    out += `${out ? " " : ""}${threeDigitWords(lakh)} Lakh`;
      if (thousand)out += `${out ? " " : ""}${threeDigitWords(thousand)} Thousand`;
      if (hundred) out += `${out ? " " : ""}${threeDigitWords(hundred)}`;

      return out.trim();
    };

    const rupeesWords = `${segmentWords(rupees)} Rupees`;
    const paiseWords = paise ? ` and ${twoDigitWords(paise)} Paise` : "";
    return `${rupeesWords}${paiseWords} only`;
  }
  // ---------------------------------------------------------------------------

  if (!invoice || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading invoice...
      </div>
    );
  }

  // Company visuals
  const isWT = invoice.invoice_type === "WT" || invoice.invoice_type === "WTPL";
  const isWTX = invoice.invoice_type === "WTX" || invoice.invoice_type === "WTXPL";
  const headingColor = isWTX ? "#ffde58" : "#3b5998";
  const logoPath = isWT ? "/wt-logo.png" : "/wtx_logo.png";

  // ======== AMOUNTS & FORMATTING (always 2 decimals) ========
  const fmt2 = (n) =>
    Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const subtotal = Number(invoice.subtotal) || 0;
  const total = Number(invoice.total_amount) || subtotal;

  // ======== TAX VISIBILITY (match CreateInvoice rules) ========
  const toLower = (s) => (s || "").toString().trim().toLowerCase();
  const clientCountry = toLower(client.country);
  const clientState = toLower(client.state);
  const isIndian = clientCountry === "india";
  const isTelangana = clientState === "telangana";

  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9; sgstRate = 9; igstRate = 0;
  } else if (isIndian && !isTelangana) {
    cgstRate = 0; sgstRate = 0; igstRate = 18;
  } else {
    cgstRate = 0; sgstRate = 0; igstRate = 0;
  }

  // Prefer stored amounts; fall back to computed
  const storedCGST = Number(invoice.cgst ?? 0);
  const storedSGST = Number(invoice.sgst ?? 0);
  const storedIGST = Number(invoice.igst ?? 0);

  const cgstAmount = storedCGST || +(subtotal * (cgstRate / 100)).toFixed(2);
  const sgstAmount = storedSGST || +(subtotal * (sgstRate / 100)).toFixed(2);
  const igstAmount = storedIGST || +(subtotal * (igstRate / 100)).toFixed(2);

  // ======== SERVICES NORMALIZATION ========
  const lineItems = Array.isArray(invoice.services) && invoice.services.length
    ? invoice.services.map((s, i) => {
        const nameStr = Array.isArray(s?.name) ? s.name.filter(Boolean).join(", ") : (s?.name || `Service ${i + 1}`);
        return {
          name: String(nameStr),
          description: String(s?.description || ""),
          amount: Number(s?.amount || 0),
        };
      })
    : [
        {
          name: String(invoice.invoice_title || invoice.service_name || "Service"),
          description: String(invoice.service_description || ""),
          amount: Number(invoice.subtotal || 0),
        },
      ];

  return (
    <div className="min-h-screen bg-white px-6 py-10 font-sans text-[13px] text-gray-900 preview">
      {/* actions */}
      <button
        onClick={handleEdit}
        className="absolute top-4 left-6 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] downloadbtn downloadbtn3"
      >
        Edit Invoice
      </button>
      <div className="absolute block absolute bottons-block">
        <button
          onClick={handleDownloadTax}
          className="absolute top-4 left-6 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373]  downloadbtn "
        >
          Download Tax Invoice PDF
        </button>
        <button
          onClick={handleDownloadProforma}
          className="absolute top-4 left-6 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373]  downloadbtn downloadbtn2"
        >
          Download Proforma Invoice PDF
        </button>
      </div>

      <div ref={previewRef} className="max-w-5xl mx-auto p-6">
        {/* logo + address */}
        <div className="mb-3">
          <img src={logoPath} alt="Company Logo" className="h-16" />
          <div className="text-left text-[12px] leading-1">
            <p>19/B, 3rd Floor, Progressive Tower<br />100 Ft Road, Siddhi Vinayak Nagar<br />Madhapur, Hyderabad, Telangana - 500081</p>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold mb-3" style={{ color: headingColor }}>
          Tax Invoice
        </h1>

        {/* Top info table */}
        <table className="w-full border border-gray-100 border-collapse mb-1">
          <tbody>
            <tr>
              <td className="border border-gray-100 p-0 font-medium">
                {isWT ? "Walls And Trends" : "Walls And Trends"}

              </td>
              <td className="border border-gray-100 p-0 font-medium">
                GST IN: {isWT ? "36AACFW6827B1Z8" : "36AAACW8991C1Z9"}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">
                Invoice Number: {invoice.invoice_id}
              </td>
              <td className="border border-gray-100 p-0">
                Invoice Date:{" "}
                {invoice.invoice_date
                  ? formatDate(invoice.invoice_date)
                  : invoice.created_at?.toDate
                  ? formatDate(invoice.created_at.toDate())
                  : ""}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">
                Invoice Title: {invoice.invoice_title || lineItems[0]?.name}
              </td>
              <td className="border border-gray-100 p-0 font-semibold">
                Total Cost: INR {fmt2(total)}
              </td>
            </tr>
          </tbody>
        </table>

       

        {/* Customer block */}
        <table className="w-full border border-gray-100 border-collapse mb-1">
          <tbody>
            <tr>
              <td className="border border-gray-100 p-0">
                Customer Name: {client.client_name}
              </td>
              <td className="border border-gray-100 p-0">
                Customer Address: {client.address}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0" colSpan={2}>
                Customer GST IN: {(client.gst_number || "").trim() || "NA"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table className="w-full border border-gray-100 border-collapse mb-1 text-center">
          <thead className="bg-gray-100 text-black">
            <tr>
              <th className="p-0 border border-gray-100">HSN / SAC Code</th>
              <th className="p-0 border border-gray-100">Item</th>
              <th className="p-0 border border-gray-100">Description</th>
              <th className="p-0 border border-gray-100">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((it, idx) => (
              <tr key={idx}>
                <td className="border border-gray-100 p-0">9983</td>
                <td className="border border-gray-100 p-0">{it.name}</td>
                <td className="border border-gray-100 p-0">{it.description}</td>
                <td className="border border-gray-100 p-0 text-center pr-4">{fmt2(it.amount)}</td>
              </tr>
            ))}

            {/* Gross */}
            <tr>
              <td className="border border-gray-100 p-0 text-center" colSpan={3}>
                Gross
              </td>
              <td className="border border-gray-100 p-0 text-center pr-4">{fmt2(subtotal)}</td>
            </tr>

            {/* === TAX: show ONLY the applicable rows === */}
            {isIndian && isTelangana && (
              <>
                <tr>
                  <td className="border border-gray-100 p-0 text-center" colSpan={3}>
                    CGST @ 9%
                  </td>
                  <td className="border border-gray-100 p-0 text-center pr-4">{fmt2(cgstAmount)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-100 p-0 text-center" colSpan={3}>
                    SGST @ 9%
                  </td>
                  <td className="border border-gray-100 p-0 text-center pr-4">{fmt2(sgstAmount)}</td>
                </tr>
              </>
            )}

            {isIndian && !isTelangana && (
              <tr>
                <td className="border border-gray-100 p-0 text-center" colSpan={3}>
                  IGST @ 18%
                </td>
                <td className="border border-gray-100 p-0 text-center pr-4">{fmt2(igstAmount)}</td>
              </tr>
            )}

            {!isIndian && (
              <tr>
                <td className="border border-gray-100 p-0 text-center" colSpan={3}>
                  IGST @ 0%
                </td>
                <td className="border border-gray-100 p-0 text-center pr-4">{fmt2(igstAmount)}</td>
              </tr>
            )}

            {/* Total */}
            <tr className="font-bold">
              <td className="border border-gray-100 p-0 text-center text-[#3b5998]" colSpan={3}>
                Total
              </td>
              <td className="border border-gray-100 p-0 text-center pr-4 text-[#3b5998]">
                {fmt2(total)}
              </td>
            </tr>

            {/* Words row (uses new converter) */}
            <tr>
              <td className="border border-gray-100 p-0 text-center" colSpan={3}>
                <span className="italic">(Total Amount In Words)</span>
              </td>
              <td className="border border-gray-100 p-0 text-center pr-4">
                {numberToWordsINR(total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bank Details */}
        <h2 className="font-semibold mb-2" style={{ color: headingColor }}>
          Bank Details
        </h2>
        <table className="w-full border border-gray-100 border-collapse mb-1 text-center">
          <tbody>
            <tr>
              <td className="border border-gray-100 p-0 w-1/3">Bank Name</td>
              <td className="border border-gray-100 p-0">Yes Bank</td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">Beneficiary Name</td>
              <td className="border border-gray-100 p-0">{isWT ? "Walls And Trends" : "Walls And Trends"}</td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">Account Number</td>
              <td className="border border-gray-100 p-0">000663300001713</td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">Account Type</td>
              <td className="border border-gray-100 p-0">Current Account</td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">IFSC Code</td>
              <td className="border border-gray-100 p-0">YESB0000006</td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">Bank Branch</td>
              <td className="border border-gray-100 p-0">Somajiguda</td>
            </tr>
            <tr>
              <td className="border border-gray-100 p-0">City</td>
              <td className="border border-gray-100 p-0">Hyderabad</td>
            </tr>
          </tbody>
        </table>

        <p>NOTE: No files will be delivered until the final payment is made.</p>

        <div className="flex justify-start mt-10">
          <div className="text-center">
            <img src="/csh-sign.PNG" alt="Signature" className="h-12 mx-auto mb-1" />
            <p className="text-xs">Authorised Signature for Walls & Trends</p>
          </div>
        </div>

        <div className="flex justify-end mt-10">
          <div className="text-right">
            <p className="text-xs italic text-[#3b5998]">Authenticity Promised. Creativity Published</p>
            <p className="text-xs italic text-[#3b5998]">Thank you for your business!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
