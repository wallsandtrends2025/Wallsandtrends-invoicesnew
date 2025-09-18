import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { generateProformaInvoicePDF } from "../utils/generateProformaInvoicePDF"; // uses your existing util

export default function PreviewQuotation() { // keep the same component name to avoid import/route changes
  const { id } = useParams();
  const [docData, setDocData] = useState(null);
  const [client, setClient] = useState(null);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const ref = doc(db, "quotations", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setDocData(data);

          const clientRef = doc(db, "clients", data.client_id);
          const clientSnap = await getDoc(clientRef);
          if (clientSnap.exists()) setClient(clientSnap.data());
        }
      } catch (err) {
        console.error("Error loading proforma:", err);
      }
    };

    fetchDoc();
  }, [id]);

  const handleDownload = async () => {
    if (!docData || !client) return;
    try {
      const pdf = await generateProformaInvoicePDF(docData, client);
      if (pdf?.save) {
        const fileId = docData.proforma_id || docData.quotation_id || id;
        pdf.save(`${fileId}.pdf`);
      } else {
        console.error("PDF generation failed.");
      }
    } catch (e) {
      console.error("PDF generation error:", e);
    }
  };

  if (!docData || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] text-[#3b5999] text-xl">
        Loading proforma...
      </div>
    );
  }

  // Use new fields if present, else fall back to old quotation fields
  const type = docData.proforma_type || docData.quotation_type;
  const number = docData.proforma_id || docData.quotation_id;
  const date = docData.proforma_date || docData.quotation_date;
  const title = docData.proforma_title || docData.quotation_title;
  const total = Number(docData.total_amount);

  const logoPath =
    type === "WT" || type === "WTPL" ? "/wt-logo.png" : "/wtx_logo.webp";

  const companyName =
    type === "WT" || type === "WTPL" ? "Walls And Trends" : "WTX";

  const gstIn =
    type === "WT" || type === "WTPL" ? "36AACFW6827B1Z8" : "WTX GST NUMBER";

  const renderServiceName = (name) => {
    // name can be string OR array (from your multi-select)
    if (Array.isArray(name)) return name.join(", ");
    return String(name || "");
  };

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

        <h1 className="text-xl font-bold text-left mb-6 text-[#3b5998] font-heading">
          Proforma
        </h1>

        <table className="w-full border-collapse mb-4">
          <tbody>
            <tr>
              <td className="border p-2 font-medium">
                <b>{companyName}</b>
              </td>
              <td className="border p-2 font-medium">
                <b>GST IN: </b> {gstIn}
              </td>
            </tr>
            <tr>
              <td className="border p-2">
                <b>Proforma Number:</b> {number}
              </td>
              <td className="border p-2">
                <b>Proforma Date:</b> {date}
              </td>
            </tr>
            <tr>
              <td className="border p-2">
                <b>Proforma Title:</b> {title}
              </td>
              <td className="border p-2 font-semibold">
                <b>Total Cost:</b>{" "}
                {total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border border-collapse border-gray-300 mb-4">
          <tbody>
            <tr>
              <td className="border p-2">
                <strong>Customer Name:</strong> {client.client_name}
              </td>
              <td className="border p-2">
                <strong>Customer Address:</strong> {client.address}
              </td>
            </tr>
            <tr>
              <td className="border p-2" colSpan={2}>
                <strong>Customer Email:</strong> {client.email}
              </td>
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
            {(docData.services || []).map((s, i) => (
              <tr key={i}>
                <td className="border p-2">
                  {renderServiceName(s.name)}
                </td>
                <td className="border p-2 text-left">{s.description}</td>
                <td className="border p-2 text-center">
                  ₹{Number(s.amount).toFixed(2)}
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td
                colSpan="2"
                className="border p-2 text-[#3b5999] text-right"
              >
                Total
              </td>
              <td className="border p-2 text-center text-[#3b5999]">
                ₹
                {total.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-start mt-10">
          <div className="text-center">
            <img src="/csh-sign.PNG" alt="Signature" className="h-12 mx-auto mb-1" />
            <p className="text-xs authorised-text">
              Authorised Signature for Walls & Trends
            </p>
          </div>
        </div>

        <div className="flex justify-end mt-10">
          <div className="text-right">
            <p className="text-xs italic text-[#3b5998] thank-you-text">
              Authenticity Promised. Creativity Published
            </p>
            <p className="text-xs italic text-[#3b5998] thank-you-text">
              Thank you for your business!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
