import { useEffect, useState } from "react";
import { collection, addDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function AddClient() {
  const [client, setClient] = useState({
    client_name: "",
    country: "India",
    state: "Telangana",
    phone: "",
    poc: "",
    email: "",
    company_name: "WT",
    address: "",
  });

  const [clients, setClients] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clientData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClients(clientData);
    });

    return () => unsub();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const now = Timestamp.now();
      await addDoc(collection(db, "clients"), {
        ...client,
        created_by: now,
        created_in: now,
        created_at: now,
        updated_at: now,
      });
      alert("Client added!");
      setClient({
        client_name: "",
        country: "India",
        state: "Telangana",
        phone: "",
        poc: "",
        email: "",
        company_name: "WT",
        address: "",
      });
    } catch (err) {
      console.error("Error adding client:", err);
      alert("Failed to add client.");
    }
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen space-y-10">
      <form
        onSubmit={handleSubmit}
        className="bg-white shadow-md rounded p-6 max-w-xl mx-auto space-y-4"
      >
        <h2 className="text-xl font-bold text-center">Add New Client</h2>

        <div className="w-full">
          <label className="block font-semibold mb-1">Client Name</label>
          <input
            name="client_name"
            value={client.client_name}
            onChange={handleChange}
            placeholder="Client Name"
            required
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">Country</label>
          <select
            name="country"
            value={client.country}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          >
            <option value="India">India</option>
            <option value="America">America</option>
          </select>
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">State</label>
          <select
            name="state"
            value={client.state}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          >
            <option value="Telangana">Telangana</option>
            <option value="Andhra Pradesh">Andhra Pradesh</option>
          </select>
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">Phone</label>
          <input
            name="phone"
            value={client.phone}
            onChange={handleChange}
            placeholder="Phone"
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">POC (Point of Contact)</label>
          <input
            name="poc"
            value={client.poc}
            onChange={handleChange}
            placeholder="POC"
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">Email</label>
          <input
            name="email"
            value={client.email}
            onChange={handleChange}
            placeholder="Email"
            type="email"
            className="w-full border p-2 rounded"
          />
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">Select Company</label>
          <select
            name="company_name"
            value={client.company_name}
            onChange={handleChange}
            className="w-full border p-2 rounded"
          >
            <option value="WT">WT</option>
            <option value="WTPL">WTPL</option>
            <option value="WTX">WTX</option>
            <option value="WTXPL">WTXPL</option>
          </select>
        </div>

        <div className="w-full">
          <label className="block font-semibold mb-1">Address</label>
          <input
            name="address"
            value={client.address}
            onChange={handleChange}
            placeholder="Address"
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          Add Client
        </button>
      </form>
    </div>
  );
}
