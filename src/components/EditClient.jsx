import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import countriesWithStates from "../constants/countriesWithStates";

export default function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();

  const companyGroups = useMemo(
    () => ({
      WT_WTPL: ["WT", "WTPL"],
      WTX_WTXPL: ["WTX", "WTXPL"],
    }),
    []
  );

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState({
    client_name: "",
    company_group: "",
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
  const [errors, setErrors] = useState({ phone: "", email: "" });

  // Validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  const isIndia = (country) => {
    const c = String(country || "").toLowerCase();
    return ["india", "republic of india", "in"].includes(c);
  };
  const indiaMobileRegex = /^[6-9]\d{9}$/;
  const intlRegex = /^\+?\d{7,15}$/;

  const validatePhone = (raw, country) => {
    if (!raw) return "Phone is required.";
    if (isIndia(country)) return indiaMobileRegex.test(raw) ? "" : "Enter a valid 10-digit Indian mobile (starts 6–9).";
    return intlRegex.test(raw) ? "" : "Enter a valid phone (e.g., +15551234567).";
  };
  const validateEmail = (raw) => (!raw ? "Email is required." : emailRegex.test(raw) ? "" : "Enter a valid email address.");

  const trimOrEmpty = (v) => (typeof v === "string" ? v.trim() : "");
  const safeGroup = (g) => (g === "WT_WTPL" || g === "WTX_WTXPL" ? g : "");
  const inferGroupFromCompany = (companyName) => {
    const n = trimOrEmpty(companyName);
    if (!n) return "";
    if (companyGroups.WT_WTPL.includes(n)) return "WT_WTPL";
    if (companyGroups.WTX_WTXPL.includes(n)) return "WTX_WTXPL";
    return "";
  };

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const ref = doc(db, "clients", id);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("Client not found.");
          navigate("/dashboard/all-clients");
          return;
        }
        const data = snap.data() || {};
        const loadedGroup = safeGroup(trimOrEmpty(data.company_group)) || inferGroupFromCompany(data.company_name);
        const loadedCompany = trimOrEmpty(data.company_name);

        setClient((prev) => ({
          ...prev,
          ...data,
          company_group: loadedGroup,
          company_name: loadedCompany,
        }));

        setErrors({
          phone: validatePhone(trimOrEmpty(data.phone), trimOrEmpty(data.country)),
          email: validateEmail(trimOrEmpty(data.email)),
        });
      } catch (e) {
        console.error(e);
        alert("Failed to load client details.");
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "company_group") {
      const nextOptions = companyGroups[value] || [];
      setClient((prev) => ({
        ...prev,
        company_group: value,
        company_name: nextOptions.includes(prev.company_name) ? prev.company_name : "",
      }));
      return;
    }

    if (name === "country") {
      setClient((prev) => ({ ...prev, country: value, state: "" }));
      setErrors((prev) => ({ ...prev, phone: validatePhone(client.phone, value) }));
      return;
    }

    if (name === "phone") {
      let cleaned = value.replace(/[^\d+]/g, "");
      if (cleaned.includes("+")) {
        cleaned = cleaned.replace(/\+/g, "");
        cleaned = "+" + cleaned;
      }
      if (isIndia(client.country)) cleaned = cleaned.replace(/\D/g, "").slice(0, 10);
      else cleaned = cleaned.slice(0, 16);
      setClient((prev) => ({ ...prev, phone: cleaned }));
      setErrors((prev) => ({ ...prev, phone: validatePhone(cleaned, client.country) }));
      return;
    }

    if (name === "email") {
      const v = value.trim();
      setClient((prev) => ({ ...prev, email: v }));
      setErrors((prev) => ({ ...prev, email: validateEmail(v) }));
      return;
    }

    setClient((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const phoneErr = validatePhone(client.phone, client.country);
    const emailErr = validateEmail(client.email);
    setErrors({ phone: phoneErr, email: emailErr });
    if (phoneErr || emailErr) return;

    const required = ["client_name", "company_name", "poc", "phone", "email", "address", "pan_number"];
    for (const f of required) {
      if (!String(client[f] || "").trim()) {
        alert(`Please fill ${f.replace("_", " ")}`);
        return;
      }
    }

    const payload = {
      ...client,
      gst_number: trimOrEmpty(client.gst_number) === "" ? "NA" : trimOrEmpty(client.gst_number),
      email: trimOrEmpty(client.email),
      phone: trimOrEmpty(client.phone),
    };

    try {
      await updateDoc(doc(db, "clients", id), payload);
      navigate("/dashboard/all-clients");
    } catch (e) {
      console.error("Update failed:", e);
      alert("Update failed.");
    }
  };

  const countryList = useMemo(() => Object.keys(countriesWithStates), []);
  const statesList = useMemo(
    () => (client.country ? countriesWithStates[client.country] || [] : []),
    [client.country]
  );

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto bg-white shadow-md edit-client">
        <h2 className="text-xl font-semibold mb-4">Edit Client</h2>
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  const hasGroup = !!client.company_group;
  const companyOptions = hasGroup ? companyGroups[client.company_group] || [] : [];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-inter">
      <form
        onSubmit={handleSubmit}
        className="shadow-lg rounded-lg p-8 max-w-md w-full space-y-4 bg-white text-black"
        noValidate
      >
        <h2 className="text-2xl font-bold text-center">Edit Client</h2>

        <div>
          <label className="block mb-1 font-semibold">Client Name</label>
          <input
            name="client_name"
            value={client.client_name}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded"
            required
            autoComplete="name"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Select Company Group</label>
          <select
            name="company_group"
            value={client.company_group}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded bg-white"
            required
          >
            <option value="">Select Group</option>
            <option value="WT_WTPL">WT / WTPL</option>
            <option value="WTX_WTXPL">WTX / WTXPL</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold">Company Name</label>
          {hasGroup ? (
            <select
              name="company_name"
              value={client.company_name}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded bg-white"
              required
            >
              <option value="">Select Company</option>

              {!companyOptions.includes(client.company_name) && client.company_name && (
                <option value={client.company_name}>{client.company_name} (legacy)</option>
              )}

              {companyOptions.map((co) => (
                <option key={co} value={co}>{co}</option>
              ))}
            </select>
          ) : (
            <input
              name="company_name"
              value={client.company_name}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required
              placeholder="e.g., WT / WTX / WTPL / WTXPL"
              spellCheck={false}
            />
          )}
        </div>

        <div>
          <label className="block mb-1 font-semibold">POC</label>
          <input
            name="poc"
            value={client.poc}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded"
            required
            placeholder="e.g., Abhilash"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">
            Phone Number {isIndia(client.country) ? "(India – 10 digits)" : "(Intl / E.164)"}
          </label>
          <input
            name="phone"
            type="tel"
            value={client.phone}
            onChange={handleChange}
            className={`w-full border px-4 py-2 rounded ${
              errors.phone ? "border-red-500" : "border-gray-300"
            }`}
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder={isIndia(client.country) ? "9876543210" : "+15551234567"}
          />
          {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
        </div>

        <div>
          <label className="block mb-1 font-semibold">Email</label>
          <input
            name="email"
            type="email"
            value={client.email}
            onChange={handleChange}
            className={`w-full border px-4 py-2 rounded ${
              errors.email ? "border-red-500" : "border-gray-300"
            }`}
            autoComplete="email"
            spellCheck={false}
            required
            placeholder="name@example.com"
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
        </div>

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
            {Object.keys(countriesWithStates).map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold">State</label>
          {(countriesWithStates[client.country] || []).length > 0 ? (
            <select
              name="state"
              value={client.state}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded bg-white"
              required
            >
              <option value="">Select State</option>
              {(countriesWithStates[client.country] || []).map((s) => (
                <option key={s} value={s}>{s}</option>
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

        <div>
          <label className="block mb-1 font-semibold">Address</label>
          <input
            name="address"
            value={client.address}
            onChange={handleChange}
            className="w-full border border-gray-300 px-4 py-2 rounded"
            required
            autoComplete="street-address"
          />
        </div>

        {[
          { name: "pan_number", label: "PAN Number", required: true },
          { name: "gst_number", label: "GST Number", required: false },
        ].map(({ name, label, required }) => (
          <div key={name}>
            <label className="block mb-1 font-semibold">{label}</label>
            <input
              name={name}
              value={client[name]}
              onChange={handleChange}
              className="w-full border border-gray-300 px-4 py-2 rounded"
              required={required}
              spellCheck={false}
            />
          </div>
        ))}

        <button
          type="submit"
          className="w-full bg-[#3b5999] text-[#ffffff] font-semibold py-2 rounded transition cursor-pointer save-changes-btn"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
