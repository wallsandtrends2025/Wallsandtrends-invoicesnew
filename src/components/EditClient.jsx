import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState({
    client_name: "",
    company_name: "",
    poc: "",
    phone: "",
    email: "",
    address: "",
    country: "",
    state: "",
    pan_number: "",
    gst_number: ""
  });

  useEffect(() => {
    const fetchClient = async () => {
      const ref = doc(db, "clients", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        // Ensure all fields exist even if not in DB
        setClient((prev) => ({ ...prev, ...snap.data() }));
      }
    };
    fetchClient();
  }, [id]);

  const handleChange = (e) => {
    setClient({ ...client, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ref = doc(db, "clients", id);
    await updateDoc(ref, client);
    navigate("/dashboard/all-clients");
  };

  const fieldOrder = [
    "client_name",
    "company_name",
    "poc",
    "phone",
    "email",
    "address",
    "country",
    "state",
    "pan_number",
    "gst_number"
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto bg-white shadow-md edit-client">
      <h2 className="text-xl font-semibold mb-4">Edit Client</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {fieldOrder.map((field) => (
          <div key={field}>
            <label className="block mb-1 capitalize">
              {field.replace(/_/g, " ")}
            </label>
            <input
              type="text"
              name={field}
              value={client[field] || ""}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
              required
            />
          </div>
        ))}
        <button
          type="submit"
          className="bg-[#3b5999] text-[#ffffff] px-4 py-2 rounded save-changes-btn"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}