import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useEffect, useState } from "react";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock/unlock background scroll when mobile menu is open
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    if (mobileOpen) {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    } else {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.touchAction = "";
    }
    return () => {
      html.style.overflow = "";
      body.style.overflow = "";
      body.style.touchAction = "";
    };
  }, [mobileOpen]);

  // Auto-close mobile on route change
  useEffect(() => setMobileOpen(false), [location.pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Icons (black on white)
  const MenuIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
  const CloseIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6l-12 12" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header (white, logo unchanged) */}
      <header className="sticky top-0 z-40 bg-white">
        <div className="h-[100px] min-[1025px]:h-16 max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between overflow-visible">
          {/* ✅ Logo exactly same size as before */}
          <div className="invoices-logo select-none">
            <img
              src="/invoice-logo.png"
              alt="Logo"
              style={{ width: "100px", height: "auto" }}
              draggable="false"
            />
          </div>

          {/* Desktop nav (≥1025px) with spacing between items */}
          <nav className="hidden min-[1025px]:flex items-center space-x-6 xl:space-x-10 2xl:space-x-12 relative z-[70]">
            <NavLink to="/dashboard/home">Home</NavLink>

            {/* Project Management */}
            <Dropdown label="Project Management">
              <DropdownItem to="/dashboard/add-project">Add Project</DropdownItem>
              <DropdownItem to="/dashboard/all-projects">All Projects</DropdownItem>
            </Dropdown>

            {/* Client Registration */}
            <Dropdown label="Client Registration">
              <DropdownItem to="/dashboard/add-client">Register Client</DropdownItem>
              <DropdownItem to="/dashboard/all-clients">Client List</DropdownItem>
            </Dropdown>

            {/* Invoice Generation */}
            <Dropdown label="Invoice Generation">
              <DropdownItem to="/dashboard/create-invoice">Create Invoice</DropdownItem>
              <DropdownItem to="/dashboard/all-invoices">Invoice List</DropdownItem>
            </Dropdown>

            {/* Quotation Generation */}
            <Dropdown label="Quotation Generation">
              <DropdownItem to="/dashboard/create-quotation">Create Quotation</DropdownItem>
              <DropdownItem to="/dashboard/quotations">Quotations List</DropdownItem>
            </Dropdown>

            <NavLink to="/dashboard/invoice-summary">Invoice Summary</NavLink>

            <button
              onClick={handleLogout}
              className="logout ml-2 inline-flex items-center justify-center rounded-md px-4 py-2 text-white bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
            >
              Logout
            </button>
          </nav>

          {/* Mobile/Tablet toggle (0–1024px). Hidden on ≥1025px */}
          <button
            onClick={() => setMobileOpen(true)}
            className={`min-[1025px]:hidden inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 ${mobileOpen ? "hidden" : ""}`}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <MenuIcon />
          </button>
        </div>
      </header>

      {/* Mobile FULLSCREEN menu (0–1024px) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 min-[1025px]:hidden">
          {/* One full-screen panel (no separate overlay to avoid gaps) */}
          <div className="fixed inset-0 bg-[#ffffff] text-slate-800 overflow-y-auto menu-block">
            <div className="max-w-7xl mx-auto px-5 pt-4 pb-8">
              {/* Panel header */}
              <div className="h-12 flex items-center justify-between">
                <span className="text-[15px] font-semibold tracking-wide text-slate-700">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-md hover:bg-slate-100 close-menu-btn"
                  aria-label="Close menu"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Nav list */}
              <nav className="mt-2">
                <Link className="block w-full px-3 py-3 rounded-lg text-[15px] font-medium hover:bg-slate-50" to="/dashboard/home">
                  Home
                </Link>

                <MobileSection
                  title="Project Management"
                  items={[
                    { label: "Add Project", to: "/dashboard/add-project" },
                    { label: "All Projects", to: "/dashboard/all-projects" },
                  ]}
                />
                <MobileSection
                  title="Client Registration"
                  items={[
                    { label: "Register Client", to: "/dashboard/add-client" },
                    { label: "Client List", to: "/dashboard/all-clients" },
                  ]}
                />
                <MobileSection
                  title="Invoice Generation"
                  items={[
                    { label: "Create Invoice", to: "/dashboard/create-invoice" },
                    { label: "Invoice List", to: "/dashboard/all-invoices" },
                  ]}
                />
                <MobileSection
                  title="Quotation Generation"
                  items={[
                    { label: "Create Quotation", to: "/dashboard/create-quotation" },
                    { label: "Quotations List", to: "/dashboard/quotations" },
                  ]}
                />

                <Link className="block w-full mt-1 px-3 py-3 rounded-lg text-[15px] font-medium hover:bg-slate-50" to="/dashboard/invoice-summary">
                  Invoice Summary
                </Link>

                <button
                  onClick={handleLogout}
                  className="logout mt-6 w-full inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700"
                >
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ---------- Reusable UI bits ---------- */

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="px-3 py-2 rounded-md text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

/**
 * Desktop dropdown – overlap-safe, items 100% width, with inner gap
 */
function Dropdown({ label, children }) {
  return (
    <div className="relative group">
      {/* trigger */}
      <button
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-slate-700 hover:bg-slate-50 focus:outline-none"
        type="button"
      >
        {label} ▾
      </button>

      {/* menu wrapper (desktop only) */}
      <div
        className="
          absolute left-0 top-full mt-0 hidden group-hover:block z-[100] min-w-full
          pointer-events-none group-hover:pointer-events-auto
          "
      >
        {/* hover bridge */}
        <div className="relative before:content-[''] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2">
          <div className="bg-white rounded-xl shadow-xl py-1">
            {/* 👇 small gap between dropdown items */}
            <div className="flex flex-col w-full gap-1">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropdownItem({ to, children }) {
  return (
    <Link
      to={to}
      className="block w-full px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50"
    >
      {children}
    </Link>
  );
}

/** 30px chevron icon */
function Chevron30({ open }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Mobile accordion (0–1024px) */
function MobileSection({ title, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-3 flex items-center justify-between gap-3 text-[15px] font-semibold text-slate-800 rounded-lg hover:bg-slate-50"
        aria-expanded={open}
      >
        <span>{title}</span>
        <Chevron30 open={open} />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="py-1">
            {items.map((it) => (
              <Link
                key={it.to}
                to={it.to}
                className="block w-full px-5 py-2.5 rounded-lg text-slate-700 hover:bg-slate-50"
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
