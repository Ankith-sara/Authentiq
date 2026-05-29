import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Plus, LogIn, LogOut, BarChart2, Copy, Check, Shield, Crown, ChevronRight, X } from "lucide-react";

interface Group { 
  id: string; 
  name: string; 
  description: string | null; 
  created_by: string; 
  is_public: boolean; 
  created_at: string; 
  member_count?: number; 
  submission_count?: number; 
}

const Groups = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [myGroupIds, setMyGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: memberships } = await supabase.from("group_members").select("group_id").eq("user_id", user.id);
      setMyGroupIds(new Set((memberships || []).map((m: { group_id: string }) => m.group_id)));
      
      const { data: groups, error } = await supabase.from("groups").select("*").eq("is_public", true).order("created_at", { ascending: false });
      if (error) throw error;
      
      const enriched = await Promise.all((groups || []).map(async (g: Group) => {
        const [{ count: mc }, { count: sc }] = await Promise.all([
          supabase.from("group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id),
          supabase.from("submissions").select("*", { count: "exact", head: true }).eq("group_id", g.id),
        ]);
        return { ...g, member_count: mc ?? 0, submission_count: sc ?? 0 };
      }));
      setAllGroups(enriched);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load groups.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const joinGroup = useCallback(async (groupId: string, silent = false) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id });
      if (error && error.code !== "23505") throw error;
      if (!silent) toast({ title: "Joined!" });
      await fetchGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join group.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }, [user, fetchGroups, toast]);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    fetchGroups();
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join");
    if (joinId) joinGroup(joinId, true);
  }, [user, navigate, fetchGroups, joinGroup]);

  const createGroup = async () => {
    if (!newName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setCreating(true);
    try {
      const { data: group, error } = await supabase.from("groups").insert({ name: newName, description: newDesc, created_by: user!.id }).select().single();
      if (error) throw error;
      await supabase.from("group_members").insert({ group_id: group.id, user_id: user!.id });
      toast({ title: "Group created!" });
      setCreateOpen(false); setNewName(""); setNewDesc("");
      await fetchGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create group.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const leaveGroup = async (groupId: string) => {
    try {
      await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user!.id);
      toast({ title: "Left group" });
      await fetchGroups();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to leave group.";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const copyInvite = (id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/groups?join=${id}`);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  const myGroups = allGroups.filter(g => myGroupIds.has(g.id));
  const otherGroups = allGroups.filter(g => !myGroupIds.has(g.id));
  const displayed = tab === "mine" ? myGroups : otherGroups;

  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(59, 130, 246, 0.15)", gap: 16 };
  const btnStyle = (primary?: boolean): React.CSSProperties => ({
    padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid",
    background: primary ? "#2563eb" : "transparent",
    color: "#ffffff",
    borderColor: primary ? "#2563eb" : "rgba(59, 130, 246, 0.15)",
    display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#03050a" }}>
      <Navigation />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "100px 24px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", marginBottom: 6 }}>Groups</h1>
            <p style={{ fontSize: 14, color: "#94a3b8" }}>Create or join a group to compare originality scores on a live leaderboard.</p>
          </div>
          <button onClick={() => setCreateOpen(true)} style={{ ...btnStyle(true), whiteSpace: "nowrap", padding: "9px 18px", fontSize: 13 }}>
            <Plus size={14} /> New Group
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "1px solid rgba(59, 130, 246, 0.15)" }}>
          {([["mine", `My Groups (${myGroups.length})`], ["all", `Discover (${otherGroups.length})`]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "10px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", background: "none", border: "none",
              color: tab === key ? "#ffffff" : "#94a3b8",
              borderBottom: `2px solid ${tab === key ? "#3b82f6" : "transparent"}`,
              marginBottom: -1, transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0" }}><Loader2 size={24} color="#3b82f6" style={{ animation: "spin 1s linear infinite", margin: "0 auto" }} /></div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: 12, border: "1px solid rgba(59, 130, 246, 0.15)", background: "#080d1a" }}>
            {tab === "mine" ? <Users size={32} color="#3b82f6" style={{ margin: "0 auto 16px" }} /> : <Shield size={32} color="#3b82f6" style={{ margin: "0 auto 16px" }} />}
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#ffffff", marginBottom: 8 }}>{tab === "mine" ? "No groups yet" : "No other groups"}</h3>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>{tab === "mine" ? "Create a group or discover existing ones to join." : "You've joined all available groups."}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setCreateOpen(true)} style={btnStyle(true)}><Plus size={13} /> Create Group</button>
              {tab === "mine" && <button onClick={() => setTab("all")} style={btnStyle()}>Discover <ChevronRight size={13} /></button>}
            </div>
          </div>
        ) : (
          <div style={{ borderRadius: 12, border: "1px solid rgba(59, 130, 246, 0.15)", overflow: "hidden", background: "#080d1a" }}>
            {displayed.map((group, i) => {
              const isMember = myGroupIds.has(group.id);
              const isOwner = group.created_by === user?.id;
              return (
                <div key={group.id} style={{ ...rowStyle, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 9, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Users size={15} color="#ffffff" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.name}</span>
                        {isOwner && <Crown size={12} color="#f59e0b" />}
                        {isMember && <span style={{ fontSize: 10, fontWeight: 600, color: "#ffffff", background: "#2563eb", padding: "1px 7px", borderRadius: 99 }}>joined</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}><span style={{ color: "#ffffff" }}>{group.member_count}</span> members</span>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}><span style={{ color: "#ffffff" }}>{group.submission_count}</span> checks</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {isMember ? (
                      <>
                        <button onClick={() => navigate(`/compare/${group.id}`)} style={btnStyle(true)}><BarChart2 size={13} /> Leaderboard</button>
                        <button onClick={() => copyInvite(group.id)} style={btnStyle()} title="Copy invite link">{copied === group.id ? <Check size={13} /> : <Copy size={13} />}</button>
                        {!isOwner && <button onClick={() => leaveGroup(group.id)} style={{ ...btnStyle(), color: "#ffffff" }} title="Leave"><LogOut size={13} /></button>}
                      </>
                    ) : (
                      <button onClick={() => joinGroup(group.id)} style={btnStyle(true)}><LogIn size={13} /> Join</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {myGroups.length > 0 && (
          <div style={{ marginTop: 32, padding: "20px 24px", borderRadius: 10, border: "1px solid rgba(59, 130, 246, 0.15)", background: "#080d1a" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>How Groups Work</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {["Go to Checker and select a group before checking", "Your originality score is saved to the group", "View the leaderboard to compare with others"].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(59, 130, 246, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.5 }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: "#080d1a", border: "1px solid rgba(59, 130, 246, 0.15)", borderRadius: 14, padding: "28px", width: "100%", maxWidth: 420 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#ffffff" }}>Create New Group</h2>
              <button onClick={() => setCreateOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff", padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#ffffff", marginBottom: 6 }}>Group Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., CS101 — Section A"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, background: "#03050a", border: "1px solid rgba(59, 130, 246, 0.15)", color: "#ffffff", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#ffffff", marginBottom: 6 }}>Description</label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What's this group for?" rows={3}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, background: "#03050a", border: "1px solid rgba(59, 130, 246, 0.15)", color: "#ffffff", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <button onClick={createGroup} disabled={creating} className="btn-primary" style={{ width: "100%", padding: "11px", borderRadius: 8, fontSize: 14, fontWeight: 600, border: "none", cursor: creating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {creating && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />} Create Group
            </button>
          </div>
        </div>
      )}

      <Footer />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Groups;
