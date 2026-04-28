import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Users, Menu, X, Shield } from "lucide-react";

const Navigation = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (p: string) => location.pathname === p;
  const close = () => setOpen(false);

  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/demo", label: "Checker" },
    { to: "/history", label: "History" },
  ];

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(0,0,0,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "2px solid #2563eb", }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, }}>
        <Link to="/" onClick={close} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit", }}>
          <div style={{ width: 26, height: 26, background: "#2563eb", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", }}>
            <Shield size={14} color="#ffffff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: "#ffffff", }}>Authentiq</span>
        </Link>

        {/* Desktop Navigation */}
        <div style={{ display: "none", alignItems: "center", gap: 6, }} className="desktop-nav">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{ padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, textDecoration: "none", color: "#ffffff", background: isActive(to) ? "#2563eb" : "transparent", transition: "all 0.15s", opacity: isActive(to) ? 1 : 0.7, }}
              onMouseEnter={(e) => { if (!isActive(to)) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)"; } }}
              onMouseLeave={(e) => { if (!isActive(to)) { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "transparent"; } }}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop Right Actions */}
        <div style={{ display: "none", alignItems: "center", gap: 8, }} className="desktop-nav">
          {user ? (
            <>
              <Link
                to="/groups"
                style={{ padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, color: "#ffffff", background: isActive("/groups") ? "#2563eb" : "transparent", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s", opacity: isActive("/groups") ? 1 : 0.7, }}
                onMouseEnter={(e) => { if (!isActive("/groups")) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)"; } }}
                onMouseLeave={(e) => { if (!isActive("/groups")) { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "transparent"; } }}
              >
                <Users size={14} /> Groups
              </Link>
              <button
                onClick={signOut}
                style={{ padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, color: "#ffffff", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s", opacity: 0.7, }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                style={{ padding: "6px 12px", borderRadius: 6, fontSize: 14, fontWeight: 500, color: "#ffffff", textDecoration: "none", transition: "all 0.15s", opacity: 0.7, }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.background = "transparent"; }}
              >
                Sign In
              </Link>
              <Link
                to="/beta"
                style={{ padding: "6px 14px", borderRadius: 6, fontSize: 14, fontWeight: 600, color: "#ffffff", background: "#2563eb", textDecoration: "none", transition: "background 0.15s", }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#3b82f6"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#2563eb"}
              >
                Join Beta
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setOpen(!open)}
          className="mobile-menu-btn"
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#ffffff", padding: 8, borderRadius: 6, transition: "background 0.15s", }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {
        open && (
          <div className="mobile-menu" style={{ borderTop: "2px solid #2563eb", background: "#000000", padding: "12px 16px 16px", maxHeight: "calc(100vh - 56px)", overflowY: "auto", }}>
            {/* Main Links */}
            {links.map(({ to, label }) => (
              <Link key={to} to={to} onClick={close} style={{ display: "block", padding: "12px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500, textDecoration: "none", marginBottom: 4, color: "#ffffff", background: isActive(to) ? "#2563eb" : "transparent", transition: "background 0.15s", }}>
                {label}
              </Link>
            ))}

            <div style={{ borderTop: "1px solid rgba(37, 99, 235, 0.3)", marginTop: 8, marginBottom: 8, }} />
            {/* User Actions */}
            {user ? (
              <>
                <Link to="/groups" onClick={close} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500, color: "#ffffff", textDecoration: "none", marginBottom: 4, background: isActive("/groups") ? "#2563eb" : "transparent", transition: "background 0.15s", }}>
                  <Users size={16} /> Groups
                </Link>
                <button onClick={() => { signOut(); close(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500, color: "#ffffff", background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left", transition: "background 0.15s", }}>
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, }}>
                <Link to="/auth" onClick={close} style={{ padding: "12px", borderRadius: 8, fontSize: 15, fontWeight: 500, textAlign: "center", color: "#ffffff", border: "1px solid #2563eb", textDecoration: "none", transition: "background 0.15s", }}>
                  Sign In
                </Link>
                <Link to="/beta" onClick={close} style={{ padding: "12px", borderRadius: 8, fontSize: 15, fontWeight: 600, textAlign: "center", color: "#ffffff", background: "#2563eb", textDecoration: "none", transition: "background 0.15s", }}>
                  Join Beta
                </Link>
              </div>
            )}
          </div>
        )
      }

      <style>{`
        /* Desktop styles */
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
        }

        /* Mobile styles */
        @media (max-width: 767px) {
          .mobile-menu-btn {
            display: block !important;
          }
        }

        /* Mobile menu animation */
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .mobile-menu {
          animation: slideDown 0.2s ease-out;
        }

        /* Smooth scrolling for mobile menu */
        .mobile-menu::-webkit-scrollbar {
          width: 6px;
        }

        .mobile-menu::-webkit-scrollbar-track {
          background: transparent;
        }

        .mobile-menu::-webkit-scrollbar-thumb {
          background: rgba(37, 99, 235, 0.5);
          border-radius: 3px;
        }

        .mobile-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(37, 99, 235, 0.7);
        }

        /* Touch-friendly tap targets on mobile */
        @media (max-width: 767px) {
          .mobile-menu a,
          .mobile-menu button {
            min-height: 44px;
          }
        }

        /* Prevent body scroll when menu is open */
        body.menu-open {
          overflow: hidden;
        }
      `}</style>
    </nav >
  );
};

export default Navigation;