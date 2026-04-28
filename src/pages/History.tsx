import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  History, Trash2, Search, TrendingUp, TrendingDown,
  Minus, Shield, Brain, FileText, AlertCircle, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, Clock, BarChart2,
  Zap, X, Cloud, CloudOff, Loader2, LogIn
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  timestamp: number;
  textPreview: string;
  textLength: number;
  combined_originality_score: number;
  plagiarism: {
    plagiarism_score: number;
    originality_score: number;
    flagged_sentences: number;
    total_sentences: number;
  };
  ai_detection: {
    ai_probability: number;
    human_probability: number;
    verdict: string;
    confidence: string;
    raw_signals: { perplexity: number; burstiness: number };
  };
  total_processing_ms: number;
  synced?: boolean;
}

export const HISTORY_KEY = "authentiq_history";

// ── Save helpers (called from OriginalityChecker) ─────────────────────────────

export function saveToLocalStorage(entry: Omit<HistoryEntry, "id" | "timestamp" | "synced">) {
  const existing: HistoryEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  const newEntry: HistoryEntry = { ...entry, id: crypto.randomUUID(), timestamp: Date.now(), synced: false };
  localStorage.setItem(HISTORY_KEY, JSON.stringify([newEntry, ...existing].slice(0, 50)));
  return newEntry;
}

export async function saveToHistory(
  entry: Omit<HistoryEntry, "id" | "timestamp" | "synced">,
  userId?: string,
  groupId?: string
) {
  saveToLocalStorage(entry);
  if (userId) {
    try {
      await supabase.from("check_history").insert({
        user_id: userId,
        text_preview: entry.textPreview,
        text_length: entry.textLength,
        combined_originality_score: entry.combined_originality_score,
        plagiarism_score: entry.plagiarism.plagiarism_score,
        originality_score: entry.plagiarism.originality_score,
        flagged_sentences: entry.plagiarism.flagged_sentences,
        total_sentences: entry.plagiarism.total_sentences,
        ai_probability: entry.ai_detection.ai_probability,
        human_probability: entry.ai_detection.human_probability,
        ai_verdict: entry.ai_detection.verdict,
        ai_confidence: entry.ai_detection.confidence,
        perplexity: entry.ai_detection.raw_signals.perplexity,
        burstiness: entry.ai_detection.raw_signals.burstiness,
        processing_ms: entry.total_processing_ms,
        group_id: groupId || null,
      });
    } catch (e) {
      console.warn("Supabase history save failed:", e);
    }
  }
}

// ── Convert Supabase row → HistoryEntry ───────────────────────────────────────
function rowToEntry(row: any): HistoryEntry {
  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    textPreview: row.text_preview,
    textLength: row.text_length,
    combined_originality_score: row.combined_originality_score,
    plagiarism: {
      plagiarism_score: row.plagiarism_score,
      originality_score: row.originality_score,
      flagged_sentences: row.flagged_sentences,
      total_sentences: row.total_sentences,
    },
    ai_detection: {
      ai_probability: row.ai_probability,
      human_probability: row.human_probability,
      verdict: row.ai_verdict,
      confidence: row.ai_confidence,
      raw_signals: { perplexity: row.perplexity, burstiness: row.burstiness },
    },
    total_processing_ms: row.processing_ms,
    synced: true,
  };
}

// ── Design helpers ────────────────────────────────────────────────────────────

const grade = (s: number) =>
  s >= 85 ? { label: "Excellent", color: "#22c55e", bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.2)"  }
  : s >= 70 ? { label: "Good",    color: "#84cc16", bg: "rgba(132,204,22,0.08)", border: "rgba(132,204,22,0.2)" }
  : s >= 50 ? { label: "Fair",    color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" }
  :           { label: "Poor",    color: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.2)"  };

const Bar = ({ value, color }: { value: number; color: string }) => (
  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 5, overflow: "hidden" }}>
    <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
  </div>
);

const formatTime = (ts: number) => {
  const diff = Date.now() - ts;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const TrendBadge = ({ curr, prev }: { curr: number; prev: number }) => {
  const d = curr - prev;
  if (d > 2)  return <span style={{ color: "#22c55e", fontSize: 11, display: "flex", alignItems: "center", gap: 2 }}><TrendingUp size={11} />+{d}%</span>;
  if (d < -2) return <span style={{ color: "#ef4444", fontSize: 11, display: "flex", alignItems: "center", gap: 2 }}><TrendingDown size={11} />{d}%</span>;
  return <span style={{ color: "#6b7280", fontSize: 11, display: "flex", alignItems: "center", gap: 2 }}><Minus size={11} />same</span>;
};

const StatCard = ({ icon: Icon, label, value, color = "#2E7BFF", sub }: {
  icon: React.ElementType; label: string; value: string | number; color?: string; sub?: string;
}) => (
  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "14px 16px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <Icon size={13} color={color} />
      <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>{label}</span>
    </div>
    <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#4b5563", marginTop: 3 }}>{sub}</div>}
  </div>
);

// ── Entry Card ────────────────────────────────────────────────────────────────

const EntryCard = ({ entry, prevEntry, onDelete }: {
  entry: HistoryEntry; prevEntry?: HistoryEntry; onDelete: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const g = grade(entry.combined_originality_score);
  const aiG = grade(entry.ai_detection.human_probability);

  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${open ? g.border : "rgba(255,255,255,0.06)"}`, borderRadius: 20, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={() => setOpen(!open)} style={{ padding: "16px", cursor: "pointer", userSelect: "none" as const }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Score circle */}
          <div style={{ flexShrink: 0, width: 52, height: 52, borderRadius: 14, background: g.bg, border: `1.5px solid ${g.border}`, display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center", gap: 1 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: g.color, lineHeight: 1 }}>{entry.combined_originality_score}</span>
            <span style={{ fontSize: 9, color: g.color, opacity: 0.7, fontWeight: 600 }}>SCORE</span>
          </div>
          {/* Content */}
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: g.color }}>{g.label}</span>
              {prevEntry && <TrendBadge curr={entry.combined_originality_score} prev={prevEntry.combined_originality_score} />}
              {entry.synced
                ? <span style={{ marginLeft: "auto", color: "#22c55e", display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}><Cloud size={10} />synced</span>
                : <span style={{ marginLeft: "auto", color: "#6b7280", display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}><CloudOff size={10} />local</span>
              }
            </div>
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{entry.textPreview}</p>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "3px 10px", marginTop: 5 }}>
              <span style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} />{formatTime(entry.timestamp)}</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{entry.textLength} chars</span>
              <span style={{ fontSize: 11, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}><Zap size={10} />{entry.total_processing_ms}ms</span>
            </div>
          </div>
          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 6, flexShrink: 0 }}>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(!confirmDel); }}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 8, color: "#4b5563" }}>
              <Trash2 size={14} />
            </button>
            {open ? <ChevronUp size={14} color="#4b5563" /> : <ChevronDown size={14} color="#4b5563" />}
          </div>
        </div>
        {/* Mini bars */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", marginTop: 12 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: "#6b7280" }}>Originality</span>
              <span style={{ fontSize: 10, color: g.color, fontWeight: 600 }}>{entry.plagiarism.originality_score}%</span>
            </div>
            <Bar value={entry.plagiarism.originality_score} color={g.color} />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 10, color: "#6b7280" }}>Human prob.</span>
              <span style={{ fontSize: 10, color: aiG.color, fontWeight: 600 }}>{entry.ai_detection.human_probability}%</span>
            </div>
            <Bar value={entry.ai_detection.human_probability} color={aiG.color} />
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {confirmDel && (
        <div style={{ padding: "10px 16px", background: "rgba(239,68,68,0.06)", borderTop: "1px solid rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#ef4444" }}>Delete this entry?</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDelete} style={{ background: "#ef4444", color: "#fff", border: "none", cursor: "pointer", padding: "5px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Delete</button>
            <button onClick={e => { e.stopPropagation(); setConfirmDel(false); }} style={{ background: "rgba(255,255,255,0.06)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", padding: "5px 14px", borderRadius: 8, fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Expanded detail */}
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "16px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 14 }}>
            {[{ text: entry.ai_detection.verdict, color: aiG.color }, { text: `${entry.ai_detection.confidence} confidence`, color: "#6b7280" }].map(({ text, color }) => (
              <span key={text} style={{ background: `${color}14`, color, border: `1px solid ${color}30`, padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>{text}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Plagiarism */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <FileText size={12} color="#2E7BFF" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>Plagiarism</span>
              </div>
              {[{ label: "Originality", value: entry.plagiarism.originality_score, color: g.color }, { label: "Plagiarism", value: entry.plagiarism.plagiarism_score, color: "#ef4444" }].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}%</span>
                  </div>
                  <Bar value={value} color={color} />
                </div>
              ))}
              <span style={{ fontSize: 11, color: "#6b7280" }}>{entry.plagiarism.flagged_sentences}/{entry.plagiarism.total_sentences} flagged</span>
            </div>
            {/* AI */}
            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                <Brain size={12} color="#2E7BFF" />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e5e7eb" }}>AI Score</span>
              </div>
              {[{ label: "Human prob.", value: entry.ai_detection.human_probability, color: aiG.color }, { label: "AI prob.", value: entry.ai_detection.ai_probability, color: "#f59e0b" }].map(({ label, value, color }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color }}>{value}%</span>
                  </div>
                  <Bar value={value} color={color} />
                </div>
              ))}
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                <div>Perplexity: {entry.ai_detection.raw_signals.perplexity}</div>
                <div>Burstiness: {entry.ai_detection.raw_signals.burstiness}</div>
              </div>
            </div>
          </div>
          {/* Combined bar */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>Combined Originality</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: g.color }}>{entry.combined_originality_score}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${entry.combined_originality_score}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${g.color}99, ${g.color})`, transition: "width 0.8s ease" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const HistoryPage = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "good" | "warn" | "bad">("all");

  const loadFromSupabase = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("check_history").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      setEntries((data || []).map(rowToEntry));
    } catch {
      const raw = localStorage.getItem(HISTORY_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadFromSupabase();
    else {
      const raw = localStorage.getItem(HISTORY_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    }
  }, [user, loadFromSupabase]);

  const deleteEntry = async (entry: HistoryEntry) => {
    setEntries(prev => prev.filter(e => e.id !== entry.id));
    if (user && entry.synced) {
      await supabase.from("check_history").delete().eq("id", entry.id);
    } else {
      const existing: HistoryEntry[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
      localStorage.setItem(HISTORY_KEY, JSON.stringify(existing.filter(e => e.id !== entry.id)));
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all history? This cannot be undone.")) return;
    setEntries([]);
    if (user) await supabase.from("check_history").delete().eq("user_id", user.id);
    localStorage.removeItem(HISTORY_KEY);
  };

  const filtered = entries.filter(e => {
    if (search && !e.textPreview.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "good" && e.combined_originality_score < 70)  return false;
    if (filter === "warn" && (e.combined_originality_score < 50 || e.combined_originality_score >= 70)) return false;
    if (filter === "bad"  && e.combined_originality_score >= 50) return false;
    return true;
  });

  const avg  = entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.combined_originality_score, 0) / entries.length) : 0;
  const best = entries.length > 0 ? Math.max(...entries.map(e => e.combined_originality_score)) : 0;
  const trend = entries.length >= 2 ? entries[0].combined_originality_score - entries[entries.length - 1].combined_originality_score : 0;

  const filterOpts = [
    { key: "all",  label: "All",    color: "#2E7BFF" },
    { key: "good", label: "≥70%",   color: "#22c55e" },
    { key: "warn", label: "50–69%", color: "#f59e0b" },
    { key: "bad",  label: "<50%",   color: "#ef4444" },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div style={{ paddingTop: 96, paddingBottom: 64 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" as const }}>
                <History size={20} color="#2E7BFF" />
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb", margin: 0 }}>Check History</h1>
                {user
                  ? <span style={{ fontSize: 10, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", padding: "2px 8px", borderRadius: 99, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Cloud size={10} /> Cloud synced</span>
                  : <span style={{ fontSize: 10, background: "rgba(107,114,128,0.1)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.2)", padding: "2px 8px", borderRadius: 99, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CloudOff size={10} /> Local only</span>
                }
              </div>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
                {user ? `${entries.length} checks · synced across all your devices` : `${entries.length} checks · sign in to sync across devices`}
              </p>
            </div>
            {entries.length > 0 && (
              <button onClick={clearAll} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", cursor: "pointer", padding: "7px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                <Trash2 size={13} /> Clear all
              </button>
            )}
          </div>

          {/* Sign-in nudge */}
          {!user && (
            <div style={{ background: "rgba(46,123,255,0.06)", border: "1px solid rgba(46,123,255,0.2)", borderRadius: 16, padding: "14px 16px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#2E7BFF", margin: "0 0 2px" }}>Sign in to sync history across devices</p>
                <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Your checks will be saved to the cloud and available anywhere.</p>
              </div>
              <Link to="/auth">
                <button style={{ background: "#2E7BFF", color: "#fff", border: "none", cursor: "pointer", padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <LogIn size={13} /> Sign In
                </button>
              </Link>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <Loader2 size={32} color="#2E7BFF" style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 14, color: "#6b7280" }}>Loading from cloud…</p>
            </div>
          )}

          {/* Stats */}
          {!loading && entries.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
              <StatCard icon={BarChart2} label="Checks" value={entries.length} sub="total" />
              <StatCard icon={Shield} label="Average" value={`${avg}%`} color={avg >= 70 ? "#22c55e" : avg >= 50 ? "#f59e0b" : "#ef4444"} sub="originality" />
              <StatCard icon={CheckCircle} label="Best" value={`${best}%`} color={best >= 70 ? "#22c55e" : best >= 50 ? "#f59e0b" : "#ef4444"} sub="all time" />
              <StatCard icon={trend >= 0 ? TrendingUp : TrendingDown} label="Trend"
                value={trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : "Stable"}
                color={trend > 0 ? "#22c55e" : trend < 0 ? "#ef4444" : "#6b7280"} sub="first → latest" />
            </div>
          )}

          {/* Search + filter */}
          {!loading && entries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <Search size={14} color="#6b7280" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 2 }}><X size={14} /></button>}
                <input type="text" placeholder="Search checks…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", paddingLeft: 36, paddingRight: search ? 32 : 12, paddingTop: 10, paddingBottom: 10, borderRadius: 12, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f9fafb", outline: "none", boxSizing: "border-box" as const }} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                {filterOpts.map(({ key, label, color }) => (
                  <button key={key} onClick={() => setFilter(key)} style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid", background: filter === key ? `${color}18` : "rgba(255,255,255,0.03)", borderColor: filter === key ? `${color}50` : "rgba(255,255,255,0.08)", color: filter === key ? color : "#6b7280", transition: "all 0.15s" }}>{label}</button>
                ))}
                <span style={{ marginLeft: "auto", fontSize: 12, color: "#4b5563" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          )}

          {!loading && entries.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 24px", background: "rgba(255,255,255,0.02)", borderRadius: 24, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(46,123,255,0.08)", border: "1px solid rgba(46,123,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <History size={32} color="#2E7BFF" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>No history yet</h2>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>Run your first originality check and it'll appear here automatically.</p>
              <Link to="/demo"><Button size="lg"><Shield className="mr-2 h-4 w-4" /> Check Your First Text</Button></Link>
            </div>
          )}

          {!loading && entries.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "rgba(255,255,255,0.02)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", color: "#6b7280", fontSize: 14 }}>
              No results. <button onClick={() => { setSearch(""); setFilter("all"); }} style={{ color: "#2E7BFF", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear filters</button>
            </div>
          )}

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {filtered.map((entry, idx) => (
                <EntryCard key={entry.id} entry={entry} prevEntry={filtered[idx + 1]} onDelete={() => deleteEntry(entry)} />
              ))}
            </div>
          )}

          {entries.length > 0 && (
            <div style={{ textAlign: "center", marginTop: 32 }}>
              <Link to="/demo"><Button size="lg"><Shield className="mr-2 h-4 w-4" /> Run Another Check</Button></Link>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <Footer />
    </div>
  );
};

export default HistoryPage;
