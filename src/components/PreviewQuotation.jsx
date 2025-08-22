import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { generateQuotationPDF } from "../utils/generateQuotationPDF";

export default function PreviewQuotation() {
  const { id } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        const quotationRef = doc(db, "quotations", id);
        const quotationSnap = await getDoc(quotationRef);
        if (quotationSnap.exists()) {
          const quotationData = quotationSnap.data();
          setQuotation(quotationData);

          const clientRef = doc(db, "clients", quotationData.client_id);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) {
            setClient(clientSnap.data());
          }
        }
      } catch (err) {
        console.error("Error loading quotation:", err);
      }
    };

    fetchQuotation();
  }, [id]);

  const handleDownload = async () => {
    if (!quotation || !client) return;
    const docPDF = await generateQuotationPDF(quotation, client);
    if (docPDF && docPDF.save) {
      docPDF.save(`${quotation.quotation_id}.pdf`);
    } else {
      console.error("PDF generation failed.");
    }
  };

  if (!quotation || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading quotation...
      </div>
    );
  }

  const logoPath = (quotation.quotation_type === "WT" || quotation.quotation_type === "WTPL")
    ? "/wt-logo.png"
    : "/wtx_logo.webp";

  return (
    <div className="min-h-screen bg-white px-6 py-10 font-sans text-sm text-gray-900 preview">
      <button
        onClick={handleDownload}
        className="absolute top-4 right-6 bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded hover:bg-[#2d4373] downloadbtn"
      >
        Download PDF
      </button>

      <div className="max-w-5xl mx-auto p-6">
        <div className="items-start mb-4">
          <img src={logoPath} alt="Company Logo" className="h-16" />
          <div className="text-left text-sm leading-5 address">
            <p>19/B, 3rd Floor, Progressive Tower</p>
            <p>100 Ft Road, Siddhi Vinayak Nagar</p>
            <p>Madhapur, Hyderabad, Telangana - 500081</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-left mb-6 text-[#3b5998] font-heading">Quotation</h1>

        <table className="w-full border-collapse  mb-4">
          <tbody>
            <tr>
              <td className="border p-2 font-medium">
                <b>{(quotation.quotation_type === "WT" || quotation.quotation_type === "WTPL")
                  ? "Walls And Trends"
                  : "WTX"}</b>
              </td>
              <td className="border p-2 font-medium">
                <b>GST IN: </b> {(quotation.quotation_type === "WT" || quotation.quotation_type === "WTPL")
                  ? "36AACFW6827B1Z8"
                  : "WTX GST NUMBER"}
              </td>
            </tr>
            <tr>
              <td className="border p-2"><b>Quotation Number:</b> {quotation.quotation_id}</td>
              <td className="border p-2"><b>Quotation Date:</b> {quotation.quotation_date}</td>
            </tr>
            <tr>
              <td className="border p-2"><b>Quotation Title:</b> {quotation.quotation_title}</td>
              <td className="border p-2 font-semibold"><b>Total Cost:</b> {Number(quotation.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border border-collapse border-gray-300 mb-4">
          <tbody>
            <tr>
              <td className="border p-2"><strong>Customer Name:</strong> {client.client_name}</td>
              <td className="border p-2"><strong>Customer Address:</strong> {client.address}</td>
            </tr>
            <tr>
              <td className="border p-2" colSpan={2}><strong>Customer Email:</strong> {client.email}</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border border-collapse border-gray-300 mb-4 text-center">
          <thead className="bg-gray-100 text-black">
            <tr>
              <th className="p-2 border">Service Name</th>
              <th className="p-2 border">Description</th>
              <th className="p-2 border text-center">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            {quotation.services.map((s, i) => (
              <tr key={i}>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2 text-left">{s.description}</td>
                <td className="border p-2 text-center">₹{Number(s.amount).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td colSpan="2" className="border p-2 text-[#3b5999] text-right">Total</td>
              <td className="border p-2 text-center text-[#3b5999]">₹{Number(quotation.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tbody>
        </table>

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
