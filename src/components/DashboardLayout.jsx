import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useEffect, useState } from "react";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  // Watch scroll to toggle header shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  // Icons
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
      {/* Header — fixed, high z-index, white background */}
      <header
        className={[
          "fixed top-0 left-0 right-0  z-[9999]", // full width + high z-index
          "bg-[#ffffff]", // solid white background
          "border-b border-slate-200",
          scrolled ? "shadow-sm" : "shadow-none",
        ].join(" ")}
      >
        <div className="h-[100px] min-[1025px]:h-16 max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between overflow-visible">
          <div className="invoices-logo select-none">
            <img
              src="/invoice-logo.png"
              alt="Logo"
              style={{ width: "100px", height: "auto" }}
              draggable="false"
            />
          </div>

          {/* Desktop nav */}
          <nav className="hidden min-[1025px]:flex items-center space-x-6 xl:space-x-10 2xl:space-x-12 relative z-[70]">
            <NavLink to="/dashboard/home">Home</NavLink>

            <Dropdown label="Client Registration">
              <DropdownItem to="/dashboard/add-client">Register Client</DropdownItem>
              <DropdownItem to="/dashboard/all-clients">Client List</DropdownItem>
            </Dropdown>

            <Dropdown label="Project Management">
              <DropdownItem to="/dashboard/add-project">Add Project</DropdownItem>
              <DropdownItem to="/dashboard/all-projects">All Projects</DropdownItem>
            </Dropdown>

            <Dropdown label="Proforma Generation">
              <DropdownItem to="/dashboard/create-quotation">Create Proforma</DropdownItem>
              <DropdownItem to="/dashboard/quotations">Proformas List</DropdownItem>
            </Dropdown>

            <Dropdown label="Invoice Generation">
              <DropdownItem to="/dashboard/create-invoice">Create Invoice</DropdownItem>
              <DropdownItem to="/dashboard/all-invoices">Invoice List</DropdownItem>
            </Dropdown>

            <NavLink to="/dashboard/invoice-summary">Invoice Summary</NavLink>
            <NavLink to="/dashboard/pdf-manager">PDF Manager</NavLink>
            <NavLink to="/dashboard/audit-manager">Audit Manager</NavLink>

            <button
              onClick={handleLogout}
              className="logout ml-2 inline-flex items-center justify-center rounded-md px-4 py-2 text-white bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
            >
              Logout
            </button>
          </nav>

          {/* Mobile menu button */}
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

      {/* Mobile FULLSCREEN menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[10000] min-[1025px]:hidden">
          <div className="fixed inset-0 bg-[#ffffff] text-slate-800 overflow-y-auto menu-block">
            <div className="max-w-7xl mx-auto px-5 pt-4 pb-8">
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

              {/* Mobile Nav */}
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
                    { label: "Create Proforma", to: "/dashboard/create-quotation" },
                    { label: "Proformas List", to: "/dashboard/quotations" },
                  ]}
                />

                <Link className="block w-full mt-1 px-3 py-3 rounded-lg text-[15px] font-medium hover:bg-slate-50" to="/dashboard/invoice-summary">
                  Invoice Summary
                </Link>

                <Link className="block w-full mt-1 px-3 py-3 rounded-lg text-[15px] font-medium hover:bg-slate-50" to="/dashboard/pdf-manager">
                  PDF Manager
                </Link>

                <Link className="block w-full mt-1 px-3 py-3 rounded-lg text-[15px] font-medium hover:bg-slate-50" to="/dashboard/audit-manager">
                  Audit Manager
                </Link>

                <button
                  onClick={handleLogout}
                  className="logout mt-6 w-full inline-flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white bg-gradient-to-b from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700"
                >
                  Logout
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Page content — add top padding to clear the fixed header */}
      <main className="flex-1 pt-[135px] min-[1025px]:pt-16">
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

function Dropdown({ label, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-slate-700 hover:bg-slate-50 focus:outline-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        {label} ▾
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-0 z-[100] min-w-full">
          <div className="bg-white rounded-xl shadow-xl py-1">
            <div className="flex flex-col w-full gap-1">{children}</div>
          </div>
        </div>
      )}
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

      <div
        className={`overflow-hidden transition-[max-height] duration-300 ease-in-out`}
        style={{ maxHeight: open ? "1000px" : "0px" }}
      >
        <div className="py-1 flex flex-col gap-1">
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
  );
}
