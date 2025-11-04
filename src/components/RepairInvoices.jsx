import React, { useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

export default function RepairInvoices() {
  useEffect(() => {
    const repair = async () => {
      const snapshot = await getDocs(collection(db, "invoices"));

      for (const document of snapshot.docs) {
        const data = document.data();

        if (!data.services || !Array.isArray(data.services) || data.services.length === 0) {
          await updateDoc(doc(db, "invoices", document.id), {
            services: [{ name: "Default Service", description: "Auto-fixed service" }],
          });
          console.log(`Repaired invoice: ${document.id}`);
        }
      }

      alert("Repair completed ✅");
    };

    repair();
  }, []);

  return (
    <div className="p-10 text-center">
      <h1>Repairing Invoices...</h1>
    </div>
  );
}
