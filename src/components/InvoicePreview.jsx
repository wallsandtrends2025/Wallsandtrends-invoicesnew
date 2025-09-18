import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate();

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
    if (!invoice || !client) return;
    const element = document.querySelector('.preview');
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF();
    const marginLeft = 20; // Left margin in mm
    const imgWidth = 170; // Content width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    if (imgHeight <= pageHeight) {
      doc.addImage(imgData, 'PNG', marginLeft, 0, imgWidth, imgHeight);
    } else {
      const scale = pageHeight / imgHeight;
      const scaledWidth = imgWidth * scale;
      doc.addImage(imgData, 'PNG', marginLeft, 0, scaledWidth, pageHeight);
    }
    doc.save(`${invoice.invoice_id}.pdf`);
  };

  const handleDownloadProforma = async () => {
    if (!invoice || !client) return;
    const element = document.querySelector('.preview');
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF();
    const marginLeft = 20; // Left margin in mm
    const imgWidth = 170; // Content width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    if (imgHeight <= pageHeight) {
      doc.addImage(imgData, 'PNG', marginLeft, 0, imgWidth, imgHeight);
    } else {
      const scale = pageHeight / imgHeight;
      const scaledWidth = imgWidth * scale;
      doc.addImage(imgData, 'PNG', marginLeft, 0, scaledWidth, pageHeight);
    }
    doc.save(`${invoice.invoice_id}_PROFORMA.pdf`);
  };

  const formatDate = (dateObj) => {
    const date = new Date(dateObj);
    const dd = String(date.getDate()).padStart(2, "0");
    const yyyy = date.getFullYear();
    const month = date.toLocaleString("default", { month: "long" });
    return `${dd} ${month} ${yyyy}`;
  };

  function convertNumberToWords(num) {
    // Handle negative numbers and zero
    if (num < 0) return "Minus " + convertNumberToWords(-num);
    if (num === 0) return "Zero";

    const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
    const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    const scales = ["", "Thousand", "Lakh", "Crore"];

    let result = "";
    let scaleIndex = 0;

    while (num > 0) {
      // Get last 3 digits (hundreds, tens, units)
      let chunk = num % 1000;
      
      if (chunk > 0) {
        let chunkWords = "";
        
        // Hundreds
        if (chunk >= 100) {
          chunkWords += units[Math.floor(chunk / 100)] + " Hundred ";
          chunk -= Math.floor(chunk / 100) * 100;
        }
        
        // Tens and units
        if (chunk > 0) {
          if (chunk >= 20) {
            chunkWords += tens[Math.floor(chunk / 10)] + " ";
            chunk %= 10;
          }
          
          if (chunk > 0) {
            if (chunk >= 10 && chunk < 20) {
              chunkWords += teens[chunk - 10] + " ";
            } else {
              chunkWords += units[chunk] + " ";
            }
          }
        }
        
        // Add scale if needed
        if (scaleIndex > 0) {
          chunkWords += scales[scaleIndex] + " ";
        }
        
        // Prepend to result (process from highest scale to lowest)
        if (result) {
          result = chunkWords + result;
        } else {
          result = chunkWords.trim();
        }
      }
      
      num = Math.floor(num / 1000);
      scaleIndex++;
      
      // Handle Lakh and Crore scales
      if (scaleIndex === 2 && num > 0) scaleIndex = 3; // Skip "Thousand" for Lakh
      if (scaleIndex === 3 && num > 0) scaleIndex = 4; // Skip "Million" for Crore
    }

    return result.trim();
  }

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
  const fmt0 = (n) =>
    Number(n).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  // UPDATED RATES (intra: CGST+SGST; inter: IGST 18%; international: 0)
  let cgstRate = 0, sgstRate = 0, igstRate = 0;
  if (isIndian && isTelangana) {
    cgstRate = 9; sgstRate = 9; igstRate = 0;
  } else if (isIndian && !isTelangana) {
    cgstRate = 0; sgstRate = 0; igstRate = 18;
  } else {
    cgstRate = 0; sgstRate = 0; igstRate = 0;
  }

  // Prefer stored amounts from invoice; otherwise compute from subtotal & rates
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

      <div className="max-w-5xl mx-auto p-6">
        {/* logo + address */}
        <div className="mb-3">
          <img src={logoPath} alt="Company Logo" className="h-16" />
          <div className="text-left text-[12px] leading-none">
            <p className="mb-0">19/B, 3rd Floor, Progressive Tower, 100 Ft Road,</p>
            <p className="mb-0">Siddhi Vinayak Nagar, Madhapur,</p>
            <p className="mb-0">Hyderabad, Telangana - 500081</p>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold mb-3" style={{ color: headingColor }}>
          Tax Invoice
        </h1>

        {/* Top info table */}
        <table className="w-full border border-gray-300 border-collapse mb-4">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2 font-medium">
                <b>{isWT ? "Walls And Trends" : "Walls And Trends"}</b>
              </td>
              <td className="border border-gray-300 p-2 font-medium">
                <b>GST IN:</b> {isWT ? "36AACFW6827B1Z8" : "36AAACW8991C1Z9"}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">
                <b>Invoice Number:</b> {invoice.invoice_id}
              </td>
              <td className="border border-gray-300 p-2">
                <b>Invoice Date:</b>{" "}
                {invoice.created_at?.toDate
                  ? formatDate(invoice.created_at.toDate())
                  : formatDate(invoice.created_at || invoice.invoice_date)}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">
                <b>Invoice Title:</b> {invoice.invoice_title || lineItems[0]?.name}
              </td>
              <td className="border border-gray-300 p-2 font-semibold">
                <b>Total Cost:</b> INR {fmt0(total)}
              </td>
            </tr>
          </tbody>
        </table>

       
        <table className="w-full border border-gray-300 border-collapse mb-4">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2">
                <b>Customer Name:</b> {client.client_name}
              </td>
              <td className="border border-gray-300 p-2">
                <b>Customer Address:</b> {client.address}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2" colSpan={2}>
                <b>Customer GST IN:</b> {(client.gst_number || "").trim() || "NA"}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table className="w-full border border-gray-300 border-collapse mb-2 text-center">
          <thead className="bg-gray-100 text-black">
            <tr>
              <th className="p-2 border border-gray-300">HSN / SAC Code</th>
              <th className="p-2 border border-gray-300">Item</th>
              <th className="p-2 border border-gray-300">Description</th>
              <th className="p-2 border border-gray-300">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((it, idx) => (
              <tr key={idx}>
                <td className="border border-gray-300 p-2">9983</td>
                <td className="border border-gray-300 p-2">{it.name}</td>
                <td className="border border-gray-300 p-2">{it.description}</td>
                <td className="border border-gray-300 p-2 text-center pr-4">{fmt0(it.amount)}</td>
              </tr>
            ))}

            {/* Gross */}
            <tr>
              <td className="border border-gray-300 p-2 text-center" colSpan={3}>
                Gross
              </td>
              <td className="border border-gray-300 p-2 text-center pr-4">{fmt0(subtotal)}</td>
            </tr>

            {/* === TAX: show ONLY the applicable rows === */}
            {isIndian && isTelangana && (
              <>
                <tr>
                  <td className="border border-gray-300 p-2 text-center" colSpan={3}>
                    CGST @ 9%
                  </td>
                  <td className="border border-gray-300 p-2 text-center pr-4">{fmt2(cgstAmount)}</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-2 text-center" colSpan={3}>
                    SGST @ 9%
                  </td>
                  <td className="border border-gray-300 p-2 text-center pr-4">{fmt2(sgstAmount)}</td>
                </tr>
              </>
            )}

            {isIndian && !isTelangana && (
              <tr>
                <td className="border border-gray-300 p-2 text-center" colSpan={3}>
                  IGST @ 18%
                </td>
                <td className="border border-gray-300 p-2 text-center pr-4">{fmt2(igstAmount)}</td>
              </tr>
            )}

            {!isIndian && (
              <tr>
                <td className="border border-gray-300 p-2 text-center" colSpan={3}>
                  IGST @ 0%
                </td>
                <td className="border border-gray-300 p-2 text-center pr-4">{fmt2(igstAmount)}</td>
              </tr>
            )}

            {/* Total */}
            <tr className="font-bold">
              <td className="border border-gray-300 p-2 text-center text-[#3b5998]" colSpan={3}>
                Total
              </td>
              <td className="border border-gray-300 p-2 text-center pr-4 text-[#3b5998]">
                {fmt0(total)}
              </td>
            </tr>

            {/* Words row */}
            <tr>
              <td className="border border-gray-300 p-2 text-center" colSpan={3}>
                <span className="italic">(Total Amount In Words)</span>
              </td>
              <td className="border border-gray-300 p-2 text-center pr-4">
                {convertNumberToWords(Number(total).toFixed(0))} only
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bank Details */}
        <h2 className="font-semibold mb-2" style={{ color: headingColor }}>
          Bank Details
        </h2>
        <table className="w-full border border-gray-300 border-collapse mb-6 text-center">
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2 w-1/3"><b>Bank Name</b></td>
              <td className="border border-gray-300 p-2">Yes Bank</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2"><b>Beneficiary Name</b></td>
              <td className="border border-gray-300 p-2">{isWT ? "Walls And Trends" : "Walls And Trends"}</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2"><b>Account Number</b></td>
              <td className="border border-gray-300 p-2">000663300001713</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2"><b>Account Type</b></td>
              <td className="border border-gray-300 p-2">Current Account</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2"><b>IFSC Code</b></td>
              <td className="border border-gray-300 p-2">YESB0000006</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2"><b>Bank Branch</b></td>
              <td className="border border-gray-300 p-2">Somajiguda</td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2"><b>City</b></td>
              <td className="border border-gray-300 p-2">Hyderabad</td>
            </tr>
          </tbody>
        </table>

        <p><b>NOTE:</b> No files will be delivered until the final payment is made.</p>

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
 