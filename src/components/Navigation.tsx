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
    { to: "/checker", label: "Checker" },
    { to: "/history", label: "History" },
  ];

  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "#03050a", borderBottom: "1px solid rgba(59, 130, 246, 0.15)", }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, }}>
        <Link to="/" onClick={close} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit", }}>
          <div style={{ width: 26, height: 26, background: "#2563eb", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={14} color="#ffffff" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", color: "#ffffff", }} className="text-brand">Authentiq</span>
        </Link>

        {/* Desktop Navigation */}
        <div style={{ display: "none", alignItems: "center", gap: 6, }} className="desktop-nav">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                color: isActive(to) ? "#60a5fa" : "#ffffff",
                background: isActive(to) ? "rgba(59, 130, 246, 0.12)" : "transparent",
                border: isActive(to) ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid transparent",
                transition: "all 0.2s",
                opacity: isActive(to) ? 1 : 0.85,
              }}
              onMouseEnter={(e) => { if (!isActive(to)) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)"; e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.12)"; } }}
              onMouseLeave={(e) => { if (!isActive(to)) { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
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
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive("/groups") ? "#60a5fa" : "#ffffff",
                  background: isActive("/groups") ? "rgba(59, 130, 246, 0.12)" : "transparent",
                  border: isActive("/groups") ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid transparent",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.2s",
                  opacity: isActive("/groups") ? 1 : 0.85,
                }}
                onMouseEnter={(e) => { if (!isActive("/groups")) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)"; e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.12)"; } }}
                onMouseLeave={(e) => { if (!isActive("/groups")) { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}
              >
                <Users size={14} /> Groups
              </Link>
              <button
                onClick={signOut}
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#ffffff", background: "transparent", border: "1px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s", opacity: 0.85, }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(244, 63, 94, 0.08)"; e.currentTarget.style.borderColor = "rgba(244, 63, 94, 0.15)"; e.currentTarget.style.color = "#fda4af"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#ffffff"; }}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                style={{ padding: "6px 12px", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#ffffff", textDecoration: "none", transition: "all 0.2s", opacity: 0.85, border: "1px solid transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)"; e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
              >
                Sign In
              </Link>
              <Link
                to="/beta"
                style={{ padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#ffffff", background: "#2563eb", textDecoration: "none", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#1d4ed8"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#2563eb"; }}
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
          style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#ffffff", padding: 8, borderRadius: 8, transition: "background 0.2s", }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {
        open && (
          <div className="mobile-menu" style={{ borderTop: "1px solid rgba(59, 130, 246, 0.15)", background: "#080d1a", padding: "12px 16px 16px", maxHeight: "calc(100vh - 56px)", overflowY: "auto", }}>
            {/* Main Links */}
            {links.map(({ to, label }) => (
              <Link key={to} to={to} onClick={close} style={{ display: "block", padding: "12px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500, textDecoration: "none", marginBottom: 4, color: isActive(to) ? "#60a5fa" : "#ffffff", background: isActive(to) ? "rgba(59, 130, 246, 0.12)" : "transparent", border: isActive(to) ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid transparent", transition: "all 0.2s", }}>
                {label}
              </Link>
            ))}

            <div style={{ borderTop: "1px solid rgba(59, 130, 246, 0.15)", marginTop: 8, marginBottom: 8, }} />
            {/* User Actions */}
            {user ? (
              <>
                <Link to="/groups" onClick={close} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500, color: isActive("/groups") ? "#60a5fa" : "#ffffff", textDecoration: "none", marginBottom: 4, background: isActive("/groups") ? "rgba(59, 130, 246, 0.12)" : "transparent", border: isActive("/groups") ? "1px solid rgba(59, 130, 246, 0.25)" : "1px solid transparent", transition: "all 0.2s", }}>
                  <Users size={16} /> Groups
                </Link>
                <button onClick={() => { signOut(); close(); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 8, fontSize: 15, fontWeight: 500, color: "#ffffff", background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left", transition: "background 0.2s", }}>
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4, }}>
                <Link to="/auth" onClick={close} style={{ padding: "12px", borderRadius: 8, fontSize: 15, fontWeight: 500, textAlign: "center", color: "#ffffff", border: "1px solid rgba(59, 130, 246, 0.25)", textDecoration: "none", transition: "all 0.2s", }}>
                  Sign In
                </Link>
                <Link to="/beta" onClick={close} style={{ padding: "12px", borderRadius: 8, fontSize: 15, fontWeight: 600, textAlign: "center", color: "#ffffff", background: "#2563eb", textDecoration: "none", transition: "all 0.2s", }}>
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
        @keyframes slideDownMobile {
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
          animation: slideDownMobile 0.2s ease-out;
        }

        /* Smooth scrolling for mobile menu */
        .mobile-menu::-webkit-scrollbar {
          width: 6px;
        }

        .mobile-menu::-webkit-scrollbar-track {
          background: transparent;
        }

        .mobile-menu::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.3);
          border-radius: 3px;
        }

        .mobile-menu::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.5);
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