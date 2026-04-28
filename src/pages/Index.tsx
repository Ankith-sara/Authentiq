import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowRight, Users, Scan, CheckCircle2, Shield, Zap, History, Brain, FileText } from "lucide-react";

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500, color: "#ffffff", border: "1px solid #2563eb", background: "rgba(37, 99, 235, 0.1)" }}>
    {children}
  </span>
);

const FeatureCard = ({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) => (
  <div style={{ padding: "24px", borderRadius: 12, border: "1px solid #2563eb", background: "rgba(37, 99, 235, 0.05)", transition: "all 0.2s" }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6"; (e.currentTarget as HTMLElement).style.background = "rgba(37, 99, 235, 0.1)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2563eb"; (e.currentTarget as HTMLElement).style.background = "rgba(37, 99, 235, 0.05)"; }}
  >
    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
      <Icon size={16} color="#ffffff" />
    </div>
    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", marginBottom: 6 }}>{title}</h3>
    <p style={{ fontSize: 13, color: "#ffffff", lineHeight: 1.6, opacity: 0.9 }}>{desc}</p>
  </div>
);

const Index = () => (
  <div style={{ minHeight: "100vh", background: "#000000" }}>
    <Navigation />

    <section style={{ padding: "140px 24px 100px", maxWidth: 1200, margin: "0 auto", textAlign: "center" }}>
      <h1 className="animate-fade-up" style={{
        fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 800, letterSpacing: "-0.04em",
        lineHeight: 1.05, color: "#ffffff", marginBottom: 24, animationDelay: "0.05s"
      }}>
        Be original<br />
        <span style={{ color: "#2563eb" }}>even when AI writes with you.</span>
      </h1>

      <p className="animate-fade-up" style={{ fontSize: 18, color: "#ffffff", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.6, animationDelay: "0.1s", opacity: 0.9 }}>
        Authentiq detects how unique your AI-assisted writing is and shows exactly what needs to change.
      </p>

      <div className="animate-fade-up" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.15s" }}>
        <Link to="/demo" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px",
          borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#2563eb", color: "#ffffff",
          textDecoration: "none", transition: "background 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#3b82f6"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#2563eb"}
        >
          <Zap size={14} /> Try authentiq
        </Link>
        <Link to="/beta" style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 24px",
          borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#ffffff",
          border: "1px solid #2563eb", background: "transparent",
          textDecoration: "none", transition: "all 0.15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6"; (e.currentTarget as HTMLElement).style.background = "rgba(37, 99, 235, 0.1)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2563eb"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          Join the Beta <ArrowRight size={14} />
        </Link>
      </div>
    </section>

    {/* ── Score preview ── */}
    <section style={{ padding: "0 24px 100px", maxWidth: 800, margin: "0 auto" }}>
      <div style={{ borderRadius: 16, border: "2px solid #2563eb", background: "#000000", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "2px solid #2563eb", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
          <span style={{ fontSize: 12, color: "#ffffff", marginLeft: 8, fontFamily: "monospace" }}>authentiq — check-full</span>
        </div>
        <div style={{ padding: "28px 32px" }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            {[
              { label: "Combined Originality", value: "81%", color: "#2563eb" },
              { label: "Plagiarism Score", value: "12%", color: "#3b82f6" },
              { label: "AI Probability", value: "34%", color: "#60a5fa" },
              { label: "Processing", value: "1.2s", color: "#ffffff" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ flex: 1, minWidth: 120, padding: "16px", borderRadius: 10, border: "1px solid #2563eb", background: "rgba(37, 99, 235, 0.05)" }}>
                <p style={{ fontSize: 11, color: "#ffffff", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, opacity: 0.8 }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</p>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(37, 99, 235, 0.05)", borderRadius: 8, padding: "14px 16px", border: "1px solid #2563eb" }}>
            <p style={{ fontSize: 13, color: "#ffffff", marginBottom: 8, fontWeight: 500 }}>Flagged sentences</p>
            {[
              { text: "Furthermore, AI systems have demonstrated remarkable capabilities in recent years.", sim: 89 },
              { text: "It is important to note that these findings have significant implications.", sim: 82 },
            ].map(({ text, sim }) => (
              <div key={text} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#ffffff", background: "#2563eb", padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", marginTop: 2, fontFamily: "monospace" }}>{sim}%</span>
                <span style={{ fontSize: 13, color: "#ffffff", lineHeight: 1.5, opacity: 0.9 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    <section style={{ padding: "80px 24px", borderTop: "2px solid #2563eb", borderBottom: "2px solid #2563eb" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", marginBottom: 16, lineHeight: 1.15 }}>
          AI makes everything easier —<br />
          <span style={{ color: "#2563eb" }}>and everyone the same.</span>
        </h2>
        <p style={{ fontSize: 16, color: "#ffffff", lineHeight: 1.7, opacity: 0.9 }}>
          As AI tools become universal, students and professionals unknowingly produce near-identical content. Authentiq detects duplication at the semantic level — before it becomes a problem.
        </p>
      </div>
    </section>

    <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>How it works</p>
      <h2 style={{ fontSize: "clamp(22px, 3vw, 32px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", marginBottom: 48 }}>Real detection. Not keyword matching.</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <FeatureCard icon={Scan} title="Semantic Similarity" desc="Vector embeddings (all-MiniLM-L6-v2) compare meaning, not just words. Can't be bypassed by paraphrasing." />
        <FeatureCard icon={Brain} title="AI Detection" desc="GPT-2 perplexity, sentence burstiness, structural uniformity, and 40+ AI phrase patterns." />
        <FeatureCard icon={History} title="Cloud History" desc="Every check saved. Synced to your account. See your originality score improve over time." />
        <FeatureCard icon={FileText} title="PDF Support" desc="Upload PDFs directly. Text is extracted and analyzed the same way as pasted text." />
        <FeatureCard icon={Shield} title="Privacy First" desc="Your text is never stored publicly. History is private to your account via row-level security." />
        <FeatureCard icon={Users} title="Group Leaderboards" desc="Create groups for your class or team. See who's producing truly original work." />
      </div>
    </section>

    <section style={{ padding: "80px 24px", borderTop: "2px solid #2563eb", borderBottom: "2px solid #2563eb" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="block sm:grid">
        <div>
          <Chip>For Classrooms & Teams</Chip>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", margin: "16px 0 16px", lineHeight: 1.2 }}>
            See how original your class really is.
          </h2>
          <p style={{ fontSize: 15, color: "#ffffff", lineHeight: 1.7, marginBottom: 28, opacity: 0.9 }}>
            Create a group, share the link. Every submission appears on a live leaderboard ranked by originality score. Spot AI-copied answers instantly.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
            {[
              { who: "Teachers", detail: "Catch students submitting identical AI outputs before grades are posted" },
              { who: "Students", detail: "Know if your rewrite actually improved your score before submitting" },
              { who: "Teams", detail: "Prevent blog posts, reports, and proposals from overlapping" },
            ].map(({ who, detail }) => (
              <div key={who} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <CheckCircle2 size={14} color="#2563eb" style={{ marginTop: 3, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "#ffffff", opacity: 0.9 }}><span style={{ color: "#ffffff", fontWeight: 500 }}>{who} — </span>{detail}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/groups" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: "#2563eb", color: "#ffffff", textDecoration: "none" }}>
              <Users size={14} /> Create a Group
            </Link>
            <Link to="/demo" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "#ffffff", border: "1px solid #2563eb", textDecoration: "none" }}>
              Try the Checker <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="leaderboard-wrapper" style={{ borderRadius: 12, border: "2px solid #2563eb", background: "#000000", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "2px solid #2563eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 11, color: "#2563eb", marginBottom: 2 }}>CS101 — Assignment 3</p>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#ffffff" }}>Originality Leaderboard</p>
            </div>
            <span style={{ fontSize: 11, color: "#2563eb", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", display: "inline-block" }} /> Live
            </span>
          </div>
          <div style={{ padding: "12px" }}>
            {[
              { rank: "1", name: "Arjun S.", score: 94, color: "#3b82f6" },
              { rank: "2", name: "Priya M.", score: 81, color: "#60a5fa" },
              { rank: "3", name: "You", score: 73, color: "#93c5fd", isYou: true },
              { rank: "4", name: "Rahul K.", score: 58, color: "#2563eb" },
              { rank: "5", name: "Sneha T.", score: 34, color: "#1d4ed8" },
            ].map(({ rank, name, score, color, isYou }) => (
              <div key={name} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, marginBottom: 4,
                background: isYou ? "rgba(37, 99, 235, 0.15)" : "transparent",
                border: isYou ? "1px solid #2563eb" : "1px solid transparent",
              }}>
                <span style={{ fontSize: 12, color: "#ffffff", width: 16, textAlign: "center", fontFamily: "monospace" }}>{rank}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: isYou ? 600 : 400, color: "#ffffff" }}>
                      {name}{isYou && <span style={{ fontSize: 10, color: "#ffffff", marginLeft: 6, background: "#2563eb", padding: "1px 5px", borderRadius: 3 }}>you</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: "monospace" }}>{score}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 99, background: "rgba(37, 99, 235, 0.2)", overflow: "hidden" }}>
                    <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99 }} />
                  </div>
                </div>
              </div>
            ))}
            <p style={{ fontSize: 11, color: "#2563eb", textAlign: "center", marginTop: 8 }}>5 of 24 submitted · updates live</p>
          </div>
        </div>
      </div>
    </section>

    <section style={{ padding: "60px 20px", textAlign: "center" }}>
      <h2 style={{ fontSize: "clamp(28px, 5vw, 56px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#ffffff", marginBottom: 12 }}>
        Stay Authentiq.
      </h2>
      <p style={{ fontSize: 16, color: "#ffffff", marginBottom: 24, maxWidth: 380, margin: "0 auto 36px", opacity: 0.9 }}>
        Join the beta. Get early access to the originality platform built for the AI era.
      </p>
      <Link to="/beta" style={{
        display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px",
        borderRadius: 8, fontSize: 15, fontWeight: 600, background: "#2563eb", color: "#ffffff",
        textDecoration: "none", transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#3b82f6"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#2563eb"}
      >
        Join Waitlist <ArrowRight size={15} />
      </Link>
    </section>

    <Footer />
  </div>
);

export default Index;
