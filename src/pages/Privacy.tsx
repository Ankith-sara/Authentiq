import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 48 }}>
    <h2 style={{ fontSize: 18, fontWeight: 600, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: 14 }}>{title}</h2>
    <div style={{ fontSize: 14, color: "#ffffff", lineHeight: 1.8 }}>{children}</div>
  </div>
);

const Privacy = () => (
  <div style={{ minHeight: "100vh", background: "#000000" }}>
    <Navigation />
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "120px 24px 80px" }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Legal</p>
      <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.04em", color: "#ffffff", marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 13, color: "#2563eb", marginBottom: 56 }}>Last updated: January 2025</p>

      <Section title="Information we collect">
        <p>When you use Authentiq, we collect the text you submit for analysis, your account information (email, name), and usage data (scores, timestamps). We do not collect sensitive personal information beyond what is necessary to provide the service.</p>
      </Section>
      <Section title="How we use your data">
        <p>Your submitted text is used solely to compute originality scores. It is not shared with third parties, used for advertising, or sold. Check history is stored privately and accessible only to your account via row-level security.</p>
      </Section>
      <Section title="Data storage">
        <p>Data is stored in Supabase (PostgreSQL) with row-level security policies. Each user can only access their own history. We use Supabase's security infrastructure, which is SOC2 compliant.</p>
      </Section>
      <Section title="Cookies">
        <p>We use only essential session cookies for authentication. No tracking cookies, no ad networks.</p>
      </Section>
      <Section title="Data deletion">
        <p>You can delete your check history at any time from the History page. To request full account deletion, contact us and we will remove all associated data within 30 days.</p>
      </Section>
      <Section title="Contact">
        <p>Questions about this policy? Reach out through the beta signup form or via the contact information on our About page.</p>
      </Section>
    </div>
    <Footer />
  </div>
);

export default Privacy;
