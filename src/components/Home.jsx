// src/pages/Home.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, onSnapshot, query } from "firebase/firestore";

/* ---------- Design tokens ---------- */
const COLORS = {
  pageBg: "#F8F9FA",
  cardBg: "#FFFFFF",
  cardBorder: "#E5E7EB",
  textMain: "#111827",
  textSubtle: "#6B7280",
  sidebarBg: "#3B82F6",
  sidebarActive: "#DBEAFE",
  sidebarActiveText: "#1E40AF",
  sidebarHover: "#2563EB",
  statBlue: "#3B82F6",
  statLightBlue: "#EFF6FF",
  statGreen: "#059669",
  statRed: "#DC2626",
  gridline: "#E5E7EB",
  border: "#E5E7EB",
  shadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
};

/* ---------- helpers ---------- */
const pickAmount = (inv) =>
  Number(inv.amount ?? inv.total_amount ?? inv.grandTotal ?? 0);

const toDate = (v) => {
  if (!v) return null;
  if (v?.toDate) {
    try { return v.toDate(); } catch {}
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

/* ---------- Icons ---------- */
const Icon = {
  // Sidebar icons (white)
  Home: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  User: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Folder: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8C20 7.46957 19.7893 6.96086 19.4142 6.58579C19.0391 6.21071 18.5304 6 18 6H12L10 4H6C5.46957 4 4.96086 4.21071 4.58579 4.58579C4.21071 4.96086 4 5.46957 4 6V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  FileText: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="10,9 9,9 8,9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  File: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  FileCheck: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="14,2 14,8 20,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 15L11 17L15 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Shield: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // Header icons
  Search: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
      <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Bell: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M18 8C18 6.4087 17.3679 4.88258 16.2426 3.75736C15.1174 2.63214 13.5913 2 12 2C10.4087 2 8.88258 2.63214 7.75736 3.75736C6.63214 4.88258 6 6.4087 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  UserCircle: (props) => (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M6.168 18.849C6.562 16.702 8.403 15 12 15C15.597 15 17.438 16.702 17.832 18.849C17.879 19.207 17.715 19.558 17.406 19.759C16.18 20.583 14.603 21 12 21C9.397 21 7.82 20.583 6.594 19.759C6.285 19.558 6.121 19.207 6.168 18.849Z" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  // Stat card icons - smaller and responsive
  Dollar: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" {...props}>
      <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
      <path d="M17 5H9.5C8.57174 5 7.6815 5.36875 7.02513 6.02513C6.36875 6.6815 6 7.57174 6 8.5C6 9.42826 6.36875 10.3185 7.02513 10.9749C7.6815 11.6313 8.57174 12 9.5 12H14.5C15.4283 12 16.3185 12.3687 16.9749 13.0251C17.6313 13.6815 18 14.5717 18 15.5C18 16.4283 17.6313 17.3185 16.9749 17.9749C16.3185 18.6313 15.4283 19 14.5 19H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Clock: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" {...props}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <polyline points="12,6 12,12 16,14" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  CheckCircle: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" {...props}>
      <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.0424 2.85976" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  AlertTriangle: (props) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" {...props}>
      <path d="M10.29 3.86L1.82 18C1.64539 18.3024 1.55299 18.6453 1.55201 18.9945C1.55103 19.3437 1.6414 19.6871 1.81445 19.9905C1.98749 20.2939 2.2368 20.5467 2.53753 20.7239C2.83826 20.901 3.18055 20.9962 3.5304 20.9996C3.88025 21.003 4.22539 20.9144 4.5304 20.74L12 18.27L19.47 20.74C19.7749 20.9144 20.1198 21.003 20.4696 20.9996C20.8195 20.9962 21.1617 20.901 21.4625 20.7239C21.7633 20.5467 22.0125 20.2939 22.1856 19.9905C22.3586 19.6871 22.449 19.3437 22.448 18.9945C22.447 18.6453 22.3546 18.3024 22.18 18L13.71 3.86C13.5318 3.56611 13.2807 3.32312 12.9812 3.15448C12.6817 2.98585 12.3437 2.89726 12 2.89726C11.6563 2.89726 11.3184 2.98585 11.0188 3.15448C10.7193 3.32312 10.4682 3.56611 10.29 3.86Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

/* ---------- Small components ---------- */
const PageHeaderBar = ({ title }) => (
  <div className="px-4 md:px-6 pt-4">
    <div
      className="mx-auto max-w-[1180px] h-9 rounded-xl flex items-center shadow-[0_1px_0_rgba(16,24,40,0.04)]"
      style={{ background: COLORS.cardBg, border: `1px solid ${COLORS.cardBorder}` }}
    >
      <span className="pl-4 text-[13px] font-semibold" style={{ color: COLORS.textMain }}>
        {title}
      </span>
    </div>
  </div>
);

const StatCard = ({ color, label, value, icon, textColor = "text-white" }) => (
  <div
    className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 flex-1 min-w-[180px]"
    style={{ backgroundColor: color }}
  >
    <div className="flex-shrink-0">
      <div className={`w-6 h-6 rounded flex items-center justify-center ${textColor === 'text-white' ? 'bg-white bg-opacity-20' : 'bg-white bg-opacity-40'}`}>
        <span className={`${textColor} w-4 h-4`}>{icon}</span>
      </div>
    </div>
    <div className="flex-1 min-w-0">
      <div className={`text-xs font-medium ${textColor} opacity-90 mb-0.5 truncate`}>{label}</div>
      <div className={`text-lg font-bold ${textColor} truncate`}>{value}</div>
    </div>
  </div>
);

const SidebarItem = ({ icon, label, active = false }) => (
  <button
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
      active
        ? 'bg-blue-700 text-white'
        : 'text-white hover:bg-blue-600'
    }`}
  >
    <span className="text-white">{icon}</span>
    <span className="font-medium">{label}</span>
  </button>
);

const ActivityItem = ({ time, title, type = 'default' }) => {
  const getActivityIcon = () => {
    switch (type) {
      case 'invoice':
        return <Icon.FileText className="w-3 h-3 text-blue-500" />;
      case 'payment':
        return <Icon.CheckCircle className="w-3 h-3 text-green-500" />;
      case 'proforma':
        return <Icon.FileCheck className="w-3 h-3 text-purple-500" />;
      default:
        return <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>;
    }
  };

  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 mt-1">
        {type === 'default' ? getActivityIcon() : getActivityIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 mb-1">{time}</div>
        <div className="text-sm text-gray-700">{title}</div>
      </div>
    </div>
  );
};

/* ---------- Chart Components ---------- */
const RevenueChart = ({ monthlyData }) => {
  // Generate monthly data with actual revenue amounts
  const generateMonthlyData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return months.map((month, index) => {
      const actualRevenue = monthlyData?.arr?.[index] || 0;

      return {
        month,
        revenue: actualRevenue, // Use actual revenue amount
        formattedRevenue: formatINR(actualRevenue)
      };
    });
  };

  const data = generateMonthlyData();

  // Calculate total revenue for 2025
  const totalRevenue2025 = data.reduce((sum, item) => sum + item.revenue, 0);

  // Calculate max revenue for Y-axis scaling
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  // Generate Y-axis labels based on actual revenue
  const getYAxisLabels = () => {
    const labels = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const value = (maxRevenue * i) / steps;
      labels.push(value);
    }
    return labels;
  };

  const yAxisLabels = getYAxisLabels();

  return (
    <div className="w-full">
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#3B7DD8' }}></div>
          <span className="text-sm text-gray-600">Monthly Revenue (₹)</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <svg viewBox="0 0 600 300" className="w-full h-48 min-w-[600px]">
          {/* Grid lines */}
          {yAxisLabels.map((value, index) => (
            <g key={index}>
              <line
                x1="60"
                y1={240 - (index / 5) * 200}
                x2="560"
                y2={240 - (index / 5) * 200}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <text
                x="50"
                y={240 - (index / 5) * 200 + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6B7280"
              >
                {formatINR(value)}
              </text>
            </g>
          ))}

          {/* Chart area */}
          <defs>
            <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B7DDD" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B7DDD" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path
            d={`M 60 ${240} ${data.map((d, i) => `L ${60 + i * 40} ${240 - (d.revenue / maxRevenue) * 200}`).join(' ')} L 560 240 Z`}
            fill="url(#revenueGradient)"
          />

          {/* Revenue line */}
          <polyline
            points={data.map((d, i) => `${60 + i * 40},${240 - (d.revenue / maxRevenue) * 200}`).join(' ')}
            fill="none"
            stroke="#3B7DDD"
            strokeWidth="3"
          />

          {/* Data points */}
          {data.map((d, i) => (
            <g key={i}>
              <circle
                cx={60 + i * 40}
                cy={240 - (d.revenue / maxRevenue) * 200}
                r="4"
                fill="#3B7DDD"
              />
              {/* Revenue value labels */}
              <text
                x={60 + i * 40}
                y={240 - (d.revenue / maxRevenue) * 200 - 10}
                textAnchor="middle"
                fontSize="9"
                fill="#3B7DDD"
                fontWeight="bold"
              >
                {d.formattedRevenue}
              </text>
            </g>
          ))}

          {/* Month labels */}
          {data.map((d, i) => (
            <text
              key={i}
              x={60 + i * 40}
              y="260"
              textAnchor="middle"
              fontSize="12"
              fill="#6B7280"
            >
              {d.month}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

const InvoiceStatusChart = ({ stats }) => {
  const getStatusData = () => {
    const totalCount = stats.totalCount || 1;
    const paidCount = stats.paidCount || 0;
    const pendingCount = stats.pendingCount || 0;
    const overdueCount = stats.overdueCount || 0;
    const partialCount = stats.partialCount || 0;

    return [
      {
        status: 'Paid',
        value: Math.round((paidCount / totalCount) * 100),
        count: paidCount,
        color: '#10B981'  // Green - matches stat card
      },
      {
        status: 'Pending',
        value: Math.round((pendingCount / totalCount) * 100),
        count: pendingCount,
        color: '#EF4444'  // Red - matches stat card
      },
      {
        status: 'Partial',
        value: Math.round((partialCount / totalCount) * 100),
        count: partialCount,
        color: '#EAB308'  // Yellow - matches stat card
      }
    ].filter(item => item.count > 0); // Only show statuses that have invoices
  };

  const data = getStatusData();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = 60;
  const centerX = 80;
  const centerY = 80;

  let currentAngle = -90; // Start from top

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      {/* Legend */}
      <div className="flex-1 w-full">
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></div>
                <span className="text-sm text-gray-600">{item.status}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-gray-900">{item.value}%</div>
                <div className="text-xs text-gray-500">({item.count})</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pie Chart */}
      <div className="relative flex-shrink-0">
        <svg width="100" height="100" viewBox="0 0 160 160">
          {data.map((item, index) => {
            const angle = (item.value / total) * 360;
            const startAngle = currentAngle;
            const endAngle = currentAngle + angle;
            currentAngle = endAngle;

            const startAngleRad = (startAngle * Math.PI) / 180;
            const endAngleRad = (endAngle * Math.PI) / 180;

            const x1 = centerX + radius * Math.cos(startAngleRad);
            const y1 = centerY + radius * Math.sin(startAngleRad);
            const x2 = centerX + radius * Math.cos(endAngleRad);
            const y2 = centerY + radius * Math.sin(endAngleRad);

            const largeArcFlag = angle > 180 ? 1 : 0;

            const pathData = [
              `M ${centerX} ${centerY}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');

            return (
              <path
                key={index}
                d={pathData}
                fill={item.color}
                stroke="white"
                strokeWidth="2"
              />
            );
          })}

          {/* Center circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r="20"
            fill="white"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
};

/* ---------- Page ---------- */
export default function Home() {
  console.log("Home component is rendering...");

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add error boundary
  useEffect(() => {
    console.log("Home component mounted");
    return () => console.log("Home component unmounted");
  }, []);

  useEffect(() => {
    console.log("Setting up Firebase listener...");
    // Set up real-time listener for invoices collection
    const unsubscribe = onSnapshot(
      query(collection(db, "invoices")),
      (snapshot) => {
        console.log("Received invoices data:", snapshot.docs.length, "documents");
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvoices(list);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error("Error fetching invoices:", error);
        setError("Failed to load invoice data: " + error.message);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      console.log("Cleaning up Firebase listener");
      unsubscribe();
    };
  }, []);

  const today = new Date();

  const stats = useMemo(() => {
    const totalCount = invoices.length;
    let paidCount = 0, pendingCount = 0, partialCount = 0, overdueCount = 0;
    let totalRevenue = 0;

    invoices.forEach((inv) => {
      const st = (inv.payment_status || "").toLowerCase();
      const amount = pickAmount(inv);
      totalRevenue += amount; // Include all amounts regardless of payment status
      if (st === "paid") { paidCount++; }
      else if (st === "pending") pendingCount++;
      else if (st === "partial") partialCount++;

      const due = toDate(inv.dueDate);
      if (due && due < today && st !== "paid") overdueCount++;
    });

    return { totalCount, paidCount, pendingCount, partialCount, overdueCount, totalRevenue };
  }, [invoices, today]);

  const monthly = useMemo(() => {
    const arr = new Array(12).fill(0);
    const currentYear = 2025; // Use 2025 as specified
    invoices.forEach((inv) => {
      const dt = toDate(inv.createdAt) || toDate(inv.created_at);
      if (!dt || dt.getFullYear() !== currentYear) return;
      // Include all invoices regardless of payment status
      arr[dt.getMonth()] += pickAmount(inv);
    });
    const max = Math.max(1, ...arr);
    return { arr, max };
  }, [invoices]);

  const recent = useMemo(() => {
    return [...invoices]
      .map((inv) => ({
        title: `Invoice ${inv.number || inv.id} created for client ${inv.clientName || 'Unknown'}`,
        ts: (toDate(inv.createdAt) || toDate(inv.created_at) || new Date()).getTime(),
        type: 'invoice'
      }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 5); // Show more recent activities
  }, [invoices]);

  const recentPayments = useMemo(() => {
    return [...invoices]
      .filter(inv => (inv.payment_status || '').toLowerCase() === 'paid')
      .map((inv) => ({
        title: `Payment received for ${inv.number || inv.id}`,
        ts: (toDate(inv.updatedAt) || toDate(inv.updated_at) || toDate(inv.createdAt) || new Date()).getTime(),
        type: 'payment'
      }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 3);
  }, [invoices]);

  const recentProformas = useMemo(() => {
    return [...invoices]
      .filter(inv => inv.type === 'proforma' || (inv.number || '').startsWith('PRO'))
      .map((inv) => ({
        title: `Proforma ${inv.number || inv.id} approved`,
        ts: (toDate(inv.updatedAt) || toDate(inv.updated_at) || toDate(inv.createdAt) || new Date()).getTime(),
        type: 'proforma'
      }))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 2);
  }, [invoices]);

  const allRecentActivities = useMemo(() => {
    const activities = [
      ...recent.map(activity => ({ ...activity, category: 'invoice' })),
      ...recentPayments.map(activity => ({ ...activity, category: 'payment' })),
      ...recentProformas.map(activity => ({ ...activity, category: 'proforma' }))
    ];

    return activities
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 6)
      .map(activity => ({
        ...activity,
        time: new Date(activity.ts).toLocaleTimeString('en-IN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) + ' ' + new Date(activity.ts).getDate()
      }));
  }, [recent, recentPayments, recentProformas]);

  const paidPct = stats.totalCount ? Math.round((stats.paidCount / stats.totalCount) * 100) : 0;
  const notPaidPct = 100 - paidPct;

  // Show error if there is one
  if (error) {
    return (
      <div style={{ background: 'var(--page-bg)' }} className="p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--page-bg)' }} className="p-4 sm:p-6">
      {/* Debug info */}
      <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm  text-[#3b5997]">
        Invoices: {invoices.length}
      </div>

      {/* Real-time indicator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live Dashboard</span>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              color="#3B7DD8"
              label="Total Revenue"
              value={formatINR(stats.totalRevenue)}
              icon={<Icon.Dollar />}
            />
            <StatCard
              color="#10B981"
              label="Paid Invoices"
              value={stats.paidCount.toString()}
              icon={<Icon.CheckCircle />}
            />
            <StatCard
              color="#EAB308"
              label="Partial Paid"
              value={stats.partialCount.toString()}
              icon={<Icon.FileCheck />}
              textColor="text-white"
            />
            <StatCard
              color="#EF4444"
              label="Pending"
              value={stats.pendingCount.toString()}
              icon={<Icon.Clock />}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Monthly Revenue Trends */}
            <div className="bg-white rounded-lg p-4 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
              <h3 className="text-base font-semibold mb-3 text-gray-900">
                Monthly Revenue Trends - 2025
              </h3>
              <RevenueChart monthlyData={monthly} />
              <div className="mt-3 text-xs text-gray-500">
                Showing actual monthly revenue amounts in Indian Rupees (₹)
              </div>
              <div className="mt-2 text-sm text-gray-700">
                <strong>Total 2025 Revenue: {formatINR(stats.totalRevenue)}</strong>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {/* Recent Activity */}
              <div className="bg-white rounded-lg p-3 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
                <h4 className="text-sm font-semibold mb-2 text-gray-900">
                  Recent Activity
                </h4>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {loading ? (
                    <div className="text-sm text-gray-500">Loading recent activities...</div>
                  ) : allRecentActivities.length > 0 ? (
                    allRecentActivities.map((activity, index) => (
                      <ActivityItem
                        key={index}
                        time={activity.time}
                        title={activity.title}
                        type={activity.type}
                      />
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No recent activities found</div>
                  )}
                </div>
              </div>

              {/* Invoice Status Distribution */}
              <div className="bg-white rounded-lg p-3 shadow-sm" style={{ border: '1px solid #E5E7EB' }}>
                <h4 className="text-sm font-semibold mb-2 text-gray-900">
                  Invoice Status Distribution
                </h4>
                <InvoiceStatusChart stats={stats} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

