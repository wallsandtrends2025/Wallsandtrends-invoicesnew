import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function ClientList() {
  const [clients, setClients] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "clients"), (snapshot) => {
      const clientData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setClients(clientData);
    });

    return () => unsub(); // clean up listener
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Client List</h2>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1">Client Name</th>
            <th className="border px-2 py-1">Created At</th>
            <th className="border px-2 py-1">Created By</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id} className="text-center">
              <td className="border px-2 py-1">{client.client_name}</td>
              <td className="border px-2 py-1">
                {client.created_at?.toDate().toLocaleString()}
              </td>
              <td className="border px-2 py-1">
                {client.created_by?.toDate().toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
