import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, Shield, Trophy, Clock,
  TrendingUp, BarChart2, RefreshCw, ChevronLeft
} from "lucide-react";

interface Submission {
  id: string;
  text: string;
  uniqueness_score: number | null;
  similar_count: number | null;
  created_at: string;
  user_id: string | null;
  profiles: { full_name: string | null; email: string } | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
}

// Helpers
const grade = (s: number | null) => {
  if (s === null) return { label: "N/A", color: "#6b7280", bg: "rgba(107,114,128,0.08)", bar: "#6b7280" };
  if (s >= 85) return { label: "Excellent", color: "#22c55e", bg: "rgba(34,197,94,0.08)", bar: "#22c55e" };
  if (s >= 70) return { label: "Good", color: "#84cc16", bg: "rgba(132,204,22,0.08)", bar: "#84cc16" };
  if (s >= 50) return { label: "Fair", color: "#f59e0b", bg: "rgba(245,158,11,0.08)", bar: "#f59e0b" };
  return { label: "Poor", color: "#ef4444", bg: "rgba(239,68,68,0.08)", bar: "#ef4444" };
};

const formatDate = (ts: string) => {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const displayName = (sub: Submission, userId: string | undefined) => {
  const name = sub.profiles?.full_name || sub.profiles?.email?.split("@")[0] || "Anonymous";
  return sub.user_id === userId ? `${name} (you)` : name;
};

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <span style={{ fontSize: 18 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 18 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 18 }}>🥉</span>;
  return <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, minWidth: 24, textAlign: "center" as const }}>#{rank}</span>;
};

// Submission Row 
const SubmissionRow = ({
  submission, rank, isYou
}: {
  submission: Submission;
  rank: number;
  isYou: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const g = grade(submission.uniqueness_score);
  const score = submission.uniqueness_score ?? null;

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        background: isYou ? "rgba(46,123,255,0.06)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isYou ? "rgba(46,123,255,0.2)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
    >
      {/* Main row */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>

        {/* Rank */}
        <div style={{ shrink: 0, width: 28, display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <RankIcon rank={rank} />
        </div>

        {/* Score circle */}
        <div style={{
          flexShrink: 0, width: 48, height: 48, borderRadius: 12,
          background: g.bg, border: `1.5px solid ${g.color}30`,
          display: "flex", flexDirection: "column" as const,
          alignItems: "center", justifyContent: "center", gap: 1,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: g.color, lineHeight: 1 }}>
            {score ?? "—"}
          </span>
          <span style={{ fontSize: 8, color: g.color, opacity: 0.7, fontWeight: 600 }}>%</span>
        </div>

        {/* Name + preview */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: isYou ? "#2E7BFF" : "#f9fafb" }}>
              {displayName(submission, undefined)}
            </span>
            {isYou && (
              <span style={{
                fontSize: 10, background: "rgba(46,123,255,0.15)",
                color: "#2E7BFF", border: "1px solid rgba(46,123,255,0.3)",
                padding: "1px 6px", borderRadius: 99, fontWeight: 600
              }}>you</span>
            )}
            <span style={{
              fontSize: 10, background: g.bg, color: g.color,
              border: `1px solid ${g.color}30`,
              padding: "1px 7px", borderRadius: 99, fontWeight: 600, marginLeft: "auto"
            }}>{g.label}</span>
          </div>
          <p style={{
            fontSize: 12, color: "#6b7280", margin: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const
          }}>
            {submission.text?.substring(0, 90) || "—"}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" as const }}>
            <span style={{ fontSize: 11, color: "#4b5563", display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9} />{formatDate(submission.created_at)}
            </span>
            {submission.similar_count !== null && (
              <span style={{ fontSize: 11, color: "#4b5563" }}>
                {submission.similar_count} flagged sentences
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score bar — always visible */}
      <div style={{ paddingInline: 16, paddingBottom: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 99, height: 4, overflow: "hidden" }}>
          <div style={{
            width: `${score ?? 0}%`, height: "100%",
            background: `linear-gradient(90deg, ${g.bar}80, ${g.bar})`,
            borderRadius: 99, transition: "width 0.6s ease"
          }} />
        </div>
      </div>

      {/* Expanded: full text */}
      {expanded && submission.text && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 16px",
          background: "rgba(0,0,0,0.15)"
        }}>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
            Submitted Text
          </p>
          <p style={{ fontSize: 13, color: "#d1d5db", lineHeight: 1.6, margin: 0 }}>
            {submission.text.substring(0, 500)}{submission.text.length > 500 ? "…" : ""}
          </p>
        </div>
      )}
    </div>
  );
};

const Compare = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      if (groupId) {
        // Group info
        const { data: groupData, error: gErr } = await supabase
          .from("groups").select("*").eq("id", groupId).single();
        if (gErr) throw gErr;
        setGroup(groupData);

        // Member count
        const { count } = await supabase
          .from("group_members").select("*", { count: "exact", head: true }).eq("group_id", groupId);
        setMemberCount(count ?? 0);

        // Submissions for this group
        const { data, error } = await supabase
          .from("submissions")
          .select("*, profiles(full_name, email)")
          .eq("group_id", groupId)
          .order("uniqueness_score", { ascending: false });
        if (error) throw error;

        // De-duplicate: keep highest score per user
        const seen = new Set<string>();
        const deduped = (data || []).filter(s => {
          const key = s.user_id || s.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setSubmissions(deduped);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error loading data";
      toast({ title: "Error loading data", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchData();

    const channel = supabase
      .channel("submissions-live")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "submissions",
        filter: groupId ? `group_id=eq.${groupId}` : undefined,
      }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, groupId, navigate, fetchData]);

  const refresh = () => fetchData(true);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const avg = submissions.length > 0
    ? Math.round(submissions.reduce((s, e) => s + (e.uniqueness_score ?? 0), 0) / submissions.length)
    : 0;
  const best = submissions.length > 0 ? Math.max(...submissions.map(s => s.uniqueness_score ?? 0)) : 0;
  const mySubmission = submissions.find(s => s.user_id === user?.id);
  const myRank = mySubmission ? submissions.indexOf(mySubmission) + 1 : null;

  const g = grade(avg);
  const bestG = grade(best);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div style={{ paddingTop: 96, paddingBottom: 64 }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
          <div style={{ marginBottom: 24 }}>
            <button
              onClick={() => navigate("/groups")}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 13, color: "#6b7280", background: "none",
                border: "none", cursor: "pointer", padding: "0 0 12px 0"
              }}
            >
              <ChevronLeft size={14} /> Back to Groups
            </button>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" as const }}>
                  <Trophy size={20} color="#f59e0b" />
                  <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb", margin: 0 }}>
                    {group?.name || "Leaderboard"}
                  </h1>
                </div>
                {group?.description && (
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>{group.description}</p>
                )}
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 4 }}>
                    <Users size={11} />{memberCount} member{memberCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "#4b5563", display: "flex", alignItems: "center", gap: 4 }}>
                    <BarChart2 size={11} />{submissions.length} submission{submissions.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{ fontSize: 12, color: "#22c55e", display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, background: "#22c55e", borderRadius: "50%", display: "inline-block" }} />
                    Live
                  </span>
                </div>
              </div>

              <button
                onClick={refresh}
                style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, padding: "8px 12px", cursor: "pointer",
                  color: "#6b7280", display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexShrink: 0
                }}
              >
                <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats row */}
          {submissions.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Group Avg", value: `${avg}%`, color: g.color, icon: BarChart2 },
                { label: "Best Score", value: `${best}%`, color: bestG.color, icon: TrendingUp },
                { label: "Your Rank", value: myRank ? `#${myRank}` : "—", color: "#2E7BFF", icon: Trophy },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 16, padding: "14px 12px", textAlign: "center" as const
                }}>
                  <Icon size={14} color={color} style={{ margin: "0 auto 6px" }} />
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* My position callout */}
          {mySubmission && myRank && (
            <div style={{
              background: "rgba(46,123,255,0.06)", border: "1px solid rgba(46,123,255,0.2)",
              borderRadius: 14, padding: "12px 16px", marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" as const
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <RankIcon rank={myRank} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#2E7BFF", margin: 0 }}>Your position</p>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                    Score: {mySubmission.uniqueness_score}% · {myRank} of {submissions.length}
                  </p>
                </div>
              </div>
              <Link to="/demo">
                <button style={{
                  background: "rgba(46,123,255,0.15)", border: "1px solid rgba(46,123,255,0.3)",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                  color: "#2E7BFF", fontSize: 12, fontWeight: 600
                }}>
                  Improve Score →
                </button>
              </Link>
            </div>
          )}

          {/* Empty state */}
          {submissions.length === 0 && (
            <div style={{
              textAlign: "center", padding: "60px 24px",
              background: "rgba(255,255,255,0.02)", borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.06)"
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px"
              }}>
                <Trophy size={32} color="#f59e0b" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb", marginBottom: 8 }}>
                No submissions yet
              </h2>
              <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>
                Be the first! Go to the checker, select this group, and submit your text.
              </p>
              <Link to="/demo">
                <Button size="lg">
                  <Shield className="mr-2 h-4 w-4" /> Go to Checker
                </Button>
              </Link>
            </div>
          )}

          {/* Leaderboard */}
          {submissions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
              {submissions.map((sub, idx) => (
                <SubmissionRow
                  key={sub.id}
                  submission={sub}
                  rank={idx + 1}
                  isYou={sub.user_id === user?.id}
                />
              ))}
            </div>
          )}

          {/* Bottom CTA */}
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <Link to="/demo">
              <Button size="lg">
                <Shield className="mr-2 h-4 w-4" />
                {mySubmission ? "Submit New Check" : "Submit to Leaderboard"}
              </Button>
            </Link>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <Footer />
    </div>
  );
};

export default Compare;
