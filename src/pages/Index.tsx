import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { ArrowRight, Users, Scan, CheckCircle2, Shield, Zap, History, Brain, FileText } from "lucide-react";

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-blue-300 border border-blue-500/20 bg-blue-500/10 backdrop-blur-sm animate-fade-in">
    {children}
  </span>
);

const FeatureCard = ({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) => (
  <div className="glass-panel glass-panel-hover p-6 flex flex-col items-start gap-4">
    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
      <Icon size={18} className="text-white" />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-slate-300 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const Index = () => (
  <div className="min-h-screen bg-background relative overflow-hidden">
    <Navigation />

    {/* Hero Section */}
    <section className="pt-32 pb-20 px-6 max-w-5xl mx-auto text-center relative z-10">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-glow -z-10 pointer-events-none" />
      
      <h1 className="animate-fade-up text-5xl md:text-7xl font-extrabold tracking-tight leading-none text-white mb-6">
        Be original<br />
        <span className="text-brand">even when AI writes with you.</span>
      </h1>

      <p className="animate-fade-up text-base md:text-lg text-slate-300 max-w-lg mx-auto mb-10 leading-relaxed opacity-90">
        Authentiq detects how unique your AI-assisted writing is and shows exactly what needs to change.
      </p>

      <div className="animate-fade-up flex flex-wrap gap-4 justify-center items-center">
        <Link to="/demo" className="btn-primary px-6 py-3 text-sm font-semibold inline-flex items-center gap-2">
          <Zap size={14} /> Try authentiq
        </Link>
        <Link to="/beta" className="btn-secondary px-6 py-3 text-sm font-medium inline-flex items-center gap-2 hover:text-white">
          Join the Beta
        </Link>
      </div>
    </section>

    {/* Score Preview Section */}
    <section className="px-6 pb-24 max-w-3xl mx-auto animate-fade-up relative z-10">
      <div className="glass-panel overflow-hidden border border-blue-500/20 shadow-glow">
        <div className="px-6 py-4 border-b border-blue-500/10 flex items-center gap-2 bg-blue-950/20">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          <span className="text-xs text-blue-300 ml-4 font-mono">authentiq — check-full</span>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Combined Originality", value: "81%", color: "text-blue-300", bg: "bg-blue-500/5 border-blue-500/15" },
              { label: "Plagiarism Score", value: "12%", color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/15" },
              { label: "AI Probability", value: "34%", color: "text-blue-400", bg: "bg-blue-500/5 border-blue-500/15" },
              { label: "Processing", value: "1.2s", color: "text-slate-200", bg: "bg-slate-500/5 border-slate-500/15" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`p-4 rounded-xl border ${bg} backdrop-blur-sm`}>
                <p className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">{label}</p>
                <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-5">
            <p className="text-xs font-semibold text-blue-300 mb-3 uppercase tracking-wider">Flagged sentences</p>
            {[
              { text: "Furthermore, AI systems have demonstrated remarkable capabilities in recent years.", sim: 89 },
              { text: "It is important to note that these findings have significant implications.", sim: 82 },
            ].map(({ text, sim }) => (
              <div key={text} className="flex items-start gap-3 mb-3 last:mb-0">
                <span className="text-[10px] font-bold text-background bg-blue-300 px-2 py-0.5 rounded-md font-mono mt-0.5">{sim}%</span>
                <p className="text-xs text-slate-300 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>

    {/* Statement Banner */}
    <section className="py-20 px-6 border-y border-blue-500/10 bg-blue-950/15 relative z-10">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4 leading-tight">
          AI makes everything easier <br />
          <span className="text-brand">and everyone the same.</span>
        </h2>
        <p className="text-sm md:text-base text-slate-300 leading-relaxed opacity-90">
          As AI tools become universal, students and professionals unknowingly produce near-identical content. Authentiq detects duplication at the semantic level — before it becomes a problem.
        </p>
      </div>
    </section>

    {/* Features Grid */}
    <section className="py-24 px-6 max-w-5xl mx-auto relative z-10">
      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">How it works</p>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-12">Real detection. Not keyword matching.</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard icon={Scan} title="Semantic Similarity" desc="Vector embeddings compare meaning, not just words. Can't be bypassed by simple paraphrasing or word swapping." />
        <FeatureCard icon={Brain} title="AI Detection" desc="Deep Multi-LLM perplexity ensemble scoring, sentence burstiness, and 40+ dynamic AI writing patterns." />
        <FeatureCard icon={History} title="Cloud History" desc="Every audit check is securely logged, and is synced to your profile dashboard so you can audit over time." />
        <FeatureCard icon={FileText} title="Document Extraction" desc="Upload PDFs and text files directly. System automatically processes and chunks paragraphs seamlessly." />
        <FeatureCard icon={Shield} title="Privacy First" desc="Your documents are never exposed to public crawlers. Secured via Supabase Row-Level Security." />
        <FeatureCard icon={Users} title="Group Leaderboards" desc="Create workspaces or classrooms, distribute invitations, and review originality rankings on a live dashboard." />
      </div>
    </section>

    {/* Live Leaderboard Section */}
    <section className="py-20 px-6 border-t border-blue-500/10 bg-blue-950/5 relative z-10">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div>
          <Chip>For Classrooms & Teams</Chip>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white my-6 leading-tight">
            See how original your class really is.
          </h2>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed mb-8 opacity-90">
            Create a group, share the link. Every submission appears on a live leaderboard ranked by originality score. Spot AI-copied answers instantly.
          </p>
          <div className="flex flex-col gap-4 mb-8">
            {[
              { who: "Teachers", detail: "Catch students submitting identical AI outputs before grades are posted" },
              { who: "Students", detail: "Know if your rewrite actually improved your score before submitting" },
              { who: "Teams", detail: "Prevent blog posts, reports, and proposals from overlapping" },
            ].map(({ who, detail }) => (
              <div key={who} className="flex gap-3 items-start">
                <CheckCircle2 size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs md:text-sm text-slate-300 leading-normal"><span className="text-white font-semibold">{who} — </span>{detail}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <Link to="/groups" className="btn-primary px-6 py-2.5 text-sm font-semibold inline-flex items-center gap-2">
              <Users size={14} /> Create a Group
            </Link>
            <Link to="/demo" className="btn-secondary px-6 py-2.5 text-sm font-medium inline-flex items-center gap-2 hover:text-white">
              Try the Checker
            </Link>
          </div>
        </div>

        <div className="leaderboard-wrapper glass-panel overflow-hidden border border-blue-500/20 shadow-elegant">
          <div className="px-6 py-4 border-b border-blue-500/10 flex justify-between items-center bg-blue-950/20">
            <div>
              <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-0.5">CS101 — Assignment 3</p>
              <p className="text-xs font-bold text-white">Originality Leaderboard</p>
            </div>
            <span className="text-[10px] text-blue-300 flex items-center gap-1.5 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Live
            </span>
          </div>
          <div className="p-4 space-y-2">
            {[
              { rank: "1", name: "Arjun S.", score: 94, color: "bg-blue-500", textClass: "text-blue-400" },
              { rank: "2", name: "Priya M.", score: 81, color: "bg-blue-500", textClass: "text-blue-300" },
              { rank: "3", name: "You", score: 73, color: "bg-blue-600", textClass: "text-blue-300", isYou: true },
              { rank: "4", name: "Rahul K.", score: 58, color: "bg-blue-700", textClass: "text-blue-400" },
              { rank: "5", name: "Sneha T.", score: 34, color: "bg-blue-800", textClass: "text-blue-400" },
            ].map(({ rank, name, score, color, textClass, isYou }) => (
              <div key={name} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${isYou ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-white/5 border border-transparent"}`}>
                <span className="text-xs text-slate-400 w-4 text-center font-mono">{rank}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-xs font-semibold ${isYou ? "text-blue-200" : "text-white"}`}>
                      {name}{isYou && <span className="text-[9px] text-blue-950 font-bold ml-2 bg-blue-300 px-1.5 py-0.5 rounded-md uppercase tracking-wider font-sans">you</span>}
                    </span>
                    <span className={`text-xs font-bold font-mono ${textClass}`}>{score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-[10px] text-slate-400 text-center pt-2">5 of 24 submitted · updates live</p>
          </div>
        </div>
      </div>
    </section>

    {/* Beta Waiting Call to Action */}
    <section className="py-24 px-6 text-center relative z-10">
      <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
        Stay Authentiq.
      </h2>
      <p className="text-sm md:text-base text-slate-300 mb-10 max-w-sm mx-auto opacity-90 leading-relaxed">
        Join the beta. Get early access to the originality platform built for the AI era.
      </p>
      <Link to="/beta" className="btn-primary px-8 py-3.5 text-sm font-semibold inline-flex items-center gap-2">
        Join Waitlist
      </Link>
    </section>

    <Footer />
  </div>
);

export default Index;