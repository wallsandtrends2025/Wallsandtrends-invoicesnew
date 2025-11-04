import { useState } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import countriesWithStates from "../constants/countriesWithStates";
import { InputSanitizer } from "../utils/sanitization";

export default function ClientSignup() {
  const [client, setClient] = useState({
    client_name: "",
    company_group: "",
    poc: "",
    client_poc_name: "",
    client_poc_number: "",
    client_poc_email: "",
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
    client_poc_name: "",
    client_poc_number: "",
    client_poc_email: "",
    phone: "",
    email: "",
    address: "",
    country: "",
    state: "",
    pan: "",
    gst: "",
    pan_gst: "",
  });

  const [touched, setTouched] = useState({
    client_name: false,
    company_group: false,
    poc: false,
    client_poc_name: false,
    client_poc_number: false,
    client_poc_email: false,
    phone: false,
    email: false,
    address: false,
    country: false,
    state: false,
    pan_number: false,
    gst_number: false,
  });

  const navigate = useNavigate();

  // --- POC mapping ---
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

  const validatePhone = (raw, country, checkRequired = false) => {
    if (!raw || raw.trim() === "") {
      return checkRequired ? "Phone number is required." : "";
    }
    const digits = raw.replace(/\D/g, "");
    if (isIndia(country)) {
      if (digits.length !== 10) return "Phone number must be exactly 10 digits for India.";
    } else {
      if (digits.length < 7 || digits.length > 15)
        return "Phone number must be between 7 and 15 digits for international numbers.";
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

  const validateClientPocName = (raw) => {
    if (!raw || raw.trim() === "") return "Client POC Name is required.";
    if (raw.trim().length < 2) return "Client POC Name must be at least 2 characters.";
    return "";
  };

  const validateClientPocEmail = (raw) => {
    if (!raw || raw.trim() === "") return "Client POC Email is required.";
    if (!emailRegex.test(raw)) return "Enter a valid email address (e.g., name@example.com).";
    return "";
  };

  const extractPanFromGst = (gst) => (gst || "").toUpperCase().trim().slice(2, 12);

  const computePanGstError = (pan, gst) => {
    const p = (pan || "").toUpperCase().trim();
    const g = (gst || "").toUpperCase().trim();
    if (!p && !g) return "";
    if ((!!p && !g) || (!p && !!g))
      return "PAN number and GST number must both be filled (they are linked).";
    if (p.length !== 10 || g.length !== 15) return "";
    if (panRegex.test(p) && gstRegex.test(g)) {
      const panInGst = extractPanFromGst(g);
      if (panInGst !== p)
        return "PAN number and GST number do not match. Please ensure your GSTIN contains the same PAN";
      return "";
    }
    return "";
  };

  // --- state helpers ---
  const setField = (name, value) => {
    setClient((prev) => ({ ...prev, [name]: value }));
    if (errors[name] && String(value).trim()) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const markFieldAsTouched = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handlePhoneBlur = () => {
    markFieldAsTouched("phone");
    const phoneErr = validatePhone(client.phone, client.country, false);
    setErrors((prev) => ({ ...prev, phone: phoneErr }));
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

    if (name === "poc") {
      setField("poc", value);
      if (value) setErrors((prev) => ({ ...prev, poc: "" }));
      return;
    }

    if (name === "country") {
      setClient((prev) => ({
        ...prev,
        country: value,
        state: ""
      }));
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
      let cleaned = value.replace(/\D/g, "");
      cleaned = isIndia(client.country) ? cleaned.slice(0, 10) : cleaned.slice(0, 15);
      setClient((prev) => ({ ...prev, phone: cleaned }));
      if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
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
      const nextPanGstErr = computePanGstError(v, client.gst_number);
      setClient((prev) => ({ ...prev, pan_number: v }));
      setErrors((prev) => ({ ...prev, pan: nextPanErr, pan_gst: nextPanGstErr }));
      return;
    }

    if (name === "gst_number") {
      const v = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15);
      const nextGstErr = validateGST(v);
      const nextPanGstErr = computePanGstError(client.pan_number, v);
      setClient((prev) => ({ ...prev, gst_number: v }));
      setErrors((prev) => ({ ...prev, gst: nextGstErr, pan_gst: nextPanGstErr }));
      return;
    }

    if (name === "client_poc_name") {
      const v = InputSanitizer.sanitizeName(value);
      setClient((prev) => ({ ...prev, client_poc_name: v }));
      setErrors((prev) => ({ ...prev, client_poc_name: validateClientPocName(v) }));
      return;
    }

    if (name === "client_poc_number") {
      let cleaned = value.replace(/\D/g, "");
      cleaned = isIndia(client.country) ? cleaned.slice(0, 10) : cleaned.slice(0, 15);
      setClient((prev) => ({ ...prev, client_poc_number: cleaned }));
      if (errors.client_poc_number) setErrors((prev) => ({ ...prev, client_poc_number: "" }));
      return;
    }

    if (name === "client_poc_email") {
      const v = value.trim();
      setClient((prev) => ({ ...prev, client_poc_email: v }));
      setErrors((prev) => ({ ...prev, client_poc_email: validateClientPocEmail(v) }));
      return;
    }

    setField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const phoneErr = validatePhone(client.phone, client.country, true);
    const emailErr = validateEmail(client.email);
    const clientPocNameErr = validateClientPocName(client.client_poc_name);
    const clientPocNumberErr = validatePhone(client.client_poc_number, client.country, true);
    const clientPocEmailErr = validateClientPocEmail(client.client_poc_email);

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

    const panGstErr = computePanGstError(client.pan_number, client.gst_number);

    const requiredFields = [
      "client_name",
      "company_group",
      "poc",
      "client_poc_name",
      "client_poc_number",
      "client_poc_email",
      "email",
      "address",
      "country",
      "state",
    ];
    const reqErrors = {};
    requiredFields.forEach((field) => {
      const value = client[field];
      const isEmpty = !value || String(value).trim() === "";
      if (isEmpty) {
        reqErrors[field] = `${field.replaceAll("_", " ")} is required.`;
      }
    });

    setErrors((prev) => ({
      ...prev,
      ...reqErrors,
      phone: phoneErr,
      email: emailErr,
      client_poc_name: clientPocNameErr,
      client_poc_number: clientPocNumberErr,
      client_poc_email: clientPocEmailErr,
      pan: panErr,
      gst: gstErr,
      pan_gst: panGstErr,
    }));

    const hasAnyError =
      phoneErr ||
      emailErr ||
      clientPocNameErr ||
      clientPocNumberErr ||
      clientPocEmailErr ||
      panErr ||
      gstErr ||
      panGstErr ||
      Object.values(reqErrors).some(Boolean);

    if (hasAnyError) return;

    // Safer doc id
    const rawId = `${client.company_group}_${client.client_name}`.trim();
    const docId = rawId
      .replace(/\s+/g, "_")
      .replace(/[#/\\?%*:|"<>.]/g, "_");

    const finalData = {
      ...client,
      client_name: client.client_name.trim(),
      company_group: client.company_group,
      poc: client.poc,
      client_poc_name: client.client_poc_name.trim(),
      client_poc_number: client.client_poc_number,
      client_poc_email: client.client_poc_email.trim(),
      pan_number: client.pan_number.toUpperCase().trim(),
      gst_number: client.gst_number.toUpperCase().trim(),
      created_at: Timestamp.now(),
    };

    try {
      await setDoc(doc(db, "clients", docId), finalData);
      navigate("/dashboard/all-clients");
    } catch (err) {
      console.error("Client submit failed:", err);
      alert("Submission failed.");
    }
  };

  const countryList = Object.keys(countriesWithStates);
  const statesList = countriesWithStates[client.country] || [];
  const currentPocOptions =
    client.company_group ? pocByGroup[client.company_group] || [] : [];

  // --- UI helpers ---
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;

  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;

  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Title chip */}
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Client Registration Form</h2>
        </div>

        {/* Main form card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve form-block"
          noValidate
        >
          {/* ALWAYS 2 columns */}
          <div className="grid grid-cols-2 gap-6">
            {/* Row 1: Client Name | Country */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client_name)}>Client Name</label>
              <input
                name="client_name"
                value={client.client_name}
                onChange={handleChange}
                className={`${inputClass(!!errors.client_name)} border-curve`}
                placeholder="Client Name"
                required
              />
              {helpText(errors.client_name)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.country)}>Country</label>
              <select
                name="country"
                value={client.country}
                onChange={handleChange}
                className={`${inputClass(!!errors.country)} border-curve`}
                required
              >
                <option value="">Country</option>
                {countryList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {helpText(errors.country)}
            </div>

            {/* Row 2: Company | State */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.company_group)}>Select Company</label>
              <select
                name="company_group"
                value={client.company_group}
                onChange={handleChange}
                className={`${inputClass(!!errors.company_group)} border-curve`}
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

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.state)}>State</label>
              {statesList.length > 0 ? (
                <select
                  name="state"
                  value={client.state}
                  onChange={handleChange}
                  className={`${inputClass(!!errors.state)} border-curve`}
                  required
                >
                  <option value="">State/Region</option>
                  {statesList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name="state"
                  value={client.state}
                  onChange={handleChange}
                  placeholder="State/Region"
                  className={`${inputClass(!!errors.state)} border-curve`}
                  required
                />
              )}
              {helpText(errors.state)}
            </div>


            {/* Row 3: POC | spacer */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.poc)}>POC</label>
              <select
                name="poc"
                value={client.poc}
                onChange={handleChange}
                className={`${inputClass(!!errors.poc)} border-curve`}
                disabled={!client.company_group}
                required
              >
                <option value="">
                  {client.company_group ? "Select POC" : "Select company first"}
                </option>
                {currentPocOptions.map((p) => (
                  <option key={p} value={p}>
                    {formatPocLabel(p)}
                  </option>
                ))}
              </select>
              {helpText(errors.poc)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">{/* spacer */}</div>

            {/* Row 3.5: Client POC Details */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client_poc_name)}>Client POC Name</label>
              <input
                name="client_poc_name"
                value={client.client_poc_name}
                onChange={handleChange}
                className={`${inputClass(!!errors.client_poc_name)} border-curve`}
                placeholder="Client Point of Contact Name"
                required
              />
              {helpText(errors.client_poc_name)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client_poc_number)}>Client POC Number</label>
              <input
                name="client_poc_number"
                type="tel"
                value={client.client_poc_number}
                onChange={handleChange}
                onBlur={() => {
                  markFieldAsTouched("client_poc_number");
                  const phoneErr = validatePhone(client.client_poc_number, client.country, false);
                  setErrors((prev) => ({ ...prev, client_poc_number: phoneErr }));
                }}
                className={`${inputClass(!!errors.client_poc_number)} border-curve`}
                placeholder={isIndia(client.country) ? "9876543210" : "Enter 7-15 digit number"}
                required
              />
              {helpText(errors.client_poc_number)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client_poc_email)}>Client POC Email</label>
              <input
                name="client_poc_email"
                type="email"
                value={client.client_poc_email}
                onChange={handleChange}
                className={`${inputClass(!!errors.client_poc_email)} border-curve`}
                placeholder="poc@clientcompany.com"
                required
              />
              {helpText(errors.client_poc_email)}
            </div>

            {/* Row 4: Phone + Email + Address */}
            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-6 items-stretch">
                {/* LEFT COLUMN */}
                <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px] flex flex-col gap-4">
                  {/* Phone */}
                  <div className="flex flex-col">
                    <label className={labelClass(!!errors.phone)}>Phone Number</label>
                    <input
                      name="phone"
                      type="tel"
                      value={client.phone}
                      onChange={handleChange}
                      onBlur={handlePhoneBlur}
                      className={`${inputClass(!!errors.phone)} border-curve`}
                      placeholder={isIndia(client.country) ? "9876543210" : "Enter 7-15 digit number"}
                      required
                    />
                    {helpText(errors.phone)}
                  </div>

                  {/* Email */}
                  <div className="flex flex-col">
                    <label className={labelClass(!!errors.email)}>Email</label>
                    <input
                      name="email"
                      type="email"
                      value={client.email}
                      onChange={handleChange}
                      className={`${inputClass(!!errors.email)} border-curve`}
                      placeholder="name@example.com"
                      required
                    />
                    {helpText(errors.email)}
                  </div>
                </div>

                {/* RIGHT COLUMN: Address */}
                <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px] flex flex-col">
                  <label className={labelClass(!!errors.address)}>Address</label>
                  <textarea
                    name="address"
                    value={client.address}
                    onChange={(e) => {
                      const sanitizedValue = InputSanitizer.sanitizeAddress(e.target.value);
                      setClient((prev) => ({ ...prev, address: sanitizedValue }));
                      if (errors.address) setErrors((prev) => ({ ...prev, address: "" }));
                    }}
                    className={`${inputClass(!!errors.address)} border-curve flex-1 min-h-[120px] resize-none`}
                    placeholder="Address"
                    required
                  />
                  {helpText(errors.address)}
                </div>
              </div>
            </div>

            {/* Row 5: PAN | GST */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.pan || !!errors.pan_gst)}>PAN Number</label>
              <input
                name="pan_number"
                value={client.pan_number}
                onChange={handleChange}
                className={`${inputClass(!!errors.pan || !!errors.pan_gst)} border-curve`}
                placeholder="ABCDE1234F"
                maxLength={10}
                required
              />
              {helpText(errors.pan)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.gst || !!errors.pan_gst)}>GST Number</label>
              <input
                name="gst_number"
                value={client.gst_number}
                onChange={handleChange}
                className={`${inputClass(!!errors.gst || !!errors.pan_gst)} border-curve`}
                placeholder="22ABCDE1234F1Z5"
                maxLength={15}
                required
              />
              {helpText(errors.gst)}
            </div>

            {/* Cross-field error */}
            {errors.pan_gst && <div className="col-span-2">{helpText(errors.pan_gst)}</div>}

            {/* Submit Buttons */}
            <div className=" flex justify-center pt-[10px] pb-[10px] col-span-2">
              <div className="flex gap-3 w-full max-w-xs">
                <button
                  type="submit"
                  className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] flex-1 h-[40px] border-0 hover:bg-[#3b5997] transition-colors"
                >
                  Submit
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    // Clear all form fields - make the form empty as requested
                    setClient({
                      client_name: "",
                      company_group: "",
                      poc: "",
                      client_poc_name: "",
                      client_poc_number: "",
                      client_poc_email: "",
                      phone: "",
                      email: "",
                      address: "",
                      country: "",
                      state: "",
                      pan_number: "",
                      gst_number: "",
                    });
                    setErrors({
                      client_name: "",
                      company_group: "",
                      poc: "",
                      client_poc_name: "",
                      client_poc_number: "",
                      client_poc_email: "",
                      phone: "",
                      email: "",
                      address: "",
                      country: "",
                      state: "",
                      pan: "",
                      gst: "",
                      pan_gst: "",
                    });
                    setTouched({
                      client_name: false,
                      company_group: false,
                      poc: false,
                      client_poc_name: false,
                      client_poc_number: false,
                      client_poc_email: false,
                      phone: false,
                      email: false,
                      address: false,
                      country: false,
                      state: false,
                      pan_number: false,
                      gst_number: false,
                    });
                    // Think like 20 years software developer - do not touch anything
                    console.log("Clear from button clicked - cleared form as requested");
                  }}
                  className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] flex-1 h-[40px] border-0 hover:bg-[#3b5997] transition-colors"
                >
                  Clear from
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
