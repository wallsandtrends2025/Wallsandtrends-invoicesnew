import React, { useEffect, useState } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import Select from "react-select";
import { useNavigate } from "react-router-dom";

export default function AddProject() {
  const [projectName, setProjectName] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [company, setCompany] = useState("WT");
  const [movieName, setMovieName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [poc, setPoc] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [clients, setClients] = useState([]);
  const navigate = useNavigate();

  const serviceOptions = [
    { label: "Lyrical Videos", value: "Lyrical Videos" },
    { label: "Posters", value: "Posters" },
    { label: "Digital Creatives", value: "Digital Creatives" },
    { label: "Motion Posters", value: "Motion Posters" },
    { label: "Title Animations", value: "Title Animations" },
    { label: "Marketing", value: "Marketing" },
    { label: "Editing", value: "Editing" },
    { label: "Teaser", value: "Teaser" },
    { label: "Trailer", value: "Trailer" },
    { label: "Promos", value: "Promos" },
    { label: "Google Ads", value: "Google Ads" },
    { label: "YouTube Ads", value: "YouTube Ads" },
    { label: "Influencer Marketing", value: "Influencer Marketing" },
    { label: "Meme Marketing", value: "Meme Marketing" },
    { label: "Open and end titles", value: "Open and end titles" },
    { label: "Pitch Deck", value: "Pitch Deck" },
    { label: "Branding", value: "Branding" },
    { label: "Strategy & Marketing", value: "Strategy & Marketing" },
    { label: "Creative design & editing", value: "Creative design & editing" },
    { label: "Digital Marketing", value: "Digital Marketing" },
    { label: "Content & video production", value: "Content & video production" },
    { label: "Performance Marketing", value: "Performance Marketing" },
    { label: "Web Development", value: "Web Development" },
    { label: "Ad Film", value: "Ad Film" },
    { label: "⁠Brand Film", value: "⁠Brand Film" },
    { label: "⁠⁠Corporate Film", value: "⁠Corporate Film" },
    { label: "⁠Teaser + Trailer + Business cut", value: "⁠Teaser + Trailer + Business cut" },
  ];

  useEffect(() => {
    const fetchClients = async () => {
      const clientSnap = await getDocs(collection(db, "clients"));
      const clientList = clientSnap.docs.map((doc) => ({
        value: doc.id,
        label: `${doc.data().company_name} — ${doc.data().client_name}`,
      }));
      setClients(clientList);
    };

    fetchClients();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!projectName || !selectedClient || !company) {
      alert("Project Name, Client, and Company are required.");
      return;
    }

    try {
      await addDoc(collection(db, "projects"), {
        projectName,
        clientId: selectedClient.value,
        company,
        movieName: ["WT", "WTPL"].includes(company) ? movieName : "",
        brandName: ["WTX", "WTXPL"].includes(company) ? brandName : "",
        poc,
        services: selectedServices.map((s) => s.value),
        createdAt: new Date(),
      });

      alert("Project added successfully!");
      navigate("/dashboard/all-projects");
    } catch (error) {
      console.error("Error adding project:", error);
      alert("Failed to add project.");
    }
  };

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h2 style={styles.title}>Add New Project</h2>

        <label style={styles.label}>Select Company</label>
        <select
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={styles.input}
          required
        >
          <option value="WT">WT</option>
          <option value="WTPL">WTPL</option>
          <option value="WTX">WTX</option>
          <option value="WTXPL">WTXPL</option>
        </select>

        <label style={styles.label}>Select Client</label>
        <Select
          options={clients}
          value={selectedClient}
          onChange={(val) => setSelectedClient(val)}
          placeholder="Select Client"
          isSearchable
          styles={styles.select}
        />

        <label style={styles.label}>Project Name</label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          style={styles.input}
          required
        />

        {["WT", "WTPL"].includes(company) && (
          <>
            <label style={styles.label}>Movie Name</label>
            <input
              type="text"
              value={movieName}
              onChange={(e) => setMovieName(e.target.value)}
              style={styles.input}
            />
          </>
        )}

        {["WTX", "WTXPL"].includes(company) && (
          <>
            <label style={styles.label}>Brand Name</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              style={styles.input}
            />
          </>
        )}

        <label style={styles.label}>POC</label>
        <input
          type="text"
          value={poc}
          onChange={(e) => setPoc(e.target.value)}
          style={styles.input}
        />

        <label style={styles.label}>Select Services</label>
        <Select
          isMulti
          options={serviceOptions}
          value={selectedServices}
          onChange={setSelectedServices}
          placeholder="Select Services"
          isSearchable
          styles={styles.select}
        />

        <button type="submit" style={styles.button}>
          Submit Project
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f3f4f6",
    display: "flex",
    justifyContent: "center",
    padding: "2rem",
  },
  card: {
    background: "#fff",
    padding: "30px",
    borderRadius: "10px",
    maxWidth: "700px",
    width: "100%",
    boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: "30px",
  },
  label: {
    fontWeight: "600",
    marginBottom: "6px",
    display: "block",
  },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "5px",
    border: "1px solid #ccc",
    marginBottom: "20px",
  },
  button: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: "bold",
    fontSize: "16px",
    marginTop: "20px",
    cursor: "pointer",
  },
  select: {
    control: (provided) => ({
      ...provided,
      borderRadius: "5px",
      padding: "2px",
      borderColor: "#ccc",
      marginBottom: "20px",
    }),
  },
};
