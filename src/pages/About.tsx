import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Brain, Shield, Users, Zap } from "lucide-react";

const About = () => (
  <div style={{ minHeight: "100vh", background: "#03050a" }}>
    <Navigation />

    <section style={{ padding: "130px 12px 80px", maxWidth: 840, margin: "0 auto" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 20 }}>About</p>
      <h1 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#ffffff", lineHeight: 1.1, marginBottom: 24 }}>
        We built Authentiq because AI was making everyone sound the same.
      </h1>
      <p style={{ fontSize: 17, color: "#ffffff", lineHeight: 1.75 }}>
        When AI writing tools became ubiquitous, we noticed something: students, professionals, and creators were submitting near-identical work without realizing it. Authentiq was built to surface that problem — and help people fix it.
      </p>
    </section>

    <div style={{ borderTop: "1px solid rgba(59, 130, 246, 0.15)", maxWidth: 1100, margin: "0 auto" }} />
    <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "280px 1fr", gap: 64, alignItems: "start" }} className="block sm:grid">
      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mission</p>
      </div>
      <div>
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", marginBottom: 16 }}>
          Make AI a tool for creativity, not conformity.
        </h2>
        <p style={{ fontSize: 15, color: "#ffffff", lineHeight: 1.75 }}>
          Every person who uses AI should still produce something distinctly their own. Authentiq doesn't punish AI usage — it measures originality at the semantic level so you can see exactly where your voice is being diluted and what to do about it.
        </p>
      </div>
    </section>

    <div style={{ borderTop: "1px solid rgba(59, 130, 246, 0.15)", maxWidth: 1100, margin: "0 auto" }} />

    <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 40 }}>What we stand for</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 1, border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 12, overflow: "hidden" }}>
        {[
          { icon: Brain, title: "Real Detection", desc: "SentenceTransformer embeddings + GPT-2 perplexity. Signals used by actual research labs, not keyword matching." },
          { icon: Shield, title: "Privacy First", desc: "History is private to your account via Supabase RLS. We never sell your text or data." },
          { icon: Users, title: "For Everyone", desc: "Students, professionals, educators, creators. Anyone who uses AI and wants to keep their voice." },
          { icon: Zap, title: "Actionable", desc: "Not just a score. We show which sentences triggered flags and exactly why — so you can fix it." },
        ].map(({ icon: Icon, title, desc }, i) => (
          <div key={title} style={{ padding: "32px", background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent", borderRight: "1px solid rgba(59, 130, 246, 0.15)", borderBottom: "1px solid rgba(59, 130, 246, 0.15)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 7, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon size={15} color="#ffffff" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", marginBottom: 8 }}>{title}</h3>
            <p style={{ fontSize: 13, color: "#ffffff", lineHeight: 1.65 }}>{desc}</p>
          </div>
        ))}
      </div>
    </section>

    <div style={{ borderTop: "1px solid rgba(59, 130, 246, 0.15)", maxWidth: 1100, margin: "0 auto" }} />

    <section style={{ padding: "80px 24px", maxWidth: 720, margin: "0 auto" }}>
      <blockquote style={{ fontSize: "clamp(18px, 3vw, 28px)", fontWeight: 600, color: "#ffffff", lineHeight: 1.4, letterSpacing: "-0.02em", marginBottom: 20 }}>
        "In a world where everyone uses AI, originality becomes the new signature."
      </blockquote>
      <p style={{ fontSize: 14, color: "#3b82f6" }}>— The Authentiq team</p>
    </section>

    <div style={{ borderTop: "1px solid rgba(59, 130, 246, 0.15)", maxWidth: 1100, margin: "0 auto" }} />

    <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", marginBottom: 8 }}>Ready to check your originality?</h2>
        <p style={{ fontSize: 14, color: "#ffffff" }}>Join the beta and get early access.</p>
      </div>
      <Link to="/beta" className="btn-primary px-6 py-3 text-sm font-semibold inline-flex items-center gap-2">
        Join Beta 
      </Link>
    </section>

    <Footer />
  </div>
);

export default About;

