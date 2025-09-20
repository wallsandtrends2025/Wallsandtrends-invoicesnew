import { useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import countriesWithStates from "../constants/countriesWithStates";

export default function ClientSignup() {
  const [client, setClient] = useState({
    client_name: "",
    company_group: "",
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
    client_name: "",
    company_group: "",
    poc: "",
    phone: "",
    email: "",
    address: "",
    country: "",
    state: "",
    pan: "",
    gst: "",
    pan_gst: "",
  });

  const navigate = useNavigate();

  // --- Updated POC mapping (raw values without hyphen) ---
  const pocByGroup = {
    WT: [
      "Suryadevara Veda Sai Krishna WT120",
      "Koduru Abhilash Reddy WT146",
      "Sajja Seshasai WT131",
    ],
    WTPL: [
      "Suryadevara Veda Sai Krishna WT120",
      "Koduru Abhilash Reddy WT146",
      "Sajja Seshasai WT131",
    ],
    WTX: [
      "Lingareddy Navya WT122",
      "Rohith Gali WT259",
      "Mohit Vamsi WT274",
      "Anouska Panda WT286",
      "Kamya Mogulagani WT262",
      "Varshini Suragowni WT263",
      "Addanki Sai Durga WT284",
      "Sharvana Sandhya WT266",
      "Vineel Raj WT321",
    ],
    WTXPL: [
      "Lingareddy Navya WT122",
      "Rohith Gali WT259",
      "Mohit Vamsi WT274",
      "Anouska Panda WT286",
      "Kamya Mogulagani WT262",
      "Varshini Suragowni WT263",
      "Addanki Sai Durga WT284",
      "Sharvana Sandhya WT266",
      "Vineel Raj WT321",
    ],
  };

  // --- Helper to format POC display ---
  const formatPocLabel = (s) => {
    const m = String(s).match(/^(.*\S)\s*-?\s*([A-Za-z]{2,}\d{2,})$/);
    return m ? `${m[1]} - ${m[2]}` : s;
  };

  // --- Validation helpers ---
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
    if (!emailRegex.test(raw))
      return "Enter a valid email address (e.g., name@example.com).";
    return "";
  };

  const validatePAN = (raw) => {
    const v = (raw || "").toUpperCase().trim();
    if (!v) return "PAN number is required.";
    if (v.length < 10) return "";
    if (v.length === 10 && !panRegex.test(v))
      return "Invalid PAN format (e.g., ABCDE1234F).";
    if (v.length > 10) return "PAN must be exactly 10 characters.";
    return "";
  };

  const validateGST = (raw) => {
    const v = (raw || "").toUpperCase().trim();
    if (!v) return "GST number is required.";
    if (v.length < 15) return "";
    if (v.length === 15 && !gstRegex.test(v))
      return "Invalid GST format (e.g., 22ABCDE1234F1Z5).";
    if (v.length > 15) return "GST must be exactly 15 characters.";
    return "";
  };

  // --- PAN inside GST helper ---
  // For GSTIN: positions 3-12 (0-indexed slice 2..12) must be the PAN.
  const extractPanFromGst = (gst) =>
    (gst || "").toUpperCase().trim().slice(2, 12);

  // Recompute cross-field PAN-in-GST error
  const computePanGstError = (pan, gst) => {
    const p = (pan || "").toUpperCase().trim();
    const g = (gst || "").toUpperCase().trim();
    if (!p && !g) return "";
    // If one is present and the other isn't, keep the existing linked message
    if ((!!p && !g) || (!p && !!g))
      return "PAN number and GST number must both be filled (they are linked).";
    // If both present but lengths not final yet, don't show mismatch error prematurely
    if (p.length !== 10 || g.length !== 15) return "";
    // If both formatted ok, check match
    if (panRegex.test(p) && gstRegex.test(g)) {
      const panInGst = extractPanFromGst(g);
      if (panInGst !== p)
        return "PAN number and GST number do not match. Please ensure your GSTIN contains the same PAN";
      return "";
    }
    return "";
  };

  const setField = (name, value) => {
    setClient((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      if (String(value).trim()) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "company_group") {
      setClient((prev) => ({ ...prev, company_group: value, poc: "" }));
      setErrors((prev) => ({
        ...prev,
        company_group: value ? "" : "Company is required.",
        poc: "",
      }));
      return;
    }

    if (name === "country") {
      setClient((prev) => ({ ...prev, country: value, state: "" }));
      setErrors((prev) => ({
        ...prev,
        country: value ? "" : "Country is required.",
        phone: validatePhone(client.phone, value),
        state: "",
      }));
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
      setErrors((prev) => ({
        ...prev,
        phone: validatePhone(cleaned, client.country),
      }));
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
      const nextPanErr = validatePAN(v);
      // Cross-check with current GST
      const nextPanGstErr = computePanGstError(v, client.gst_number);
      setClient((prev) => ({ ...prev, pan_number: v }));
      setErrors((prev) => ({
        ...prev,
        pan: nextPanErr,
        pan_gst: nextPanGstErr,
      }));
      return;
    }

    if (name === "gst_number") {
      const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
      const nextGstErr = validateGST(v);
      // Cross-check with current PAN
      const nextPanGstErr = computePanGstError(client.pan_number, v);
      setClient((prev) => ({ ...prev, gst_number: v }));
      setErrors((prev) => ({
        ...prev,
        gst: nextGstErr,
        pan_gst: nextPanGstErr,
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
    if (!client.pan_number) {
      panErr = "PAN number is required.";
    } else if (client.pan_number.length !== 10) {
      panErr = "PAN must be exactly 10 characters.";
    } else {
      panErr = validatePAN(client.pan_number);
    }

    let gstErr = "";
    if (!client.gst_number) {
      gstErr = "GST number is required.";
    } else if (client.gst_number.length !== 15) {
      gstErr = "GST must be exactly 15 characters.";
    } else {
      gstErr = validateGST(client.gst_number);
    }

    // Cross-field: PAN must be included in GST (positions 3–12)
    let panGstErr = computePanGstError(client.pan_number, client.gst_number);

    const requiredFields = [
      "client_name",
      "company_group",
      "poc",
      "phone",
      "email",
      "address",
      "country",
      "state",
      "pan_number",
      "gst_number",
    ];
    const reqErrors = {};
    requiredFields.forEach((field) => {
      if (!String(client[field] || "").trim()) {
        if (field === "pan_number") reqErrors.pan = "PAN number is required.";
        else if (field === "gst_number") reqErrors.gst = "GST number is required.";
        else reqErrors[field] = `${field.replaceAll("_", " ")} is required.`;
      }
    });

    setErrors((prev) => ({
      ...prev,
      ...reqErrors,
      phone: phoneErr || prev.phone,
      email: emailErr || prev.email,
      pan: panErr || prev.pan,
      gst: gstErr || prev.gst,
      pan_gst: panGstErr,
    }));

    const hasAnyError =
      phoneErr ||
      emailErr ||
      panErr ||
      gstErr ||
      panGstErr ||
      Object.values(reqErrors).some(Boolean);

    if (hasAnyError) return;

    const docId = `${client.company_group}_${client.client_name}`.replace(/\s+/g, "_");
    const finalData = {
      ...client,
      pan_number: client.pan_number.toUpperCase().trim(),
      gst_number: client.gst_number.toUpperCase().trim(),
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
  const currentPocOptions = client.company_group ? pocByGroup[client.company_group] || [] : [];

  // Force red on invalid
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black"
    }`;

  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;

  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 font-inter">
      <form
        onSubmit={handleSubmit}
        className="shadow-lg rounded-lg p-8 max-w-md w-full space-y-4 bg-white text-black"
        noValidate
      >
        <h2 className="text-2xl font-bold text-center">Client Registration Form</h2>

        {/* Client Name */}
        <div>
          <label className={labelClass(!!errors.client_name)}>Client Name</label>
          <input
            name="client_name"
            value={client.client_name}
            onChange={handleChange}
            className={inputClass(!!errors.client_name)}
            required
          />
          {helpText(errors.client_name)}
        </div>

        {/* Company */}
        <div>
          <label className={labelClass(!!errors.company_group)}>Select Company</label>
          <select
            name="company_group"
            value={client.company_group}
            onChange={handleChange}
            className={inputClass(!!errors.company_group) + " bg-white"}
            required
          >
            <option value="">Select Company</option>
            <option value="WT">WT</option>
            <option value="WTPL">WTPL</option>
            <option value="WTX">WTX</option>
            <option value="WTXPL">WTXPL</option>
          </select>
          {helpText(errors.company_group)}
        </div>

        {/* POC */}
        {client.company_group && (
          <div>
            <label className={labelClass(!!errors.poc)}>POC</label>
            <select
              name="poc"
              value={client.poc}
              onChange={handleChange}
              className={inputClass(!!errors.poc) + " bg-white"}
              required
            >
              <option value="">Select POC</option>
              {currentPocOptions.map((p) => (
                <option key={p} value={p}>
                  {formatPocLabel(p)}
                </option>
              ))}
            </select>
            {helpText(errors.poc)}
          </div>
        )}

        {/* Phone */}
        <div>
          <label className={labelClass(!!errors.phone)}>Phone Number</label>
          <input
            name="phone"
            type="tel"
            value={client.phone}
            onChange={handleChange}
            className={inputClass(!!errors.phone)}
            placeholder={isIndia(client.country) ? "9876543210" : "+15551234567"}
            required
          />
          {helpText(errors.phone)}
        </div>

        {/* Email */}
        <div>
          <label className={labelClass(!!errors.email)}>Email</label>
          <input
            name="email"
            type="email"
            value={client.email}
            onChange={handleChange}
            className={inputClass(!!errors.email)}
            placeholder="name@example.com"
            required
          />
          {helpText(errors.email)}
        </div>

        {/* Country */}
        <div>
          <label className={labelClass(!!errors.country)}>Country</label>
          <select
            name="country"
            value={client.country}
            onChange={handleChange}
            className={inputClass(!!errors.country) + " bg-white"}
            required
          >
            <option value="">Select Country</option>
            {countryList.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {helpText(errors.country)}
        </div>

        {/* State */}
        <div>
          <label className={labelClass(!!errors.state)}>State</label>
          {statesList.length > 0 ? (
            <select
              name="state"
              value={client.state}
              onChange={handleChange}
              className={inputClass(!!errors.state) + " bg-white"}
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
              className={inputClass(!!errors.state)}
              required
            />
          )}
          {helpText(errors.state)}
        </div>

        {/* Address */}
        <div>
          <label className={labelClass(!!errors.address)}>Address</label>
          <input
            name="address"
            value={client.address}
            onChange={handleChange}
            className={inputClass(!!errors.address)}
            required
          />
          {helpText(errors.address)}
        </div>

        {/* PAN */}
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
          />
          {helpText(errors.pan)}
        </div>

        {/* GST */}
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
          />
          {helpText(errors.gst)}
        </div>

        {/* Cross-field error */}
        {helpText(errors.pan_gst)}

        <button
          type="submit"
          className="w-full bg-[#037f9e] text-[#ffffff] font-semibold py-2 rounded transition cursor-pointer signup-btn"
        >
          Submit
        </button>
      </form>
    </div>
  );
}
