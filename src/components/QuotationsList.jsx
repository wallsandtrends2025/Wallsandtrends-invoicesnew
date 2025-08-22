import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function QuotationsList() {
  const [quotations, setQuotations] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuotations = async () => {
      try {
        const snapshot = await getDocs(collection(db, "quotations"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setQuotations(data);
      } catch (error) {
        console.error("Error fetching quotations:", error);
      }
    };

    fetchQuotations();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this quotation?")) {
      await deleteDoc(doc(db, "quotations", id));
      setQuotations((prev) => prev.filter((q) => q.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-6 py-10 font-inter">
      <h2 className="text-3xl font-bold text-center mb-8 text-black">
        All Quotations
      </h2>

      <div className=" rounded-xl shadow-lg">
        <table className=" table-auto text-sm bg-black text-white  rounded-lg">
          <thead className="bg-gray-900 text-white sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 border border-gray-700 text-left">Quotation ID</th>
              <th className="px-6 py-3 border border-gray-700 text-left">Client</th>
              <th className="px-6 py-3 border border-gray-700 text-left">Title</th>
              <th className="px-6 py-3 border border-gray-700 text-left">Services</th>
              <th className="px-6 py-3 border border-gray-700 text-center">Amount</th>
              <th className="px-6 py-3 border border-gray-700 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-10 text-gray-300">
                  No quotations found.
                </td>
              </tr>
            ) : (
              quotations.map((q, index) => (
                <tr
                  key={q.id}
                  className={`transition ${index % 2 === 0 ? 'bg-gray-950' : 'bg-black'} hover:bg-gray-800`}
                >
                  <td className="px-6 py-3 border border-gray-800">{q.quotation_id}</td>
                  <td className="px-6 py-3 border border-gray-800">{q.client_name || q.client_id}</td>
                  <td className="px-6 py-3 border border-gray-800">{q.quotation_title}</td>
                  <td className="px-6 py-3 border border-gray-800">
                    {q.services?.map((s) => s.name).join(" + ") || "—"}
                  </td>
                  <td className="px-6 py-3 border border-gray-800 text-center">
                    ₹{Number(q.total_amount || q.amount).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 border border-gray-800">
                    <div className="flex flex-col items-center gap-y-2">
                      <button
                        onClick={() => navigate(`/dashboard/edit-quotation/${q.id}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded text-xs edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-xs edit"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => navigate(`/dashboard/quotation/${q.quotation_id}`)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-xs edit"
                      >
                        Preview
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
