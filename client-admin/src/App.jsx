import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const BRAND_NAME = "Ecommerce Clothing";

const formatPrice = (value) =>
  Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "$0.00";

const buildImage = (url) => (url?.startsWith("http") ? url : `${API_BASE}${url || ""}`);

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    price: "",
    sizes: "S,M,L",
    category: "New In",
  });
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("adminAuth");
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", adminKey: "" });

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/products`);
        const data = await res.json();
        setProducts(data);
      } catch (err) {
        console.error("Failed to fetch products", err);
        setError("Unable to load products right now.");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormState({
      title: "",
      description: "",
      price: "",
      sizes: "S,M,L",
      category: "New In",
    });
    setImageFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth) {
      setError("Login as admin to upload.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = new FormData();
      Object.entries(formState).forEach(([key, val]) => payload.append(key, val));
      if (imageFile) {
        payload.append("image", imageFile);
      }
      const res = await fetch(`${API_BASE}/api/products`, {
        method: "POST",
        body: payload,
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Upload failed");
      }
      const created = await res.json();
      setProducts((prev) => [created, ...prev]);
      resetForm();
    } catch (err) {
      console.error(err);
      setError("Could not save product. Check admin permissions and connectivity.");
    } finally {
      setSubmitting(false);
    }
  };

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
      const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Auth failed");
      const data = await res.json();
      if (data.user.role !== "admin") {
        throw new Error("Admin role required");
      }
      setAuth(data);
      localStorage.setItem("adminAuth", JSON.stringify(data));
      setAuthForm({ name: "", email: "", password: "", adminKey: "" });
    } catch (err) {
      console.error(err);
      setError("Authentication failed. Ensure admin key and credentials are correct.");
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem("adminAuth");
  };

  const disableActions = !auth || auth.user.role !== "admin";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f7f9] to-[#f0f2f7] text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">{BRAND_NAME} Admin</div>
          <div className="flex items-center gap-3">
            <a
              href="http://localhost:5173"
              className="rounded-full border border-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-900 transition hover:bg-gray-900 hover:text-white"
            >
              View Storefront
            </a>
            {auth ? (
              <button
                onClick={logout}
                className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {!auth && (
          <section className="mb-10 grid gap-6 rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-sm lg:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Admin Access</p>
              <h3 className="text-2xl font-semibold text-gray-900">Login or create admin account</h3>
              <p className="text-sm text-gray-600">
                Protect uploads with an admin token. Use the configured ADMIN_KEY to create admin accounts.
              </p>
            </div>
            <form onSubmit={handleAuthSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              {authMode === "signup" && (
                <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                  Full name
                  <input
                    required
                    name="name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Alex Admin"
                    className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                  />
                </label>
              )}
              <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-gray-700">
                Email
                <input
                  required
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="admin@email.com"
                  className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                />
              </label>
              <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-gray-700">
                Password
                <input
                  required
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                  className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                />
              </label>
              {authMode === "signup" && (
                <label className="mt-3 flex flex-col gap-2 text-sm font-semibold text-gray-700">
                  Admin key
                  <input
                    required
                    name="adminKey"
                    value={authForm.adminKey}
                    onChange={(e) => setAuthForm((p) => ({ ...p, adminKey: e.target.value }))}
                    placeholder="ADMIN_KEY from server env"
                    className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                  />
                </label>
              )}
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  {authMode === "login" ? "Login" : "Create admin"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
                  className="rounded-full border border-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-gray-900 transition hover:bg-gray-900 hover:text-white"
                >
                  {authMode === "login" ? "Need an admin account?" : "Have an admin account?"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Admin</p>
              <h3 className="text-2xl font-semibold text-gray-900">Upload a new product</h3>
              <p className="text-sm text-gray-500">
                Images save locally to `/uploads` and require admin auth to create.
              </p>
            </div>
            <span className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide ${disableActions ? "bg-gray-300 text-gray-700" : "bg-gray-900 text-white"}`}>
              {disableActions ? "Login required" : "Admin live"}
            </span>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                Product title
                <input
                  required
                  name="title"
                  value={formState.title}
                  onChange={handleChange}
                  placeholder="Red dress / Coastal tee"
                  className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                  disabled={disableActions}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                Price (USD)
                <input
                  required
                  name="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.price}
                  onChange={handleChange}
                  placeholder="200"
                  className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                  disabled={disableActions}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                Category
                <input
                  name="category"
                  value={formState.category}
                  onChange={handleChange}
                  placeholder="Apparel, New In..."
                  className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                  disabled={disableActions}
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                Sizes (comma separated)
                <input
                  name="sizes"
                  value={formState.sizes}
                  onChange={handleChange}
                  placeholder="XS,S,M,L,XL"
                  className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                  disabled={disableActions}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
              Description
              <textarea
                name="description"
                rows="3"
                value={formState.description}
                onChange={handleChange}
                placeholder="Short product story and material details..."
                className="rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400"
                disabled={disableActions}
              />
            </label>
            <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
              <label className={`flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed ${disableActions ? "border-gray-200 bg-gray-100" : "border-gray-300 bg-gray-50/60 hover:border-gray-400"} px-4 py-6 text-center text-sm font-semibold text-gray-600`}>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  disabled={disableActions}
                />
                <span className="text-lg">Drop or select an image</span>
                <span className="text-xs text-gray-500">JPG, PNG up to 5MB</span>
              </label>
              <div className="flex h-full items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    Preview appears here
                  </div>
                )}
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={disableActions || submitting}
                className="rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? "Saving..." : "Save product"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={disableActions}
                className="rounded-full border border-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-gray-900 transition hover:bg-gray-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white/80 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-lg font-semibold text-gray-900">Recently added</h4>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">
              {products.length} products
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {products.slice(0, 6).map((p) => (
              <div
                key={`admin-${p._id}`}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-3"
              >
                <div className="h-16 w-16 overflow-hidden rounded-lg bg-gray-100">
                  {p.imageUrl ? (
                    <img src={buildImage(p.imageUrl)} alt={p.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-500">No image</div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    {p.category} • {formatPrice(p.price)}
                  </p>
                </div>
              </div>
            ))}
            {!products.length && (
              <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500">
                Nothing here yet—upload your first product.
              </div>
            )}
          </div>
          {loading && (
            <div className="mt-4 text-sm text-gray-500">Loading products...</div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white/90 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">{BRAND_NAME}</p>
            <p className="text-sm text-gray-500">Admin console for clothing uploads.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-gray-500">
            <span>Shipping worldwide</span>
            <span>Instagram</span>
            <span>Youtube</span>
            <span>LinkedIn</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
