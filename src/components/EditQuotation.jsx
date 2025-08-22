import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Select from "react-select";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
} from "firebase/firestore";

export default function EditQuotation() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quotation, setQuotation] = useState(null);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState(["WT", "WTX"]);
  const [paymentOptions] = useState(["Pending", "Partial", "Paid"]);
  const [serviceOptions, setServiceOptions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const quotationRef = doc(db, "quotations", id);
        const docSnap = await getDoc(quotationRef);

        if (!docSnap.exists()) {
          alert("Quotation not found!");
          return navigate("/dashboard/all-quotations");
        }

        const data = docSnap.data();
        const formattedServices =
          data.services?.map((s) => ({
            ...s,
            serviceType: { value: s.name, label: s.name },
          })) || [];

        setQuotation({
          ...data,
          services: formattedServices,
        });

        setServiceOptions([
          { value: "Lyrical Videos", label: "Lyrical Videos" },
          { value: "Teasers", label: "Teasers" },
          { value: "Trailers", label: "Trailers" },
          { value: "Posters", label: "Posters" },
          { value: "Promos", label: "Promos" },
        ]);

        setLoading(false);
      } catch (error) {
        console.error("Error fetching quotation:", error);
        alert("Something went wrong.");
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleServiceChange = (index, field, value) => {
    const updated = [...quotation.services];
    if (field === "serviceType") {
      updated[index].serviceType = value;
      updated[index].name = value.value;
    } else {
      updated[index][field] = value;
    }
    setQuotation({ ...quotation, services: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        ...quotation,
        services: quotation.services.map((s) => ({
          name: s.serviceType.value,
          description: s.description || "",
          amount: s.amount || 0,
        })),
      };

      await updateDoc(doc(db, "quotations", id), updatedData);
      navigate("/dashboard/all-quotations");
    } catch (error) {
      console.error("Update failed:", error);
      alert("Failed to update.");
    }
  };

  if (loading || !quotation) return <p className="text-center p-6">Loading...</p>;

  return (
    <div className="min-h-screen bg-black flex justify-center p-6">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-900 text-white rounded-xl shadow-xl p-8 w-full max-w-4xl"
      >
        <h2 className="text-3xl font-bold text-center mb-8">Edit Quotation</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">Quotation Date</label>
            <input
              type="text"
              value={quotation.date}
              onChange={(e) => setQuotation({ ...quotation, date: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Quotation Title</label>
            <input
              type="text"
              value={quotation.quotation_title}
              onChange={(e) => setQuotation({ ...quotation, quotation_title: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Select Company</label>
            <select
              value={quotation.company}
              onChange={(e) => setQuotation({ ...quotation, company: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Payment Status</label>
            <select
              value={quotation.payment_status}
              onChange={(e) => setQuotation({ ...quotation, payment_status: e.target.value })}
              className="w-full p-3 rounded bg-gray-800 border border-gray-700 text-white"
            >
              {paymentOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-semibold text-white">Services</h3>

          {quotation.services.map((s, index) => (
            <div key={index} className="bg-gray-800 p-4 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Name</label>
                <Select
                  options={serviceOptions}
                  value={s.serviceType}
                  onChange={(val) => handleServiceChange(index, "serviceType", val)}
                  styles={selectStyles}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={s.description || ""}
                  onChange={(e) => handleServiceChange(index, "description", e.target.value)}
                  className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={s.amount || ""}
                  onChange={(e) => handleServiceChange(index, "amount", e.target.value)}
                  className="w-full p-3 rounded bg-gray-900 border border-gray-700 text-white"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="update-project-btn mt-10 mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold tracking-wide py-3 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 ease-in-out"
        >
          Update Quotation
        </button>
      </form>
    </div>
  );
}

const selectStyles = {
  control: (base) => ({
    ...base,
    backgroundColor: "#1f2937",
    borderColor: "#374151",
    color: "#fff",
  }),
  input: (base) => ({ ...base, color: "white" }),
  singleValue: (base) => ({ ...base, color: "white" }),
  multiValue: (base) => ({ ...base, backgroundColor: "#374151" }),
  multiValueLabel: (base) => ({ ...base, color: "white" }),
  menu: (base) => ({ ...base, backgroundColor: "#111827" }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "#374151" : "#111827",
    color: "white",
  }),
};
