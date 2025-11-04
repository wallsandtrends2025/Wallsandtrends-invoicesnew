import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import Login from "./components/Login";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./components/Home";

import ClientSignup from "./components/ClientSignup";
import AllClients from "./components/AllClients";
import EditClient from "./components/EditClient";
import PreviewClient from "./components/PreviewClient";

import CreateInvoice from "./components/CreateInvoice";
import AllInvoices from "./components/AllInvoices";
import EditInvoice from "./components/EditInvoice";
import InvoicePreview from "./components/InvoicePreview";
import InvoiceSummary from "./components/InvoiceSummary";
import RepairInvoices from "./components/RepairInvoices";

import CreateQuotation from "./components/CreateQuotation";
import QuotationList from "./components/QuotationList";
import PreviewQuotation from "./components/PreviewQuotation";
import EditQuotation from "./components/EditQuotation";

import CreateProforma from "./components/CreateProforma";
import ProformaList from "./components/ProformaList";
// ⬇️ new components you should have (based on our refactor)
import EditProforma from "./components/EditProforma";
import PreviewProforma from "./components/PreviewProforma";

import AddProject from "./components/AddProject";
import AllProjects from "./components/AllProjects";
import EditProject from "./components/EditProject";
import PreviewProject from "./components/PreviewProject";

import POCSignup from "./components/POCSignup";
import AllPOCs from "./components/AllPOCs";
import EditPOC from "./components/EditPOC";
import PreviewPOC from "./components/PreviewPOC";

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
        {/* default redirect */}
        <Route index element={<Navigate to="/dashboard/home" replace />} />

        {/* home */}
        <Route path="home" element={<Home />} />

        {/* clients */}
        <Route path="add-client" element={<ClientSignup />} />
        <Route path="all-clients" element={<AllClients />} />
        <Route path="edit-client/:id" element={<EditClient />} />
        <Route path="client-preview/:id" element={<PreviewClient />} />

        {/* invoices */}
        <Route path="create-invoice" element={<CreateInvoice />} />
        <Route path="all-invoices" element={<AllInvoices />} />
        <Route path="edit-invoice/:id" element={<EditInvoice />} />
        <Route path="invoice/:id" element={<InvoicePreview />} />
        <Route path="invoice-summary" element={<InvoiceSummary />} />
        <Route path="invoice-preview/:id" element={<InvoicePreview />} />

        {/* quotations */}
        <Route path="create-quotation" element={<CreateQuotation />} />
        <Route path="quotation-list" element={<QuotationList />} />
        <Route path="quotations" element={<QuotationList />} />
        <Route path="quotation/:id" element={<PreviewQuotation />} />
        <Route path="edit-quotation/:id" element={<EditQuotation />} />

        {/* proformas */}
        <Route path="create-proforma" element={<CreateProforma />} />
        <Route path="proforma-list" element={<ProformaList />} />
        {/* ⬇️ added routes to match ProformaList actions */}
        <Route path="proforma/:id" element={<PreviewProforma />} />
        <Route path="edit-proforma/:id" element={<EditProforma />} />

        {/* projects */}
        <Route path="add-project" element={<AddProject />} />
        <Route path="all-projects" element={<AllProjects />} />
        <Route path="edit-project/:id" element={<EditProject />} />
        <Route path="project-preview/:id" element={<PreviewProject />} />

        {/* POC */}
        <Route path="add-poc" element={<POCSignup />} />
        <Route path="all-pocs" element={<AllPOCs />} />
        <Route path="edit-poc/:id" element={<EditPOC />} />
        <Route path="preview-poc/:id" element={<PreviewPOC />} />

        {/* pdf / audit */}
        <Route path="pdf-manager" element={<PDFManager />} />
        <Route path="pdf-viewer/:pdfId" element={<PDFViewer />} />
        <Route path="audit-manager" element={<AuditManager />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}
