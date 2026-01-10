import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const BRAND_NAME = "Ecommerce Clothing";

const formatPrice = (value) =>
  Number.isFinite(Number(value)) ? `$${Number(value).toFixed(2)}` : "$0.00";

const buildImage = (url) => (url?.startsWith("http") ? url : `${API_BASE}${url || ""}`);

function ProductCard({ product }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200 transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="relative h-64 w-full overflow-hidden bg-gradient-to-br from-slate-100 to-gray-200">
        {product.imageUrl ? (
          <img
            src={buildImage(product.imageUrl)}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">No image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent" />
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-gray-900">{product.title}</h3>
          <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
            {formatPrice(product.price)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-gray-600">{product.description}</p>
        <div className="mt-auto flex items-center justify-between text-xs uppercase tracking-wide text-gray-500">
          <span>{product.category || "Apparel"}</span>
          <span className="flex gap-1">
            {product.sizes?.length ? product.sizes.slice(0, 3).join(" • ") : "One size"}
          </span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem("userAuth");
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const heroProduct = useMemo(() => products[0] || null, [products]);

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

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = authMode === "login" ? "login" : "signup";
      const payload = { email: authForm.email, password: authForm.password };
      if (authMode === "signup") payload.name = authForm.name || "Fashion Lover";
      const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Auth failed");
      const data = await res.json();
      setAuth(data);
      localStorage.setItem("userAuth", JSON.stringify(data));
      setAuthForm({ name: "", email: "", password: "" });
    } catch (err) {
      console.error(err);
      setError("Authentication failed. Check details and retry.");
    }
  };

  const logout = () => {
    setAuth(null);
    localStorage.removeItem("userAuth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f7f7f9] to-[#f0f2f7] text-gray-900">
      <header className="sticky top-0 z-20 border-b border-gray-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-2xl font-semibold tracking-tight text-gray-900">{BRAND_NAME}</div>
          <nav className="hidden items-center gap-8 text-sm font-medium uppercase text-gray-600 sm:flex">
            <a href="#hero" className="hover:text-gray-900">
              Home
            </a>
            <a href="#latest" className="hover:text-gray-900">
              New In
            </a>
            <a href="#catalog" className="hover:text-gray-900">
              Apparel
            </a>
          </nav>
          {auth ? (
            <div className="flex items-center gap-3 text-sm text-gray-700">
              <span className="rounded-full bg-gray-100 px-3 py-1 font-semibold">Hi, {auth.user.name}</span>
              <button
                onClick={logout}
                className="rounded-full border border-gray-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-900 transition hover:bg-gray-900 hover:text-white"
              >
                Logout
              </button>
            </div>
          ) : (
            <a
              href="#account"
              className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Login / Signup
            </a>
          )}
        </div>
      </header>

      <main>
        <section
          id="hero"
          className="relative isolate overflow-hidden border-b border-gray-200/60 bg-white"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-slate-100 via-white to-slate-50" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gray-500">
                New Collection
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-gray-900 md:text-5xl">
                Contemporary clothing looks, bold silhouettes, luxe textures.
              </h1>
              <p className="max-w-xl text-lg text-gray-600">
                Curated apparel inspired by the reference visuals: modern tailoring, plush
                outerwear, and statement tees ready to ship worldwide.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="#latest"
                  className="rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  Shop the drop
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br from-gray-900/10 to-transparent blur-2xl" />
              <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-gradient-to-br from-indigo-100 to-transparent blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl">
                {heroProduct ? (
                  <img
                    src={buildImage(heroProduct.imageUrl)}
                    alt={heroProduct.title}
                    className="h-[420px] w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-[420px] items-center justify-center bg-gradient-to-br from-gray-100 to-white text-gray-500">
                    Add products via the admin site to fill this hero.
                  </div>
                )}
                {heroProduct && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-white/70">
                          Featured look
                        </p>
                        <h2 className="text-2xl font-semibold">{heroProduct.title}</h2>
                      </div>
                      <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-900">
                        {formatPrice(heroProduct.price)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="latest" className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Latest Drop</p>
              <h3 className="text-2xl font-semibold text-gray-900">Fresh apparel arrivals</h3>
            </div>
            <span className="text-sm text-gray-500">Shipping Worldwide</span>
          </div>
          {loading ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-10 text-center text-gray-500">
              Loading products...
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.slice(0, 6).map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
              {!products.length && (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white/60 p-10 text-center text-gray-500">
                  No products yet. Add some from the admin app.
                </div>
              )}
            </div>
          )}
        </section>

        <section
          id="catalog"
          className="border-t border-b border-gray-200/80 bg-white/90 py-12"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-gray-900">Explore more looks</h3>
              <span className="text-sm uppercase tracking-[0.2em] text-gray-500">
                Apparel • Street • Minimal
              </span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={`grid-${product._id}`} product={product} />
              ))}
              {!products.length && (
                <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-500">
                  Waiting for uploads...
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          id="account"
          className="border-b border-gray-200 bg-white/90"
        >
          <div className="mx-auto max-w-5xl px-6 py-12 grid gap-8 lg:grid-cols-2 items-start">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Account</p>
              <h3 className="text-2xl font-semibold text-gray-900">Login or create an account</h3>
              <p className="text-sm text-gray-600">
                Save your favorites, get faster checkout, and track orders. This flow mirrors modern clothing e-commerce patterns with quick auth and session badges.
              </p>
              {auth && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Logged in as {auth.user.email}
                </div>
              )}
            </div>
            <form onSubmit={handleAuthSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              {authMode === "signup" && (
                <label className="flex flex-col gap-2 text-sm font-semibold text-gray-700">
                  Full name
                  <input
                    required
                    name="name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Alex Doe"
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
                  placeholder="you@email.com"
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
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  {authMode === "login" ? "Login" : "Create account"}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((m) => (m === "login" ? "signup" : "login"))}
                  className="rounded-full border border-gray-900 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-gray-900 transition hover:bg-gray-900 hover:text-white"
                >
                  {authMode === "login" ? "Need an account?" : "Have an account?"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white/90 py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">{BRAND_NAME}</p>
            <p className="text-sm text-gray-500">
              Clothing-first stack: React (user) + Express + Mongo + local uploads.
            </p>
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
