import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const Footer = () => (
  <footer style={{ borderTop: "2px solid #2563eb", padding: "48px 24px 32px", marginTop: "auto" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 32, marginBottom: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 24, height: 24, background: "#2563eb", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={13} color="#ffffff" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#ffffff", letterSpacing: "-0.01em" }}>Authentiq</span>
          </div>
          <p style={{ fontSize: 13, color: "#ffffff", maxWidth: 220, lineHeight: 1.6, opacity: 0.8 }}>
            AI originality detection for students, teams, and educators.
          </p>
        </div>
        <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Product</p>
            {[{ to: "/demo", l: "Checker" }, { to: "/history", l: "History" }, { to: "/groups", l: "Groups" }, { to: "/beta", l: "Join Beta" }].map(({ to, l }) => (
              <Link key={to} to={to} style={{ display: "block", fontSize: 13, color: "#ffffff", textDecoration: "none", marginBottom: 8, transition: "opacity 0.15s", opacity: 0.7 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
              >{l}</Link>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Company</p>
            {[{ to: "/about", l: "About" }, { to: "/privacy", l: "Privacy" }].map(({ to, l }) => (
              <Link key={to} to={to} style={{ display: "block", fontSize: 13, color: "#ffffff", textDecoration: "none", marginBottom: 8, transition: "opacity 0.15s", opacity: 0.7 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0.7"}
              >{l}</Link>
            ))}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #2563eb", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 12, color: "#ffffff", opacity: 0.6 }}>© 2025 Authentiq. All rights reserved.</p>
        <p style={{ fontSize: 12, color: "#ffffff", opacity: 0.6 }}>Built for academic integrity.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
