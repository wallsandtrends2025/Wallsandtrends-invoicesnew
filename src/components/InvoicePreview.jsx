import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { generateInvoicePDF } from "../utils/generateInvoicePDF";
import { generateProformaInvoicePDF } from "../utils/generateProformaInvoicePDF";

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
    const docPDF = await generateInvoicePDF(invoice, client);
    if (docPDF?.save) {
      docPDF.save(`${invoice.invoice_id}.pdf`);
    } else {
      console.error("Tax Invoice PDF generation failed.");
    }
  };

  const handleDownloadProforma = async () => {
    if (!invoice || !client) return;
    const docPDF = await generateProformaInvoicePDF(invoice, client);
    if (docPDF?.save) {
      docPDF.save(`${invoice.invoice_id}_PROFORMA.pdf`);
    } else {
      console.error("Proforma Invoice PDF generation failed.");
    }
  };

  const formatDate = (dateObj) => {
    const date = new Date(dateObj);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd} ${date.toLocaleString("default", { month: "long" })} ${yyyy}`;
  };

  function convertNumberToWords(amount) {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if ((amount = amount.toString()).length > 9) return 'Overflow';
    const n = ('000000000' + amount).substr(-9).match(/(\d{2})(\d{2})(\d{2})(\d{3})/);
    if (!n) return;

    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' ' : '';
    return str.trim();
  }

  if (!invoice || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading invoice...
      </div>
    );
  }

  const logoPath = (invoice.invoice_type === "WT" || invoice.invoice_type === "WTPL")
    ? "/wt-logo.png"
    : "/wtx_logo.png";

  return (
    <div className="min-h-screen bg-white px-6 py-10 font-sans text-sm text-gray-900 preview">
       <button
        onClick={handleEdit}
        className="absolute top-4 left-6 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] downloadbtn downloadbtn3"
      >
        Edit Invoice
      </button>

      <button
        onClick={handleDownloadTax}
        className="absolute top-4 right-6 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] downloadbtn"
      >
        Download Tax Invoice PDF
      </button>

      <button
        onClick={handleDownloadProforma}
        className="absolute top-4 right-6 mt-14 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] downloadbtn downloadbtn2"
      >
        Download Proforma Invoice PDF
      </button>

     <div className="max-w-5xl mx-auto p-6 border-gray-300">
  <div className="items-start mb-4">
    <img src={logoPath} alt="Company Logo" className="h-16" />
    <div className="text-left text-sm leading-5 address">
      <p>19/B, 3rd Floor, Progressive Tower</p>
      <p>100 Ft Road, Siddhi Vinayak Nagar</p>
      <p>Madhapur, Hyderabad, Telangana - 500081</p>
    </div>
  </div>

  <h1 className="text-xl font-bold text-left mb-6 text-[#3b5998] font-heading">Tax Invoice</h1>

  <table className="w-full border-collapse border-gray-300 mb-4">
    <tbody>
      <tr>
        <td className="border p-2 font-medium">
          <b>{(invoice.invoice_type === "WT" || invoice.invoice_type === "WTPL") ? "Walls And Trends" : "WTX"}</b>
        </td>
        <td className="border p-2 font-medium">
          <b>GST IN: </b>{(invoice.invoice_type === "WT" || invoice.invoice_type === "WTPL")
            ? "36AACFW6827B1Z8"
            : "WTX GST NUMBER"}
        </td>
      </tr>
      <tr>
        <td className="border p-2"><b>Invoice Number:</b> {invoice.invoice_id}</td>
        <td className="border p-2"><b>Invoice Date:</b> {formatDate(invoice.created_at.toDate())}</td>
      </tr>
      <tr>
        <td className="border p-2"><b>Invoice Title:</b> {invoice.service_name}</td>
        <td className="border p-2 font-semibold"><b>Total Cost:</b> {Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <p className="mb-4">This invoice prepared by Walls & Trends (WTPL) includes {invoice.service_name} for {client.client_name}.</p>

  <table className="w-full border border-collapse border-gray-300 mb-4">
    <tbody>
      <tr>
        <td className="border p-2"><strong>Customer Name:</strong> {client.client_name}</td>
        <td className="border p-2"><strong>Customer Address:</strong> {client.address}</td>
      </tr>
      <tr>
        <td className="border p-2" colSpan={2}><strong>Customer GST IN:</strong> {client.gst_number}</td>
      </tr>
    </tbody>
  </table>

  <table className="w-full border border-collapse border-gray-300 mb-4 text-center">
    <thead className="bg-gray-100 text-black">
      <tr>
        <th className="p-2 border">HSN / SAC Code</th>
        <th className="p-2 border">Item</th>
        <th className="p-2 border">Description</th>
        <th className="p-2 border text-center">Amount (INR)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="border p-2">9983</td>
        <td className="border p-2">{invoice.service_name}</td>
        <td className="border p-2">{invoice.service_description}</td>
        <td className="border p-2 text-center">{Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td colSpan="3" className="border p-2 font-medium">Gross</td>
        <td className="border p-2 text-center">{Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td colSpan="3" className="border p-2 font-medium">IGST @ 18%</td>
        <td className="border p-2 text-center">{Number(invoice.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr className="font-bold">
        <td colSpan="3" className="border p-2 text-[#3b5999]">Total</td>
        <td className="border p-2 text-center text-[#3b5999]">{Number(invoice.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr>
        <td colSpan="4" className="border p-2 italic text-center">
          {convertNumberToWords(invoice.total_amount.toFixed(0))}
        </td>
      </tr>
    </tbody>
  </table>

  <h2 className="text-black font-semibold mb-2 text-[#3b5998] bank-details">Bank Details</h2>
  <table className="w-full border border-collapse border-gray-300 mb-6 text-center">
    <tbody>
      <tr><td className="border p-2"><b>Bank Name</b></td><td className="border p-2">Yes Bank</td></tr>
      <tr><td className="border p-2"><b>Beneficiary Name</b></td><td className="border p-2">{(invoice.invoice_type === "WT" || invoice.invoice_type === "WTPL") ? "Walls And Trends" : "Walls And Trends WTX"}</td></tr>
      <tr><td className="border p-2"><b>Account Number</b></td><td className="border p-2">000663300001713</td></tr>
      <tr><td className="border p-2"><b>Account Type</b></td><td className="border p-2">Current Account</td></tr>
      <tr><td className="border p-2"><b>IFSC Code</b></td><td className="border p-2">YESB0000006</td></tr>
      <tr><td className="border p-2"><b>Branch</b></td><td className="border p-2">Somajiguda</td></tr>
      <tr><td className="border p-2"><b>City</b></td><td className="border p-2">Hyderabad</td></tr>
    </tbody>
  </table>

  <p><b>NOTE:</b> No files will be delivered until the final payment is made.</p>

  <div className="flex justify-start mt-10">
    <div className="text-center">
      <img src="/csh-sign.PNG" alt="Signature" className="h-12 mx-auto mb-1" />
      <p className="text-xs authorised-text">Authorised Signature for Walls & Trends</p>
    </div>
  </div>

  <div className="flex justify-end mt-10">
    <div className="text-right">
      <p className="text-xs italic text-[#3b5998] thank-you-text">Authenticity Promised. Creativity Published</p>
      <p className="text-xs italic text-[#3b5998] thank-you-text">Thank you for your business!</p>
    </div>
  </div>
</div>

    </div>
  );
}
