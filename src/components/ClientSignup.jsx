import { useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import countriesWithStates from "../constants/countriesWithStates";

export default function ClientSignup() {
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
    gst_number: "",
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "country") {
      setClient((prev) => ({ ...prev, country: value, state: "" }));
    } else {
      setClient((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = [
      "client_name",
      "company_name",
      "poc",
      "phone",
      "email",
      "address",
      "pan_number",
    ];
    for (let field of requiredFields) {
      if (!client[field].trim()) {
        alert(`Please fill ${field.replace("_", " ")}`);
        return;
      }
    }

    const docId = `${client.company_name}_${client.client_name}`.replace(/\s+/g, "_");
    const finalData = {
      ...client,
      gst_number: client.gst_number.trim() === "" ? "NA" : client.gst_number,
      created_at: Timestamp.now(),
    };

    try {
      await setDoc(doc(db, "clients", docId), finalData);
      navigate("/dashboard/all-clients");
    } catch (err) {
      alert("Submission failed.");
    }
  };

  const countryList = Object.keys(countriesWithStates);
  const statesList = countriesWithStates[client.country] || [];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-inter">
      <form
        onSubmit={handleSubmit}
        className="shadow-lg rounded-lg p-8 max-w-md w-full space-y-4 bg-white text-black"
      >
        <h2 className="text-2xl font-bold text-center">Client Registration Form</h2>

        {/* Client Name */}
        <div>
          <label className="block mb-1 font-semibold">Client Name</label>
          <input
            name="client_name"
            value={client.client_name}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded"
            required
          />
        </div>

        {/* Company Name - Dropdown */}
        <div>
          <label className="block mb-1 font-semibold">Select Company</label>
          <select
            name="company_name"
            value={client.company_name}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded bg-white"
            required
          >
            <option value="">Select Company</option>
            <option value="WT">WT</option>
            <option value="WTPL">WTPL</option>
            <option value="WTX">WTX</option>
            <option value="WTXPL">WTXPL</option>
          </select>
        </div>

        {/* POC, Phone, Email */}
        {[
          { name: "poc", label: "POC" },
          { name: "phone", label: "Phone Number" },
          { name: "email", label: "Email" },
        ].map(({ name, label }) => (
          <div key={name}>
            <label className="block mb-1 font-semibold">{label}</label>
            <input
              name={name}
              value={client[name]}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required
            />
          </div>
        ))}

        {/* Country */}
        <div>
          <label className="block mb-1 font-semibold">Country</label>
          <select
            name="country"
            value={client.country}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded bg-white"
            required
          >
            <option value="">Select Country</option>
            {countryList.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        {/* State */}
        <div>
          <label className="block mb-1 font-semibold">State</label>
          {statesList.length > 0 ? (
            <select
              name="state"
              value={client.state}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded bg-white"
              required
            >
              <option value="">Select State</option>
              {statesList.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="state"
              value={client.state}
              onChange={handleChange}
              placeholder="State / Region"
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required
            />
          )}
        </div>

        {/* Address */}
        <div>
          <label className="block mb-1 font-semibold">Address</label>
          <input
            name="address"
            value={client.address}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded"
            required
          />
        </div>

        {/* PAN and GST */}
        {[
          { name: "pan_number", label: "PAN Number" },
          { name: "gst_number", label: "GST Number" },
        ].map(({ name, label }) => (
          <div key={name}>
            <label className="block mb-1 font-semibold">{label}</label>
            <input
              name={name}
              value={client[name]}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required={name === "pan_number"}
            />
          </div>
        ))}

        <button
          type="submit"
          className="w-full bg-black text-white font-semibold py-2 rounded transition cursor-pointer signup-btn"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
