import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const BRAND_NAME = "It's Too Easy Workwear";
const FALLBACK_COMPANY_LOGO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' rx='18' fill='%23e5e7eb'/><text x='40' y='46' font-family='Arial' font-size='28' font-weight='700' text-anchor='middle' fill='%239ca3af'>IT</text></svg>";
const FALLBACK_ADMIN_AVATAR =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' rx='40' fill='%23e5e7eb'/><text x='40' y='48' font-family='Arial' font-size='28' font-weight='700' text-anchor='middle' fill='%239ca3af'>A</text></svg>";
const FALLBACK_PRODUCT_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><rect width='120' height='120' rx='20' fill='%23e5e7eb'/><rect x='28' y='32' width='64' height='48' rx='8' fill='%23d1d5db'/><circle cx='44' cy='48' r='8' fill='%23c4c4c4'/><path d='M32 84l20-20 16 16 12-12 20 20' stroke='%23bdbdbd' stroke-width='6' fill='none'/></svg>";

const formatPrice = (value) =>
  Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)} AUD` : "$0.00 AUD";

const formatCount = (value) =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString("en-US") : "0";

const buildImage = (url) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_BASE}${url}`;
};

const classNames = (...classes) => classes.filter(Boolean).join(" ");
const getRegionLabel = (address) => {
  if (!address) return "Unknown";
  const parts = address.split(",").map((item) => item.trim()).filter(Boolean);
  return parts[parts.length - 1] || "Unknown";
};
const AU_STATES = ["NSW", "VIC", "QLD", "SA", "WA", "ACT", "TAS", "NT"];
const extractState = (address) => {
  if (!address) return "Unknown";
  const parts = address.split(",").map((item) => item.trim());
  const last = parts[parts.length - 1] || "";
  const match = AU_STATES.find((state) => last.toUpperCase().includes(state));
  return match || last || "Unknown";
};
const getGstAmount = (total) => Number(total || 0) * 0.1;
const getTotalWithGst = (total) => Number(total || 0) * 1.1;
const getCountryFromLocale = (locale) => {
  if (!locale) return "";
  const parts = locale.split("-");
  return parts[1] || "";
};

const getMonthBuckets = () => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: date.toLocaleString("en-US", { month: "short" }) });
  }
  return months;
};

const buildSalesFromOrders = (orders) => {
  const months = getMonthBuckets();
    const totals = months.reduce((acc, month) => ({ ...acc, [month.key]: 0 }), {});
    orders.forEach((order) => {
      if (order.paymentStatus !== "Paid" || !order.createdAt) return;
      const created = new Date(order.createdAt);
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      if (key in totals) totals[key] += Number(order.total || 0);
    });
  return {
    labels: months.map((month) => month.label),
    values: months.map((month) => Number(totals[month.key].toFixed(2))),
  };
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "products", label: "Product", icon: "box", countKey: "products" },
  { id: "orders", label: "Transaction", icon: "receipt", countKey: "orders" },
  { id: "customers", label: "Customers", icon: "users", countKey: "customers" },
  { id: "sales", label: "Sales Report", icon: "chart" },
];

const TOOL_ITEMS = [
  { id: "account", label: "Account & Settings", icon: "settings" },
  { id: "error-log", label: "Error Log", icon: "alert" },
  { id: "help", label: "Help", icon: "help" },
];

const ICONS = {
  home: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  box: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7l9 5 9-5" />
      <path d="M3 7v10l9 5 9-5V7" />
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M16 11a4 4 0 1 0-8 0" />
      <path d="M3 21c0-3.3 3.6-6 9-6s9 2.7 9 6" />
      <circle cx="12" cy="7" r="3" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 19h16" />
      <path d="M6 17V9" />
      <path d="M12 17V5" />
      <path d="M18 17v-6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V21a2 2 0 1 1-4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H3a2 2 0 1 1 0-4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V3a2 2 0 1 1 4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H21a2 2 0 1 1 0 4h-.1a1 1 0 0 0-.9.6z" />
    </svg>
  ),
  help: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.8-2.5 2-2.5 4" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 9v4" />
      <circle cx="12" cy="17" r="1" />
      <path d="M10.3 4.6 3.2 18.5c-.6 1.1.2 2.5 1.5 2.5h14.7c1.3 0 2.1-1.4 1.5-2.5L13.7 4.6c-.6-1.1-2.8-1.1-3.4 0z" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16v12H4z" />
      <path d="M4 6l8 7 8-7" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14h10l1-14" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  chevron: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

function StatusPill({ label, tone }) {
  const styles = {
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-sky-100 text-sky-700",
    neutral: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={classNames("rounded-full px-3 py-1 text-xs font-semibold", styles[tone])}>
      {label}
    </span>
  );
}

function ActionButton({ icon, onClick, title }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      title={title}
      className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-blue-200 hover:text-blue-600"
    >
      {icon}
    </button>
  );
}

function MetricCard({ title, value, change, tone }) {
  const toneClasses = {
    primary: "bg-blue-600 text-white",
    light: "bg-white text-gray-900",
  };
  return (
    <div className={classNames("rounded-2xl border border-gray-200 p-4 shadow-sm", toneClasses[tone])}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-sm">↗</span>
      </div>
      <div className="mt-6 text-2xl font-semibold">{value}</div>
      <div className="mt-2 text-xs">
        <span className={change.startsWith("-") ? "text-rose-500" : "text-emerald-500"}>
          {change}
        </span>
        <span className={tone === "primary" ? "text-white/70" : "text-gray-500"}>
          {" "}from last week
        </span>
      </div>
    </div>
  );
}

function buildLinePath(values, width, height, padding) {
  if (!values.length) return "";
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;
  const step = (width - padding * 2) / Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - ((value - minValue) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

const paginate = (items, page, pageSize) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

const downloadCsv = (filename, rows) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(",")]
    .concat(
      rows.map((row) =>
        headers
          .map((key) => {
            const value = row[key] ?? "";
            const escaped = String(value).replace(/\"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      )
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("adminAuth");
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "superadmin@company.com",
    password: "SuperAdmin@123",
    adminKey: "",
  });
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorLog, setErrorLog] = useState([]);
  const [serverErrorLog, setServerErrorLog] = useState([]);
  const [errorPage, setErrorPage] = useState(1);
  const [errorTotal, setErrorTotal] = useState(0);
  const errorLimit = 8;
  const [clientMeta, setClientMeta] = useState({
    country: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    locale: navigator.language || "",
    lat: null,
    lng: null,
  });
  const [productForm, setProductForm] = useState({
    sku: "",
    title: "",
    description: "",
    price: "",
    sizes: "",
    category: "",
    quantity: "",
    color: "",
    status: "available",
  });
  const [productImage, setProductImage] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    purchasesTotal: "",
    orderCount: "",
    address: "",
    avatarUrl: "",
  });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
    birthDate: "",
    phone: "",
    country: "",
    address: "",
    avatarUrl: "",
    companyLogoUrl: "",
  });
  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [orderForm, setOrderForm] = useState({
    orderNumber: "",
    customerName: "",
    customerEmail: "",
    itemTitle: "",
    itemPrice: "",
    itemQty: "1",
    itemImageUrl: "",
    total: "",
    paymentStatus: "Paid",
    status: "Shipping",
    trackingId: "",
    origin: "",
    destination: "",
    courierName: "",
    eta: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [accountTab, setAccountTab] = useState("account");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState("All");
  const [productCategory, setProductCategory] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [salesMonthIndex, setSalesMonthIndex] = useState(11);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState("");
  const [detailView, setDetailView] = useState({ type: "", data: null });
  const [productStatusFilter, setProductStatusFilter] = useState("All");
  const [customerStatusFilter, setCustomerStatusFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [productPage, setProductPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const productPageSize = 8;
  const customerPageSize = 8;
  const orderPageSize = 8;

  const authHeader = auth?.token ? { Authorization: `Bearer ${auth.token}` } : {};
  const adminAvatar = profileForm.avatarUrl || FALLBACK_ADMIN_AVATAR;
  const companyLogo = profileForm.companyLogoUrl || FALLBACK_COMPANY_LOGO;

  useEffect(() => {
    const locale = navigator.language || "";
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const country = getCountryFromLocale(locale);
    setClientMeta((prev) => ({ ...prev, locale, timezone, country }));

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientMeta((prev) => ({
          ...prev,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }));
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  const pushErrorLog = (message) => {
    if (!message) return;
    setErrorLog((prev) => [
      { id: `${Date.now()}-${Math.random()}`, message, at: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  };

  const apiFetch = async (url, options = {}) => {
    const res = await fetch(url, options);
    if (!res.ok) {
      let detail = "";
      try {
        const data = await res.json();
        detail = data?.message ? ` ${data.message}` : "";
      } catch (_) {
        detail = "";
      }
      const message = `${res.status} ${res.statusText}.${detail}`;
      pushErrorLog(message);
      if (auth?.token && !url.includes('/api/errors')) {
        fetch(`${API_BASE}/api/errors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            message,
            status: res.status,
            endpoint: url,
            method: options.method || 'GET',
            source: 'admin',
            country: clientMeta.country,
            timezone: clientMeta.timezone,
            locale: clientMeta.locale,
            lat: clientMeta.lat,
            lng: clientMeta.lng,
          }),
        }).catch(() => {});
      }
      throw new Error(message);
    }
    return res;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsRes, customersRes, ordersRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/products`),
          apiFetch(`${API_BASE}/api/customers`),
          apiFetch(`${API_BASE}/api/orders`),
        ]);
        const [productsData, customersData, ordersData] = await Promise.all([
          productsRes.json(),
          customersRes.json(),
          ordersRes.json(),
        ]);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (err) {
        console.error("Failed to load core lists", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    const loadSummary = async () => {
      if (!auth?.token) return;
      try {
        const [summaryRes, salesRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/admin/summary`, { headers: authHeader }),
          apiFetch(`${API_BASE}/api/admin/sales`, { headers: authHeader }),
        ]);
        const summaryData = await summaryRes.json();
        const salesData = await salesRes.json();
        setSummary(summaryData);
        setSales(salesData);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      }
    };

    loadSummary();
  }, [auth?.token]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!auth?.token) return;
      try {
        const res = await apiFetch(`${API_BASE}/api/admin/profile`, { headers: authHeader });
        const data = await res.json();
        setProfileForm({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          gender: data.gender || "",
          birthDate: data.birthDate || "",
          phone: data.phone || "",
          country: data.country || "",
          address: data.address || "",
          avatarUrl: data.avatarUrl || "",
          companyLogoUrl: data.companyLogoUrl || "",
        });
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    };

    loadProfile();
  }, [auth?.token]);

  useEffect(() => {
    const loadErrorLogs = async () => {
      if (activePage !== "error-log" || !auth?.token) return;
      try {
        const res = await apiFetch(
          `${API_BASE}/api/errors?page=${errorPage}&limit=${errorLimit}`,
          { headers: authHeader }
        );
        const data = await res.json();
        setServerErrorLog(data.data || []);
        setErrorTotal(data.total || 0);
      } catch (err) {
        console.error("Failed to load error logs", err);
      }
    };
    loadErrorLogs();
  }, [activePage, auth?.token, errorPage]);

  const productCategories = useMemo(() => {
    const categories = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(categories)];
  }, [products]);

  const latestOrder = useMemo(() => {
    if (!orders.length) return null;
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }, [orders]);

  const customerRegionStats = useMemo(() => {
    if (!customers.length) return [];
    const counts = customers.reduce((acc, customer) => {
      const label = extractState(customer.address);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const sorted = Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const total = customers.length || 1;
    return sorted.map((item) => ({ ...item, percent: Math.round((item.count / total) * 100) }));
  }, [customers]);

  const localSummary = useMemo(() => {
      const totalRevenue = orders
      .filter((order) => order.paymentStatus === "Paid")
      .reduce((sum, order) => sum + getTotalWithGst(order.total || 0), 0);
    return {
      totalRevenue,
      totalCustomers: customers.length,
      totalTransactions: orders.length,
      totalProducts: products.length,
    };
  }, [orders, customers, products]);

  const localSales = useMemo(() => {
    const adjustedOrders = orders.map((order) => ({
      ...order,
      total: getTotalWithGst(order.total || 0),
    }));
    return buildSalesFromOrders(adjustedOrders);
  }, [orders]);

  const displaySummary = localSummary;
  const displaySales = localSales;
  const messageCount = Math.min(customers.length, 9);
  const notificationCount = Math.min(orders.length, 9);
  const salesMonths = useMemo(() => getMonthBuckets(), []);
  const ordersByMonth = useMemo(() => {
    const buckets = salesMonths.map((month) => ({ ...month, orders: [] }));
    orders.forEach((order) => {
      if (!order.createdAt) return;
      const created = new Date(order.createdAt);
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`;
      const index = buckets.findIndex((month) => month.key === key);
      if (index >= 0) {
        buckets[index].orders.push(order);
      }
    });
    return buckets;
  }, [orders, salesMonths]);

  useEffect(() => {
    if (displaySales.labels.length) {
      setSalesMonthIndex(displaySales.labels.length - 1);
    }
  }, [displaySales.labels.length]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!activeDropdown) return;
      const target = event.target;
      if (target.closest("[data-dropdown-trigger]")) return;
      if (target.closest("[data-dropdown-menu]")) return;
      setActiveDropdown("");
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [activeDropdown]);

  useEffect(() => {
    setProductPage(1);
  }, [productCategory, productStatusFilter, searchQuery]);

  useEffect(() => {
    setCustomerPage(1);
  }, [stateFilter, customerStatusFilter, searchQuery]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderFilter, paymentFilter, searchQuery]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchCategory = productCategory === "All" || product.category === productCategory;
      const matchStatus =
        productStatusFilter === "All" || product.status === productStatusFilter;
      const matchSearch =
        !searchQuery ||
        product.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchStatus && matchSearch;
    });
  }, [products, productCategory, productStatusFilter, searchQuery]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchState =
        stateFilter === "All" || extractState(customer.address).toUpperCase() === stateFilter;
      const matchStatus =
        customerStatusFilter === "All" || customer.status === customerStatusFilter;
      if (!searchQuery) return matchState && matchStatus;
      const needle = searchQuery.toLowerCase();
      const matchSearch =
        customer.name?.toLowerCase().includes(needle) ||
        customer.email?.toLowerCase().includes(needle) ||
        customer.phone?.toLowerCase().includes(needle);
      return matchState && matchStatus && matchSearch;
    });
  }, [customers, searchQuery, stateFilter, customerStatusFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchFilter =
        orderFilter === "All" || order.status?.toLowerCase() === orderFilter.toLowerCase();
      const matchPayment =
        paymentFilter === "All" || order.paymentStatus === paymentFilter;
      const matchSearch =
        !searchQuery ||
        order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchFilter && matchPayment && matchSearch;
    });
  }, [orders, orderFilter, paymentFilter, searchQuery]);

  const pagedProducts = useMemo(
    () => paginate(filteredProducts, productPage, productPageSize),
    [filteredProducts, productPage]
  );
  const pagedCustomers = useMemo(
    () => paginate(filteredCustomers, customerPage, customerPageSize),
    [filteredCustomers, customerPage]
  );
  const pagedOrders = useMemo(
    () => paginate(filteredOrders, orderPage, orderPageSize),
    [filteredOrders, orderPage]
  );

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = authMode === "login" ? "login" : "signup";
      const body = {
        email: authForm.email,
        password: authForm.password,
      };
      if (authMode === "signup") {
        body.name = authForm.name || "Admin";
        body.adminKey = authForm.adminKey;
      }
      const res = await apiFetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.user.role !== "admin" && data.user.role !== "superadmin") {
        throw new Error("Admin role required");
      }
      setAuth(data);
      localStorage.setItem("adminAuth", JSON.stringify(data));
      setAuthForm({ name: "", email: "superadmin@company.com", password: "SuperAdmin@123", adminKey: "" });
      setAuthModalOpen(false);
    } catch (err) {
      console.error(err);
      setError("Authentication failed. Check admin credentials.");
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem("adminAuth");
    setSummary(null);
    setSales(null);
  };

  const resetProductForm = () => {
    setProductForm({
      sku: "",
      title: "",
      description: "",
      price: "",
      sizes: "",
      category: "",
      quantity: "",
      color: "",
      status: "available",
    });
    setProductImage(null);
    setEditingProduct(null);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!auth?.token) {
      setAuthModalOpen(true);
      return;
    }
    setError("");
    try {
      const payload = new FormData();
      Object.entries(productForm).forEach(([key, value]) => payload.append(key, value));
      payload.append("clientCountry", clientMeta.country);
      payload.append("clientTimezone", clientMeta.timezone);
      payload.append("clientLocale", clientMeta.locale);
      if (clientMeta.lat) payload.append("clientLat", String(clientMeta.lat));
      if (clientMeta.lng) payload.append("clientLng", String(clientMeta.lng));
      if (productImage) payload.append("image", productImage);
      const url = editingProduct
        ? `${API_BASE}/api/products/${editingProduct._id}`
        : `${API_BASE}/api/products`;
      const res = await apiFetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: authHeader,
        body: payload,
      });
      const saved = await res.json();
      setProducts((prev) =>
        editingProduct ? prev.map((item) => (item._id === saved._id ? saved : item)) : [saved, ...prev]
      );
      resetProductForm();
      setActivePage("products");
    } catch (err) {
      console.error(err);
      setError("Could not save product. Check admin permissions.");
    }
  };

  const handleCustomerSubmit = async (e) => {
    e.preventDefault();
    if (!auth?.token) {
      setAuthModalOpen(true);
      return;
    }
    setError("");
    try {
      const url = editingCustomer
        ? `${API_BASE}/api/customers/${editingCustomer._id}`
        : `${API_BASE}/api/customers`;
      const res = await apiFetch(url, {
        method: editingCustomer ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ ...customerForm, clientMeta }),
      });
      const saved = await res.json();
      setCustomers((prev) =>
        editingCustomer ? prev.map((item) => (item._id === saved._id ? saved : item)) : [saved, ...prev]
      );
      setCustomerForm({
        name: "",
        email: "",
        phone: "",
        purchasesTotal: "",
        orderCount: "",
        address: "",
        avatarUrl: "",
      });
      setEditingCustomer(null);
      setActivePage("customers");
    } catch (err) {
      console.error(err);
      setError("Could not save customer. Check admin permissions.");
    }
  };

  const handleDelete = async (type, id) => {
    if (!auth?.token) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await apiFetch(`${API_BASE}/api/${type}/${id}`, { method: "DELETE", headers: authHeader });
      if (type === "products") setProducts((prev) => prev.filter((item) => item._id !== id));
      if (type === "customers") setCustomers((prev) => prev.filter((item) => item._id !== id));
      if (type === "orders") setOrders((prev) => prev.filter((item) => item._id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const handleImageUpload = async (file, onSuccess) => {
    if (!file) return;
    if (!auth?.token) {
      setAuthModalOpen(true);
      return;
    }
    try {
      const payload = new FormData();
      payload.append("image", file);
      const res = await apiFetch(`${API_BASE}/api/uploads`, {
        method: "POST",
        headers: authHeader,
        body: payload,
      });
      const data = await res.json();
      onSuccess(data.imageUrl);
    } catch (err) {
      console.error(err);
      setError("Image upload failed.");
    }
  };

  const persistProfile = async (nextProfile) => {
    if (!auth?.token) return;
    setError("");
    try {
      const res = await apiFetch(`${API_BASE}/api/admin/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify(nextProfile),
      });
    } catch (err) {
      console.error(err);
      setError("Failed to update profile.");
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!auth?.token) return;
    await persistProfile(profileForm);
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!auth?.token) return;
    setError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New password confirmation does not match.");
      return;
    }
    try {
      const res = await apiFetch(`${API_BASE}/api/admin/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      setError("Failed to update password.");
    }
  };

  const salesPath = buildLinePath(displaySales.values, 420, 180, 18);
  const secondaryPath = buildLinePath(
    displaySales.values.map((v) => Math.max(v - 8, 4)),
    420,
    180,
    18
  );

  const salesTarget = 500000;
  const salesProgress = Math.min(displaySummary.totalRevenue / salesTarget, 1);

  const renderDashboard = () => (
    <div className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
          <div className="flex items-center justify-between text-sm text-emerald-700">
            <span className="font-semibold">Sales Target</span>
            <span>In Progress</span>
          </div>
          <div className="mt-4 flex items-end justify-between text-sm text-emerald-800">
            <span className="text-lg font-semibold">{formatPrice(displaySummary.totalRevenue)}</span>
            <span>Sales Target {formatPrice(salesTarget)}</span>
          </div>
          <div className="mt-4 h-3 rounded-full bg-emerald-100">
            <div
              className="h-3 rounded-full bg-emerald-400"
              style={{ width: `${salesProgress * 100}%` }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-700">Your Sales this year</p>
              <p className="text-xs text-gray-500">Average sale value and item per sale</p>
            </div>
            <button className="text-xs font-semibold text-blue-600">Show All</button>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span>Average Sale Value</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span>Average item per sale</span>
            </div>
          </div>
          <div className="mt-4">
            <svg viewBox="0 0 420 180" className="h-48 w-full">
              <path d={secondaryPath} fill="none" stroke="#facc15" strokeWidth="3" strokeDasharray="6 6" />
              <path d={salesPath} fill="none" stroke="#3b82f6" strokeWidth="3" />
              <line x1="210" y1="0" x2="210" y2="180" stroke="#a3e635" strokeWidth="2" />
            </svg>
            <div className="mt-2 grid grid-cols-12 text-[10px] uppercase text-gray-400">
              {displaySales.labels.map((label) => (
                <span key={label} className="text-center">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
              <MetricCard
              title="Total Revenue"
              value={formatPrice(displaySummary.totalRevenue)}
              change="+10.6%"
              tone="primary"
            />
            <MetricCard
              title="Total Customer"
              value={formatCount(displaySummary.totalCustomers)}
              change="+1.5%"
              tone="light"
            />
            <MetricCard
              title="Total Transactions"
              value={formatCount(displaySummary.totalTransactions)}
              change="+3.6%"
              tone="light"
            />
            <MetricCard
              title="Total Product"
              value={formatCount(displaySummary.totalProducts)}
              change="-1.5%"
              tone="light"
            />
          </div>
        </section>

        <section className="rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-500 p-6 text-white shadow-lg">
          <h3 className="text-2xl font-semibold">Increase your sales</h3>
          <p className="mt-2 text-sm text-white/80">
            Discover the proven methods to accelerate growth and reach the next milestone.
          </p>
          <button className="mt-4 rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-blue-700">
            Learn More
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Product Popular</h4>
          <button className="text-xs font-semibold text-blue-600">Show All</button>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 4).map((product) => (
                <tr key={product._id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                        <img
                          src={buildImage(product.imageUrl || FALLBACK_PRODUCT_IMAGE)}
                          alt={product.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{product.title}</p>
                        <p className="text-[10px] text-gray-400">{product.sku || "SKU"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{formatPrice(product.price)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCount(product.quantity || 0)}</td>
                  <td className="px-4 py-3">
                    <StatusPill label={product.status === "out-of-stock" ? "Out of Stock" : "Success"} tone={product.status === "out-of-stock" ? "warning" : "success"} />
                  </td>
                </tr>
              ))}
              {!products.length && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan="4">
                    Add products to populate the dashboard.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Delivery Tracking</h4>
          <button className="text-xs font-semibold text-blue-600">Show All</button>
        </div>
        <div className="mt-4 rounded-xl border border-gray-100 p-4">
          {latestOrder ? (
            <>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Tracking Id</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-semibold text-blue-700">
                  {latestOrder.status || "Shipping"}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-gray-800">
                {latestOrder.trackingId || latestOrder.orderNumber}
              </p>
              <div className="mt-4 h-28 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50">
                <div className="h-full w-full rounded-xl border border-gray-200 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.2),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(16,185,129,0.2),transparent_60%)]" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <p className="text-[10px] uppercase">Departure</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {latestOrder.origin || "Unknown origin"}
                  </p>
                  <p>{latestOrder.createdAt ? new Date(latestOrder.createdAt).toLocaleString() : "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase">Destination</p>
                  <p className="text-sm font-semibold text-gray-700">
                    {latestOrder.destination || "Unknown destination"}
                  </p>
                  <p>{latestOrder.eta || "ETA pending"}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-full bg-blue-50 p-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white" />
                  <div>
                    <p className="text-xs text-gray-500">Courier</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {latestOrder.courierName || "Courier"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 text-blue-600">
                  <ActionButton icon={ICONS.mail} title="Message" />
                  <ActionButton icon={ICONS.bell} title="Call" />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-xs text-gray-500">
              No orders available for tracking yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">Customer Growth</h4>
          <button className="text-xs font-semibold text-blue-600">Show All</button>
        </div>
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          {customerRegionStats.length ? (
            <>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                {customerRegionStats.map((item, index) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className={classNames(
                        "h-2 w-2 rounded-full",
                        index === 0 ? "bg-rose-500" : index === 1 ? "bg-sky-500" : "bg-purple-500"
                      )}
                    />
                    {item.label} ({item.percent}%)
                  </div>
                ))}
              </div>
              <div className="mt-4 h-40 rounded-2xl bg-[radial-gradient(circle_at_20%_60%,rgba(244,63,94,0.25),transparent_40%),radial-gradient(circle_at_60%_40%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.25),transparent_40%)]" />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-xs text-gray-500">
              No customer region data yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );

  const renderProductList = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Product</h2>
          <p className="text-xs text-gray-500">Dashboard / Product / Sneakers</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            data-dropdown-trigger
            onClick={() => setActiveDropdown((prev) => (prev === "product-filter" ? "" : "product-filter"))}
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Filter
          </button>
          {activeDropdown === "product-filter" && (
            <div data-dropdown-menu className="absolute right-0 top-12 z-10 w-44 rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-lg">
              {["All", "available", "out-of-stock"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setProductStatusFilter(status);
                    setActiveDropdown("");
                  }}
                  className={classNames(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2",
                    productStatusFilter === status ? "bg-blue-50 text-blue-700" : "text-gray-600"
                  )}
                >
                  {status === "All" ? "All status" : status.replace("-", " ")}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              downloadCsv(
                "products.csv",
                filteredProducts.map((product) => ({
                  sku: product.sku,
                  title: product.title,
                  price: product.price,
                  category: product.category,
                  quantity: product.quantity,
                  status: product.status,
                }))
              )
            }
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Export
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              resetProductForm();
              setActivePage("add-product");
            }}
          >
            {ICONS.plus} New Product
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex flex-wrap gap-2">
          {productCategories.map((category) => (
            <button
              key={category}
              onClick={() => setProductCategory(category)}
              className={classNames(
                "rounded-full px-4 py-2 text-xs font-semibold",
                productCategory === category ? "bg-blue-100 text-blue-700" : "text-gray-500"
              )}
            >
              {category} ({products.filter((p) => (category === "All" ? true : p.category === category)).length})
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Total (incl GST)</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">QTY</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedProducts.map((product) => (
              <tr
                key={product._id}
                className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => setDetailView({ type: "product", data: product })}
              >
                <td className="px-4 py-3">
                  <input type="checkbox" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={buildImage(product.imageUrl || FALLBACK_PRODUCT_IMAGE)}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{product.sku || "SKU"}</p>
                      <p className="text-[11px] text-gray-500">{product.title}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{formatPrice(product.price)}</td>
                <td className="px-4 py-3 text-gray-700">{product.sizes?.[0] || "-"}</td>
                <td className="px-4 py-3 text-gray-700">{product.quantity || 0}</td>
                <td className="px-4 py-3 text-gray-500">
                  {product.createdAt ? new Date(product.createdAt).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill
                    label={product.status === "out-of-stock" ? "Out of Stock" : "Available"}
                    tone={product.status === "out-of-stock" ? "warning" : "success"}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ActionButton
                      icon={ICONS.eye}
                      title="View"
                      onClick={() => setDetailView({ type: "product", data: product })}
                    />
                    <ActionButton
                      icon={ICONS.edit}
                      title="Edit"
                      onClick={() => {
                        setEditingProduct(product);
                        setProductForm({
                          sku: product.sku || "",
                          title: product.title || "",
                          description: product.description || "",
                          price: product.price || "",
                          sizes: product.sizes?.join(",") || "",
                          category: product.category || "",
                          quantity: product.quantity || "",
                          color: product.color || "",
                          status: product.status || "available",
                        });
                        setActivePage("add-product");
                      }}
                    />
                    <ActionButton
                      icon={ICONS.trash}
                      title="Delete"
                      onClick={() => handleDelete("products", product._id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!filteredProducts.length && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan="8">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          Page {productPage} of {Math.max(1, Math.ceil(filteredProducts.length / productPageSize))}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setProductPage((p) => Math.max(p - 1, 1))}
            className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-600"
            disabled={productPage === 1}
          >
            Prev
          </button>
          <button
            onClick={() =>
              setProductPage((p) =>
                Math.min(p + 1, Math.max(1, Math.ceil(filteredProducts.length / productPageSize)))
              )
            }
            className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-600"
            disabled={productPage * productPageSize >= filteredProducts.length}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderAddProduct = () => (
    <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
      <form
        id="product-form"
        onSubmit={handleProductSubmit}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Product Information</h2>
            <p className="text-xs text-gray-500">Dashboard / Product / Add Product</p>
          </div>
          {editingProduct && <span className="text-xs text-blue-600">Editing</span>}
        </div>
        <div className="mt-6 space-y-4">
          <label className="text-xs font-semibold text-gray-600">
            SKU
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              value={productForm.sku}
              onChange={(e) => setProductForm((prev) => ({ ...prev, sku: e.target.value }))}
              placeholder="Input no SKU"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Product Name
            <input
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              value={productForm.title}
              onChange={(e) => setProductForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Input product name"
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-gray-600">
              Size
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                value={productForm.sizes}
                onChange={(e) => setProductForm((prev) => ({ ...prev, sizes: e.target.value }))}
                placeholder="S,M,L"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Color
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                value={productForm.color}
                onChange={(e) => setProductForm((prev) => ({ ...prev, color: e.target.value }))}
                placeholder="Black"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Product Category
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                value={productForm.category}
                onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Sneakers"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Price
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                value={productForm.price}
                onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
                placeholder="Input Price"
                required
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Quantity
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                value={productForm.quantity}
                onChange={(e) => setProductForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder="Input stock"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Status Product
              <select
                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                value={productForm.status}
                onChange={(e) => setProductForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="available">Available</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-semibold text-gray-600">
            Description
            <textarea
              rows="4"
              className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              value={productForm.description}
              onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Product description"
            />
          </label>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white"
            >
              {editingProduct ? "Update Product" : "Save Product"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetProductForm();
                setActivePage("products");
              }}
              className="rounded-full border border-gray-200 px-5 py-2 text-xs font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Image Product</h3>
            <p className="text-xs text-gray-500">Format SVG, PNG, JPG (max 4mb)</p>
          </div>
          <button type="submit" form="product-form" className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
            Save Product
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((index) => (
            <label key={index} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-blue-200 text-xs text-blue-500">
              <input
                type="file"
                className="hidden"
                onChange={(e) => setProductImage(e.target.files?.[0] || null)}
              />
              <span className="rounded-lg bg-blue-50 p-2">{ICONS.plus}</span>
              <span>Photo {index + 1}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
          <img
            src={productImage ? URL.createObjectURL(productImage) : FALLBACK_PRODUCT_IMAGE}
            alt="Preview"
            className="h-40 w-full object-cover"
          />
        </div>
      </div>
    </div>
  );

  const renderCustomers = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer</h2>
          <p className="text-xs text-gray-500">Dashboard / Customer</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            data-dropdown-trigger
            onClick={() => setActiveDropdown((prev) => (prev === "customer-filter" ? "" : "customer-filter"))}
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Filter
          </button>
          {activeDropdown === "customer-filter" && (
            <div data-dropdown-menu className="absolute right-0 top-12 z-10 w-44 rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-lg">
              {["All", "active", "inactive"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setCustomerStatusFilter(status);
                    setActiveDropdown("");
                  }}
                  className={classNames(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2",
                    customerStatusFilter === status ? "bg-blue-50 text-blue-700" : "text-gray-600"
                  )}
                >
                  {status === "All" ? "All status" : status}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              downloadCsv(
                "customers.csv",
                filteredCustomers.map((customer) => ({
                  name: customer.name,
                  email: customer.email,
                  phone: customer.phone,
                  purchasesTotal: customer.purchasesTotal,
                  orderCount: customer.orderCount,
                  address: customer.address,
                  status: customer.status,
                }))
              )
            }
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Export
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            onClick={() => {
              setEditingCustomer(null);
              setCustomerForm({
                name: "",
                email: "",
                phone: "",
                purchasesTotal: "",
                orderCount: "",
                address: "",
                avatarUrl: "",
              });
              setActivePage("add-customer");
            }}
          >
            {ICONS.plus} Add Customer
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex flex-wrap gap-2">
          {["All", ...AU_STATES].map((state) => (
            <button
              key={state}
              onClick={() => setStateFilter(state)}
              className={classNames(
                "rounded-full px-4 py-2 text-xs font-semibold",
                stateFilter === state ? "bg-blue-100 text-blue-700" : "text-gray-500"
              )}
            >
              {state} (
              {state === "All"
                ? customers.length
                : customers.filter((customer) => extractState(customer.address).toUpperCase() === state).length}
              )
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3 font-medium">Name Customer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Purchases</th>
              <th className="px-4 py-3 font-medium">Order QTY</th>
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedCustomers.map((customer) => (
              <tr
                key={customer._id}
                className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => setDetailView({ type: "customer", data: customer })}
              >
                <td className="px-4 py-3">
                  <input type="checkbox" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={buildImage(customer.avatarUrl || FALLBACK_ADMIN_AVATAR)}
                        alt={customer.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{customer.name}</p>
                      <p className="text-[11px] text-blue-600">ID{customer._id.slice(-4)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <div>{customer.email || "-"}</div>
                  <div>{customer.phone || "-"}</div>
                </td>
                <td className="px-4 py-3 text-gray-700">{formatPrice(customer.purchasesTotal || 0)}</td>
                <td className="px-4 py-3 text-gray-500">{customer.orderCount || 0} Order</td>
                <td className="px-4 py-3 text-gray-500">{customer.address || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ActionButton
                      icon={ICONS.eye}
                      title="View"
                      onClick={() => setDetailView({ type: "customer", data: customer })}
                    />
                    <ActionButton
                      icon={ICONS.edit}
                      title="Edit"
                      onClick={() => {
                        setEditingCustomer(customer);
                        setCustomerForm({
                          name: customer.name || "",
                          email: customer.email || "",
                          phone: customer.phone || "",
                          purchasesTotal: customer.purchasesTotal || "",
                          orderCount: customer.orderCount || "",
                          address: customer.address || "",
                          avatarUrl: customer.avatarUrl || "",
                        });
                        setActivePage("add-customer");
                      }}
                    />
                    <ActionButton
                      icon={ICONS.trash}
                      title="Delete"
                      onClick={() => handleDelete("customers", customer._id)}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {!filteredCustomers.length && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan="7">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          Page {customerPage} of {Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize))}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setCustomerPage((p) => Math.max(p - 1, 1))}
            className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-600"
            disabled={customerPage === 1}
          >
            Prev
          </button>
          <button
            onClick={() =>
              setCustomerPage((p) =>
                Math.min(p + 1, Math.max(1, Math.ceil(filteredCustomers.length / customerPageSize)))
              )
            }
            className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-600"
            disabled={customerPage * customerPageSize >= filteredCustomers.length}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderAddCustomer = () => (
    <form onSubmit={handleCustomerSubmit} className="max-w-2xl rounded-2xl border border-blue-100 bg-blue-50/40 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Customer</h2>
          <p className="text-xs text-gray-500">Dashboard / Customer / Add Customer</p>
        </div>
        {editingCustomer && <span className="text-xs text-blue-600">Editing</span>}
      </div>
      <div className="mt-6 space-y-4">
        <label className="text-xs font-semibold text-gray-600">
          Name Customer
          <input
            className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
            value={customerForm.name}
            onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Input name"
            required
          />
        </label>
        <label className="text-xs font-semibold text-gray-600">
          Customer Photo
          <div className="mt-2 flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-xl bg-gray-100">
              <img
                src={buildImage(customerForm.avatarUrl || FALLBACK_ADMIN_AVATAR)}
                alt="Customer"
                className="h-full w-full object-cover"
              />
            </div>
            <label className="cursor-pointer rounded-full border border-blue-100 px-4 py-2 text-xs font-semibold text-gray-600">
              Upload Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleImageUpload(e.target.files?.[0], (url) =>
                    setCustomerForm((prev) => ({ ...prev, avatarUrl: url }))
                  )
                }
              />
            </label>
          </div>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-gray-600">
            Email
            <input
              type="email"
              className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
              value={customerForm.email}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Input email"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            No Handphone
            <input
              className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
              value={customerForm.phone}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Input no handphone"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Purchases
            <input
              type="number"
              className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
              value={customerForm.purchasesTotal}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, purchasesTotal: e.target.value }))}
              placeholder="Total Purchases"
            />
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Order Quantity
            <input
              type="number"
              className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
              value={customerForm.orderCount}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, orderCount: e.target.value }))}
              placeholder="Order Quantity"
            />
          </label>
        </div>
        <label className="text-xs font-semibold text-gray-600">
          Address
          <textarea
            rows="3"
            className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
            value={customerForm.address}
            onChange={(e) => setCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="Input address"
          />
        </label>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <button type="submit" className="w-full rounded-full bg-blue-600 px-6 py-2 text-xs font-semibold text-white">
          {editingCustomer ? "Update Customer" : "Save Customer"}
        </button>
      </div>
    </form>
  );

  const renderOrders = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Orders</h2>
          <p className="text-xs text-gray-500">Dashboard / Orders / All Orders</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            data-dropdown-trigger
            onClick={() => setActiveDropdown((prev) => (prev === "order-filter" ? "" : "order-filter"))}
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Filter
          </button>
          {activeDropdown === "order-filter" && (
            <div data-dropdown-menu className="absolute right-0 top-12 z-10 w-44 rounded-xl border border-gray-200 bg-white p-2 text-xs shadow-lg">
              {["All", "Paid", "Unpaid"].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setPaymentFilter(status);
                    setActiveDropdown("");
                  }}
                  className={classNames(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2",
                    paymentFilter === status ? "bg-blue-50 text-blue-700" : "text-gray-600"
                  )}
                >
                  {status === "All" ? "All payments" : status}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              downloadCsv(
                "orders.csv",
                filteredOrders.map((order) => ({
                  orderNumber: order.orderNumber,
                  customerName: order.customerName,
                  total: order.total,
                  paymentStatus: order.paymentStatus,
                  status: order.status,
                  createdAt: order.createdAt,
                }))
              )
            }
            className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
          >
            Export
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
            onClick={() => setOrderFormOpen((prev) => !prev)}
          >
            {ICONS.plus} New Order
          </button>
        </div>
      </div>
      {orderFormOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!auth?.token) {
              setAuthModalOpen(true);
              return;
            }
            const payload = {
              orderNumber: orderForm.orderNumber,
              customerName: orderForm.customerName,
              customerEmail: orderForm.customerEmail,
              items: [
                {
                  title: orderForm.itemTitle,
                  price: Number(orderForm.itemPrice || 0),
                  qty: Number(orderForm.itemQty || 1),
                  imageUrl: orderForm.itemImageUrl,
                },
              ],
              total: Number(orderForm.total || 0),
              paymentStatus: orderForm.paymentStatus,
              status: orderForm.status,
              trackingId: orderForm.trackingId,
              origin: orderForm.origin,
              destination: orderForm.destination,
              courierName: orderForm.courierName,
              eta: orderForm.eta,
              clientMeta,
            };
            apiFetch(`${API_BASE}/api/orders`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeader },
              body: JSON.stringify(payload),
            })
              .then((res) => res.json())
              .then((saved) => {
                setOrders((prev) => [saved, ...prev]);
                setOrderForm({
                  orderNumber: "",
                  customerName: "",
                  customerEmail: "",
                  itemTitle: "",
                  itemPrice: "",
                  itemQty: "1",
                  itemImageUrl: "",
                  total: "",
                  paymentStatus: "Paid",
                  status: "Shipping",
                  trackingId: "",
                  origin: "",
                  destination: "",
                  courierName: "",
                  eta: "",
                });
                setOrderFormOpen(false);
              })
                .catch((err) => {
                  console.error(err);
                  setError("Failed to create order.");
                });
          }}
          className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Add Order</h3>
            <button
              type="button"
              onClick={() => setOrderFormOpen(false)}
              className="text-xs font-semibold text-gray-400"
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-gray-600">
              Order Number
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.orderNumber}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, orderNumber: e.target.value }))}
                placeholder="AU-ORD-100999"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Customer Name
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.customerName}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, customerName: e.target.value }))}
                placeholder="Customer"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Customer Email
              <input
                type="email"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.customerEmail}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
                placeholder="customer@email.com"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Item Title
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.itemTitle}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, itemTitle: e.target.value }))}
                placeholder="Product name"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Item Price
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.itemPrice}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, itemPrice: e.target.value }))}
                placeholder="89"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Item Qty
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.itemQty}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, itemQty: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Order Total
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.total}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, total: e.target.value }))}
                placeholder="Total (ex GST)"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Payment Status
              <select
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.paymentStatus}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
              >
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Status
              <select
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.status}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="Shipping">Shipping</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Tracking ID
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.trackingId}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, trackingId: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Origin
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.origin}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, origin: e.target.value }))}
                placeholder="Sydney, NSW"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Destination
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.destination}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, destination: e.target.value }))}
                placeholder="Melbourne, VIC"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Courier Name
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.courierName}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, courierName: e.target.value }))}
                placeholder="Australia Post"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              ETA
              <input
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={orderForm.eta}
                onChange={(e) => setOrderForm((prev) => ({ ...prev, eta: e.target.value }))}
                placeholder="20/01/2025 - 3:30 p.m."
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-xl bg-gray-100">
              <img
                src={buildImage(orderForm.itemImageUrl || FALLBACK_PRODUCT_IMAGE)}
                alt="Item"
                className="h-full w-full object-cover"
              />
            </div>
            <label className="cursor-pointer rounded-full border border-blue-100 px-4 py-2 text-xs font-semibold text-gray-600">
              Upload Item Image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleImageUpload(e.target.files?.[0], (url) =>
                    setOrderForm((prev) => ({ ...prev, itemImageUrl: url }))
                  )
                }
              />
            </label>
          </div>
          {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button type="submit" className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white">
              Save Order
            </button>
            <button
              type="button"
              onClick={() => setOrderFormOpen(false)}
              className="rounded-full border border-blue-100 px-5 py-2 text-xs font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3">
        <div className="flex flex-wrap gap-2">
          {["All", "Shipping", "Completed", "Cancelled"].map((label) => (
            <button
              key={label}
              onClick={() => setOrderFilter(label)}
              className={classNames(
                "rounded-full px-4 py-2 text-xs font-semibold",
                orderFilter === label ? "bg-blue-100 text-blue-700" : "text-gray-500"
              )}
            >
              {label} ({label === "All" ? orders.length : orders.filter((o) => o.status === label).length})
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3"></th>
              <th className="px-4 py-3 font-medium">Orders</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {pagedOrders.map((order) => (
              <tr
                key={order._id}
                className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                onClick={() => setDetailView({ type: "order", data: order })}
              >
                <td className="px-4 py-3">
                  <input type="checkbox" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                      <img
                        src={buildImage(order.items?.[0]?.imageUrl || FALLBACK_PRODUCT_IMAGE)}
                        alt={order.items?.[0]?.title || "Product"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{order.orderNumber}</p>
                      <p className="text-[11px] text-gray-500">{order.items?.[0]?.title || "Product"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{order.customerName}</td>
                <td className="px-4 py-3 text-gray-700">
                  <div className="font-semibold">{formatPrice(getTotalWithGst(order.total))}</div>
                  <div className="text-[10px] text-gray-400">Subtotal {formatPrice(order.total)}</div>
                  <div className="text-[10px] text-gray-400">GST 10% {formatPrice(getGstAmount(order.total))}</div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusPill label={order.paymentStatus} tone={order.paymentStatus === "Paid" ? "success" : "warning"} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill
                    label={order.status}
                    tone={order.status === "Cancelled" ? "danger" : order.status === "Completed" ? "success" : "info"}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ActionButton
                      icon={ICONS.eye}
                      title="View"
                      onClick={() => setDetailView({ type: "order", data: order })}
                    />
                    <ActionButton icon={ICONS.edit} title="Edit" />
                    <ActionButton icon={ICONS.trash} title="Delete" onClick={() => handleDelete("orders", order._id)} />
                  </div>
                </td>
              </tr>
            ))}
            {!filteredOrders.length && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-400" colSpan="8">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          Page {orderPage} of {Math.max(1, Math.ceil(filteredOrders.length / orderPageSize))}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setOrderPage((p) => Math.max(p - 1, 1))}
            className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-600"
            disabled={orderPage === 1}
          >
            Prev
          </button>
          <button
            onClick={() =>
              setOrderPage((p) =>
                Math.min(p + 1, Math.max(1, Math.ceil(filteredOrders.length / orderPageSize)))
              )
            }
            className="rounded-full border border-gray-200 px-3 py-1 font-semibold text-gray-600"
            disabled={orderPage * orderPageSize >= filteredOrders.length}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  const renderAccount = () => (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Account & Settings</h2>
        <p className="text-xs text-gray-500">Dashboard / Profile</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 rounded-full border border-gray-100 bg-gray-50 p-2 text-xs">
        {["account", "security", "notification"].map((tab) => (
          <button
            key={tab}
            onClick={() => setAccountTab(tab)}
            className={classNames(
              "flex-1 rounded-full px-4 py-2 font-semibold",
              accountTab === tab ? "bg-blue-100 text-blue-700" : "text-gray-500"
            )}
          >
            {tab === "account" ? "Account" : tab === "security" ? "Security" : "Notification"}
          </button>
        ))}
      </div>

      {accountTab === "account" && (
        <form onSubmit={handleProfileUpdate} className="mt-6 space-y-6">
          {!auth?.token && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              Sign in to update your profile settings.
            </div>
          )}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
          <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl bg-gray-200">
                <img src={buildImage(adminAvatar)} alt="Profile" className="h-full w-full object-cover" />
              </div>
              <label className="cursor-pointer rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600">
                Change Picture
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleImageUpload(e.target.files?.[0], (url) => {
                      const next = { ...profileForm, avatarUrl: url };
                      setProfileForm(next);
                      persistProfile(next);
                    })
                  }
                />
              </label>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-gray-600">
                First Name
                <input
                  className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="First name"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Last Name
                <input
                  className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Last name"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Email
                <input
                  type="email"
                  className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="abc@gmail.com"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Gender
                <input
                  className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                  value={profileForm.gender}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, gender: e.target.value }))}
                  placeholder="Female"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Date Birthday
                <input
                  className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                  value={profileForm.birthDate}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  placeholder="23 December 2003"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                type="submit"
                disabled={!auth?.token}
                className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                Update
              </button>
              <button type="button" className="text-xs font-semibold text-blue-600">Cancel</button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Contact Detail</h3>
              <button type="button" className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">Edit</button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold text-gray-600">
                Phone Number
                <input
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 847 123 1123"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Country
                <input
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  value={profileForm.country}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, country: e.target.value }))}
                  placeholder="India"
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Address
                <input
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="abc, road"
                />
              </label>
            </div>
          </div>
        </form>
      )}

      {accountTab === "security" && (
        <form onSubmit={handlePasswordUpdate} className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/40 p-6">
          <h3 className="text-lg font-semibold text-gray-800">Password</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className="text-xs font-semibold text-gray-600">
              Old Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={passwordForm.oldPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              New Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              />
            </label>
            <label className="text-xs font-semibold text-gray-600">
              Confirm Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-blue-100 px-4 py-3 text-sm"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              />
            </label>
          </div>
          <div className="mt-3 space-y-2 text-xs text-gray-500">
            <p>Minimum 8 characters.</p>
            <p>Use combination of uppercase and lowercase letters.</p>
            <p>Use special characters (e.g. !, @, #, $). </p>
          </div>
          {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={!auth?.token}
              className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              Update Password
            </button>
            <button type="button" className="text-xs font-semibold text-blue-600">Cancel</button>
          </div>
        </form>
      )}

      {accountTab === "notification" && (
        <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500">
          Notification preferences will live here.
        </div>
      )}
    </div>
  );

  const renderSalesReport = () => (
    <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sales Report</h2>
            <p className="text-xs text-gray-500">Last 12 months overview</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
            {orders.length} Orders
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {displaySales.labels.map((label, index) => (
            <button
              key={label}
              onClick={() => setSalesMonthIndex(index)}
              className={classNames(
                "rounded-full px-3 py-1 text-[10px] font-semibold uppercase",
                salesMonthIndex === index ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <svg viewBox="0 0 420 180" className="h-48 w-full">
            <path d={secondaryPath} fill="none" stroke="#eab308" strokeWidth="3" strokeDasharray="6 6" />
            <path d={salesPath} fill="none" stroke="#3b82f6" strokeWidth="3" />
          </svg>
          <div className="mt-2 grid grid-cols-12 text-[10px] uppercase text-gray-400">
            {displaySales.labels.map((label) => (
              <span key={label} className="text-center">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <MetricCard
          title="Total Revenue"
          value={formatPrice(displaySummary.totalRevenue)}
          change="+10.6%"
          tone="primary"
        />
        <MetricCard
          title="Total Transactions"
          value={formatCount(displaySummary.totalTransactions)}
          change="+3.6%"
          tone="light"
        />
        <MetricCard
          title="Total Customers"
          value={formatCount(displaySummary.totalCustomers)}
          change="+1.5%"
          tone="light"
        />
        <div className="rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-600 shadow-sm">
          <p className="text-sm font-semibold text-gray-800">
            {salesMonths[salesMonthIndex]?.label || "Month"} Highlights
          </p>
          <div className="mt-3 grid gap-2">
            <div className="flex items-center justify-between">
              <span>Orders</span>
              <span className="font-semibold">
                {ordersByMonth[salesMonthIndex]?.orders.length || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Paid Revenue (incl GST)</span>
              <span className="font-semibold">
                {formatPrice(
                  (ordersByMonth[salesMonthIndex]?.orders || [])
                    .filter((order) => order.paymentStatus === "Paid")
                    .reduce((sum, order) => sum + getTotalWithGst(order.total || 0), 0)
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unpaid Orders</span>
              <span className="font-semibold">
                {(ordersByMonth[salesMonthIndex]?.orders || []).filter(
                  (order) => order.paymentStatus === "Unpaid"
                ).length}
              </span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[10px] uppercase text-gray-400">Recent Orders</p>
            <div className="mt-2 space-y-2">
              {(ordersByMonth[salesMonthIndex]?.orders || [])
                .slice(0, 3)
                .map((order) => (
                  <div key={order._id} className="flex items-center justify-between">
                    <span className="text-gray-500">{order.orderNumber}</span>
                    <span className="font-semibold">{formatPrice(getTotalWithGst(order.total || 0))}</span>
                  </div>
                ))}
              {(!ordersByMonth[salesMonthIndex]?.orders ||
                ordersByMonth[salesMonthIndex].orders.length === 0) && (
                <p className="text-gray-400">No orders in this month.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderErrorLog = () => (
    <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-rose-700">Backend Error Log</h3>
        <div className="flex items-center gap-3 text-xs text-rose-600">
          <span>
            {errorTotal} total • Page {errorPage}
          </span>
          <button onClick={() => setErrorLog([])} className="font-semibold">
            Clear Local
          </button>
        </div>
      </div>
      {!auth?.token && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-white/70 p-6 text-sm text-rose-600">
          Sign in to load stored error logs.
        </div>
      )}
      {auth?.token && serverErrorLog.length === 0 && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-white/70 p-6 text-sm text-rose-600">
          No backend errors yet.
        </div>
      )}
      {auth?.token && serverErrorLog.length > 0 && (
        <div className="mt-4 space-y-2 text-xs text-rose-700">
          {serverErrorLog.map((entry) => (
            <div key={entry._id} className="rounded-lg bg-white/70 p-2">
              <span className="font-semibold">
                {entry.createdAt
                  ? new Date(entry.createdAt).toLocaleTimeString([], {
                      timeZone: entry.timezone || undefined,
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "-"}
              </span>{" "}
              — {entry.message}
              {entry.endpoint ? (
                <div className="text-[10px] text-rose-500">
                  {entry.method} {entry.endpoint}
                </div>
              ) : null}
              {entry.country || entry.timezone ? (
                <div className="text-[10px] text-rose-500">
                  {entry.country || ""} {entry.timezone || ""}
                </div>
              ) : null}
            </div>
          ))}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => setErrorPage((p) => Math.max(p - 1, 1))}
              className="rounded-full border border-rose-200 px-3 py-1 text-[10px] font-semibold text-rose-600"
              disabled={errorPage === 1}
            >
              Prev
            </button>
            <button
              onClick={() => setErrorPage((p) => p + 1)}
              className="rounded-full border border-rose-200 px-3 py-1 text-[10px] font-semibold text-rose-600"
              disabled={errorPage * errorLimit >= errorTotal}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderDetailModal = () => {
    if (!detailView.data) return null;
    const { type, data } = detailView;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {type === "product" ? "Product Details" : type === "customer" ? "Customer Details" : "Order Details"}
            </h3>
            <button onClick={() => setDetailView({ type: "", data: null })} className="text-gray-400">
              x
            </button>
          </div>
          <div className="mt-4 space-y-3 text-sm text-gray-600">
            {type === "product" && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-gray-100">
                    <img
                      src={buildImage(data.imageUrl || FALLBACK_PRODUCT_IMAGE)}
                      alt={data.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{data.title}</p>
                    <p className="text-xs text-gray-400">{data.sku || "SKU"}</p>
                  </div>
                </div>
                <p>{data.description || "No description"}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Price: {formatPrice(data.price)}</div>
                  <div>Quantity: {data.quantity || 0}</div>
                  <div>Category: {data.category || "-"}</div>
                  <div>Status: {data.status || "-"}</div>
                </div>
              </>
            )}
            {type === "customer" && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-gray-100">
                    <img
                      src={buildImage(data.avatarUrl || FALLBACK_ADMIN_AVATAR)}
                      alt={data.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{data.name}</p>
                    <p className="text-xs text-gray-400">{data.email || "-"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Phone: {data.phone || "-"}</div>
                  <div>Status: {data.status || "-"}</div>
                  <div>Orders: {data.orderCount || 0}</div>
                  <div>Purchases: {formatPrice(data.purchasesTotal || 0)}</div>
                </div>
                <p className="text-xs">Address: {data.address || "-"}</p>
              </>
            )}
            {type === "order" && (
              <>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 overflow-hidden rounded-xl bg-gray-100">
                    <img
                      src={buildImage(data.items?.[0]?.imageUrl || FALLBACK_PRODUCT_IMAGE)}
                      alt={data.items?.[0]?.title || "Product"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{data.orderNumber}</p>
                    <p className="text-xs text-gray-400">{data.customerName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Status: {data.status}</div>
                  <div>Payment: {data.paymentStatus}</div>
                  <div>Total: {formatPrice(getTotalWithGst(data.total || 0))}</div>
                  <div>Tracking: {data.trackingId || "-"}</div>
                </div>
                <p className="text-xs">Origin: {data.origin || "-"}</p>
                <p className="text-xs">Destination: {data.destination || "-"}</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-gray-900">
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={classNames(
            "fixed left-0 top-0 z-50 flex h-full flex-col border-r border-gray-200 bg-white px-5 py-6 transition-transform lg:fixed lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "w-64",
            "lg:flex"
          )}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-200">
              <img src={buildImage(companyLogo)} alt="Company logo" className="h-full w-full object-cover" />
            </div>
            <>
              <div className="flex-1">
                <p className="text-xs text-gray-400">Company</p>
                <p className="text-sm font-semibold text-gray-800">{BRAND_NAME}</p>
              </div>
              <label className="cursor-pointer rounded-full border border-gray-200 px-3 py-1 text-[10px] font-semibold text-gray-500">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    handleImageUpload(e.target.files?.[0], (url) => {
                      const next = { ...profileForm, companyLogoUrl: url };
                      setProfileForm(next);
                      persistProfile(next);
                    })
                  }
                />
              </label>
            </>
          </div>
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">General</p>
            <div className="mt-3 space-y-2">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={classNames(
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                    activePage === item.id ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  <span className="flex items-center gap-3">
                    {ICONS[item.icon]}
                    {item.label}
                  </span>
                  {item.countKey && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                      {item.countKey === "products"
                        ? products.length
                        : item.countKey === "orders"
                        ? orders.length
                        : customers.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Tools</p>
            <div className="mt-3 space-y-2">
              {TOOL_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActivePage(item.id);
                    setSidebarOpen(false);
                  }}
                  className={classNames(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium",
                    activePage === item.id ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
                  )}
                >
                  {ICONS[item.icon]}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-auto rounded-2xl border border-gray-100 p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-lg bg-gray-200">
                <img src={buildImage(adminAvatar)} alt="Admin avatar" className="h-full w-full object-cover" />
              </div>
              <>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{auth?.user?.name || "Admin Name"}</p>
                  <p className="text-xs text-gray-400">{auth?.user?.role || "Admin"}</p>
                </div>
                {ICONS.chevron}
              </>
            </div>
          </div>
        </aside>

        <main className={classNames("flex-1", "lg:pl-64")}>
          <header
            className={classNames(
              "fixed top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur",
              "lg:left-64",
              "left-0 right-0"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="rounded-xl border border-gray-200 p-2 lg:hidden"
                >
                  {ICONS.chevron}
                </button>
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product"
                    className="w-60 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 pl-10 text-sm"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{ICONS.search}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    data-dropdown-trigger
                    onClick={() => setActiveDropdown((prev) => (prev === "messages" ? "" : "messages"))}
                    className="relative rounded-xl border border-gray-200 p-2 text-gray-500"
                  >
                  {ICONS.mail}
                  {messageCount > 0 && (
                    <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-semibold text-white">
                      {messageCount}
                    </span>
                  )}
                  </button>
                  {activeDropdown === "messages" && (
                    <div data-dropdown-menu className="absolute right-0 top-12 z-20 w-60 rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
                      <p className="mb-2 font-semibold text-gray-700">New Messages</p>
                      {customers.slice(0, 3).map((customer) => (
                        <div key={customer._id} className="rounded-lg px-2 py-2 hover:bg-gray-50">
                          <p className="font-semibold text-gray-700">{customer.name}</p>
                          <p className="text-[10px] text-gray-400">New customer inquiry</p>
                        </div>
                      ))}
                      {!customers.length && (
                        <p className="text-[10px] text-gray-400">No messages yet.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    data-dropdown-trigger
                    onClick={() => setActiveDropdown((prev) => (prev === "notifications" ? "" : "notifications"))}
                    className="relative rounded-xl border border-gray-200 p-2 text-gray-500"
                  >
                  {ICONS.bell}
                  {notificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-rose-500 text-[10px] font-semibold text-white">
                      {notificationCount}
                    </span>
                  )}
                  </button>
                  {activeDropdown === "notifications" && (
                    <div data-dropdown-menu className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-gray-200 bg-white p-3 text-xs shadow-lg">
                      <p className="mb-2 font-semibold text-gray-700">Notifications</p>
                      {orders.slice(0, 3).map((order) => (
                        <div key={order._id} className="rounded-lg px-2 py-2 hover:bg-gray-50">
                          <p className="font-semibold text-gray-700">{order.orderNumber}</p>
                          <p className="text-[10px] text-gray-400">{order.status} • {order.customerName}</p>
                        </div>
                      ))}
                      {!orders.length && (
                        <p className="text-[10px] text-gray-400">No notifications yet.</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-lg bg-gray-200">
                    {adminAvatar ? (
                      <img src={buildImage(adminAvatar)} alt="Admin avatar" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{auth?.user?.name || "Admin"}</p>
                    <p className="text-xs text-gray-400">{auth?.user?.role || "Admin"}</p>
                  </div>
                </div>
                {auth ? (
                  <button
                    onClick={logout}
                    className="rounded-full border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600"
                  >
                    Logout
                  </button>
                ) : (
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </header>

          <div className="px-6 pb-6 pt-24">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">
                {activePage === "dashboard"
                  ? "Dashboard"
                  : activePage === "products"
                  ? "Product"
                  : activePage === "add-product"
                  ? "Product"
                  : activePage === "customers"
                  ? "Customer"
                  : activePage === "add-customer"
                  ? "Customer"
                  : activePage === "orders"
                  ? "Orders"
                  : activePage === "account"
                  ? "Account & Settings"
                  : activePage === "error-log"
                  ? "Error Log"
                  : "Sales Report"}
              </h1>
              <p className="text-xs text-gray-400">Dashboard</p>
            </div>

            {loading && <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading admin data...</div>}
            {!loading && (
              <>
                {activePage === "dashboard" && renderDashboard()}
                {activePage === "products" && renderProductList()}
                {activePage === "add-product" && renderAddProduct()}
                {activePage === "customers" && renderCustomers()}
                {activePage === "add-customer" && renderAddCustomer()}
                {activePage === "orders" && renderOrders()}
                {activePage === "account" && renderAccount()}
                {activePage === "sales" && renderSalesReport()}
                {activePage === "error-log" && renderErrorLog()}
              </>
            )}
          </div>
        </main>
      </div>

      {renderDetailModal()}

      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-gray-100">
                    <img src={buildImage(companyLogo)} alt="Company logo" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Company</p>
                    <p className="text-sm font-semibold text-gray-900">{BRAND_NAME}</p>
                  </div>
                </div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Admin Access</p>
                <h3 className="text-lg font-semibold text-gray-900">Login or create admin account</h3>
              </div>
              <button onClick={() => setAuthModalOpen(false)} className="text-gray-400">x</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3">
              {authMode === "signup" && (
                <label className="text-xs font-semibold text-gray-600">
                  Full name
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                    value={authForm.name}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </label>
              )}
              <label className="text-xs font-semibold text-gray-600">
                Email
                <input
                  type="email"
                  className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Password
                <div className="relative mt-2">
                  <input
                    type={showAuthPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm"
                    value={authForm.password}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
                    aria-label={showAuthPassword ? "Hide password" : "Show password"}
                  >
                    {ICONS.eye}
                  </button>
                </div>
              </label>
              {authMode === "signup" && (
                <label className="text-xs font-semibold text-gray-600">
                  Admin / Super Admin key
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                    value={authForm.adminKey}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, adminKey: e.target.value }))}
                    required
                    placeholder="Enter ADMIN_KEY or SUPER_ADMIN_KEY"
                  />
                </label>
              )}
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" className="rounded-full bg-blue-600 px-5 py-2 text-xs font-semibold text-white">
                  {authMode === "login" ? "Login" : "Create admin"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((mode) => (mode === "login" ? "signup" : "login"))}
                  className="rounded-full border border-gray-200 px-5 py-2 text-xs font-semibold text-gray-600"
                >
                  {authMode === "login" ? "Need an admin account?" : "Have an admin account?"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
