import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./components/Login";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./components/Home";
import ClientSignup from "./components/ClientSignup";
import AllClients from "./components/AllClients";
import CreateInvoice from "./components/CreateInvoice";
import AllInvoices from "./components/AllInvoices";
import InvoicePreview from "./components/InvoicePreview";
import InvoiceSummary from "./components/InvoiceSummary";
import EditClient from "./components/EditClient";
import EditInvoice from "./components/EditInvoice";
import PreviewClient from "./components/PreviewClient";
import RepairInvoices from "./components/RepairInvoices";
import CreateQuotation from "./components/CreateQuotation";
import QuotationsList from "./components/QuotationsList";
import PreviewQuotation from "./components/PreviewQuotation";
import EditQuotation from "./components/EditQuotation";
import AddProject from "./components/AddProject";
import AllProjects from "./components/AllProjects";
import EditProject from "./components/EditProject";
import PreviewProject from "./components/PreviewProject";
import PDFManager from "./components/PDFManager";
import PDFViewer from "./components/PDFViewer";
import AuditManager from "./components/AuditManager";


function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <div>Loading...</div>;

  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/repair" element={<RepairInvoices />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Relative paths under /dashboard */}
        <Route path="home" element={<Home />} />
        <Route path="add-client" element={<ClientSignup />} />
        <Route path="all-clients" element={<AllClients />} />
        <Route path="edit-client/:id" element={<EditClient />} />
        <Route path="create-invoice" element={<CreateInvoice />} />
        <Route path="all-invoices" element={<AllInvoices />} />
        <Route path="edit-invoice/:id" element={<EditInvoice />} />
        <Route path="invoice/:id" element={<InvoicePreview />} />
        <Route path="invoice-summary" element={<InvoiceSummary />} />
        <Route path="invoice-preview/:id" element={<InvoicePreview />} />
        <Route path="client-preview/:id" element={<PreviewClient />} />

        <Route path="create-quotation" element={<CreateQuotation />} />
        <Route path="quotations" element={<QuotationsList />} />
        <Route path="quotation/:id" element={<PreviewQuotation />} />
        <Route path="edit-quotation/:id" element={<EditQuotation />} />

        <Route path="add-project" element={<AddProject />} />
        <Route path="all-projects" element={<AllProjects />} />
        <Route path="edit-project/:id" element={<EditProject />} />
        <Route path="project-preview/:id" element={<PreviewProject />} />

        <Route path="pdf-manager" element={<PDFManager />} />
        <Route path="pdf-viewer/:pdfId" element={<PDFViewer />} />
        <Route path="audit-manager" element={<AuditManager />} />

      </Route>

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
