import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Loader2, CheckCircle, AlertTriangle, Shield, Upload,
  Brain, FileText, Globe, AlertCircle, ChevronDown, ChevronUp,
  History, Users
} from "lucide-react";
import { saveToHistory } from "@/pages/History";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// ── Types ──────────────────────────────────────────────────────────────────

interface SentenceResult {
  sentence: string;
  similarity: number;
  matched_text: string;
  source: "corpus" | "web";
  flagged: boolean;
}

interface PlagiarismResult {
  plagiarism_score: number;
  originality_score: number;
  matches: SentenceResult[];
  sentence_results: SentenceResult[];
  total_sentences: number;
  flagged_sentences: number;
  processing_ms: number;
  corpus_size: number;
  web_checked: boolean;
}

interface SignalBreakdown { score: number; weight: number; }

interface AiResult {
  ai_probability: number;
  human_probability: number;
  verdict: string;
  confidence: string;
  reasoning: string[];
  signal_breakdown: Record<string, SignalBreakdown>;
  raw_signals: {
    perplexity: number;
    burstiness: number;
    entropy: number;
    stylometry: Record<string, number>;
  };
  processing_ms: number;
}

interface FullResult {
  combined_originality_score: number;
  plagiarism: PlagiarismResult;
  ai_detection: AiResult;
  total_processing_ms: number;
}

interface Group {
  id: string;
  name: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const scoreColor = (s: number) => s >= 75 ? "text-blue-400" : s >= 50 ? "text-blue-300" : "text-blue-200";
const scoreBg   = (s: number) => s >= 75 ? "bg-blue-500/10 border-blue-500" : s >= 50 ? "bg-blue-500/10 border-blue-400" : "bg-blue-500/10 border-blue-300";
const scoreIcon = (s: number) => s >= 75
  ? <CheckCircle className="h-7 w-7 text-blue-400" />
  : s >= 50 ? <AlertTriangle className="h-7 w-7 text-blue-300" />
  : <AlertCircle className="h-7 w-7 text-blue-200" />;

const SIGNAL_LABELS: Record<string, string> = {
  perplexity: "GPT-2 Perplexity",
  burstiness: "Sentence Burstiness",
  unique_word_ratio: "Unique Word Ratio",
  avg_sentence_length: "Avg. Sentence Length",
  entropy: "Token Entropy",
};

// ── Component ──────────────────────────────────────────────────────────────

const OriginalityChecker = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [useWeb, setUseWeb] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FullResult | null>(null);
  const [showAllSentences, setShowAllSentences] = useState(false);
  const [mode, setMode] = useState<"text" | "pdf">("text");

  // Group state
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [savingToGroup, setSavingToGroup] = useState(false);

  // Load user's groups
  useEffect(() => {
    if (!user) return;
    const fetchGroups = async () => {
      const { data: memberships } = await supabase
        .from("group_members")
        .select("group_id")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) return;

      const ids = memberships.map(m => m.group_id);
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name")
        .in("id", ids)
        .order("name");

      if (groups) setMyGroups(groups);
    };
    fetchGroups();
  }, [user]);

  // ── Save result to Supabase submissions table ──
  const saveToSupabase = async (data: FullResult, inputText: string) => {
    if (!user) return;
    setSavingToGroup(true);
    try {
      const { error } = await supabase.from("submissions").insert({
        user_id: user.id,
        group_id: selectedGroupId || null,
        text: inputText.substring(0, 10000),
        uniqueness_score: data.combined_originality_score,
        similar_count: data.plagiarism.flagged_sentences,
      });
      if (error) {
        console.error("Supabase save error:", error);
        // Non-blocking: analysis succeeded, just warn the user
        toast({
          title: "Result saved locally",
          description: "Cloud sync failed — your result is saved in History on this device.",
          variant: "default",
        });
      }
    } finally {
      setSavingToGroup(false);
    }
  };

  // ── Process result: save history + save to Supabase ──
  const processResult = async (data: FullResult, inputText: string) => {
    setResult(data);
    await saveToHistory(
      {
        textPreview: inputText.slice(0, 120) + (inputText.length > 120 ? "…" : ""),
        textLength: inputText.length,
        combined_originality_score: data.combined_originality_score,
        plagiarism: {
          plagiarism_score: data.plagiarism.plagiarism_score,
          originality_score: data.plagiarism.originality_score,
          flagged_sentences: data.plagiarism.flagged_sentences,
          total_sentences: data.plagiarism.total_sentences,
        },
        ai_detection: {
          ai_probability: data.ai_detection.ai_probability,
          human_probability: data.ai_detection.human_probability,
          verdict: data.ai_detection.verdict,
          confidence: data.ai_detection.confidence,
          raw_signals: {
            perplexity: data.ai_detection.raw_signals.perplexity,
            burstiness: data.ai_detection.raw_signals.burstiness,
          },
        },
        total_processing_ms: data.total_processing_ms,
      },
      user?.id,        
      selectedGroupId || undefined
    );
    // Also save to submissions table for group leaderboard
    await saveToSupabase(data, inputText);

    const groupName = myGroups.find(g => g.id === selectedGroupId)?.name;
    toast({
      title: "Analysis complete!",
      description: `${data.combined_originality_score}% original${groupName ? ` · saved to "${groupName}"` : " · saved to history"}`,
    });
  };

  // ── Check text ──
  const handleCheck = async () => {
    if (!text || text.trim().length < 10) {
      toast({ title: "Too short", description: "Enter at least 10 characters.", variant: "destructive" });
      return;
    }
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/check-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, use_web: useWeb, store: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data: FullResult = await res.json();
      await processResult(data, text);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reach backend.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  // ── Check PDF ──
  const handlePdfUpload = async (file: File) => {
    setChecking(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("use_web", String(useWeb));
      form.append("store", "true");
      const res = await fetch(`${API_BASE}/upload-pdf`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data: FullResult = await res.json();
      await processResult(data, `PDF: ${file.name}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to analyze PDF.", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const p = result?.plagiarism;
  const ai = result?.ai_detection;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">

      {/* ── Input Card ── */}
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Shield className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg sm:text-2xl font-bold text-white">Check Originality</h2>
        </div>
        <p className="text-white/80 mb-4 text-xs sm:text-sm">
          Real semantic similarity + GPT-2 AI detection.
        </p>

        <div className="flex gap-2 mb-4">
          <Button size="sm" variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")} className="flex-1 sm:flex-none">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Text
          </Button>
          <Button size="sm" variant={mode === "pdf" ? "default" : "outline"} onClick={() => setMode("pdf")} className="flex-1 sm:flex-none">
            <Upload className="h-3.5 w-3.5 mr-1.5" /> PDF
          </Button>
        </div>

        {mode === "text" ? (
          <Textarea
            placeholder="Paste your text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="mb-4 font-mono text-sm bg-black border-blue-500 text-white placeholder:text-white/40"
          />
        ) : (
          <div
            className="mb-4 border-2 border-dashed border-blue-500 rounded-xl p-8 sm:p-12 text-center cursor-pointer hover:bg-blue-500/10 transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 sm:h-8 sm:w-8 mx-auto mb-2 text-blue-400" />
            <p className="text-white/70 text-sm">Tap to upload a PDF</p>
            <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }} />
          </div>
        )}

        {user && myGroups.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-semibold text-white">Save to Group</span>
              <span className="text-xs text-white/60">(optional — for leaderboard)</span>
            </div>
            <select
              value={selectedGroupId}
              onChange={e => setSelectedGroupId(e.target.value)}
              className="w-full text-sm rounded-lg bg-black border border-blue-500 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None (history only)</option>
              {myGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        {!user && (
          <div className="mb-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Users className="h-3.5 w-3.5" />
              Sign in to save results to a group leaderboard
            </div>
            <Link to="/auth">
              <Button size="sm" variant="outline" className="text-xs h-7 border-blue-500 text-white">Sign In</Button>
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {mode === "text" && (
              <span className="text-xs text-white/60">
                {text.length} chars · {text.split(/\s+/).filter(Boolean).length} words
              </span>
            )}
            <button
              onClick={() => setUseWeb(!useWeb)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                useWeb ? "border-blue-500 bg-blue-500/20 text-blue-400" : "border-blue-500 text-white/70"
              }`}
            >
              <Globe className="h-3 w-3" /> Web {useWeb ? "ON" : "OFF"}
            </button>
          </div>

          {mode === "text" && (
            <Button onClick={handleCheck} disabled={checking || text.trim().length < 10} size="lg" className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white">
              {checking
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing...</>
                : <><Shield className="mr-2 h-4 w-4" /> Check Originality</>}
            </Button>
          )}
        </div>
      </div>

      {checking && (
        <Card className="p-6 sm:p-8 text-center border-2 border-blue-500 bg-black">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-500" />
          <p className="font-medium text-sm sm:text-base text-white">Running analysis...</p>
          <p className="text-xs sm:text-sm text-white/60 mt-1">
            Embeddings · Corpus match · GPT-2 perplexity
            {savingToGroup && " · Saving to group..."}
          </p>
        </Card>
      )}

      {/* ── Results ── */}
      {result && !checking && (
        <>
          <Card className={`p-4 sm:p-6 border-2 ${scoreBg(result.combined_originality_score)} bg-black`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                {scoreIcon(result.combined_originality_score)}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-3xl sm:text-4xl font-bold ${scoreColor(result.combined_originality_score)}`}>
                      {result.combined_originality_score}%
                    </span>
                    <span className="text-sm text-white/70 font-medium">original</span>
                  </div>
                  <p className="text-xs text-white/60">
                    Saved to history
                    {selectedGroupId && myGroups.find(g => g.id === selectedGroupId) &&
                      ` · Saved to "${myGroups.find(g => g.id === selectedGroupId)?.name}" ✓`}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-white/60 shrink-0 space-y-0.5">
                <p>{result.total_processing_ms}ms</p>
                <p>{p?.corpus_size} refs</p>
                {p?.web_checked && <p className="text-blue-400">web ✓</p>}
              </div>
            </div>
            <Progress value={result.combined_originality_score} className="mt-3 h-2 sm:h-3" />
            <p className="text-[10px] sm:text-xs text-white/60 mt-1.5">
              60% plagiarism originality · 40% human probability
            </p>
          </Card>

          <Card className="p-4 sm:p-6 border-2 border-blue-500 bg-black">
            <Tabs defaultValue="plagiarism">
              <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10 bg-blue-500/10 border border-blue-500">
                <TabsTrigger value="plagiarism" className="text-xs sm:text-sm text-white data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <FileText className="h-3.5 w-3.5 mr-1 hidden sm:inline" /> Plagiarism
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs sm:text-sm text-white data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  <Brain className="h-3.5 w-3.5 mr-1 hidden sm:inline" /> AI Score
                </TabsTrigger>
                <TabsTrigger value="sentences" className="text-xs sm:text-sm text-white data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                  Sentences
                  {p && p.flagged_sentences > 0 && (
                    <Badge variant="destructive" className="ml-1 text-[9px] px-1 py-0 bg-blue-600 border-blue-400">{p.flagged_sentences}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Plagiarism tab */}
              <TabsContent value="plagiarism" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: "Originality", value: `${p?.originality_score}%`, color: scoreColor(p?.originality_score ?? 0) },
                    { label: "Plagiarism",  value: `${p?.plagiarism_score}%`, color: "text-white" },
                    { label: "Flagged",     value: `${p?.flagged_sentences}/${p?.total_sentences}`, color: "text-white" },
                    { label: "Time",        value: `${p?.processing_ms}ms`, color: "text-white" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-blue-500/10 border border-blue-500 rounded-xl p-3 text-center">
                      <p className={`text-lg sm:text-2xl font-bold ${color ?? ""}`}>{value}</p>
                      <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs sm:text-sm text-white">
                    <span className="font-medium">Plagiarism Level</span>
                    <span>{p?.plagiarism_score}%</span>
                  </div>
                  <Progress value={p?.plagiarism_score ?? 0} className="h-2" />
                </div>
                {p?.similarity_stats && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {(["max", "mean", "median"] as const).map(k => (
                      <div key={k} className="bg-blue-500/5 border border-blue-500 rounded-xl p-2">
                        <p className="text-white font-medium">{(p.similarity_stats as any)[k]}%</p>
                        <p className="text-white/50 capitalize">{k} sim.</p>
                      </div>
                    ))}
                  </div>
                )}
                {p?.matches.length === 0 && (
                  <div className="text-center py-4 text-blue-400">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">No corpus matches found.</p>
                  </div>
                )}
              </TabsContent>

              {/* AI tab */}
              <TabsContent value="ai" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[
                    { label: "Human Probability", value: `${ai?.human_probability}%`, color: scoreColor(ai?.human_probability ?? 0) },
                    { label: "AI Probability",    value: `${ai?.ai_probability}%`, color: "text-white" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-blue-500/10 border border-blue-500 rounded-xl p-3 text-center">
                      <p className={`text-xl sm:text-2xl font-bold ${color ?? ""}`}>{value}</p>
                      <p className="text-[10px] sm:text-xs text-white/60 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-blue-500/10 border border-blue-500 rounded-xl p-3 sm:p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/60">Verdict</p>
                    <p className="font-semibold text-sm sm:text-base text-white">{ai?.verdict}</p>
                  </div>
                  <Badge variant="outline" className="text-xs border-blue-500 text-white">{ai?.confidence} confidence</Badge>
                </div>
                <div className="space-y-2.5">
                  <p className="text-xs sm:text-sm font-medium text-white">Signal Breakdown:</p>
                  {ai && Object.entries(ai.signal_breakdown).map(([key, val]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex justify-between text-[10px] sm:text-xs text-white">
                        <span className="text-white/70">{SIGNAL_LABELS[key] ?? key}</span>
                        <span>Score: {val.score} · {Math.round(val.weight * 100)}% weight</span>
                      </div>
                      <Progress value={val.score} className="h-1.5" />
                    </div>
                  ))}
                </div>
                <div className="bg-blue-500/5 border border-blue-500 rounded-xl p-3 font-mono text-[10px] sm:text-xs space-y-1 text-white">
                  <p className="font-semibold font-sans text-xs sm:text-sm mb-1.5">Raw Signals</p>
                  {ai && <>
                    <p>Perplexity: {ai.raw_signals.perplexity}</p>
                    <p>Burstiness: {ai.raw_signals.burstiness}</p>
                    <p>Entropy: {ai.raw_signals.entropy}</p>
                    <p>Avg Word Length: {ai.raw_signals.stylometry.avg_word_length}</p>
                    <p>Unique Word Ratio: {ai.raw_signals.stylometry.unique_word_ratio}</p>
                    <p>Avg Sentence Length: {ai.raw_signals.stylometry.avg_sentence_length} words</p>
                  </>}
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs sm:text-sm font-medium text-white">Why this score:</p>
                  {ai?.reasoning.map((r, i) => (
                    <div key={i} className="flex gap-2 text-[10px] sm:text-xs text-white/70">
                      <span className="mt-0.5 shrink-0 text-blue-500">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Sentences tab */}
              <TabsContent value="sentences" className="mt-4 space-y-2 sm:space-y-3">
                {p && p.sentence_results.length === 0 && (
                  <p className="text-center py-6 text-white/60 text-sm">No sentences found.</p>
                )}
                {p && (showAllSentences ? p.sentence_results : p.sentence_results.filter(s => s.flagged)).map((s, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-sm ${
                    s.flagged ? "bg-blue-500/10 border-blue-400" : "bg-blue-500/5 border-blue-500"
                  }`}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <p className="text-xs sm:text-sm leading-relaxed flex-1 text-white">{s.sentence}</p>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant={s.flagged ? "destructive" : "outline"} className="text-[10px] px-1.5 bg-blue-600 border-blue-400 text-white">{s.similarity}%</Badge>
                        {s.source === "web" && <Badge variant="secondary" className="text-[10px] px-1.5 bg-blue-500 text-white">web</Badge>}
                      </div>
                    </div>
                    {s.flagged && s.matched_text && (
                      <p className="text-[10px] sm:text-xs text-white/60 mt-1.5 border-t border-blue-500 pt-1.5">
                        ↳ "{s.matched_text.substring(0, 100)}{s.matched_text.length > 100 ? "…" : ""}"
                      </p>
                    )}
                    <Progress value={s.similarity} className="h-1 mt-2" />
                  </div>
                ))}
                {p && p.sentence_results.length > 0 && (
                  <button
                    onClick={() => setShowAllSentences(!showAllSentences)}
                    className="flex items-center gap-1 text-xs text-white/70 hover:text-white transition mx-auto pt-1"
                  >
                    {showAllSentences
                      ? <><ChevronUp className="h-3 w-3" /> Show flagged only</>
                      : <><ChevronDown className="h-3 w-3" /> Show all {p.sentence_results.length} sentences</>}
                  </button>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          {/* Links */}
          <div className="flex items-center justify-center gap-3">
            <Link to="/history">
              <Button variant="outline" size="sm" className="text-xs sm:text-sm border-blue-500 text-white hover:bg-blue-500/10">
                <History className="mr-1.5 h-3.5 w-3.5" /> History
              </Button>
            </Link>
            {selectedGroupId && (
              <Link to={`/compare/${selectedGroupId}`}>
                <Button variant="outline" size="sm" className="text-xs sm:text-sm border-blue-500 text-white hover:bg-blue-500/10">
                  <Users className="mr-1.5 h-3.5 w-3.5" /> View Group Leaderboard
                </Button>
              </Link>
            )}
            {!selectedGroupId && user && (
              <Link to="/groups">
                <Button variant="outline" size="sm" className="text-xs sm:text-sm border-blue-500 text-white hover:bg-blue-500/10">
                  <Users className="mr-1.5 h-3.5 w-3.5" /> Join a Group
                </Button>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OriginalityChecker;