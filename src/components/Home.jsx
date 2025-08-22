import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

// Component for each status bar
const ProgressBar = ({ label, count, total, color }) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
        <div
          className="h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold bar-colour"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            transition: "width 0.5s ease",
          }}
        >
          <span>{percentage}%</span>
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    const fetchInvoices = async () => {
      const snapshot = await getDocs(collection(db, "invoices"));
      const list = snapshot.docs.map((doc) => doc.data());
      setInvoices(list);
    };

    fetchInvoices();
  }, []);

  const total = invoices.length;
  const paid = invoices.filter((inv) => inv.payment_status === "Paid").length;
  const pending = invoices.filter((inv) => inv.payment_status === "Pending").length;
  const partial = invoices.filter((inv) => inv.payment_status === "Partial").length;

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white shadow-md rounded-md p-8">
        <h2 className="text-2xl font-bold text-center mb-8 text-black">
         Payment Status
        </h2>

        {/* Counts Display */}
        <div className="grid grid-cols-4 text-center mb-8">
          <div>
            <p className="text-sm text-gray-500 font-bold text-[#037595]">Total</p>
            <p className="text-lg font-bold text-black">{total}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 text-[#16a34a] font-bold">Paid</p>
            <p className="text-lg font-bold text-green-600">{paid}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold text-[#dc2626]">Pending</p>
            <p className="text-lg font-bold text-red-600">{pending}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-bold text-[#2563eb]">Partial</p>
            <p className="text-lg font-bold text-blue-600">{partial}</p>
          </div>
        </div>

        {/* Progress Bars */}
        <ProgressBar label="Paid" count={paid} total={total} color="#16a34a" />
        <ProgressBar label="Pending" count={pending} total={total} color="#dc2626" />
        <ProgressBar label="Partial" count={partial} total={total} color="#2563eb" />
      </div>
    </div>
  );
}
