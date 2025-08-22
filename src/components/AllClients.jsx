import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function AllClients() {
  const [clients, setClients] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      const querySnapshot = await getDocs(collection(db, "clients"));
      const clientList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClients(clientList);
    };
    fetchClients();
  }, []);

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this client?")) {
      await deleteDoc(doc(db, "clients", id));
      setClients(clients.filter(c => c.id !== id));
    }
  };

  return (
    <div className="p-6 overflow-x-auto all-clients">
      <h2 className="text-xl font-semibold mb-4">All Clients</h2>
      <table className="min-w-full border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Client Name</th>
            <th className="p-2 border">Company</th>
            <th className="p-2 border">POC</th>
            <th className="p-2 border">Phone</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Country</th>
            <th className="p-2 border">State</th>
            <th className="p-2 border">Address</th>
            <th className="p-2 border">PAN</th>
            <th className="p-2 border">GST</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id} className="hover:bg-gray-50">
              <td className="p-2 border">{client.client_name}</td>
              <td className="p-2 border">{client.company_name}</td>
              <td className="p-2 border">{client.poc}</td>
              <td className="p-2 border">{client.phone}</td>
              <td className="p-2 border">{client.email}</td>
              <td className="p-2 border">{client.country}</td>
              <td className="p-2 border">{client.state}</td>
              <td className="p-2 border">{client.address}</td>
              <td className="p-2 border">{client.pan_number}</td>
              <td className="p-2 border">{client.gst_number}</td>
              <td className="p-2 border whitespace-nowrap">
                <button
                  onClick={() => navigate(`/dashboard/edit-client/${client.id}`)}
                  className="mr-2 text-blue-600 hover:underline edit"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="mr-2 text-red-600 hover:underline edit"
                >
                  Delete
                </button>
                <button
                  onClick={() => navigate(`/dashboard/client-preview/${client.id}`)}
                  className="text-green-600 hover:underline edit"
                >
                  Preview
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
