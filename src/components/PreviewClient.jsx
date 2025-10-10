// src/pages/PreviewClient.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function PreviewClient() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const ref = doc(db, "clients", id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setClient({ id: snap.id, ...snap.data() });
        } else {
          alert("Client not found!");
          navigate("/dashboard/all-clients");
        }
      } catch (e) {
        console.error(e);
        alert("Failed to load client");
        navigate("/dashboard/all-clients");
      }
    })();
  }, [id, navigate]);

  if (!client) {
    return (
      <div className="p-[30px] bg-[#f5f7fb] min-h-screen flex items-center justify-center text-gray-600">
        Loading…
      </div>
    );
  }

  // --- helpers to match the screenshot look/wording ---
  const fmt = (v, fallback = "—") =>
    v === undefined || v === null || String(v).trim() === "" ? fallback : v;

  const fmtNA = (v) => fmt(v, "Not applicable");

  const fmtDateTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
      if (!d || isNaN(d)) return "Not applicable";
      return d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Not applicable";
    }
  };

  const rows = [
    { label: "Client Name", value: fmt(client.client_name) },
    // screenshot shows just "Company" and "-" when empty:
    { label: "Company", value: fmt(client.company_group, "-") },
    { label: "Phone Number", value: fmt(client.phone) },
    { label: "POC", value: fmt(client.poc) },
    { label: "Email", value: fmt(client.email) },
    { label: "Address", value: fmt(client.address) },
    { label: "Country", value: fmt(client.country) },
    { label: "State", value: fmt(client.state) },
    { label: "PAN Number", value: fmtNA(client.pan_number) },
    { label: "GST Number", value: fmtNA(client.gst_number) },
    { label: "Created At", value: fmtDateTime(client.created_at) },
  ];

  return (
    <div className="p-[30px] bg-[#f5f7fb] min-h-screen">
      {/* Title chip (same as other pages) */}
      <div className="mb-4 bg-[#ffffff] p-[10px] border-curve mb-[30px]">
        <h2 className="text-xl font-semibold text-gray-800 m-[0]">
          Client Preview
        </h2>
      </div>

      {/* Card */}
      <div className="bg-[#ffffff] border-curve rounded-xl shadow p-[18px] md:p-[22px]">
        {/* Two-column “table” with soft blue stripes like the screenshot */}
        <div className="overflow-hidden rounded-xl">
          <table className=" border-separate border-spacing-0 w-[100%]">
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.label}
                  className={i % 2 === 0 ? "bg-[#F3F7FF]" : "bg-[#ffffff]"}
                >
                  <td className="w-[50%] md:w-[35%] px-4 md:px-5 py-3 md:py-3.5 font-semibold text-gray-700 border-b border-[#E7ECF6] p-[10px] border-curve">
                    {r.label}
                  </td>
                  <td className="px-4 md:px-5 py-3 md:py-3.5 text-gray-800 border-b border-[#E7ECF6] p-[10px] w-[50%] border-curve">
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Buttons (bottom-left, like your screenshot) */}
        <div className="mt-5 flex items-center gap-3 mt-[20px]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 rounded-md bg-[#2E53A3] text-[#ffffff] hover:opacity-95 border-0 border-curve w-[100px] h-[40px] mr-[10px]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => navigate(`/dashboard/edit-client/${id}`)}
            className="px-4 py-2 rounded-md bg-[#28a745] text-[#ffffff] hover:opacity-95 border-0 border-curve w-[100px] h-[40px]"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
