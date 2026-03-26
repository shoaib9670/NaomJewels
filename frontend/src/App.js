import { createContext, useContext, useState, useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Link, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShoppingBag, Heart, User, MagnifyingGlass, X, List, 
  Plus, Minus, Trash, ChatCircleDots, PaperPlaneTilt,
  Check, CaretRight, Funnel, ArrowLeft, SpinnerGap
} from "@phosphor-icons/react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ==================== CONTEXT ====================
const AppContext = createContext();

export const useApp = () => useContext(AppContext);

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [wishlist, setWishlist] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const token = localStorage.getItem("naom_token");

  const authHeaders = useCallback(() => {
    const t = localStorage.getItem("naom_token");
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API}/auth/me`, { headers: authHeaders() });
      setUser(res.data);
    } catch (e) {
      localStorage.removeItem("naom_token");
    } finally {
      setIsLoading(false);
    }
  }, [token, authHeaders]);

  const fetchCart = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/cart`, { headers: authHeaders() });
      setCart(res.data);
    } catch (e) {
      console.error("Failed to fetch cart");
    }
  }, [token, authHeaders]);

  const fetchWishlist = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/wishlist`, { headers: authHeaders() });
      setWishlist(res.data.items || []);
    } catch (e) {
      console.error("Failed to fetch wishlist");
    }
  }, [token, authHeaders]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user) {
      fetchCart();
      fetchWishlist();
    }
  }, [user, fetchCart, fetchWishlist]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem("naom_token", res.data.access_token);
    setUser(res.data.user);
    setShowAuth(false);
    toast.success("Welcome back!");
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await axios.post(`${API}/auth/register`, { name, email, password });
    localStorage.setItem("naom_token", res.data.access_token);
    setUser(res.data.user);
    setShowAuth(false);
    toast.success("Welcome to NAOM Jewels!");
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem("naom_token");
    setUser(null);
    setCart({ items: [], total: 0 });
    setWishlist([]);
    toast.success("Logged out successfully");
  };

  const addToCart = async (productId, quantity = 1) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    try {
      await axios.post(`${API}/cart/add`, { product_id: productId, quantity }, { headers: authHeaders() });
      await fetchCart();
      toast.success("Added to cart");
    } catch (e) {
      toast.error("Failed to add to cart");
    }
  };

  const updateCartItem = async (productId, quantity) => {
    try {
      await axios.put(`${API}/cart/update`, { product_id: productId, quantity }, { headers: authHeaders() });
      await fetchCart();
    } catch (e) {
      toast.error("Failed to update cart");
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${API}/cart/${productId}`, { headers: authHeaders() });
      await fetchCart();
      toast.success("Removed from cart");
    } catch (e) {
      toast.error("Failed to remove item");
    }
  };

  const addToWishlist = async (productId) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    try {
      await axios.post(`${API}/wishlist/add`, { product_id: productId }, { headers: authHeaders() });
      await fetchWishlist();
      toast.success("Added to wishlist");
    } catch (e) {
      toast.error("Failed to add to wishlist");
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      await axios.delete(`${API}/wishlist/${productId}`, { headers: authHeaders() });
      await fetchWishlist();
      toast.success("Removed from wishlist");
    } catch (e) {
      toast.error("Failed to remove from wishlist");
    }
  };

  const isInWishlist = (productId) => wishlist.some(item => item.id === productId);

  return (
    <AppContext.Provider value={{
      user, cart, wishlist, isLoading, showAuth, showCart,
      setShowAuth, setShowCart, login, register, logout,
      addToCart, updateCartItem, removeFromCart,
      addToWishlist, removeFromWishlist, isInWishlist, fetchCart,
      authHeaders
    }}>
      {children}
    </AppContext.Provider>
  );
};

// ==================== COMPONENTS ====================
const Header = () => {
  const { user, cart, setShowAuth, setShowCart, logout } = useApp();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
      setShowSearch(false);
      setSearchQuery("");
    }
  };

  const categories = [
    { id: "rings", name: "Rings" },
    { id: "necklaces", name: "Necklaces" },
    { id: "earrings", name: "Earrings" },
    { id: "bracelets", name: "Bracelets" },
    { id: "bangles", name: "Bangles" },
    { id: "anklets", name: "Anklets" },
    { id: "pendants", name: "Pendants" },
    { id: "nose-pins", name: "Nose Pins" }
  ];

  return (
    <>
      <header className="glass sticky top-0 z-50 border-b border-black/5" data-testid="header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setShowMobileMenu(true)}
              data-testid="mobile-menu-btn"
            >
              <List size={24} weight="light" />
            </button>

            {/* Logo */}
            <Link to="/" className="flex-shrink-0" data-testid="logo">
              <h1 className="text-xl md:text-2xl tracking-[0.2em] font-light" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                NAOM
              </h1>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              {categories.slice(0, 5).map(cat => (
                <Link 
                  key={cat.id}
                  to={`/products?category=${cat.id}`}
                  className="text-xs tracking-[0.15em] uppercase hover:text-[#C99A82] transition-colors link-underline"
                  data-testid={`nav-${cat.id}`}
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => setShowSearch(true)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
                data-testid="search-btn"
              >
                <MagnifyingGlass size={20} weight="light" />
              </button>

              {user ? (
                <>
                  <Link to="/wishlist" className="p-2 hover:bg-black/5 rounded-full transition-colors" data-testid="wishlist-btn">
                    <Heart size={20} weight="light" />
                  </Link>
                  <Link to="/profile" className="p-2 hover:bg-black/5 rounded-full transition-colors" data-testid="profile-btn">
                    <User size={20} weight="light" />
                  </Link>
                </>
              ) : (
                <button 
                  onClick={() => setShowAuth(true)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                  data-testid="login-btn"
                >
                  <User size={20} weight="light" />
                </button>
              )}

              <button 
                onClick={() => setShowCart(true)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors relative"
                data-testid="cart-btn"
              >
                <ShoppingBag size={20} weight="light" />
                {cart.items.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#1A1918] text-white text-[10px] rounded-full flex items-center justify-center">
                    {cart.items.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <AnimatePresence>
        {showSearch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20"
            onClick={() => setShowSearch(false)}
          >
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-white w-full max-w-2xl mx-4 p-6"
              onClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleSearch} className="flex items-center gap-4">
                <MagnifyingGlass size={24} weight="light" className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search for jewelry..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 text-lg border-none outline-none"
                  autoFocus
                  data-testid="search-input"
                />
                <button type="button" onClick={() => setShowSearch(false)}>
                  <X size={24} weight="light" />
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <div className={`mobile-menu ${showMobileMenu ? 'open' : ''}`}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-medium" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Menu</h2>
          <button onClick={() => setShowMobileMenu(false)} data-testid="close-mobile-menu">
            <X size={24} weight="light" />
          </button>
        </div>
        <nav className="p-4 space-y-4">
          {categories.map(cat => (
            <Link 
              key={cat.id}
              to={`/products?category=${cat.id}`}
              className="block text-sm tracking-[0.1em] uppercase py-2"
              onClick={() => setShowMobileMenu(false)}
            >
              {cat.name}
            </Link>
          ))}
          <div className="border-t pt-4 mt-4">
            {user ? (
              <>
                <Link to="/profile" className="block py-2" onClick={() => setShowMobileMenu(false)}>My Account</Link>
                <Link to="/wishlist" className="block py-2" onClick={() => setShowMobileMenu(false)}>Wishlist</Link>
                <Link to="/orders" className="block py-2" onClick={() => setShowMobileMenu(false)}>Orders</Link>
                <button onClick={() => { logout(); setShowMobileMenu(false); }} className="block py-2 text-red-600">Logout</button>
              </>
            ) : (
              <button onClick={() => { setShowAuth(true); setShowMobileMenu(false); }} className="block py-2">Login / Register</button>
            )}
          </div>
        </nav>
      </div>
    </>
  );
};

const Footer = () => (
  <footer className="bg-[#1A1918] text-white py-16 md:py-20" data-testid="footer">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        <div>
          <h3 className="text-2xl tracking-[0.2em] mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>NAOM</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Crafting timeless elegance. Every piece tells a story of beauty and sophistication.
          </p>
        </div>
        <div>
          <h4 className="text-xs tracking-[0.2em] uppercase mb-6">Shop</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li><Link to="/products?category=rings" className="hover:text-white transition-colors">Rings</Link></li>
            <li><Link to="/products?category=necklaces" className="hover:text-white transition-colors">Necklaces</Link></li>
            <li><Link to="/products?category=earrings" className="hover:text-white transition-colors">Earrings</Link></li>
            <li><Link to="/products?category=bracelets" className="hover:text-white transition-colors">Bracelets</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs tracking-[0.2em] uppercase mb-6">Help</h4>
          <ul className="space-y-3 text-sm text-gray-400">
            <li><a href="#" className="hover:text-white transition-colors">Shipping & Returns</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Track Order</a></li>
            <li><a href="#" className="hover:text-white transition-colors">FAQs</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-xs tracking-[0.2em] uppercase mb-6">Newsletter</h4>
          <p className="text-sm text-gray-400 mb-4">Subscribe for exclusive offers and updates.</p>
          <form className="flex">
            <input 
              type="email" 
              placeholder="Your email"
              className="flex-1 bg-white/10 px-4 py-3 text-sm border-none outline-none"
            />
            <button className="bg-[#C99A82] px-4 hover:bg-[#B3856E] transition-colors">
              <PaperPlaneTilt size={18} weight="light" />
            </button>
          </form>
        </div>
      </div>
      <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-gray-500">
        <p>&copy; 2024 NAOM Jewels. All rights reserved.</p>
      </div>
    </div>
  </footer>
);

const ProductCard = ({ product }) => {
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useApp();
  const inWishlist = isInWishlist(product.id);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="product-card bg-white border border-black/5 group"
      data-testid={`product-card-${product.id}`}
    >
      <Link to={`/product/${product.id}`} className="block relative overflow-hidden aspect-square">
        <img 
          src={product.images[0]} 
          alt={product.name}
          className="product-image w-full h-full object-cover"
        />
        {product.is_bestseller && (
          <span className="absolute top-3 left-3 badge-bestseller text-[10px] tracking-[0.1em] uppercase px-2 py-1">
            Bestseller
          </span>
        )}
        {product.is_new && (
          <span className="absolute top-3 left-3 badge-new text-[10px] tracking-[0.1em] uppercase px-2 py-1">
            New
          </span>
        )}
      </Link>
      <div className="p-4">
        <Link to={`/product/${product.id}`}>
          <h3 className="text-sm font-medium mb-1 line-clamp-1">{product.name}</h3>
        </Link>
        <p className="text-xs text-gray-500 capitalize mb-2">{product.metal}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">${product.price.toFixed(2)}</span>
            {product.original_price && (
              <span className="price-original text-xs">${product.original_price.toFixed(2)}</span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.preventDefault(); inWishlist ? removeFromWishlist(product.id) : addToWishlist(product.id); }}
              className="p-2 hover:bg-black/5 rounded-full"
              data-testid={`wishlist-toggle-${product.id}`}
            >
              <Heart size={18} weight={inWishlist ? "fill" : "light"} className={inWishlist ? "text-red-500" : ""} />
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); addToCart(product.id); }}
              className="p-2 hover:bg-black/5 rounded-full"
              data-testid={`add-to-cart-${product.id}`}
            >
              <ShoppingBag size={18} weight="light" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const CartDrawer = () => {
  const { cart, showCart, setShowCart, updateCartItem, removeFromCart, user } = useApp();
  const navigate = useNavigate();

  const handleCheckout = () => {
    setShowCart(false);
    navigate("/checkout");
  };

  return (
    <>
      <AnimatePresence>
        {showCart && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setShowCart(false)}
          />
        )}
      </AnimatePresence>
      <div className={`cart-drawer ${showCart ? 'open' : ''}`} data-testid="cart-drawer">
        <div className="h-full flex flex-col">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Your Cart ({cart.items.length})</h2>
            <button onClick={() => setShowCart(false)} data-testid="close-cart">
              <X size={24} weight="light" />
            </button>
          </div>

          {cart.items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <ShoppingBag size={48} weight="light" className="text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Your cart is empty</p>
              <button onClick={() => { setShowCart(false); navigate("/products"); }} className="btn-secondary">
                Continue Shopping
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.items.map(item => (
                  <div key={item.product_id} className="flex gap-4" data-testid={`cart-item-${item.product_id}`}>
                    <img 
                      src={item.product?.images?.[0]} 
                      alt={item.product?.name}
                      className="w-20 h-20 object-cover"
                    />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium line-clamp-1">{item.product?.name}</h4>
                      <p className="text-xs text-gray-500 capitalize">{item.product?.metal}</p>
                      <p className="text-sm font-medium mt-1">${item.product?.price?.toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="quantity-selector">
                          <button onClick={() => updateCartItem(item.product_id, item.quantity - 1)}>
                            <Minus size={14} />
                          </button>
                          <span className="text-sm">{item.quantity}</span>
                          <button onClick={() => updateCartItem(item.product_id, item.quantity + 1)}>
                            <Plus size={14} />
                          </button>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          data-testid={`remove-cart-item-${item.product_id}`}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t">
                <div className="flex justify-between mb-4">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">${cart.total.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handleCheckout}
                  className="btn-primary w-full"
                  data-testid="checkout-btn"
                >
                  Checkout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

const AuthModal = () => {
  const { showAuth, setShowAuth, login, register } = useApp();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  // Reset form when switching modes or closing modal
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ name: "", email: "", password: "" });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.name, formData.email, formData.password);
      }
      setFormData({ name: "", email: "", password: "" });
    } catch (err) {
      setError(err.response?.data?.detail || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (!showAuth) return null;

  return (
    <div className="auth-modal" data-testid="auth-modal">
      <div className="auth-backdrop" onClick={() => setShowAuth(false)} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-white w-full max-w-md mx-4 p-8"
      >
        <button 
          onClick={() => setShowAuth(false)}
          className="absolute top-4 right-4"
          data-testid="close-auth-modal"
        >
          <X size={24} weight="light" />
        </button>

        <h2 className="text-2xl mb-6 text-center" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Full Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-black/10 text-sm"
              required
              data-testid="register-name-input"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-3 border border-black/10 text-sm"
            required
            data-testid="email-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="w-full px-4 py-3 border border-black/10 text-sm"
            required
            data-testid="password-input"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button 
            type="submit" 
            className="btn-primary w-full"
            disabled={loading}
            data-testid="auth-submit-btn"
          >
            {loading ? "Please wait..." : (isLogin ? "Sign In" : "Create Account")}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button 
            onClick={toggleMode}
            className="ml-1 text-[#C99A82] hover:underline"
            data-testid="toggle-auth-mode"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm your NAOM Jewels assistant. How can I help you find the perfect piece today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${API}/ai/chat`, { 
        message: userMessage, 
        session_id: sessionId 
      });
      setSessionId(res.data.session_id);
      setMessages(prev => [...prev, { role: "assistant", content: res.data.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget" data-testid="ai-chat-widget">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="chat-panel"
          >
            <div className="bg-gradient-to-br from-[#F5F2EE] via-[#FCFAF9] to-[#C99A82]/10 p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium" style={{ fontFamily: 'Cormorant Garamond, serif' }}>NAOM Assistant</h3>
                  <p className="text-xs text-gray-500">AI-powered help</p>
                </div>
                <button onClick={() => setIsOpen(false)} data-testid="close-chat">
                  <X size={20} weight="light" />
                </button>
              </div>
            </div>

            <div className="h-72 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                    msg.role === "user" 
                      ? "bg-[#1A1918] text-white" 
                      : "bg-[#F5F2EE]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#F5F2EE] p-3 rounded-lg">
                    <SpinnerGap size={18} className="animate-spin" />
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="p-4 border-t flex gap-2">
              <input
                type="text"
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-3 py-2 border border-black/10 text-sm rounded-none"
                data-testid="chat-input"
              />
              <button 
                type="submit" 
                className="p-2 bg-[#1A1918] text-white"
                disabled={loading}
                data-testid="send-message-btn"
              >
                <PaperPlaneTilt size={18} weight="light" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="chat-bubble"
        data-testid="open-chat-btn"
      >
        {isOpen ? <X size={24} weight="light" color="white" /> : <ChatCircleDots size={24} weight="light" color="white" />}
      </button>
    </div>
  );
};

// ==================== PAGES ====================
const HomePage = () => {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState({ bestsellers: [], new_arrivals: [] });
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, featRes, recRes] = await Promise.all([
          axios.get(`${API}/categories`),
          axios.get(`${API}/products/featured`),
          axios.get(`${API}/ai/recommendations`)
        ]);
        setCategories(catRes.data.categories);
        setFeatured(featRes.data);
        setRecommendations(recRes.data.recommendations || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    // Seed data first
    axios.post(`${API}/seed`).then(() => fetchData()).catch(() => fetchData());
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <main data-testid="home-page">
      {/* Hero Section */}
      <section className="hero-section relative" data-testid="hero-section">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1771621089868-47780cb7dfb9?w=1920&q=80)` }}
        />
        <div className="hero-overlay" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-lg"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-none mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Timeless Elegance, Modern Design
            </h1>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Discover our curated collection of fine jewelry, where each piece tells a story of craftsmanship and beauty.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/products" className="btn-primary" data-testid="shop-now-btn">Shop Now</Link>
              <Link to="/products?category=necklaces" className="btn-secondary">Explore Collections</Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-24" data-testid="categories-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-12 text-center" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Shop by Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {categories.slice(0, 8).map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Link to={`/products?category=${cat.id}`} className="category-card block">
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                  <div className="category-overlay" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white text-lg" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{cat.name}</h3>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bestsellers */}
      <section className="py-16 md:py-24 bg-[#F5F2EE]" data-testid="bestsellers-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Bestsellers
            </h2>
            <Link to="/products?sort=popular" className="text-sm tracking-[0.1em] uppercase flex items-center gap-2 hover:text-[#C99A82]">
              View All <CaretRight size={16} />
            </Link>
          </div>
          <div className="products-grid">
            {featured.bestsellers.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <section className="py-16 md:py-24" data-testid="recommendations-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <p className="text-xs tracking-[0.2em] uppercase text-[#C99A82] mb-2">AI Curated</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                Recommended For You
              </h2>
            </div>
            <div className="products-grid">
              {recommendations.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Arrivals */}
      <section className="py-16 md:py-24 bg-[#1A1918] text-white" data-testid="new-arrivals-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              New Arrivals
            </h2>
            <Link to="/products?sort=newest" className="text-sm tracking-[0.1em] uppercase flex items-center gap-2 hover:text-[#C99A82]">
              View All <CaretRight size={16} />
            </Link>
          </div>
          <div className="products-grid">
            {featured.new_arrivals.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#F5F2EE] to-[#C99A82]/10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-6" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Need Help Finding the Perfect Piece?
          </h2>
          <p className="text-gray-600 mb-8">
            Our AI assistant is here to help you discover jewelry that matches your style and occasion.
          </p>
          <button 
            onClick={() => document.querySelector('[data-testid="open-chat-btn"]')?.click()}
            className="btn-primary"
          >
            Chat with Our Assistant
          </button>
        </div>
      </section>
    </main>
  );
};

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "newest";
  const metal = searchParams.get("metal") || "";

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.append("category", category);
        if (search) params.append("search", search);
        if (sort) params.append("sort", sort);
        if (metal) params.append("metal", metal);

        const res = await axios.get(`${API}/products?${params.toString()}`);
        setProducts(res.data.products);
        setTotal(res.data.total);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [category, search, sort, metal]);

  const updateFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const categories = ["rings", "necklaces", "earrings", "bracelets", "bangles", "anklets", "pendants", "nose-pins"];
  const metals = ["gold", "silver", "rose gold", "platinum"];

  return (
    <main className="min-h-screen" data-testid="products-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl tracking-tight capitalize" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              {category ? category.replace("-", " ") : search ? `Search: "${search}"` : "All Jewelry"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">{total} products</p>
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center gap-2 text-sm"
            data-testid="toggle-filters-btn"
          >
            <Funnel size={18} /> Filters
          </button>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          <aside className={`filter-sidebar w-64 shrink-0 ${showFilters ? 'block' : 'hidden'} md:block`} data-testid="filters-sidebar">
            <div className="space-y-6">
              {/* Sort */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-3">Sort By</h4>
                <select 
                  value={sort} 
                  onChange={(e) => updateFilter("sort", e.target.value)}
                  className="w-full p-2 border border-black/10 text-sm"
                  data-testid="sort-select"
                >
                  <option value="newest">Newest</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="popular">Most Popular</option>
                </select>
              </div>

              {/* Category */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-3">Category</h4>
                <div className="space-y-2">
                  <button 
                    onClick={() => updateFilter("category", "")}
                    className={`block text-sm ${!category ? "font-medium text-[#C99A82]" : "text-gray-600 hover:text-black"}`}
                  >
                    All Categories
                  </button>
                  {categories.map(cat => (
                    <button 
                      key={cat}
                      onClick={() => updateFilter("category", cat)}
                      className={`block text-sm capitalize ${category === cat ? "font-medium text-[#C99A82]" : "text-gray-600 hover:text-black"}`}
                      data-testid={`filter-category-${cat}`}
                    >
                      {cat.replace("-", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metal */}
              <div>
                <h4 className="text-xs tracking-[0.2em] uppercase mb-3">Metal</h4>
                <div className="space-y-2">
                  <button 
                    onClick={() => updateFilter("metal", "")}
                    className={`block text-sm ${!metal ? "font-medium text-[#C99A82]" : "text-gray-600 hover:text-black"}`}
                  >
                    All Metals
                  </button>
                  {metals.map(m => (
                    <button 
                      key={m}
                      onClick={() => updateFilter("metal", m)}
                      className={`block text-sm capitalize ${metal === m ? "font-medium text-[#C99A82]" : "text-gray-600 hover:text-black"}`}
                      data-testid={`filter-metal-${m}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="spinner" />
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state">
                <MagnifyingGlass size={48} weight="light" className="text-gray-300 mb-4" />
                <h3 className="text-lg mb-2">No products found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
                <button onClick={() => setSearchParams({})} className="btn-secondary">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="products-grid" data-testid="products-grid">
                {products.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

const ProductDetailPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const { addToCart, addToWishlist, removeFromWishlist, isInWishlist } = useApp();

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/products/${id}`);
        setProduct(res.data.product);
        setRelated(res.data.related);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl mb-4">Product not found</h2>
          <Link to="/products" className="btn-secondary">Back to Products</Link>
        </div>
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);

  return (
    <main className="min-h-screen" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-500">
          <Link to="/" className="hover:text-black">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/products" className="hover:text-black">Products</Link>
          <span className="mx-2">/</span>
          <Link to={`/products?category=${product.category}`} className="hover:text-black capitalize">{product.category}</Link>
          <span className="mx-2">/</span>
          <span className="text-black">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
          {/* Images */}
          <div className="product-gallery">
            <div className="product-main-image bg-[#F5F2EE]">
              <img src={product.images[0]} alt={product.name} />
            </div>
          </div>

          {/* Details */}
          <div>
            {product.is_bestseller && (
              <span className="badge-bestseller text-[10px] tracking-[0.1em] uppercase px-2 py-1 inline-block mb-4">
                Bestseller
              </span>
            )}
            {product.is_new && (
              <span className="badge-new text-[10px] tracking-[0.1em] uppercase px-2 py-1 inline-block mb-4">
                New Arrival
              </span>
            )}

            <h1 className="text-2xl sm:text-3xl lg:text-4xl tracking-tight mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              {product.name}
            </h1>

            <div className="flex items-center gap-3 mb-6">
              <span className="text-2xl font-medium">${product.price.toFixed(2)}</span>
              {product.original_price && (
                <>
                  <span className="price-original text-lg">${product.original_price.toFixed(2)}</span>
                  <span className="text-[#2E4D43] text-sm">
                    Save {Math.round((1 - product.price / product.original_price) * 100)}%
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                {"★".repeat(Math.floor(product.rating))}
                <span className="ml-1">{product.rating}</span>
              </span>
              <span>({product.reviews_count} reviews)</span>
            </div>

            <p className="text-gray-600 leading-relaxed mb-8">{product.description}</p>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 w-20">Metal:</span>
                <span className="capitalize">{product.metal}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 w-20">Color:</span>
                <span className="capitalize">{product.color}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 w-20">Stock:</span>
                <span className={product.stock > 0 ? "text-[#2E4D43]" : "text-red-500"}>
                  {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
                </span>
              </div>
            </div>

            {/* Quantity & Actions */}
            <div className="flex items-center gap-4 mb-6">
              <div className="quantity-selector">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                  <Minus size={14} />
                </button>
                <span>{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)}>
                  <Plus size={14} />
                </button>
              </div>
              <button 
                onClick={() => inWishlist ? removeFromWishlist(product.id) : addToWishlist(product.id)}
                className="p-3 border border-black/10 hover:border-black transition-colors"
                data-testid="product-wishlist-btn"
              >
                <Heart size={20} weight={inWishlist ? "fill" : "light"} className={inWishlist ? "text-red-500" : ""} />
              </button>
            </div>

            <button 
              onClick={() => addToCart(product.id, quantity)}
              className="btn-primary w-full mb-4"
              disabled={product.stock === 0}
              data-testid="add-to-cart-btn"
            >
              {product.stock > 0 ? "Add to Cart" : "Out of Stock"}
            </button>

            <div className="border-t pt-6 mt-6">
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Check size={16} className="text-[#2E4D43]" />
                <span>Free shipping on orders over $100</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                <Check size={16} className="text-[#2E4D43]" />
                <span>30-day easy returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <section className="mt-16 pt-16 border-t">
            <h2 className="text-2xl tracking-tight mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              You May Also Like
            </h2>
            <div className="products-grid">
              {related.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

const WishlistPage = () => {
  const { wishlist, removeFromWishlist, addToCart, user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <main className="min-h-screen" data-testid="wishlist-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          My Wishlist ({wishlist.length})
        </h1>

        {wishlist.length === 0 ? (
          <div className="empty-state">
            <Heart size={48} weight="light" className="text-gray-300 mb-4" />
            <h3 className="text-lg mb-2">Your wishlist is empty</h3>
            <p className="text-gray-500 mb-4">Save items you love for later</p>
            <Link to="/products" className="btn-secondary">
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="products-grid">
            {wishlist.map(product => (
              <div key={product.id} className="product-card bg-white border border-black/5">
                <Link to={`/product/${product.id}`} className="block relative overflow-hidden aspect-square">
                  <img src={product.images[0]} alt={product.name} className="product-image w-full h-full object-cover" />
                </Link>
                <div className="p-4">
                  <Link to={`/product/${product.id}`}>
                    <h3 className="text-sm font-medium mb-1">{product.name}</h3>
                  </Link>
                  <p className="text-xs text-gray-500 capitalize mb-2">{product.metal}</p>
                  <p className="font-medium mb-4">${product.price.toFixed(2)}</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => addToCart(product.id)}
                      className="flex-1 btn-primary text-xs py-3"
                      data-testid={`wishlist-add-to-cart-${product.id}`}
                    >
                      Add to Cart
                    </button>
                    <button 
                      onClick={() => removeFromWishlist(product.id)}
                      className="p-3 border border-black/10 hover:border-red-500 hover:text-red-500"
                      data-testid={`wishlist-remove-${product.id}`}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

const CheckoutPage = () => {
  const { cart, user, authHeaders } = useApp();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleCheckout = async () => {
    if (cart.items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/checkout/create-session`,
        { origin_url: window.location.origin },
        { headers: authHeaders() }
      );
      
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      toast.error("Failed to create checkout session");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <main className="min-h-screen" data-testid="checkout-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          Checkout
        </h1>

        {/* Order Summary */}
        <div className="bg-[#F5F2EE] p-6 mb-8">
          <h2 className="text-lg mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Order Summary</h2>
          <div className="space-y-4">
            {cart.items.map(item => (
              <div key={item.product_id} className="flex gap-4">
                <img src={item.product?.images?.[0]} alt={item.product?.name} className="w-16 h-16 object-cover" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{item.product?.name}</h4>
                  <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="font-medium">${(item.product?.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-black/10 mt-4 pt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Subtotal</span>
              <span>${cart.total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">Shipping</span>
              <span>{cart.total >= 100 ? "Free" : "$9.99"}</span>
            </div>
            <div className="flex justify-between font-medium text-lg mt-4">
              <span>Total</span>
              <span>${(cart.total + (cart.total >= 100 ? 0 : 9.99)).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button 
          onClick={handleCheckout}
          className="btn-primary w-full"
          disabled={loading || cart.items.length === 0}
          data-testid="proceed-to-payment-btn"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <SpinnerGap size={18} className="animate-spin" />
              Processing...
            </span>
          ) : (
            "Proceed to Payment"
          )}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Secure checkout powered by Stripe
        </p>
      </div>
    </main>
  );
};

const CheckoutSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const { authHeaders, fetchCart } = useApp();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const checkStatus = async () => {
      if (!sessionId) {
        setStatus("error");
        return;
      }

      try {
        const res = await axios.get(`${API}/checkout/status/${sessionId}`, { headers: authHeaders() });
        if (res.data.payment_status === "paid") {
          setStatus("success");
          fetchCart();
        } else if (res.data.status === "expired") {
          setStatus("error");
        } else {
          // Keep polling
          setTimeout(checkStatus, 2000);
        }
      } catch (e) {
        setStatus("error");
      }
    };

    checkStatus();
  }, [sessionId, authHeaders, fetchCart]);

  return (
    <main className="checkout-success" data-testid="checkout-success-page">
      {status === "loading" && (
        <div>
          <div className="spinner mx-auto mb-4" />
          <h2 className="text-xl" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Processing your payment...</h2>
        </div>
      )}

      {status === "success" && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="w-20 h-20 bg-[#2E4D43] rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} weight="bold" className="text-white" />
          </div>
          <h1 className="text-3xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Thank You!</h1>
          <p className="text-gray-600 mb-8">Your order has been confirmed. We'll send you an email with your order details.</p>
          <div className="flex gap-4 justify-center">
            <Link to="/orders" className="btn-primary">View Orders</Link>
            <Link to="/products" className="btn-secondary">Continue Shopping</Link>
          </div>
        </motion.div>
      )}

      {status === "error" && (
        <div>
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X size={40} weight="bold" className="text-red-500" />
          </div>
          <h1 className="text-3xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Payment Failed</h1>
          <p className="text-gray-600 mb-8">Something went wrong with your payment. Please try again.</p>
          <Link to="/cart" className="btn-primary">Back to Cart</Link>
        </div>
      )}
    </main>
  );
};

const ProfilePage = () => {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <main className="min-h-screen" data-testid="profile-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          My Account
        </h1>

        <div className="bg-[#F5F2EE] p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#C99A82] rounded-full flex items-center justify-center">
              <User size={24} weight="light" className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-medium">{user.name}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Link to="/orders" className="block p-4 bg-white border border-black/5 hover:border-[#C99A82] transition-colors">
            <div className="flex items-center justify-between">
              <span>My Orders</span>
              <CaretRight size={18} />
            </div>
          </Link>
          <Link to="/wishlist" className="block p-4 bg-white border border-black/5 hover:border-[#C99A82] transition-colors">
            <div className="flex items-center justify-between">
              <span>Wishlist</span>
              <CaretRight size={18} />
            </div>
          </Link>
          <button 
            onClick={logout}
            className="w-full p-4 bg-white border border-black/5 hover:border-red-500 hover:text-red-500 transition-colors text-left"
            data-testid="logout-btn"
          >
            Sign Out
          </button>
        </div>
      </div>
    </main>
  );
};

const OrdersPage = () => {
  const { user, authHeaders } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    const fetchOrders = async () => {
      try {
        const res = await axios.get(`${API}/orders`, { headers: authHeaders() });
        setOrders(res.data.orders);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user, authHeaders, navigate]);

  if (!user) return null;

  return (
    <main className="min-h-screen" data-testid="orders-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl tracking-tight mb-8" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          My Orders
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner" />
          </div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <ShoppingBag size={48} weight="light" className="text-gray-300 mb-4" />
            <h3 className="text-lg mb-2">No orders yet</h3>
            <p className="text-gray-500 mb-4">Start shopping to see your orders here</p>
            <Link to="/products" className="btn-secondary">
              Shop Now
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => (
              <div key={order.id} className="bg-white border border-black/5 p-6" data-testid={`order-${order.id}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Order #{order.id.slice(0, 8)}</p>
                    <p className="text-sm">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs tracking-[0.1em] uppercase px-2 py-1 ${
                    order.status === "confirmed" ? "bg-[#2E4D43] text-white" : "bg-gray-200"
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="space-y-3">
                  {order.items.map(item => (
                    <div key={item.product_id} className="flex gap-4">
                      <img src={item.product?.images?.[0]} alt={item.product?.name} className="w-12 h-12 object-cover" />
                      <div className="flex-1">
                        <p className="text-sm">{item.product?.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-black/5 mt-4 pt-4 flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium">${order.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

// ==================== APP ====================
function AppContent() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/orders" element={<OrdersPage />} />
      </Routes>
      <Footer />
      <CartDrawer />
      <AuthModal />
      <AIChatWidget />
      <Toaster position="bottom-right" richColors />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
