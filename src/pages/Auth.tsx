import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield } from "lucide-react";
import Navigation from "@/components/Navigation";

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}

const Field = ({ label, type, value, onChange, placeholder, required, minLength }: FieldProps) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#ffffff", marginBottom: 6 }}>{label}</label>
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      required={required} minLength={minLength}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14,
        background: "#080d1a", border: "1px solid rgba(59, 130, 246, 0.15)",
        color: "#ffffff", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s",
      }}
      onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6"}
      onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(59, 130, 246, 0.15)"}
    />
  </div>
);

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!" });
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "You can now start using Authentiq." });
        navigate("/");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#03050a" }}>
      <Navigation />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "100px 24px 60px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
            <div style={{ width: 32, height: 32, background: "#2563eb", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={16} color="#ffffff" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "#ffffff" }}>Authentiq</span>
          </div>

          <div style={{ background: "#080d1a", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 14, padding: "32px" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 6, letterSpacing: "-0.02em" }}>
              {isLogin ? "Sign in to your account" : "Create your account"}
            </h1>
            <p style={{ fontSize: 13, color: "#3b82f6", marginBottom: 28 }}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff", fontSize: 13, padding: 0, textDecoration: "underline" }}>
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>

            <form onSubmit={handleAuth}>
              {!isLogin && (
                <Field label="Full Name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
              )}
              <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />

              <button type="submit" disabled={loading} className="btn-primary" style={{
                width: "100%", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                border: "none", cursor: loading ? "not-allowed" : "pointer", marginTop: 8,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.15s",
              }}>
                {loading && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
                {isLogin ? "Sign In" : "Create Account"}
              </button>
            </form>
          </div>

          <p style={{ fontSize: 12, color: "#3b82f6", textAlign: "center", marginTop: 20 }}>
            By signing in you agree to our{" "}
            <Link to="/privacy" style={{ color: "#ffffff", textDecoration: "underline" }}>Privacy Policy</Link>
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Auth;