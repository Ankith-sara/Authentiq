import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const roles = ["Student", "Educator", "Professional", "Creator", "Researcher", "Other"];

const Beta = () => {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "", usage: "" });

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.role) {
      toast({ title: "Fill in all required fields", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const { data: existing } = await supabase.from("beta_signups").select("id").eq("email", form.email).maybeSingle();
      if (existing) { setSubmitted(true); return; }
      const { error } = await supabase.from("beta_signups").insert({ name: form.name, email: form.email, role: form.role, usage: form.usage || null });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submission failed.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
    background: "#080d1a", border: "1px solid rgba(59, 130, 246, 0.15)",
    color: "#ffffff", outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 500, color: "#ffffff", marginBottom: 6 };
  const focusBorder = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => e.currentTarget.style.borderColor = "#3b82f6";
  const blurBorder  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.15)";

  return (
    <div style={{ minHeight: "100vh", background: "#03050a" }}>
      <Navigation />

      <section style={{ padding: "130px 24px 80px", maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 420px", gap: 80, alignItems: "start" }} className="block sm:grid">

        {/* Left — pitch */}
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.1em" }}>Early Access</span>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-0.04em", color: "#ffffff", margin: "14px 0 20px", lineHeight: 1.1 }}>
            Join the Authentiq Beta.
          </h1>
          <p style={{ fontSize: 16, color: "#ffffff", lineHeight: 1.75, marginBottom: 40 }}>
            Be among the first to use the AI originality checker built for the classroom era. We'll notify you when early access opens.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { title: "Full access to the checker", sub: "Plagiarism + AI detection on unlimited documents" },
              { title: "Cloud history sync", sub: "All checks saved and accessible across devices" },
              { title: "Group leaderboards", sub: "Create groups for your class or team" },
              { title: "Early adopter status", sub: "Shape the product with direct feedback to the team" },
            ].map(({ title, sub }) => (
              <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#2563eb", border: "1px solid rgba(59, 130, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                  <CheckCircle2 size={11} color="#ffffff" />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#ffffff", marginBottom: 2 }}>{title}</p>
                  <p style={{ fontSize: 13, color: "#ffffff" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        {submitted ? (
          <div style={{ background: "#080d1a", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 14, padding: "48px 32px", textAlign: "center", marginTop: 40 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 size={24} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>You're on the list!</h2>
            <p style={{ fontSize: 14, color: "#ffffff", lineHeight: 1.6 }}>We'll reach out when early access opens. No spam — just one email when it's ready.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: "#080d1a", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 14, padding: "32px", marginTop: 40 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 24 }}>Request early access</h2>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Name <span style={{ color: "#ef4444" }}>*</span></label>
              <input style={inputStyle} type="text" placeholder="Your name" value={form.name} onChange={set("name")} onFocus={focusBorder} onBlur={blurBorder} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email <span style={{ color: "#ef4444" }}>*</span></label>
              <input style={inputStyle} type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} onFocus={focusBorder} onBlur={blurBorder} required />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Role <span style={{ color: "#ef4444" }}>*</span></label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.role} onChange={set("role")} onFocus={focusBorder} onBlur={blurBorder} required>
                <option value="">Select your role</option>
                {roles.map(r => <option key={r} value={r.toLowerCase()}>{r}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>How do you use AI? <span style={{ color: "#3b82f6", fontWeight: 400 }}>(optional)</span></label>
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 80, background: "#080d1a", color: "#ffffff" }} placeholder="Tell us about your use case…" value={form.usage} onChange={set("usage")} onFocus={focusBorder} onBlur={blurBorder} rows={3} />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{
              width: "100%", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 600,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {loading ? "Submitting…" : "Request Early Access"}
            </button>

            <p style={{ fontSize: 12, color: "#3b82f6", textAlign: "center", marginTop: 14 }}>
              No spam. No data resale. Just one email.
            </p>
          </form>
        )}
      </section>

      <Footer />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Beta;