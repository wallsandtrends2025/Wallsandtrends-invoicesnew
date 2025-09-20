import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import countriesWithStates from "../constants/countriesWithStates";

export default function EditClient() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
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

  const [errors, setErrors] = useState({
    phone: "",
    email: "",
    pan: "",
    gst: "",
    pan_gst: "",
  });

  // --- Validation helpers (same as signup) ---
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;

  const isIndia = (country) => {
    if (!country) return false;
    const c = String(country).toLowerCase();
    return ["india", "republic of india", "in"].some((k) => c === k);
  };

  const indiaMobileRegex = /^[6-9]\d{9}$/;
  const intlRegex = /^\+?\d{7,15}$/;

  const validatePhone = (raw, country) => {
    if (!raw) return "Just enter valid number";
    if (isIndia(country)) {
      if (!indiaMobileRegex.test(raw)) return "Just enter valid number";
    } else {
      if (!intlRegex.test(raw)) return "Just enter valid number";
    }
    return "";
  };

  const validateEmail = (raw) => {
    if (!raw) return "Email is required.";
    if (!emailRegex.test(raw)) return "Enter a valid email address (e.g., name@example.com).";
    return "";
  };

  const validatePAN = (raw) => {
    const v = (raw || "").toUpperCase().trim();
    if (!v) return "PAN number is required.";
    if (v.length < 10) return "";
    if (v.length === 10 && !panRegex.test(v)) return "Invalid PAN format (e.g., ABCDE1234F).";
    if (v.length > 10) return "PAN must be exactly 10 characters.";
    return "";
  };

  const validateGST = (raw) => {
    const v = (raw || "").toUpperCase().trim();
    if (!v) return "GST number is required.";
    if (v.length < 15) return "";
    if (v.length === 15 && !gstRegex.test(v)) return "Invalid GST format (e.g., 22ABCDE1234F1Z5).";
    if (v.length > 15) return "GST must be exactly 15 characters.";
    return "";
  };

  // --- PAN in GST cross-check (positions 3–12 must equal PAN) ---
  const extractPanFromGst = (gst) => (gst || "").toUpperCase().trim().slice(2, 12);
  const computePanGstError = (pan, gst) => {
    const p = (pan || "").toUpperCase().trim();
    const g = (gst || "").toUpperCase().trim();
    if (!p && !g) return "";
    if ((!!p && !g) || (!p && !!g))
      return "PAN number and GST number must both be filled (they are linked).";
    if (p.length !== 10 || g.length !== 15) return "";
    if (panRegex.test(p) && gstRegex.test(g)) {
      const pin = extractPanFromGst(g);
      if (pin !== p) return "PAN in GST does not match the entered PAN (GST positions 3–12 must equal PAN).";
      return "";
    }
    return "";
  };

  // --- Load client ---
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
        setClient((prev) => ({
          ...prev,
          client_name: data.client_name || "",
          company_name: data.company_name || "",
          poc: data.poc || "",
          phone: data.phone || "",
          email: data.email || "",
          address: data.address || "",
          country: data.country || "",
          state: data.state || "",
          pan_number: (data.pan_number || "").toUpperCase(),
          gst_number: (data.gst_number || "").toUpperCase(),
        }));

        setErrors({
          phone: validatePhone(data.phone || "", data.country || ""),
          email: validateEmail(data.email || ""),
          pan: validatePAN(data.pan_number || ""),
          gst: validateGST(data.gst_number || ""),
          pan_gst: computePanGstError(data.pan_number || "", data.gst_number || ""),
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

  // --- Change handlers (mirror signup) ---
  const setField = (name, value) => setClient((prev) => ({ ...prev, [name]: value }));

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "country") {
      setClient((prev) => ({ ...prev, country: value, state: "" }));
      setErrors((prev) => ({ ...prev, phone: validatePhone(client.phone, value) }));
      return;
    }

    if (name === "state") {
      setField("state", value);
      return;
    }

    if (name === "phone") {
      let cleaned = value.replace(/[^\d+]/g, "");
      if (cleaned.includes("+")) {
        cleaned = cleaned.replace(/\+/g, "");
        cleaned = "+" + cleaned;
      }
      if (isIndia(client.country)) {
        cleaned = cleaned.replace(/\D/g, "").slice(0, 10);
      } else {
        cleaned = cleaned.slice(0, 16);
      }
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

    if (name === "pan_number") {
      const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
      setClient((prev) => ({ ...prev, pan_number: v }));
      setErrors((prev) => ({
        ...prev,
        pan: validatePAN(v),
        pan_gst: computePanGstError(v, client.gst_number),
      }));
      return;
    }

    if (name === "gst_number") {
      const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
      setClient((prev) => ({ ...prev, gst_number: v }));
      setErrors((prev) => ({
        ...prev,
        gst: validateGST(v),
        pan_gst: computePanGstError(client.pan_number, v),
      }));
      return;
    }

    setField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const phoneErr = validatePhone(client.phone, client.country);
    const emailErr = validateEmail(client.email);

    let panErr = "";
    if (!client.pan_number) panErr = "PAN number is required.";
    else if (client.pan_number.length !== 10) panErr = "PAN must be exactly 10 characters.";
    else panErr = validatePAN(client.pan_number);

    let gstErr = "";
    if (!client.gst_number) gstErr = "GST number is required.";
    else if (client.gst_number.length !== 15) gstErr = "GST must be exactly 15 characters.";
    else gstErr = validateGST(client.gst_number);

    const panGstErr = computePanGstError(client.pan_number, client.gst_number);

    setErrors((prev) => ({
      ...prev,
      phone: phoneErr || prev.phone,
      email: emailErr || prev.email,
      pan: panErr || prev.pan,
      gst: gstErr || prev.gst,
      pan_gst: panGstErr,
    }));

    const required = [
      "client_name",
      "company_name",
      "poc",
      "phone",
      "email",
      "address",
      "country",
      "state",
      "pan_number",
      "gst_number",
    ];

    const missing = required.find((f) => !String(client[f] || "").trim());
    const hasAnyError = phoneErr || emailErr || panErr || gstErr || panGstErr || !!missing;
    if (hasAnyError) {
      if (missing) alert(`Please fill ${missing.replaceAll("_", " ")}`);
      return;
    }

    const payload = {
      ...client,
      pan_number: client.pan_number.toUpperCase().trim(),
      gst_number: client.gst_number.toUpperCase().trim(),
      email: (client.email || "").trim(),
      phone: (client.phone || "").trim(),
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

  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black"
    }`;
  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;
  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  // Fixed 4 company options, but keep legacy value visible (if any)
  const COMPANY_OPTIONS = ["WT", "WTPL", "WTX", "WTXPL"];
  const hasLegacyCompany =
    client.company_name && !COMPANY_OPTIONS.includes(client.company_name);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-inter">
      <form
        onSubmit={handleSubmit}
        className="shadow-lg rounded-lg p-8 max-w-md w-full space-y-4 bg-white text-black"
        noValidate
      >
        <h2 className="text-2xl font-bold text-center">Edit Client</h2>

        <div>
          <label className={labelClass(false)}>Client Name</label>
          <input
            name="client_name"
            value={client.client_name}
            onChange={handleChange}
            className={inputClass(false)}
            required
            autoComplete="name"
            spellCheck={false}
          />
        </div>

        {/* Select Company (fixed options) */}
        <div>
          <label className={labelClass(false)}>Select Company</label>
          <select
            name="company_name"
            value={COMPANY_OPTIONS.includes(client.company_name) ? client.company_name : ""}
            onChange={handleChange}
            className={inputClass(false) + " bg-white"}
            required
          >
            <option value="">Select Company</option>
            {COMPANY_OPTIONS.map((co) => (
              <option key={co} value={co}>{co}</option>
            ))}
            {/* If an older record had a non-standard value, show it to avoid losing data */}
            {hasLegacyCompany && (
              <option value={client.company_name}>{client.company_name} (legacy)</option>
            )}
          </select>
          {hasLegacyCompany && (
            <p className="text-xs text-gray-500 mt-1">
              This client has a legacy company value. Please re-select one of the four options.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass(false)}>POC</label>
          <input
            name="poc"
            value={client.poc}
            onChange={handleChange}
            className={inputClass(false)}
            required
            placeholder="e.g., Abhilash WT146"
            spellCheck={false}
          />
        </div>

        <div>
          <label className={labelClass(!!errors.phone)}>
            Phone Number {isIndia(client.country) ? "(India – 10 digits)" : "(Intl / E.164)"}
          </label>
          <input
            name="phone"
            type="tel"
            value={client.phone}
            onChange={handleChange}
            className={inputClass(!!errors.phone)}
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder={isIndia(client.country) ? "9876543210" : "+15551234567"}
          />
          {helpText(errors.phone)}
        </div>

        <div>
          <label className={labelClass(!!errors.email)}>Email</label>
          <input
            name="email"
            type="email"
            value={client.email}
            onChange={handleChange}
            className={inputClass(!!errors.email)}
            autoComplete="email"
            spellCheck={false}
            required
            placeholder="name@example.com"
          />
          {helpText(errors.email)}
        </div>

        <div>
          <label className={labelClass(false)}>Country</label>
          <select
            name="country"
            value={client.country}
            onChange={handleChange}
            className={inputClass(false) + " bg-white"}
            required
          >
            <option value="">Select Country</option>
            {countryList.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass(false)}>State</label>
          {statesList.length > 0 ? (
            <select
              name="state"
              value={client.state}
              onChange={handleChange}
              className={inputClass(false) + " bg-white"}
              required
            >
              <option value="">Select State</option>
              {statesList.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <input
              name="state"
              value={client.state}
              onChange={handleChange}
              placeholder="State / Region"
              className={inputClass(false)}
              required
            />
          )}
        </div>

        <div>
          <label className={labelClass(false)}>Address</label>
          <input
            name="address"
            value={client.address}
            onChange={handleChange}
            className={inputClass(false)}
            required
            autoComplete="street-address"
          />
        </div>

        <div>
          <label className={labelClass(!!errors.pan || !!errors.pan_gst)}>PAN Number</label>
          <input
            name="pan_number"
            value={client.pan_number}
            onChange={handleChange}
            className={inputClass(!!errors.pan || !!errors.pan_gst)}
            placeholder="ABCDE1234F"
            maxLength={10}
            required
            spellCheck={false}
          />
          {helpText(errors.pan)}
        </div>

        <div>
          <label className={labelClass(!!errors.gst || !!errors.pan_gst)}>GST Number</label>
          <input
            name="gst_number"
            value={client.gst_number}
            onChange={handleChange}
            className={inputClass(!!errors.gst || !!errors.pan_gst)}
            placeholder="22ABCDE1234F1Z5"
            maxLength={15}
            required
            spellCheck={false}
          />
          {helpText(errors.gst)}
        </div>

        {helpText(errors.pan_gst)}

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
