import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useEffect, useMemo, useState, useRef } from "react";

// Assets
import wtLogo from "./../assets/wt-logo.png";
import wtxLogo from "./../assets/wtx-black-logo.png";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // Header email (from Firebase)
  const [adminEmail, setAdminEmail] = useState(null);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) =>
      setAdminEmail(u?.email || null)
    );
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  // Accordion open state (desktop header copy)
  const [openKey, setOpenKey] = useState(null);
  const toggle = (key) => setOpenKey((k) => (k === key ? null : key));

  // Auto-open based on current route
  const activeMap = useMemo(
    () => ({
      client:
        isActive("/dashboard/add-client") ||
        isActive("/dashboard/all-clients"),
      poc:
        isActive("/dashboard/add-poc") ||
        isActive("/dashboard/all-pocs"),
      project:
        isActive("/dashboard/add-project") ||
        isActive("/dashboard/all-projects"),
      quotation:
        isActive("/dashboard/create-quotation") ||
        isActive("/dashboard/quotation-list"),
      proforma:
        isActive("/dashboard/create-proforma") ||
        isActive("/dashboard/proforma-list"),
      invoice:
        isActive("/dashboard/create-invoice") ||
        isActive("/dashboard/all-invoices"),
    }),
    [location.pathname]
  );

  useEffect(() => {
    if (activeMap.client) setOpenKey("client");
    else if (activeMap.poc) setOpenKey("poc");
    else if (activeMap.project) setOpenKey("project");
    else if (activeMap.quotation) setOpenKey("quotation");
    else if (activeMap.proforma) setOpenKey("proforma");
    else if (activeMap.invoice) setOpenKey("invoice");
  }, [activeMap]);

  const avatarInitial = (adminEmail && adminEmail[0]?.toUpperCase()) || "A";

  // ---------- Profile dropdown on top-right ----------
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // ---------- Mobile drawer state ----------
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on route change + ESC
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#F3F6FB]">
      {/* ===== Top Header Strip (fixed) ===== */}
      <header className="fixed top-0 left-0 right-0 h-[90px] bg-[#3b5997] text-white flex items-center justify-between md:px-6 shadow z-30 blue-profile">
        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 pl-3 md:hidden menu-bar">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white/60 ml-[20px] menu-three"
          >
            {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

        {/* Right section with email + avatar */}
        <div
          className="items-center gap-3 admin-block ml-auto mr-0 md:mr-6"
          ref={menuRef}
        >
          <div className="sm:flex items-center gap-2 bg-white/10 rounded-full pl-2 pr-3 py-1 backdrop-blur">
            <span className="text-sm font-medium truncate align-right display-block w-[100%]">
              {adminEmail || "admin@gmail.com"}
            </span>
          </div>

          {/* Avatar -> dropdown */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 rounded-full bg-white text-[#1E3A8A] grid place-items-center font-semibold focus:outline-none mr-[30px]"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Account"
          >
            {avatarInitial}
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-[30px] top-[75px] mt-2 w-44 bg-white text-slate-700 rounded-md shadow-lg border z-40 h-[50px] admin-in-block"
            >
              <button
                className="w-full text-left border-0 cursor-pointer mt-[0] p-[10px] pt-[0]"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ===== Sidebar ===== */}
      {/* Desktop sidebar */}
      <aside className="md:block fixed left-0 top-[60px] inset-y-0 w-[260px] bg-[#ffffff] border-r border-[#E8ECF2] p-[10px] overflow-y-auto z-20 h-full sidebar">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      <div
        className={[
          "md:hidden fixed top-[60px] left-0 h-[calc(100%-60px)] w-[260px] bg-[#ffffff] border-r border-[#E8ECF2] z-40 transition-transform duration-300 open-sidebar",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
      >
        <SidebarContent onLinkClick={() => setMobileOpen(false)} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 top-[60px] z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ===== Content ===== */}
      <main className="pt-[100px] md:ml-[260px]">
        <div className="px-4 md:px-6 py-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

/* ===== SidebarContent ===== */
function SidebarContent({ onLinkClick }) {
  const location = useLocation();
  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const [openKey, setOpenKey] = useState(null);
  const toggle = (key) => setOpenKey((k) => (k === key ? null : key));

  useEffect(() => {
    if (isActive("/dashboard/add-client") || isActive("/dashboard/all-clients")) {
      setOpenKey("client");
    } else if (
      isActive("/dashboard/add-poc") ||
      isActive("/dashboard/all-pocs")
    ) {
      setOpenKey("poc");
    } else if (
      isActive("/dashboard/add-project") ||
      isActive("/dashboard/all-projects")
    ) {
      setOpenKey("project");
    } else if (
      isActive("/dashboard/create-quotation") ||
      isActive("/dashboard/quotation-list")
    ) {
      setOpenKey("quotation");
    } else if (
      isActive("/dashboard/create-proforma") ||
      isActive("/dashboard/proforma-list")
    ) {
      setOpenKey("proforma");
    } else if (
      isActive("/dashboard/create-invoice") ||
      isActive("/dashboard/all-invoices")
    ) {
      setOpenKey("invoice");
    }
  }, [location.pathname]);

  return (
    <>
      {/* Logo Row */}
      <div className="h-[100px] flex items-center justify-center gap-4 border-b border-[#E8ECF2] p-[10px]">
        <img src={wtLogo} alt="WT" className="h-auto w-[80px]" />
        <div className="h-[50px] w-[1px] bg-[#ffffff]" />
        <img src={wtxLogo} alt="WTX" className="h-auto w-[80px]" />
      </div>

      <nav className="px-3 py-4 text-[18px] space-y-1">
        {/* Home */}
        <RowSingle
          to="/dashboard/home"
          icon={<HomeIcon />}
          active={isActive("/dashboard/home")}
          onLinkClick={onLinkClick}
        >
          Home
        </RowSingle>

        {/* Client Registration */}
        <RowDropdown
          id="client"
          label="Client Registration"
          icon={<GridIcon />}
          isOpen={openKey === "client"}
          onToggle={() => toggle("client")}
          items={[
            { to: "/dashboard/add-client", label: "Register Client" },
            { to: "/dashboard/all-clients", label: "Client List" },
          ]}
          onLinkClick={onLinkClick}
        />

        {/* POC Management */}
        <RowDropdown
          id="poc"
          label="POC Management"
          icon={<UserIcon />}
          isOpen={openKey === "poc"}
          onToggle={() => toggle("poc")}
          items={[
            { to: "/dashboard/add-poc", label: "Add POC" },
            { to: "/dashboard/all-pocs", label: "All POCs" },
          ]}
          onLinkClick={onLinkClick}
        />

        {/* Project Management */}
        <RowDropdown
          id="project"
          label="Project Management"
          icon={<GearIcon />}
          isOpen={openKey === "project"}
          onToggle={() => toggle("project")}
          items={[
            { to: "/dashboard/add-project", label: "Add Project" },
            { to: "/dashboard/all-projects", label: "All Projects" },
          ]}
          onLinkClick={onLinkClick}
        />

        {/* Quotation Generation */}
        <RowDropdown
          id="quotation"
          label="Quotation Generation"
          icon={<QuoteIcon />}
          isOpen={openKey === "quotation"}
          onToggle={() => toggle("quotation")}
          items={[
            { to: "/dashboard/create-quotation", label: "Create Quotation" },
            { to: "/dashboard/quotation-list", label: "Quotations List" },
          ]}
          onLinkClick={onLinkClick}
        />

        {/* Proforma Generation */}
        <RowDropdown
          id="proforma"
          label="Proforma Generation"
          icon={<DocIcon />}
          isOpen={openKey === "proforma"}
          onToggle={() => toggle("proforma")}
          items={[
            { to: "/dashboard/create-proforma", label: "Create Proforma" },
            { to: "/dashboard/proforma-list", label: "Proforma List" },
          ]}
          onLinkClick={onLinkClick}
        />

        {/* Invoice Generation */}
        <RowDropdown
          id="invoice"
          label="Invoice Generation"
          icon={<PaperIcon />}
          isOpen={openKey === "invoice"}
          onToggle={() => toggle("invoice")}
          items={[
            { to: "/dashboard/create-invoice", label: "Create Invoice" },
            { to: "/dashboard/all-invoices", label: "Invoice List" },
          ]}
          onLinkClick={onLinkClick}
        />

        {/* Invoice Summary */}
        <RowSingle
          to="/dashboard/invoice-summary"
          icon={<ChartIcon />}
          active={isActive("/dashboard/invoice-summary")}
          onLinkClick={onLinkClick}
        >
          Invoice Summary
        </RowSingle>

        {/* PDF Manager */}
        <RowSingle
          to="/dashboard/pdf-manager"
          icon={<PdfIcon />}
          active={isActive("/dashboard/pdf-manager")}
          onLinkClick={onLinkClick}
        >
          PDF Manager
        </RowSingle>

        {/* Audit Manager */}
        <RowSingle
          to="/dashboard/audit-manager"
          icon={<ListIcon />}
          active={isActive("/dashboard/audit-manager")}
          onLinkClick={onLinkClick}
        >
          Audit Manager
        </RowSingle>
      </nav>
    </>
  );
}

/* ===== Row Components ===== */
function RowSingle({ to, icon, active, children, onLinkClick }) {
  return (
    <Link
      to={to}
      onClick={onLinkClick}
      className={[
        "relative flex items-center gap-2 rounded-md px-3 py-2 text-[14px] transition-colors",
        active
          ? "bg-[rgb(233_241_255_/_30%)] text-[#1E3A8A] font-medium"
          : "text-slate-700 ",
      ].join(" ")}
    >
      <span className="text-[16px]">{icon}</span>
      <span>{children}</span>
      {active && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-1.5 rounded-full bg-[#3b5997]" />
      )}
    </Link>
  );
}

function RowDropdown({
  id,
  label,
  icon,
  items,
  isOpen,
  onToggle,
  onLinkClick,
}) {
  const location = useLocation();
  const anyActive = items.some((it) =>
    location.pathname.startsWith(it.to)
  );

  return (
    <div className="rounded-md">
      <button
        type="button"
        onClick={onToggle}
        className={[
          "relative w-full flex items-center justify-between rounded-md px-3 py-2 text-[14px] transition-colors",
          anyActive
            ? "bg-[rgb(233_241_255_/_30%)] text-[#1E3A8A] font-medium "
            : "text-slate-700 ",
        ].join(" ")}
        aria-expanded={isOpen}
        aria-controls={`submenu-${id}`}
      >
        <span className="flex items-center gap-2">
          <span className="text-[16px]">{icon}</span>
          <span>{label}</span>
        </span>
        <Caret open={isOpen} />
        {anyActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-1.5 rounded-full bg-[#3b5997]" />
        )}
      </button>

      {isOpen && (
        <div id={`submenu-${id}`} className="pt-1">
          {items.map((it) => {
            const active = location.pathname.startsWith(it.to);
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={onLinkClick}
                className={[
                  "relative flex items-center gap-2 pl-8 pr-3 py-2 rounded-md text-[14px] ",
                  active
                    ? "bg-[rgb(233_241_255_/_30%)] text-[#1E3A8A] font-medium"
                    : "text-slate-700 ",
                ].join(" ")}
              >
                <span className="text-gray-300">–</span>
                <span>{it.label}</span>
                {active && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-1.5 rounded-full bg-[#3b5997]" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===== Icons ===== */
function Caret({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ✅ only keep ONE CloseIcon definition
function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6l-12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5l8-6 8 6V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 12h2M18 12h2M12 4v2M12 18v2M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M6 18l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

// New icon for Quotation
function QuoteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 7h6v6H7zM7 15h6M15 7h2a3 3 0 0 1 3 3v3h-5V7zM15 15h5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4h6l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M13 4v4h4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function PaperIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M15 4v4h4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 19V6M10 19v-7M15 19v-4M20 19V4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4h6l4 4v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M9 13h6M9 16h6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 7h14M5 12h14M5 17h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 20a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 12H3M12 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 4v16a2 2 0 0 1-2 2h-5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
function GmailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 18a2 2 0 0 0 2-2V8.5l-10 6.25L2 8.5V16a2 2 0 0 0 2 2h16z"
      ></path>
      <path
        fill="currentColor"
        d="M22 6.5V8l-10 6.25L2 8V6.5l10 6.25L22 6.5z"
      ></path>
    </svg>
  );
}
