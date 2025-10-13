// src/pages/EditClient.jsx
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
    company_group: "",
    poc: "",
    phone: "",
    email: "",
    address: "",
    country: "",
    state: "",
    pan_number: "",
    gst_number: "",
    // Client POC details (mirror signup)
    client_poc_name: "",
    client_poc_phone: "",
    client_poc_email: "",
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
    client_poc_name: "",
    client_poc_phone: "",
    client_poc_email: "",
  });

  // ---------- POC mapping (same as signup) ----------
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

  // ---------- Validation helpers (mirror signup) ----------
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

  // ---------- Load client ----------
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
        setClient({
          client_name: data.client_name || "",
          company_group: data.company_group || data.company_name || "",
          poc: data.poc || "",
          phone: (data.phone || "").replace(/\D/g, ""), // digits only for edit UX
          email: (data.email || "").trim(),
          address: data.address || "",
          country: data.country || "",
          state: data.state || "",
          pan_number: (data.pan_number || "").toUpperCase(),
          gst_number: (data.gst_number || "").toUpperCase(),
          // NEW: bring POC fields from DB
          client_poc_name: data.client_poc_name || "",
          client_poc_phone: (data.client_poc_phone || "").replace(/\D/g, ""),
          client_poc_email: (data.client_poc_email || "").trim(),
        });

        // pre-calc common field errors
        setErrors((prev) => ({
          ...prev,
          phone: validatePhone((data.phone || "").toString(), data.country || "", false),
          email: validateEmail(data.email || ""),
          pan: validatePAN(data.pan_number || ""),
          gst: validateGST(data.gst_number || ""),
          pan_gst: computePanGstError(data.pan_number || "", data.gst_number || ""),
          // POC fields
          client_poc_email: validateEmail(data.client_poc_email || ""),
          client_poc_phone: validatePhone(
            (data.client_poc_phone || "").toString(),
            data.country || "",
            false
          ),
        }));
      } catch (e) {
        console.error(e);
        alert("Failed to load client details.");
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [id, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- state helpers ----------
  const setField = (name, value) => {
    setClient((prev) => ({ ...prev, [name]: value }));
    if (errors[name] && String(value).trim()) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleClientPocPhoneBlur = () => {
    const phoneErr = validatePhone(client.client_poc_phone, client.country, false);
    setErrors((prev) => ({ ...prev, client_poc_phone: phoneErr }));
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
      setClient((prev) => ({ ...prev, country: value, state: "" }));
      setErrors((prev) => ({
        ...prev,
        country: value ? "" : "Country is required.",
        phone: validatePhone(client.phone, value, false),
        client_poc_phone: validatePhone(client.client_poc_phone, value, false),
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

    // NEW: POC fields
    if (name === "client_poc_phone") {
      let cleaned = value.replace(/\D/g, "");
      cleaned = isIndia(client.country) ? cleaned.slice(0, 10) : cleaned.slice(0, 15);
      setClient((prev) => ({ ...prev, client_poc_phone: cleaned }));
      if (errors.client_poc_phone) setErrors((prev) => ({ ...prev, client_poc_phone: "" }));
      return;
    }

    if (name === "client_poc_email") {
      const v = value.trim();
      setClient((prev) => ({ ...prev, client_poc_email: v }));
      setErrors((prev) => ({ ...prev, client_poc_email: validateEmail(v) }));
      return;
    }

    if (name === "client_poc_name") {
      setField("client_poc_name", value);
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

    setField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const phoneErr = validatePhone(client.phone, client.country, true);
    const emailErr = validateEmail(client.email);

    // NEW: client POC required validations (mirror signup)
    const clientPocPhoneErr = validatePhone(client.client_poc_phone, client.country, true);
    const clientPocEmailErr = validateEmail(client.client_poc_email);
    const clientPocNameErr =
      !client.client_poc_name || !client.client_poc_name.trim()
        ? "Client POC name is required."
        : "";

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

    // Required fields (mirror your final signup list)
    const requiredFields = [
      "client_name",
      "company_group",
      "email",
      "address",
      "country",
      "state",
      "client_poc_name",
      "client_poc_phone",
      "client_poc_email",
      "poc", // internal POC last, but required
    ];

    const reqErrors = {};
    requiredFields.forEach((field) => {
      const value = client[field];
      const isEmpty = !value || String(value).trim() === "";
      if (isEmpty) reqErrors[field] = `${field.replaceAll("_", " ")} is required.`;
    });

    setErrors((prev) => ({
      ...prev,
      ...reqErrors,
      phone: phoneErr,
      email: emailErr,
      pan: panErr,
      gst: gstErr,
      pan_gst: panGstErr,
      client_poc_name: clientPocNameErr || reqErrors.client_poc_name || "",
      client_poc_phone: clientPocPhoneErr || reqErrors.client_poc_phone || "",
      client_poc_email: clientPocEmailErr || reqErrors.client_poc_email || "",
    }));

    const hasAnyError =
      phoneErr ||
      emailErr ||
      panErr ||
      gstErr ||
      panGstErr ||
      clientPocNameErr ||
      clientPocPhoneErr ||
      clientPocEmailErr ||
      Object.values(reqErrors).some(Boolean);

    if (hasAnyError) return;

    const payload = {
      ...client,
      client_name: client.client_name.trim(),
      company_group: client.company_group,
      poc: client.poc,
      phone: client.phone.trim(),
      email: client.email.trim(),
      pan_number: client.pan_number.toUpperCase().trim(),
      gst_number: client.gst_number.toUpperCase().trim(),
      // ensure email trimmed
      client_poc_email: client.client_poc_email.trim(),
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

  const currentPocOptions =
    client.company_group ? pocByGroup[client.company_group] || [] : [];

  // ---------- UI helpers (same look as signup) ----------
  const inputClass = (hasError) =>
    `w-full border px-4 py-2 rounded-[10px] ${
      hasError
        ? "!border-red-500 !text-red-700 placeholder-red-400 focus:outline-none focus:ring-1 focus:!ring-red-500"
        : "border-gray-300 text-black focus:outline-none focus:ring-2 focus:ring-gray-200"
    }`;

  const labelClass = (hasError) =>
    `block mb-1 font-semibold ${hasError ? "text-red-700" : "text-black"}`;

  const helpText = (msg) => msg && <p className="text-red-600 text-sm mt-1">{msg}</p>;

  if (loading) {
    return (
      <div className="bg-[#F4F6FF] p-[10px]">
        <div className="max-w-6xl mx-auto">
          <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
            <h2 className="font-semibold text-[#000000] m-[0]">Edit client</h2>
          </div>
          <div className="bg-[#ffffff] shadow-md rounded-xl p-[15px] md:p-8 max-w-6xl mx-auto border-curve">
            <p className="text-gray-600">Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F6FF] p-[10px]">
      <div className="max-w-6xl mx-auto">
        {/* Title chip */}
        <div className="bg-[#ffffff] shadow-sm mb-4 p-[15px] border-curve mb-[20px]">
          <h2 className="font-semibold text-[#000000] m-[0]">Edit client</h2>
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

            {/* Row 3: Phone + Email + Address */}
            <div className="col-span-2">
              <div className="grid grid-cols-2 gap-6 items-stretch">
                {/* LEFT: Phone + Email */}
                <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px] flex flex-col gap-4">
                  <div className="flex flex-col">
                    <label className={labelClass(!!errors.phone)}>Phone Number</label>
                    <input
                      name="phone"
                      type="tel"
                      value={client.phone}
                      onChange={handleChange}
                      className={`${inputClass(!!errors.phone)} border-curve`}
                      placeholder={isIndia(client.country) ? "9876543210" : "Enter 7-15 digit number"}
                      required
                    />
                    {helpText(errors.phone)}
                  </div>

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

                {/* RIGHT: Address */}
                <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px] flex flex-col">
                  <label className={labelClass(!!errors.address)}>Address</label>
                  <textarea
                    name="address"
                    value={client.address}
                    onChange={handleChange}
                    className={`${inputClass(!!errors.address)} border-curve flex-1 min-h-[120px] resize-none`}
                    placeholder="Address"
                    required
                  />
                  {helpText(errors.address)}
                </div>
              </div>
            </div>

            {/* Row 4: PAN | GST */}
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
            {errors.pan_gst && (
              <div className="col-span-2 pl-[15px] pr-[1px]">{helpText(errors.pan_gst)}</div>
            )}

            {/* Row 5: Client POC Name | Client POC Number */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client_poc_name)}>Client POC Name</label>
              <input
                name="client_poc_name"
                value={client.client_poc_name}
                onChange={handleChange}
                className={`${inputClass(!!errors.client_poc_name)} border-curve`}
                placeholder="Client POC Name"
                required
              />
              {helpText(errors.client_poc_name)}
            </div>

            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px]">
              <label className={labelClass(!!errors.client_poc_phone)}>Client POC Number</label>
              <input
                name="client_poc_phone"
                type="tel"
                value={client.client_poc_phone}
                onChange={handleChange}
                onBlur={handleClientPocPhoneBlur}
                className={`${inputClass(!!errors.client_poc_phone)} border-curve`}
                placeholder={isIndia(client.country) ? "9876543210" : "Enter 7-15 digit number"}
                required
              />
              {helpText(errors.client_poc_phone)}
            </div>

            {/* Row 6: Client POC Email (single column, mirrors your final signup) */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px] ">
              <label className={labelClass(!!errors.client_poc_email)}>Client POC Email</label>
              <input
                name="client_poc_email"
                type="email"
                value={client.client_poc_email}
                onChange={handleChange}
                className={`${inputClass(!!errors.client_poc_email)} border-curve`}
                placeholder="poc.name@client.com"
                required
              />
              {helpText(errors.client_poc_email)}
            </div>

            {/* Row 7 (LAST): POC (internal) full width, last row as requested */}
            <div className="pl-[15px] pr-[15px] pt-[5px] pb-[5px] ">
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

            {/* Submit */}
            <div className="flex justify-center pt-[10px] pb-[10px] col-span-2">
              <button
                type="submit"
                className="bg-[#3b5997] text-[#ffffff] font-semibold rounded-[10px] w-[30%] h-[40px] border-0 hover:bg-[#3b5997] transition-colors"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
