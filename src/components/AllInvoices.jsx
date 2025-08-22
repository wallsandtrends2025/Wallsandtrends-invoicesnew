import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllInvoices() {
  const [invoices, setInvoices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInvoices = async () => {
      const snapshot = await getDocs(collection(db, "invoices"));
      const invoiceList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setInvoices(invoiceList);
    };

    fetchInvoices();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this invoice?")) {
      await deleteDoc(doc(db, "invoices", id));
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    }
  };

  const getServiceNames = (services) => {
    if (!Array.isArray(services)) return "—";

    const names = services
      .filter((s) => s && Array.isArray(s.name))
      .flatMap((s) => s.name)
      .filter((n) => typeof n === "string" && n.trim() !== "");

    return names.length > 0 ? names.join(", ") : "—";
  };

  const formatStatus = (status) => {
    const lower = (status || "").toLowerCase();
    const baseClass = "px-2 py-1 rounded-full text-xs font-semibold";
    if (lower === "paid") return <span className={`${baseClass} bg-green-100 text-green-800`}>Paid</span>;
    if (lower === "pending") return <span className={`${baseClass} bg-red-100 text-red-800`}>Pending</span>;
    if (lower === "partial") return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>Partial</span>;
    return <span className={`${baseClass} bg-gray-100 text-gray-800`}>—</span>;
  };

  return (
    <div className="p-6 all-invoices">
      <h2 className="text-2xl font-bold mb-4">All Invoices</h2>

      {invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <table className="table-auto border border-gray-300 text-sm w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-4 py-2">Invoice ID</th>
              <th className="border px-4 py-2">Client ID</th>
              <th className="border px-4 py-2">Title</th>
              <th className="border px-4 py-2">Service(s)</th>
              <th className="border px-4 py-2">Amount</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="border px-4 py-2">{invoice.invoice_id || "—"}</td>
                <td className="border px-4 py-2">{invoice.client_id || "—"}</td>
                <td className="border px-4 py-2">{invoice.invoice_title || "—"}</td>
                <td className="border px-4 py-2">{getServiceNames(invoice.services)}</td>
                <td className="border px-4 py-2">
                  ₹{invoice.total_amount ? invoice.total_amount.toLocaleString() : "0"}
                </td>
                <td className="border px-4 py-2 text-center">
                  {formatStatus(invoice.payment_status)}
                </td>
                <td className="border px-4 py-2 space-x-2">
                  <button
                    onClick={() => navigate(`/dashboard/edit-invoice/${invoice.id}`)}
                    className="bg-blue-600 text-white px-3 py-1 rounded edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(invoice.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded edit"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => navigate(`/dashboard/invoice-preview/${invoice.id}`)}
                    className="bg-green-600 text-white px-3 py-1 rounded edit"
                  >
                    Preview
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
