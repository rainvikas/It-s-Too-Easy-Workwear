import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const BRAND_NAME = "It's Too Easy Workwear";
const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'><rect width='240' height='240' fill='%23eceff4'/><rect x='52' y='56' width='136' height='126' rx='18' fill='%23cfd8e6'/></svg>";

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "shop", label: "Products" },
  { id: "cart", label: "Cart & Checkout" },
  { id: "orders", label: "Orders" },
  { id: "reviews", label: "Reviews" },
  { id: "support", label: "Chat Support" },
  { id: "account", label: "Account" },
];

const price = (value) => `$${Number(value || 0).toFixed(2)}`;
const dateTime = (value) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
};
const imageUrl = (url) => {
  if (!url) return FALLBACK_IMAGE;
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_BASE}${url}`;
};
const cx = (...values) => values.filter(Boolean).join(" ");
const arraysEqual = (left = [], right = []) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const ORDER_TIMELINE_STEPS = ["Placed", "Processing", "Shipped", "Delivered"];
const getOrderTimelineState = (statusValue) => {
  const raw = String(statusValue || "").toLowerCase();
  const includesAny = (tokens) => tokens.some((token) => raw.includes(token));

  if (includesAny(["cancel"])) return { stage: 0, cancelled: true, returned: false };
  if (includesAny(["return"])) return { stage: 3, cancelled: false, returned: true };
  if (includesAny(["completed", "delivered", "fulfilled"])) return { stage: 3, cancelled: false, returned: false };
  if (includesAny(["shipped", "dispatch", "in transit", "out for delivery"])) return { stage: 2, cancelled: false, returned: false };
  if (includesAny(["processing", "packed", "confirmed", "ready to ship"])) return { stage: 1, cancelled: false, returned: false };
  return { stage: 0, cancelled: false, returned: false };
};

const jsonFetch = async (url, options = {}) => {
  const res = await fetch(url, options);
  const asJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = asJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = typeof body === "object" && body?.message ? body.message : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
};

function App() {
  const [activePage, setActivePage] = useState("home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("newest");

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [wishlist, setWishlist] = useState(() => {
    try {
      const saved = localStorage.getItem("userWishlist");
      const parsed = JSON.parse(saved || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      const saved = localStorage.getItem("userRecentlyViewed");
      const parsed = JSON.parse(saved || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [wishlistMeta, setWishlistMeta] = useState(() => {
    try {
      const saved = localStorage.getItem("userWishlistMeta");
      const parsed = JSON.parse(saved || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("userCart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [checkout, setCheckout] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    cityState: "",
    postcode: "",
    paymentMethod: "cash",
    notes: "",
  });
  const [paymentConfig, setPaymentConfig] = useState({
    cardEnabled: false,
    defaultMethod: "cash",
  });
  const [checkoutState, setCheckoutState] = useState({ loading: false, message: "" });

  const [ordersEmail, setOrdersEmail] = useState("");
  const [orders, setOrders] = useState([]);
  const [ordersState, setOrdersState] = useState({ loading: false, message: "" });
  const [myOrdersLoaded, setMyOrdersLoaded] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewForm, setReviewForm] = useState({
    productId: "",
    customerName: "",
    customerEmail: "",
    customerLocation: "",
    rating: "5",
    reviewText: "",
  });
  const [reviewState, setReviewState] = useState({ loading: false, message: "" });

  const [chatIdentity, setChatIdentity] = useState({ name: "", email: "", location: "" });
  const [chatSession, setChatSession] = useState({ id: "", email: "" });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatState, setChatState] = useState({ loading: false, message: "" });
  const [chatSocket, setChatSocket] = useState(null);

  const [auth, setAuth] = useState(() => {
    try {
      const saved = localStorage.getItem("userAuth");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    address: "",
  });
  const [profileState, setProfileState] = useState({ loading: false, message: "" });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordState, setPasswordState] = useState({ loading: false, message: "" });
  const [orderRequestModal, setOrderRequestModal] = useState({
    open: false,
    order: null,
    type: "cancel",
    reason: "",
    loading: false,
    message: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutResult = params.get("checkout");
    if (!checkoutResult) return;

    const orderNumber = params.get("order");
    if (checkoutResult === "success") {
      setCart([]);
      setActivePage("orders");
      setCheckoutState({
        loading: false,
        message: orderNumber
          ? `Payment completed for ${orderNumber}. You can track it in Orders.`
          : "Payment completed successfully. You can track it in Orders.",
      });
    }

    if (checkoutResult === "cancelled") {
      setActivePage("cart");
      setCheckoutState({
        loading: false,
        message: orderNumber
          ? `Payment was cancelled for ${orderNumber}. You can retry checkout anytime.`
          : "Payment was cancelled. You can retry checkout anytime.",
      });
    }

    params.delete("checkout");
    params.delete("order");
    params.delete("session_id");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    localStorage.setItem("userCart", JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    localStorage.setItem("userWishlist", JSON.stringify(wishlist));
  }, [wishlist]);
  useEffect(() => {
    localStorage.setItem("userRecentlyViewed", JSON.stringify(recentlyViewed));
  }, [recentlyViewed]);
  useEffect(() => {
    localStorage.setItem("userWishlistMeta", JSON.stringify(wishlistMeta));
  }, [wishlistMeta]);

  useEffect(() => {
    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError("");
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/products`);
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        setProductsError(err.message || "Failed to load products");
      } finally {
        setProductsLoading(false);
      }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    let active = true;
    const loadStoreConfig = async () => {
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/config`);
        if (!active) return;
        const cardEnabled = Boolean(data?.payment?.cardEnabled);
        const defaultMethod = cardEnabled ? "card" : "cash";
        setPaymentConfig({ cardEnabled, defaultMethod });
        setCheckout((prev) => {
          if (cardEnabled) return prev;
          if (prev.paymentMethod !== "card") return prev;
          return { ...prev, paymentMethod: defaultMethod };
        });
      } catch (_err) {
        if (!active) return;
        setPaymentConfig({ cardEnabled: false, defaultMethod: "cash" });
        setCheckout((prev) => {
          if (prev.paymentMethod !== "card") return prev;
          return { ...prev, paymentMethod: "cash" };
        });
      }
    };
    loadStoreConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!products.length) return;
    setReviewForm((prev) => ({ ...prev, productId: prev.productId || products[0]._id }));
  }, [products]);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/reviews?page=${reviewsPage}&limit=6`);
        setReviews(Array.isArray(data.data) ? data.data : []);
        setReviewsTotal(Number(data.total) || 0);
      } catch (_err) {}
    };
    loadReviews();
  }, [reviewsPage]);

  useEffect(() => {
    const socket = io(API_BASE, {
      transports: ["websocket", "polling"],
    });
    setChatSocket(socket);
    return () => {
      socket.disconnect();
      setChatSocket(null);
    };
  }, []);

  useEffect(() => {
    if (!chatSocket || !chatSession.id) return undefined;
    const conversationId = String(chatSession.id);
    const onConversationMessage = (payload = {}) => {
      if (String(payload.conversationId || "") !== conversationId) return;
      const incoming = payload.message;
      if (!incoming) return;
      setChatMessages((prev) =>
        prev.some((item) => String(item?._id || "") === String(incoming?._id || ""))
          ? prev
          : [...prev, incoming]
      );
    };

    chatSocket.emit("conversation:join", { conversationId });
    chatSocket.on("conversation:message", onConversationMessage);

    return () => {
      chatSocket.emit("conversation:leave", { conversationId });
      chatSocket.off("conversation:message", onConversationMessage);
    };
  }, [chatSocket, chatSession.id]);

  useEffect(() => {
    if (!chatSession.id || !chatSession.email) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/messages/${chatSession.id}?email=${encodeURIComponent(chatSession.email)}`);
        if (active) setChatMessages(Array.isArray(data.messages) ? data.messages : []);
      } catch (_err) {}
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [chatSession]);

  useEffect(() => {
    if (!auth?.token) {
      setProfileForm({
        name: auth?.user?.name || "",
        email: auth?.user?.email || "",
        phone: "",
        country: "",
        address: "",
      });
      return;
    }

    let active = true;
    const loadProfile = async () => {
      setProfileState({ loading: true, message: "" });
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/profile`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!active) return;
        setProfileForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          country: data.country || "",
          address: data.address || "",
        });
        setProfileState({ loading: false, message: "" });
      } catch (err) {
        if (!active) return;
        setProfileState({ loading: false, message: err.message || "Failed to load profile" });
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [auth?.token, auth?.user?.email, auth?.user?.name]);

  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      if (!auth?.token) {
        if (active) setPrefsLoaded(true);
        return;
      }

      setPrefsLoaded(false);
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/preferences`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        if (!active) return;

        const serverWishlist = Array.isArray(data?.wishlist)
          ? data.wishlist.map((item) => String(item.productId || "")).filter(Boolean)
          : [];
        const serverRecentlyViewed = Array.isArray(data?.recentlyViewed)
          ? data.recentlyViewed.map((item) => String(item.productId || "")).filter(Boolean)
          : [];

        const mergedWishlist = serverWishlist.length ? serverWishlist : wishlist;
        const mergedRecentlyViewed = serverRecentlyViewed.length ? serverRecentlyViewed : recentlyViewed;
        if (!arraysEqual(mergedWishlist, wishlist)) setWishlist(mergedWishlist);
        if (!arraysEqual(mergedRecentlyViewed, recentlyViewed)) setRecentlyViewed(mergedRecentlyViewed);

        const nextMeta = {};
        if (Array.isArray(data?.wishlist)) {
          data.wishlist.forEach((item) => {
            const id = String(item.productId || "");
            if (!id) return;
            nextMeta[id] = {
              savedPrice: Number(item.savedPrice || 0),
              savedInStock: Boolean(item.savedInStock),
              addedAt: item.addedAt || null,
            };
          });
        }
        if (Object.keys(nextMeta).length) {
          setWishlistMeta((prev) => ({ ...prev, ...nextMeta }));
        }
      } catch (_err) {
        // Keep local fallback data when preference endpoint is unavailable.
      } finally {
        if (active) setPrefsLoaded(true);
      }
    };

    loadPreferences();
    return () => {
      active = false;
    };
  }, [auth?.token]);

  useEffect(() => {
    if (!auth?.token || !prefsLoaded) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await jsonFetch(`${API_BASE}/api/store/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ wishlist, recentlyViewed }),
        });
        if (cancelled) return;

        const serverWishlist = Array.isArray(data?.wishlist)
          ? data.wishlist.map((item) => String(item.productId || "")).filter(Boolean)
          : [];
        const serverRecentlyViewed = Array.isArray(data?.recentlyViewed)
          ? data.recentlyViewed.map((item) => String(item.productId || "")).filter(Boolean)
          : [];
        if (!arraysEqual(serverWishlist, wishlist)) setWishlist(serverWishlist);
        if (!arraysEqual(serverRecentlyViewed, recentlyViewed)) setRecentlyViewed(serverRecentlyViewed);

        const nextMeta = {};
        if (Array.isArray(data?.wishlist)) {
          data.wishlist.forEach((item) => {
            const id = String(item.productId || "");
            if (!id) return;
            nextMeta[id] = {
              savedPrice: Number(item.savedPrice || 0),
              savedInStock: Boolean(item.savedInStock),
              addedAt: item.addedAt || null,
            };
          });
        }
        setWishlistMeta(nextMeta);
      } catch (_err) {
        // Ignore transient save issues; local state remains available.
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [auth?.token, prefsLoaded, wishlist, recentlyViewed]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = products.filter((p) => {
      const catOk = category === "All" || p.category === category;
      const queryOk = !q || p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      return catOk && queryOk;
    });
    if (sortBy === "priceAsc") list = [...list].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === "priceDesc") list = [...list].sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === "nameAsc") list = [...list].sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
    return list;
  }, [products, search, category, sortBy]);

  const cartLines = useMemo(
    () =>
      cart
        .map((line) => {
          const product = products.find((p) => p._id === line.productId);
          if (!product) return null;
          const qty = Math.max(1, Number(line.qty || 1));
          return {
            productId: product._id,
            title: product.title,
            imageUrl: product.imageUrl,
            price: Number(product.price || 0),
            qty,
            stock: Number(product.quantity || 0),
            total: Number(product.price || 0) * qty,
          };
        })
        .filter(Boolean),
    [cart, products]
  );

  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  const subtotal = cartLines.reduce((s, l) => s + l.total, 0);
  const gst = subtotal * 0.1;
  const shipping = subtotal > 0 && subtotal < 180 ? 14.95 : 0;
  const grandTotal = subtotal + gst + shipping;
  const wishlistProducts = useMemo(
    () => wishlist.map((id) => products.find((p) => p._id === id)).filter(Boolean),
    [wishlist, products]
  );
  const recentlyViewedProducts = useMemo(
    () => recentlyViewed.map((id) => products.find((p) => p._id === id)).filter(Boolean),
    [recentlyViewed, products]
  );
  const wishlistSignals = useMemo(() => {
    const result = {};
    wishlistProducts.forEach((product) => {
      const id = String(product._id || "");
      const meta = wishlistMeta[id];
      if (!meta) return;

      const currentPrice = Number(product.price || 0);
      const savedPrice = Number(meta.savedPrice || currentPrice);
      const currentInStock =
        Number(product.quantity || 0) > 0 || String(product.status || "").toLowerCase() !== "out-of-stock";
      const wasInStock = Boolean(meta.savedInStock);
      const priceDelta = currentPrice - savedPrice;

      result[id] = {
        hasBackInStock: !wasInStock && currentInStock,
        hasPriceChange: Math.abs(priceDelta) > 0.009,
        hasPriceDrop: priceDelta < -0.009,
      };
    });
    return result;
  }, [wishlistProducts, wishlistMeta]);

  const counters = {
    shop: products.length,
    cart: cartCount,
    orders: orders.length,
    reviews: reviewsTotal,
    support: chatSession.id ? 1 : 0,
  };

  const recentOrders = useMemo(() => orders.slice(0, 3), [orders]);
  const pendingOrdersCount = useMemo(
    () => orders.filter((order) => !["Completed", "Cancelled", "Returned"].includes(order.status)).length,
    [orders]
  );
  const completedOrdersCount = useMemo(
    () => orders.filter((order) => order.status === "Completed").length,
    [orders]
  );

  const profileMissingFields = useMemo(() => {
    const checks = [
      { label: "Name", value: profileForm.name || auth?.user?.name || "" },
      { label: "Email", value: profileForm.email || auth?.user?.email || "" },
      { label: "Phone", value: profileForm.phone || "" },
      { label: "Address", value: profileForm.address || "" },
    ];
    return checks.filter((item) => !String(item.value || "").trim()).map((item) => item.label);
  }, [profileForm, auth?.user?.name, auth?.user?.email]);

  const profileCompletion = Math.round(((4 - profileMissingFields.length) / 4) * 100);

  const addToCart = (productId) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === productId);
      if (existing) return prev.map((line) => (line.productId === productId ? { ...line, qty: line.qty + 1 } : line));
      return [...prev, { productId, qty: 1 }];
    });
    setActivePage("cart");
  };
  const toggleWishlist = (productId) => {
    if (!productId) return;
    const isSaved = wishlist.includes(productId);
    const product = products.find((item) => item._id === productId);
    setWishlist((prev) => {
      const next = isSaved ? prev.filter((id) => id !== productId) : [productId, ...prev].slice(0, 24);
      return next;
    });
    setWishlistMeta((prev) => {
      const next = { ...prev };
      if (isSaved) {
        delete next[productId];
        return next;
      }
      if (!next[productId]) {
        const inStockNow =
          Number(product?.quantity || 0) > 0 || String(product?.status || "").toLowerCase() !== "out-of-stock";
        next[productId] = {
          savedPrice: Number(product?.price || 0),
          savedInStock: inStockNow,
          addedAt: new Date().toISOString(),
        };
      }
      return next;
    });
  };
  const openProductDetails = (product) => {
    if (!product?._id) return;
    setSelectedProduct(product);
    setRecentlyViewed((prev) => [product._id, ...prev.filter((id) => id !== product._id)].slice(0, 18));
  };

  const updateCartQty = (productId, qty) => {
    const safe = Math.max(1, Number(qty || 1));
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, qty: safe } : line)));
  };
  const removeCartLine = (productId) => setCart((prev) => prev.filter((line) => line.productId !== productId));

  const submitCheckout = async (e) => {
    e.preventDefault();
    if (!cartLines.length || checkoutState.loading) return;
    if (checkout.paymentMethod === "card" && !paymentConfig.cardEnabled) {
      setCheckoutState({
        loading: false,
        message: "Online card payment is not available right now. Please use Bank Transfer or Cash on Delivery.",
      });
      setCheckout((prev) => ({ ...prev, paymentMethod: "cash" }));
      return;
    }
    setCheckoutState({ loading: true, message: "" });
    try {
      const payload = {
        customer: {
          name: checkout.name,
          email: checkout.email,
          phone: checkout.phone,
          address: `${checkout.address}, ${checkout.cityState} ${checkout.postcode}`.trim(),
        },
        items: cartLines.map((line) => ({ productId: line.productId, qty: line.qty })),
        paymentMethod: checkout.paymentMethod,
        notes: checkout.notes,
        clientMeta: {
          locale: navigator.language || "en",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          country: (navigator.language || "").split("-")[1] || "",
        },
      };
      const data = await jsonFetch(`${API_BASE}/api/store/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (data?.checkoutUrl) {
        setCheckoutState({ loading: false, message: "Redirecting to secure payment..." });
        window.location.href = data.checkoutUrl;
        return;
      }
      setCheckoutState({ loading: false, message: `Order ${data.order?.orderNumber || ""} placed successfully.` });
      setOrdersEmail(checkout.email);
      setOrders((prev) => (data.order ? [data.order, ...prev] : prev));
      setCart([]);
    } catch (err) {
      setCheckoutState({ loading: false, message: err.message || "Failed to checkout" });
    }
  };

  const fetchOrders = async (e) => {
    e.preventDefault();
    if (!ordersEmail.trim()) return;
    setOrdersState({ loading: true, message: "" });
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/orders?email=${encodeURIComponent(ordersEmail.trim())}`);
      setOrders(Array.isArray(data) ? data : []);
      setOrdersState({ loading: false, message: "" });
    } catch (err) {
      setOrdersState({ loading: false, message: err.message || "Failed to load orders" });
    }
  };

  const loadMyOrders = async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!auth?.token) {
      if (!silent) setOrdersState({ loading: false, message: "Please login to load your orders." });
      return;
    }
    setOrdersState((prev) => ({ ...prev, loading: true, message: silent ? prev.message : "" }));
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/orders/me`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      setOrders(Array.isArray(data) ? data : []);
      setMyOrdersLoaded(true);
      setOrdersState({
        loading: false,
        message: silent ? "" : Array.isArray(data) && data.length ? "" : "No orders found for your account.",
      });
    } catch (err) {
      setOrdersState({ loading: false, message: err.message || "Failed to load your orders" });
    }
  };

  const openOrdersPage = () => {
    setActivePage("orders");
    if (auth?.token) loadMyOrders({ silent: true });
  };

  const addOrderItemsToCart = (order) => {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) {
      setOrdersState((prev) => ({ ...prev, message: "No reorderable items were found on this order." }));
      return;
    }

    const validItems = items
      .map((item) => {
        const rawId = typeof item?.productId === "object" ? item?.productId?._id : item?.productId;
        const productId = rawId ? String(rawId) : "";
        const qty = Math.max(1, Number(item?.qty || 1));
        return productId ? { productId, qty } : null;
      })
      .filter(Boolean);

    if (!validItems.length) {
      setOrdersState((prev) => ({ ...prev, message: "This order cannot be reordered because product IDs are missing." }));
      return;
    }

    setCart((prev) => {
      const next = [...prev];
      validItems.forEach((item) => {
        const found = next.find((line) => String(line.productId) === item.productId);
        if (found) found.qty = Math.max(1, Number(found.qty || 1)) + item.qty;
        else next.push({ productId: item.productId, qty: item.qty });
      });
      return next;
    });

    setOrdersState((prev) => ({ ...prev, message: `Added ${validItems.length} item(s) from ${order.orderNumber} to cart.` }));
    setActivePage("cart");
  };

  const closeOrderRequestModal = () => {
    setOrderRequestModal({
      open: false,
      order: null,
      type: "cancel",
      reason: "",
      loading: false,
      message: "",
    });
  };

  const requestOrderAction = (order, type) => {
    if (!auth?.token) {
      setOrdersState((prev) => ({ ...prev, message: "Please login to request cancellation or return." }));
      return;
    }
    setOrderRequestModal({
      open: true,
      order,
      type,
      reason: "",
      loading: false,
      message: "",
    });
  };

  const submitOrderRequest = async (e) => {
    e.preventDefault();
    const orderId = orderRequestModal?.order?._id;
    const reason = orderRequestModal.reason.trim();
    if (!orderId) return;
    if (!reason) {
      setOrderRequestModal((prev) => ({ ...prev, message: "Please provide a short reason." }));
      return;
    }

    setOrderRequestModal((prev) => ({ ...prev, loading: true, message: "" }));
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/orders/${orderId}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ type: orderRequestModal.type, reason }),
      });
      if (data?.serviceRequest) {
        setOrders((prev) =>
          prev.map((order) =>
            String(order._id) === String(orderId) ? { ...order, serviceRequest: data.serviceRequest } : order
          )
        );
      }
      closeOrderRequestModal();
      setOrdersState((prev) => ({ ...prev, loading: false, message: data.message || "Request submitted to support." }));
    } catch (err) {
      setOrderRequestModal((prev) => ({ ...prev, loading: false, message: err.message || "Failed to submit request" }));
    }
  };

  useEffect(() => {
    if (!auth?.token) {
      setMyOrdersLoaded(false);
      return;
    }

    if (!myOrdersLoaded && (activePage === "home" || activePage === "orders")) {
      loadMyOrders({ silent: true });
    }
  }, [auth?.token, myOrdersLoaded, activePage]);

  const submitReview = async (e) => {
    e.preventDefault();
    if (reviewState.loading) return;
    setReviewState({ loading: true, message: "" });
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reviewForm, rating: Number(reviewForm.rating) }),
      });
      setReviewState({ loading: false, message: data.message || "Review submitted" });
      setReviewForm((prev) => ({ ...prev, reviewText: "", rating: "5" }));
    } catch (err) {
      setReviewState({ loading: false, message: err.message || "Failed to submit review" });
    }
  };

  const startChat = async (e) => {
    e.preventDefault();
    setChatState({ loading: true, message: "" });
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/messages/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatIdentity),
      });
      setChatSession({ id: data.conversationId, email: data.customerEmail || chatIdentity.email });
      setChatMessages(Array.isArray(data.messages) ? data.messages : []);
      setChatState({ loading: false, message: "Connected." });
    } catch (err) {
      setChatState({ loading: false, message: err.message || "Failed to start chat" });
    }
  };

  const sendChat = async (e) => {
    e.preventDefault();
    if (!chatSession.id || !chatText.trim()) return;
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/messages/${chatSession.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: chatSession.email, text: chatText.trim() }),
      });
      if (data?.message) setChatMessages((prev) => [...prev, data.message]);
      setChatText("");
    } catch (err) {
      setChatState({ loading: false, message: err.message || "Failed to send message" });
    }
  };

  const submitAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const endpoint = authMode === "login" ? "login" : "signup";
      const payload = { email: authForm.email, password: authForm.password };
      if (authMode === "signup") payload.name = authForm.name || "Customer";
      const data = await jsonFetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setAuth(data);
      setMyOrdersLoaded(false);
      localStorage.setItem("userAuth", JSON.stringify(data));
      setOrdersEmail(data?.user?.email || "");
      setAuthModalOpen(false);
      setAuthForm({ name: "", email: "", password: "" });
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    }
  };

  const submitProfileUpdate = async (e) => {
    e.preventDefault();
    if (!auth?.token) {
      setProfileState({ loading: false, message: "Please login to update your profile." });
      return;
    }
    setProfileState({ loading: true, message: "" });
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(profileForm),
      });

      if (data?.user) {
        setProfileForm({
          name: data.user.name || "",
          email: data.user.email || "",
          phone: data.user.phone || "",
          country: data.user.country || "",
          address: data.user.address || "",
        });

        const nextAuth = {
          ...auth,
          user: {
            ...auth.user,
            name: data.user.name || auth.user?.name || "",
            email: data.user.email || auth.user?.email || "",
          },
        };
        setAuth(nextAuth);
        localStorage.setItem("userAuth", JSON.stringify(nextAuth));
      }

      setProfileState({ loading: false, message: data.message || "Profile updated." });
    } catch (err) {
      setProfileState({ loading: false, message: err.message || "Failed to update profile" });
    }
  };

  const submitPasswordUpdate = async (e) => {
    e.preventDefault();
    if (!auth?.token) {
      setPasswordState({ loading: false, message: "Please login to update password." });
      return;
    }
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordState({ loading: false, message: "Please fill all password fields." });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordState({ loading: false, message: "New password and confirm password do not match." });
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordState({ loading: false, message: "New password must be at least 8 characters." });
      return;
    }

    setPasswordState({ loading: true, message: "" });
    try {
      const data = await jsonFetch(`${API_BASE}/api/store/profile/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordState({ loading: false, message: data.message || "Password updated." });
    } catch (err) {
      setPasswordState({ loading: false, message: err.message || "Failed to update password" });
    }
  };

  const logout = () => {
    setAuth(null);
    setOrders([]);
    setOrdersEmail("");
    setMyOrdersLoaded(false);
    setOrdersState({ loading: false, message: "" });
    setProfileState({ loading: false, message: "" });
    setPasswordState({ loading: false, message: "" });
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    localStorage.removeItem("userAuth");
  };

  return (
    <div className="store-app min-h-screen text-slate-900">
      <div className="ambient-orb orb-amber" />
      <div className="ambient-orb orb-teal" />

      <div className="relative mx-auto flex h-screen max-w-[1500px] gap-4 overflow-hidden px-3 py-4 sm:px-5 lg:gap-6 lg:px-6 lg:py-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="glass-panel side-panel h-full overflow-y-auto">
            <div className="brand-block">
              <p className="brand-kicker">Industrial Essentials</p>
              <p className="brand-name">{BRAND_NAME}</p>
              <p className="brand-subtitle">Built for warehouses, workshops, and crews that move fast.</p>
            </div>

            <div className="side-nav">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={cx("nav-btn", activePage === item.id && "is-active")}
                >
                  <span>{item.label}</span>
                  {counters[item.id] ? <span className="nav-badge">{counters[item.id]}</span> : null}
                </button>
              ))}
            </div>

            <div className="account-chip mt-auto">
              <p className="text-sm font-semibold text-slate-900">{auth?.user?.name || "Guest User"}</p>
              <p className="text-xs text-slate-500">{auth?.user?.email || "Not signed in"}</p>
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-1 flex-col gap-4 pt-3">
          <header
            className="glass-panel top-shell z-40"
            style={{
              background: "rgba(255, 252, 246, 0.97)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="hero-kicker">Workwear Storefront</p>
                <h1 className="hero-title">Outfit your team with confidence.</h1>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                  className="field-input w-full sm:w-72"
                />
                <div className="flex gap-2">
                  <button onClick={() => setActivePage("cart")} className="pill-btn">
                    Cart ({cartCount})
                  </button>
                  {auth ? (
                    <button onClick={logout} className="pill-btn">
                      Logout
                    </button>
                  ) : (
                    <button onClick={() => setAuthModalOpen(true)} className="primary-btn compact">
                      Login / Register
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={cx("nav-btn nav-btn-mobile whitespace-nowrap", activePage === item.id && "is-active")}
                >
                  <span>{item.label}</span>
                  {counters[item.id] ? <span className="nav-badge">{counters[item.id]}</span> : null}
                </button>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto pb-2 pr-1">
            <section className="glass-panel page-shell">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="page-title">{NAV_ITEMS.find((item) => item.id === activePage)?.label || "Home"}</h2>
              <p className="page-helper">Live catalog, quick checkout, and full customer support in one flow.</p>
            </div>

            {activePage === "home" && (
              <div className="space-y-4">
                <article className="home-hero card-reveal">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Welcome</p>
                  <h3 className="mt-1 text-2xl font-semibold text-slate-900">
                    {auth?.user?.name ? `Good to see you, ${auth.user.name}.` : "Get equipped for your next shift."}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Jump back into your journey quickly: shop products, finish checkout, track deliveries, or contact support.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setActivePage("shop")} className="primary-btn">
                      Shop Products
                    </button>
                    <button type="button" onClick={() => setActivePage("shop")} className="secondary-btn">
                      Wishlist ({wishlistProducts.length})
                    </button>
                    <button type="button" onClick={() => setActivePage("cart")} className="secondary-btn">
                      Continue Checkout ({cartCount})
                    </button>
                    <button type="button" onClick={openOrdersPage} className="secondary-btn">
                      Track My Orders
                    </button>
                    <button type="button" onClick={() => setActivePage("support")} className="secondary-btn">
                      Chat Support
                    </button>
                  </div>
                </article>

                <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                  <article className="form-card card-reveal" style={{ animationDelay: "70ms" }}>
                    <h3 className="section-title">Your Focus Right Now</h3>
                    <div className="mt-3 space-y-2">
                      <div className="action-row">
                        <p className="text-sm text-slate-700">
                          Cart items waiting: <strong>{cartCount}</strong>
                        </p>
                        <button type="button" onClick={() => setActivePage("cart")} className="secondary-btn !px-3 !py-1.5">
                          Open Cart
                        </button>
                      </div>
                      <div className="action-row">
                        <p className="text-sm text-slate-700">
                          Orders in progress: <strong>{pendingOrdersCount}</strong>
                        </p>
                        <button type="button" onClick={openOrdersPage} className="secondary-btn !px-3 !py-1.5">
                          View Orders
                        </button>
                      </div>
                      <div className="action-row">
                        <p className="text-sm text-slate-700">
                          Completed orders ready for review: <strong>{completedOrdersCount}</strong>
                        </p>
                        <button type="button" onClick={() => setActivePage("reviews")} className="secondary-btn !px-3 !py-1.5">
                          Write Review
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-[var(--line)] bg-white/80 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Profile completion</p>
                        <span className="text-xs font-semibold text-slate-500">{profileCompletion}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-gradient-to-r from-[#d56b35] to-[#0d8088]" style={{ width: `${profileCompletion}%` }} />
                      </div>
                      {profileMissingFields.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Missing: {profileMissingFields.join(", ")}.
                          <button type="button" onClick={() => setActivePage("account")} className="ml-1 font-semibold text-slate-700 underline">
                            Update now
                          </button>
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-emerald-600">Your account details are complete.</p>
                      )}
                    </div>
                  </article>

                  <article className="form-card card-reveal" style={{ animationDelay: "110ms" }}>
                    <div className="flex items-center justify-between">
                      <h3 className="section-title">Recent Orders</h3>
                      <button type="button" onClick={() => loadMyOrders()} className="secondary-btn !px-3 !py-1.5">
                        Refresh
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {recentOrders.map((order) => (
                        <div key={order._id} className="rounded-xl border border-[var(--line)] bg-white/85 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                            <span className="status-chip">{order.status}</span>
                          </div>
                          <p className="text-xs text-slate-500">{dateTime(order.createdAt)}</p>
                          <p className="text-xs text-slate-600">
                            {order.courierName || "Courier pending"} | {order.trackingId || "Tracking pending"}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">Total: {price(Number(order.total || 0) * 1.1)}</p>
                        </div>
                      ))}
                      {!recentOrders.length && (
                        <p className="empty-note">
                          {auth?.token ? "No orders yet. Place your first order to start tracking." : "Login to see your recent orders here."}
                        </p>
                      )}
                    </div>
                  </article>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <article className="trust-card card-reveal" style={{ animationDelay: "150ms" }}>
                    <h4>Fast Dispatch</h4>
                    <p>Most in-stock workwear ships within 24 business hours from fulfillment confirmation.</p>
                  </article>
                  <article className="trust-card card-reveal" style={{ animationDelay: "190ms" }}>
                    <h4>Easy Returns</h4>
                    <p>Request a return directly from your order card and our team will guide pickup steps.</p>
                  </article>
                  <article className="trust-card card-reveal" style={{ animationDelay: "230ms" }}>
                    <h4>Real Support</h4>
                    <p>Live chat support helps with sizing, availability, and urgent delivery questions.</p>
                  </article>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <article className="form-card card-reveal" style={{ animationDelay: "270ms" }}>
                    <div className="flex items-center justify-between">
                      <h3 className="section-title">Saved Wishlist</h3>
                      <button type="button" onClick={() => setActivePage("shop")} className="secondary-btn !px-3 !py-1.5">
                        Browse
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {wishlistProducts.slice(0, 4).map((product) => (
                        <div key={product._id} className="mini-product-row">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{product.title}</p>
                            <p className="text-xs text-slate-500">{price(product.price)}</p>
                            {!!wishlistSignals[product._id] && (
                              <div className="wishlist-badges mt-1">
                                {wishlistSignals[product._id].hasBackInStock && (
                                  <span className="wishlist-badge wishlist-badge-stock">Back in stock</span>
                                )}
                                {wishlistSignals[product._id].hasPriceDrop && (
                                  <span className="wishlist-badge wishlist-badge-drop">Price dropped</span>
                                )}
                                {wishlistSignals[product._id].hasPriceChange && !wishlistSignals[product._id].hasPriceDrop && (
                                  <span className="wishlist-badge wishlist-badge-change">Price changed</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => openProductDetails(product)} className="secondary-btn !px-3 !py-1.5">
                              View
                            </button>
                            <button type="button" onClick={() => addToCart(product._id)} className="secondary-btn !px-3 !py-1.5">
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                      {!wishlistProducts.length && <p className="empty-note">Save products from the catalog to build your shortlist.</p>}
                    </div>
                  </article>

                  <article className="form-card card-reveal" style={{ animationDelay: "310ms" }}>
                    <div className="flex items-center justify-between">
                      <h3 className="section-title">Recently Viewed</h3>
                      <button type="button" onClick={() => setActivePage("shop")} className="secondary-btn !px-3 !py-1.5">
                        Open Shop
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {recentlyViewedProducts.slice(0, 4).map((product) => (
                        <div key={product._id} className="mini-product-row">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{product.title}</p>
                            <p className="text-xs text-slate-500">{product.category || "General"}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => openProductDetails(product)} className="secondary-btn !px-3 !py-1.5">
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWishlist(product._id)}
                              className="secondary-btn !px-3 !py-1.5"
                            >
                              {wishlist.includes(product._id) ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>
                      ))}
                      {!recentlyViewedProducts.length && (
                        <p className="empty-note">Open product details from the catalog to build your recent activity list.</p>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            )}

            {activePage === "shop" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input max-w-xs">
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="field-input max-w-xs">
                    <option value="newest">Newest</option>
                    <option value="priceAsc">Price Low</option>
                    <option value="priceDesc">Price High</option>
                    <option value="nameAsc">Name A-Z</option>
                  </select>
                </div>

                {productsError && <p className="text-sm font-medium text-rose-600">{productsError}</p>}

                {productsLoading ? (
                  <p className="empty-note">Loading products...</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredProducts.map((p, index) => (
                      <article
                        key={p._id}
                        className="product-card card-reveal"
                        style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                      >
                        <img src={imageUrl(p.imageUrl)} alt={p.title} className="product-image" />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="line-clamp-2 text-base font-semibold text-slate-900">{p.title}</h3>
                            <div className="flex flex-col items-end gap-1">
                              <span className="price-chip">{price(p.price)}</span>
                              <button
                                type="button"
                                onClick={() => toggleWishlist(p._id)}
                                className="secondary-btn !px-2 !py-1 text-[11px] leading-none"
                              >
                                {wishlist.includes(p._id) ? "Saved" : "Save"}
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.description || "-"}</p>
                          <div className="mt-4 flex gap-2">
                            <button onClick={() => addToCart(p._id)} className="primary-btn flex-1 text-sm">
                              Add to Cart
                            </button>
                            <button onClick={() => openProductDetails(p)} className="secondary-btn text-sm">
                              View
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!filteredProducts.length && <p className="empty-note sm:col-span-2 xl:col-span-3">No products found for this filter.</p>}
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-3">
                  <article className="trust-card">
                    <h4>Delivery Promise</h4>
                    <p>Live tracking on every order with courier and ETA details in your orders tab.</p>
                  </article>
                  <article className="trust-card">
                    <h4>Quality Guarantee</h4>
                    <p>Built for daily industrial use. Request support if fit or quality misses your expectation.</p>
                  </article>
                  <article className="trust-card">
                    <h4>Simple Returns</h4>
                    <p>Need to return? Submit a return request from your order card and our team follows up.</p>
                  </article>
                </div>
              </div>
            )}

            {activePage === "cart" && (
              <div className="grid gap-4 xl:grid-cols-[1.15fr,0.9fr]">
                <div className="space-y-3">
                  {cartLines.map((line, index) => (
                    <article
                      key={line.productId}
                      className="line-card card-reveal"
                      style={{ animationDelay: `${Math.min(index * 40, 220)}ms` }}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <img src={imageUrl(line.imageUrl)} alt={line.title} className="h-20 w-20 rounded-xl object-cover" />
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{line.title}</p>
                          <p className="text-sm text-slate-600">{price(line.price)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max={Math.max(1, line.stock)}
                              value={line.qty}
                              onChange={(e) => updateCartQty(line.productId, e.target.value)}
                              className="field-input !w-20 !px-2 !py-1.5 text-sm"
                            />
                            <button onClick={() => removeCartLine(line.productId)} className="text-xs font-semibold text-rose-600">
                              Remove
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{price(line.total)}</p>
                      </div>
                    </article>
                  ))}
                  {!cartLines.length && <p className="empty-note">Your cart is empty right now.</p>}
                </div>

                <form onSubmit={submitCheckout} className="form-card">
                  <h3 className="section-title">Checkout</h3>
                  <div className="mt-3 grid gap-2.5">
                    <input
                      required
                      value={checkout.name}
                      onChange={(e) => setCheckout((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Name"
                      className="field-input"
                    />
                    <input
                      required
                      type="email"
                      value={checkout.email}
                      onChange={(e) => setCheckout((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className="field-input"
                    />
                    <input
                      value={checkout.phone}
                      onChange={(e) => setCheckout((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone"
                      className="field-input"
                    />
                    <input
                      required
                      value={checkout.address}
                      onChange={(e) => setCheckout((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Address"
                      className="field-input"
                    />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        required
                        value={checkout.cityState}
                        onChange={(e) => setCheckout((p) => ({ ...p, cityState: e.target.value }))}
                        placeholder="City / State"
                        className="field-input"
                      />
                      <input
                        required
                        value={checkout.postcode}
                        onChange={(e) => setCheckout((p) => ({ ...p, postcode: e.target.value }))}
                        placeholder="Postcode"
                        className="field-input"
                      />
                    </div>
                    <select
                      value={checkout.paymentMethod}
                      onChange={(e) => setCheckout((p) => ({ ...p, paymentMethod: e.target.value }))}
                      className="field-input"
                    >
                      <option value="card" disabled={!paymentConfig.cardEnabled}>
                        {paymentConfig.cardEnabled ? "Card (Secure Online)" : "Card (Temporarily Unavailable)"}
                      </option>
                      <option value="bank">Bank Transfer (Manual Verification)</option>
                      <option value="cash">Cash on Delivery</option>
                    </select>
                    {!paymentConfig.cardEnabled && (
                      <p className="text-xs text-amber-700">
                        Online card payment is currently disabled and can be enabled later from Stripe keys.
                      </p>
                    )}
                    <textarea
                      rows={3}
                      value={checkout.notes}
                      onChange={(e) => setCheckout((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Delivery notes"
                      className="field-input"
                    />
                    <div className="totals-box text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <strong>{price(subtotal)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>GST</span>
                        <strong>{price(gst)}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <strong>{shipping ? price(shipping) : "Free"}</strong>
                      </div>
                      <div className="mt-2 flex justify-between border-t border-[var(--line)] pt-2 font-bold">
                        <span>Total</span>
                        <span>{price(grandTotal)}</span>
                      </div>
                    </div>
                    <div className="trust-note text-xs">
                      Secure checkout. You will receive tracking updates and can request cancellation/return from your orders page.
                    </div>
                    <button disabled={checkoutState.loading || !cartLines.length} className="primary-btn w-full disabled:opacity-50">
                      {checkoutState.loading ? "Placing..." : "Place Order"}
                    </button>
                    {checkoutState.message && <p className="text-xs text-slate-600">{checkoutState.message}</p>}
                  </div>
                </form>
              </div>
            )}

            {activePage === "orders" && (
              <div className="form-card">
                {auth?.token ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">
                      Signed in as <strong>{auth.user?.email}</strong>
                    </p>
                    <button type="button" onClick={loadMyOrders} className="primary-btn sm:w-auto">
                      Load My Orders
                    </button>
                  </div>
                ) : (
                  <form onSubmit={fetchOrders} className="flex flex-col gap-2 sm:flex-row">
                    <input
                      required
                      type="email"
                      value={ordersEmail}
                      onChange={(e) => setOrdersEmail(e.target.value)}
                      placeholder="Email for order lookup"
                      className="field-input flex-1"
                    />
                    <button className="primary-btn sm:w-auto">Load Orders</button>
                  </form>
                )}
                {ordersState.loading && <p className="mt-3 text-sm text-slate-500">Loading orders...</p>}
                {ordersState.message && <p className="mt-3 text-sm font-medium text-rose-600">{ordersState.message}</p>}
                <div className="mt-3 space-y-2">
                  {orders.map((order, index) => {
                    const timeline = getOrderTimelineState(order.status);
                    const normalizedStatus = String(order.status || "").toLowerCase();
                    const requestStatus = String(order.serviceRequest?.status || "").toLowerCase();
                    const requestType = String(order.serviceRequest?.type || "").toLowerCase();
                    const canRequestCancellation =
                      auth?.token &&
                      requestStatus !== "pending" &&
                      !["cancel", "complete", "deliver", "return"].some((token) => normalizedStatus.includes(token));
                    const canRequestReturn =
                      auth?.token &&
                      requestStatus !== "pending" &&
                      ["complete", "deliver"].some((token) => normalizedStatus.includes(token)) &&
                      !normalizedStatus.includes("return");

                    return (
                      <article
                        key={order._id}
                        className="line-card card-reveal"
                        style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong>{order.orderNumber}</strong>
                          <span className="status-chip">{order.status}</span>
                        </div>
                        <div className="order-timeline mt-2">
                          {ORDER_TIMELINE_STEPS.map((stepLabel, stepIndex) => (
                            <div
                              key={`${order._id}-${stepLabel}`}
                              className={cx(
                                "timeline-step",
                                stepIndex <= timeline.stage && "is-active",
                                stepIndex === timeline.stage && "is-current"
                              )}
                            >
                              <span className="timeline-dot" />
                              <span className="timeline-label">{stepLabel}</span>
                            </div>
                          ))}
                        </div>
                        {timeline.cancelled && (
                          <p className="mt-1 text-xs font-medium text-rose-600">
                            Cancellation in progress or completed. Support updates will appear in chat.
                          </p>
                        )}
                        {timeline.returned && (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            Return request is in progress. Our team will confirm pickup or inspection steps.
                          </p>
                        )}
                        {requestStatus === "pending" && (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            {requestType === "cancel" ? "Cancellation" : "Return"} request pending review.
                          </p>
                        )}
                        {requestStatus === "rejected" && (
                          <p className="mt-1 text-xs font-medium text-rose-600">
                            Your latest request was rejected. You can contact support for clarification.
                          </p>
                        )}
                        <p className="text-sm text-slate-600">{dateTime(order.createdAt)}</p>
                        <p className="text-sm text-slate-600">Payment: {order.paymentStatus || "-"}</p>
                        <p className="text-sm text-slate-600">Method: {order.paymentMethod || "-"}</p>
                        {order.paymentCapturedAt && (
                          <p className="text-sm text-slate-600">Paid At: {dateTime(order.paymentCapturedAt)}</p>
                        )}
                        {order.paymentTransactionId && (
                          <p className="text-sm text-slate-600">Transaction: {order.paymentTransactionId}</p>
                        )}
                        <p className="text-sm text-slate-600">Tracking: {order.trackingId || "-"}</p>
                        <p className="text-sm text-slate-600">Courier: {order.courierName || "-"}</p>
                        <p className="text-sm text-slate-600">ETA: {order.eta || "-"}</p>
                        <p className="text-sm text-slate-600">
                          Route: {(order.origin || "-")} {"->"} {(order.destination || "-")}
                        </p>
                        {Array.isArray(order.items) && order.items.length > 0 && (
                          <p className="text-xs text-slate-500">
                            Items:{" "}
                            {order.items
                              .slice(0, 2)
                              .map((item) => item.title || "Item")
                              .join(", ")}
                            {order.items.length > 2 ? ` +${order.items.length - 2} more` : ""}
                          </p>
                        )}
                        <p className="text-sm text-slate-600">
                          Subtotal: {price(order.total)} | GST: {price((Number(order.total || 0) * 0.1).toFixed(2))}
                        </p>
                        <p className="font-semibold text-slate-900">Total: {price(Number(order.total || 0) * 1.1)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={() => addOrderItemsToCart(order)} className="secondary-btn !px-3 !py-1.5">
                            Reorder
                          </button>
                          {canRequestCancellation && (
                            <button
                              type="button"
                              onClick={() => requestOrderAction(order, "cancel")}
                              className="secondary-btn !px-3 !py-1.5"
                            >
                              Request Cancellation
                            </button>
                          )}
                          {canRequestReturn && (
                            <button
                              type="button"
                              onClick={() => requestOrderAction(order, "return")}
                              className="secondary-btn !px-3 !py-1.5"
                            >
                              Request Return
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {!orders.length && <p className="empty-note">No orders loaded yet.</p>}
                </div>
              </div>
            )}

            {activePage === "reviews" && (
              <div className="grid gap-4 xl:grid-cols-[1.1fr,0.95fr]">
                <div className="form-card">
                  <h3 className="section-title">Public Reviews</h3>
                  <div className="mt-3 space-y-2">
                    {reviews.map((r, index) => (
                      <article
                        key={r._id}
                        className="line-card card-reveal"
                        style={{ animationDelay: `${Math.min(index * 35, 210)}ms` }}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <strong>{r.customerName}</strong>
                          <span>{Number(r.rating || 0).toFixed(1)} / 5</span>
                        </div>
                        <p className="text-xs text-slate-500">{r.customerLocation || "-"}</p>
                        <p className="mt-1 text-sm text-slate-700">{r.reviewText}</p>
                      </article>
                    ))}
                    {!reviews.length && <p className="empty-note">No reviews yet.</p>}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>
                      Page {reviewsPage} of {Math.max(1, Math.ceil(reviewsTotal / 6))}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReviewsPage((p) => Math.max(1, p - 1))}
                        disabled={reviewsPage === 1}
                        className="secondary-btn !px-3 !py-1.5 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setReviewsPage((p) => p + 1)}
                        disabled={reviewsPage * 6 >= reviewsTotal}
                        className="secondary-btn !px-3 !py-1.5 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>

                <form onSubmit={submitReview} className="form-card">
                  <h3 className="section-title">Submit Review</h3>
                  <div className="mt-3 grid gap-2.5">
                    <select
                      required
                      value={reviewForm.productId}
                      onChange={(e) => setReviewForm((p) => ({ ...p, productId: e.target.value }))}
                      className="field-input"
                    >
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <select
                      value={reviewForm.rating}
                      onChange={(e) => setReviewForm((p) => ({ ...p, rating: e.target.value }))}
                      className="field-input"
                    >
                      <option value="5">5</option>
                      <option value="4">4</option>
                      <option value="3">3</option>
                      <option value="2">2</option>
                      <option value="1">1</option>
                    </select>
                    <input
                      required
                      value={reviewForm.customerName}
                      onChange={(e) => setReviewForm((p) => ({ ...p, customerName: e.target.value }))}
                      placeholder="Name"
                      className="field-input"
                    />
                    <input
                      required
                      type="email"
                      value={reviewForm.customerEmail}
                      onChange={(e) => setReviewForm((p) => ({ ...p, customerEmail: e.target.value }))}
                      placeholder="Email"
                      className="field-input"
                    />
                    <input
                      value={reviewForm.customerLocation}
                      onChange={(e) => setReviewForm((p) => ({ ...p, customerLocation: e.target.value }))}
                      placeholder="Location"
                      className="field-input"
                    />
                    <textarea
                      required
                      rows={4}
                      value={reviewForm.reviewText}
                      onChange={(e) => setReviewForm((p) => ({ ...p, reviewText: e.target.value }))}
                      placeholder="Review text"
                      className="field-input"
                    />
                    <button disabled={reviewState.loading} className="primary-btn w-full disabled:opacity-50">
                      {reviewState.loading ? "Saving..." : "Submit Review"}
                    </button>
                    {reviewState.message && <p className="text-xs text-slate-600">{reviewState.message}</p>}
                  </div>
                </form>
              </div>
            )}

            {activePage === "support" && (
              <div className="form-card">
                {!chatSession.id ? (
                  <form onSubmit={startChat} className="grid max-w-lg gap-2.5">
                    <input
                      required
                      value={chatIdentity.name}
                      onChange={(e) => setChatIdentity((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Name"
                      className="field-input"
                    />
                    <input
                      required
                      type="email"
                      value={chatIdentity.email}
                      onChange={(e) => setChatIdentity((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className="field-input"
                    />
                    <input
                      value={chatIdentity.location}
                      onChange={(e) => setChatIdentity((p) => ({ ...p, location: e.target.value }))}
                      placeholder="Location"
                      className="field-input"
                    />
                    <button disabled={chatState.loading} className="primary-btn w-full disabled:opacity-50">
                      {chatState.loading ? "Connecting..." : "Start Chat"}
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="chat-pane">
                      {chatMessages.map((m) => (
                        <div
                          key={m._id || `${m.sentAt}-${m.text}`}
                          className={cx("chat-bubble", m.sender === "customer" ? "own" : "agent")}
                        >
                          <p>{m.text}</p>
                          <p className="mt-1 text-[10px] opacity-70">{dateTime(m.sentAt)}</p>
                        </div>
                      ))}
                      {!chatMessages.length && <p className="text-sm text-slate-500">No messages yet.</p>}
                    </div>
                    <form onSubmit={sendChat} className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={chatText}
                        onChange={(e) => setChatText(e.target.value)}
                        placeholder="Type message"
                        className="field-input flex-1"
                      />
                      <button className="primary-btn sm:w-auto">Send</button>
                    </form>
                  </>
                )}
                {chatState.message && <p className="mt-2 text-sm text-slate-600">{chatState.message}</p>}
              </div>
            )}

            {activePage === "account" && (
              <>
                {auth ? (
                  <div className="grid gap-4 xl:grid-cols-[1.1fr,0.95fr]">
                    <form onSubmit={submitProfileUpdate} className="form-card">
                      <h3 className="section-title">Profile</h3>
                      <div className="mt-3 grid gap-2.5">
                        <input
                          required
                          value={profileForm.name}
                          onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Name"
                          className="field-input"
                        />
                        <input
                          required
                          type="email"
                          value={profileForm.email}
                          onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="Email"
                          className="field-input"
                        />
                        <input
                          value={profileForm.phone}
                          onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
                          placeholder="Phone"
                          className="field-input"
                        />
                        <input
                          value={profileForm.country}
                          onChange={(e) => setProfileForm((p) => ({ ...p, country: e.target.value }))}
                          placeholder="Country"
                          className="field-input"
                        />
                        <textarea
                          rows={3}
                          value={profileForm.address}
                          onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))}
                          placeholder="Address"
                          className="field-input"
                        />
                        <button disabled={profileState.loading} className="primary-btn w-full disabled:opacity-50">
                          {profileState.loading ? "Saving..." : "Save Profile"}
                        </button>
                        {profileState.message && <p className="text-xs text-slate-600">{profileState.message}</p>}
                      </div>
                    </form>

                    <form onSubmit={submitPasswordUpdate} className="form-card">
                      <h3 className="section-title">Security</h3>
                      <div className="mt-3 grid gap-2.5">
                        <input
                          required
                          type="password"
                          value={passwordForm.oldPassword}
                          onChange={(e) => setPasswordForm((p) => ({ ...p, oldPassword: e.target.value }))}
                          placeholder="Old password"
                          className="field-input"
                        />
                        <input
                          required
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                          placeholder="New password"
                          className="field-input"
                        />
                        <input
                          required
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          className="field-input"
                        />
                        <button disabled={passwordState.loading} className="primary-btn w-full disabled:opacity-50">
                          {passwordState.loading ? "Updating..." : "Update Password"}
                        </button>
                        {passwordState.message && <p className="text-xs text-slate-600">{passwordState.message}</p>}

                        <button type="button" onClick={logout} className="secondary-btn mt-2">
                          Logout
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="form-card">
                    <button onClick={() => setAuthModalOpen(true)} className="primary-btn">
                      Open Login / Register
                    </button>
                  </div>
                )}
              </>
            )}
            </section>
          </div>
        </main>
      </div>

      {selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-3xl">
            <div className="grid gap-4 md:grid-cols-[1fr,1.1fr]">
              <img src={imageUrl(selectedProduct.imageUrl)} alt={selectedProduct.title} className="h-72 w-full rounded-xl object-cover" />
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-2xl font-semibold text-slate-900">{selectedProduct.title}</h3>
                  <button onClick={() => setSelectedProduct(null)} className="close-btn" aria-label="Close product details">
                    x
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-600">{selectedProduct.description || "-"}</p>
                <p className="mt-3 text-sm text-slate-700">
                  <strong className="text-slate-900">Price:</strong> {price(selectedProduct.price)}
                </p>
                <p className="text-sm text-slate-700">
                  <strong className="text-slate-900">Category:</strong> {selectedProduct.category || "-"}
                </p>
                <p className="text-sm text-slate-700">
                  <strong className="text-slate-900">Stock:</strong> {selectedProduct.quantity || 0}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      addToCart(selectedProduct._id);
                      setSelectedProduct(null);
                    }}
                    className="primary-btn"
                  >
                    Add to Cart
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(selectedProduct._id)}
                    className="secondary-btn"
                  >
                    {wishlist.includes(selectedProduct._id) ? "Remove from Wishlist" : "Save to Wishlist"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderRequestModal.open && orderRequestModal.order && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-lg">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {orderRequestModal.type === "cancel" ? "Request Cancellation" : "Request Return"}
                </h3>
                <p className="text-xs text-slate-500">{orderRequestModal.order.orderNumber}</p>
              </div>
              <button onClick={closeOrderRequestModal} className="close-btn" aria-label="Close order request">
                x
              </button>
            </div>
            <form onSubmit={submitOrderRequest} className="mt-3 space-y-3">
              <p className="text-sm text-slate-600">
                {orderRequestModal.type === "cancel"
                  ? "Tell us why you need this order cancelled."
                  : "Tell us why you want to return this order."}
              </p>
              <textarea
                required
                rows={4}
                value={orderRequestModal.reason}
                onChange={(e) => setOrderRequestModal((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={
                  orderRequestModal.type === "cancel"
                    ? "Example: wrong size was selected"
                    : "Example: product fit was not as expected"
                }
                className="field-input w-full"
              />
              {orderRequestModal.message && <p className="text-xs font-medium text-rose-600">{orderRequestModal.message}</p>}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={orderRequestModal.loading}
                  className="primary-btn flex-1 disabled:opacity-50"
                >
                  {orderRequestModal.loading ? "Submitting..." : "Submit Request"}
                </button>
                <button type="button" onClick={closeOrderRequestModal} className="secondary-btn flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {authModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card w-full max-w-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">{authMode === "login" ? "Login" : "Create Account"}</h3>
              <button onClick={() => setAuthModalOpen(false)} className="close-btn" aria-label="Close authentication">
                x
              </button>
            </div>
            <form onSubmit={submitAuth} className="mt-4 space-y-3">
              {authMode === "signup" && (
                <input
                  required
                  value={authForm.name}
                  onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Name"
                  className="field-input w-full"
                />
              )}
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
                className="field-input w-full"
              />
              <input
                required
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                placeholder="Password"
                className="field-input w-full"
              />
              {authError && <p className="text-xs font-medium text-rose-600">{authError}</p>}
              <div className="flex gap-2">
                <button className="primary-btn flex-1">{authMode === "login" ? "Login" : "Create"}</button>
                <button
                  type="button"
                  onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
                  className="secondary-btn flex-1"
                >
                  {authMode === "login" ? "Need account?" : "Have account?"}
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
