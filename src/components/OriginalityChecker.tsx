import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  Loader2, CheckCircle, AlertTriangle, Shield, Upload,
  Brain, FileText, Globe, AlertCircle, ChevronDown, ChevronUp,
  History, Users, Sparkles, Trash2, Edit3, Eye
} from "lucide-react";
import { saveToHistory } from "@/pages/History";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Types 
interface SentenceResult {
  sentence: string;
  similarity: number;
  matched_text: string;
  source: "corpus" | "web";
  flagged: boolean;
}

interface PlagiarismResult {
  similarity_stats: Record<string, number> | null;
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

// Helpers 
const scoreColor = (s: number) => s >= 75 ? "text-blue-400" : s >= 50 ? "text-blue-300" : "text-blue-200";

const SIGNAL_LABELS: Record<string, string> = {
  perplexity: "GPT-2 Perplexity",
  burstiness: "Sentence Burstiness",
  unique_word_ratio: "Unique Word Ratio",
  avg_sentence_length: "Avg. Sentence Length",
  entropy: "Token Entropy",
};

// SVG Radial Progress Indicator
const RadialOriginality = ({ score }: { score: number }) => {
  const radius = 60;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color = score >= 75 ? "#3b82f6" : score >= 50 ? "#60a5fa" : "#93c5fd";

  return (
    <div className="flex flex-col items-center justify-center p-2 select-none">
      <div className="relative flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            stroke="rgba(59, 130, 246, 0.05)"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            stroke={color}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + ' ' + circumference}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute text-center flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold font-mono text-white leading-none">{score}%</span>
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-1">Original</span>
        </div>
      </div>
    </div>
  );
};

// Component 
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

  // Quillbot-style states
  const [activeView, setActiveView] = useState<"edit" | "inspect">("edit");
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState<number | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<"plagiarism" | "ai" | "sentences">("plagiarism");

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

  // Save result to Supabase submissions table 
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

  // Process result
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
    await saveToSupabase(data, inputText);

    const groupName = myGroups.find(g => g.id === selectedGroupId)?.name;
    toast({
      title: "Analysis complete!",
      description: `${data.combined_originality_score}% original${groupName ? ` · saved to "${groupName}"` : " · saved to history"}`,
    });

    // Automatically transition to split inspector view
    setActiveView("inspect");
    const firstFlaggedIndex = data.plagiarism.sentence_results.findIndex(s => s.flagged);
    if (firstFlaggedIndex !== -1) {
      setSelectedSentenceIndex(firstFlaggedIndex);
      setActiveResultTab("sentences");
    } else {
      setSelectedSentenceIndex(null);
      setActiveResultTab("plagiarism");
    }
  };

  // Check text
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
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reach backend.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  // Check PDF
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
      setText(`[PDF Content Extracted: ${file.name}]`);
      await processResult(data, `PDF: ${file.name}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to analyze PDF.";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const p = result?.plagiarism;
  const ai = result?.ai_detection;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* ── LEFT PANEL: QuillBot-Style Editor Workspace (7 Columns) ── */}
        <div className="lg:col-span-7 flex flex-col bg-[#080d1a] border border-blue-500/15 rounded-2xl overflow-hidden min-h-[500px] shadow-2xl relative">
          
          {/* Header toolbar */}
          <div className="px-4 py-3 border-b border-blue-500/10 flex items-center justify-between bg-blue-950/20">
            <div className="flex gap-1.5 items-center">
              <Button 
                size="sm" 
                variant={activeView === "edit" ? "default" : "ghost"}
                onClick={() => setActiveView("edit")}
                className="text-xs font-semibold px-3 h-8 text-white"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1 text-blue-400" /> Write / Edit
              </Button>
              {result && (
                <Button 
                  size="sm" 
                  variant={activeView === "inspect" ? "default" : "ghost"}
                  onClick={() => setActiveView("inspect")}
                  className="text-xs font-semibold px-3 h-8 text-white"
                >
                  <Eye className="h-3.5 w-3.5 mr-1 text-blue-400" /> Interactive Inspector
                </Button>
              )}
            </div>

            {activeView === "edit" && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setMode("text")} 
                  className={`text-xs px-2.5 py-1 rounded-md transition ${mode === "text" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "text-slate-400 hover:text-white"}`}
                >
                  Text
                </button>
                <button 
                  onClick={() => setMode("pdf")} 
                  className={`text-xs px-2.5 py-1 rounded-md transition ${mode === "pdf" ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : "text-slate-400 hover:text-white"}`}
                >
                  PDF Upload
                </button>
              </div>
            )}
          </div>

          {/* Core Content Area */}
          <div className="flex-1 p-4 flex flex-col relative min-h-[350px]">
            {activeView === "edit" ? (
              mode === "text" ? (
                <div className="flex-1 flex flex-col">
                  <Textarea
                    placeholder="Paste or write your essay, article, or document here to scan for semantic plagiarism and AI footprints..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="flex-1 resize-none border-0 bg-transparent text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-1 text-sm font-sans leading-relaxed min-h-[300px] overflow-y-auto"
                  />
                  {text.length > 0 && (
                    <button 
                      onClick={() => setText("")}
                      className="absolute top-4 right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition"
                      title="Clear text"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  className="flex-1 border-2 border-dashed border-blue-500/20 rounded-xl flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:bg-blue-500/5 hover:border-blue-500/40 transition-all select-none min-h-[300px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-white font-semibold text-sm mb-1">Upload Document PDF</h3>
                  <p className="text-slate-400 text-xs max-w-xs mx-auto mb-4 leading-normal">
                    Files are parsed securely on Authentiq's servers and cross-checked against our database.
                  </p>
                  <Button size="sm" className="btn-secondary h-8 px-4 text-xs font-semibold">Select File</Button>
                  <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfUpload(f); }} />
                </div>
              )
            ) : (
              /* Interactive Inspector Screen */
              <div className="flex-1 text-sm leading-relaxed text-slate-300 font-sans px-2 py-1 overflow-y-auto max-h-[420px] select-text">
                {result && result.plagiarism.sentence_results.length > 0 ? (
                  result.plagiarism.sentence_results.map((s, idx) => {
                    if (s.flagged) {
                      const isSelected = selectedSentenceIndex === idx;
                      return (
                        <span 
                          key={idx}
                          onClick={() => {
                            setSelectedSentenceIndex(idx);
                            setActiveResultTab("sentences");
                          }}
                          className={`cursor-pointer px-0.5 rounded transition-all leading-loose inline-block ${
                            isSelected 
                              ? "bg-blue-600/30 border-b-2 border-blue-400 text-white font-medium shadow-sm" 
                              : "bg-blue-500/15 border-b border-blue-500/30 text-slate-100 hover:bg-blue-500/25"
                          }`}
                          title={`${s.similarity}% Match (Click to inspect source)`}
                        >
                          {s.sentence}
                        </span>
                      );
                    }
                    return <span key={idx} className="text-slate-300 inline-block">{s.sentence} </span>;
                  })
                ) : (
                  <p className="text-slate-400 italic">No sentence markers loaded.</p>
                )}
              </div>
            )}
          </div>

          {/* Footer toolbar panel */}
          <div className="px-4 py-3 border-t border-blue-500/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-blue-950/10">
            <div className="flex items-center gap-3 flex-wrap">
              {mode === "text" && activeView === "edit" && (
                <span className="text-[11px] text-slate-400 font-mono">
                  {text.trim().length === 0 ? "0 words" : `${text.split(/\s+/).filter(Boolean).length} words`} · {text.length} chars
                </span>
              )}
              
              {user && myGroups.length > 0 && activeView === "edit" && (
                <div className="flex items-center gap-1.5 bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-500/15">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Group:</span>
                  <select
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                    className="text-xs bg-transparent border-none text-white focus:outline-none cursor-pointer"
                  >
                    <option value="">Private Scan</option>
                    {myGroups.map(g => (
                      <option key={g.id} value={g.id} className="bg-black">{g.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeView === "edit" && (
                <button
                  onClick={() => setUseWeb(!useWeb)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition ${
                    useWeb ? "border-blue-500 bg-blue-500/10 text-blue-400 font-semibold" : "border-blue-500/25 text-slate-400"
                  }`}
                >
                  <Globe className="h-3.5 w-3.5" /> Web Scan: {useWeb ? "ON" : "OFF"}
                </button>
              )}
            </div>

            {activeView === "edit" && mode === "text" && (
              <Button 
                onClick={handleCheck} 
                disabled={checking || text.trim().length < 10} 
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md px-5 h-9 rounded-xl text-xs transition-all flex-shrink-0"
              >
                {checking ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Scanning...</>
                ) : (
                  <><Shield className="mr-1.5 h-3.5 w-3.5" /> Scan Originality</>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL: QuillBot-Style Analysis Sidebar (5 Columns) ── */}
        <div className="lg:col-span-5 flex flex-col bg-[#080d1a] border border-blue-500/15 rounded-2xl overflow-hidden min-h-[500px] shadow-2xl relative">
          
          {/* Checking Loader State */}
          {checking && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/60 backdrop-blur-sm z-30">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
              <h3 className="text-white font-bold text-base mb-1">Performing Originality Scan</h3>
              <p className="text-xs text-slate-400 max-w-xs leading-normal mb-4">
                Computing dense sentence transformer embeddings, cross-verifying active indices, and scanning GPT-2 perplexity distribution.
              </p>
              <div className="w-full max-w-[240px] space-y-2 mt-4 text-left border border-blue-500/10 p-3 rounded-xl bg-blue-950/20">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <CheckCircle className="h-3.5 w-3.5 text-blue-400" /> Canonical decomposition...
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" /> Vector corpus comparison...
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600 ml-1" /> Perplexity verification...
                </div>
              </div>
            </div>
          )}

          {/* Empty Placeholder State */}
          {!result && !checking && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Sparkles className="h-10 w-10 text-blue-500/40 mb-4" />
              <h3 className="text-white font-semibold text-sm mb-1.5">No Scan Active</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-normal mb-6">
                Paste your text in the editor or upload a document file to begin vector analysis.
              </p>
              
              <div className="w-full max-w-xs border border-blue-500/10 rounded-2xl p-4 bg-blue-950/5 text-left space-y-4">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <h4 className="text-white text-xs font-semibold">Semantic Matching</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Detects paraphrasing and matching vector alignments.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <h4 className="text-white text-xs font-semibold">Multi-LLM Probability</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Ensemble analysis of sentence perplexity and burstiness signals.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Loaded Result Panel */}
          {result && !checking && (
            <div className="flex-1 flex flex-col">
              
              {/* Radial Score dashboard header */}
              <div className="p-4 border-b border-blue-500/10 bg-blue-950/20 flex items-center justify-around gap-2 flex-wrap">
                <RadialOriginality score={result.combined_originality_score} />
                
                <div className="flex flex-col gap-2 shrink-0">
                  <div className="text-xs text-slate-400 font-mono">
                    <p>Processing: <span className="text-white font-bold">{result.total_processing_ms}ms</span></p>
                    <p>Corpus Size: <span className="text-white font-bold">{p?.corpus_size} refs</span></p>
                    {p?.web_checked && <p className="text-blue-400 font-bold">Web check active ✓</p>}
                  </div>
                  <div className="text-[10px] text-slate-400 font-sans leading-relaxed border-t border-blue-500/10 pt-1">
                    <p>{p?.plagiarism_score}% plagiarism footprint</p>
                    <p>{ai?.ai_probability}% AI detection chance</p>
                  </div>
                </div>
              </div>

              {/* Action Tabs list */}
              <div className="px-4 py-2 border-b border-blue-500/10 flex bg-[#080d1a]">
                <button
                  onClick={() => setActiveResultTab("plagiarism")}
                  className={`flex-1 text-center py-2 text-xs font-semibold transition ${
                    activeResultTab === "plagiarism" ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Plagiarism
                </button>
                <button
                  onClick={() => setActiveResultTab("ai")}
                  className={`flex-1 text-center py-2 text-xs font-semibold transition ${
                    activeResultTab === "ai" ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-400 hover:text-white"
                  }`}
                >
                  AI Score
                </button>
                <button
                  onClick={() => setActiveResultTab("sentences")}
                  className={`flex-1 text-center py-2 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                    activeResultTab === "sentences" ? "text-blue-400 border-b-2 border-blue-500" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Sentences
                  {p && p.flagged_sentences > 0 && (
                    <span className="bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                      {p.flagged_sentences}
                    </span>
                  )}
                </button>
              </div>

              {/* Tab Contents wrapper */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[300px] min-h-[250px]">
                
                {/* 1. Plagiarism Match List */}
                {activeResultTab === "plagiarism" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-white">
                        <span className="font-semibold text-slate-300">Overall Plagiarism footprint:</span>
                        <span className="font-bold">{p?.plagiarism_score}%</span>
                      </div>
                      <Progress value={p?.plagiarism_score ?? 0} className="h-2 bg-blue-950" />
                    </div>

                    {p?.similarity_stats && (
                      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                        {(["max", "mean", "median"] as const).map(k => (
                          <div key={k} className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-2">
                            <p className="text-white font-bold font-mono text-xs">{(p.similarity_stats as Record<string, number>)[k]}%</p>
                            <p className="text-slate-400 capitalize">{k} sim.</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {p?.matches && p.matches.length > 0 ? (
                      <div className="space-y-2 mt-4">
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Top similarity matches</p>
                        {p.matches.slice(0, 4).map((m, idx) => (
                          <div key={idx} className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-white uppercase tracking-tight text-[9px] bg-blue-500/10 px-2 py-0.5 rounded">Match {idx + 1}</span>
                              <span className="text-blue-400 font-bold font-mono">{m.similarity}% Match</span>
                            </div>
                            <p className="text-slate-300 leading-normal">"{m.sentence}"</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-blue-400 flex flex-col items-center">
                        <CheckCircle className="h-8 w-8 mb-2 opacity-80" />
                        <p className="text-xs font-semibold text-white">No major plagiarism matches found.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. AI Score Breakdown */}
                {activeResultTab === "ai" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-2.5">
                        <p className="text-base font-bold font-mono text-blue-300">{ai?.human_probability}%</p>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Human probability</p>
                      </div>
                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-2.5">
                        <p className="text-base font-bold font-mono text-white">{ai?.ai_probability}%</p>
                        <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">AI probability</p>
                      </div>
                    </div>

                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Verdict</p>
                        <p className="font-bold text-sm text-white">{ai?.verdict}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-blue-500/30 text-slate-300">{ai?.confidence} confidence</Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-300">Feature Signals:</p>
                      {ai && Object.entries(ai.signal_breakdown).map(([key, val]) => (
                        <div key={key} className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{SIGNAL_LABELS[key] ?? key}</span>
                            <span>{val.score} score · {Math.round(val.weight * 100)}% weight</span>
                          </div>
                          <Progress value={val.score} className="h-1 bg-blue-950" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-blue-500/10">
                      <p className="text-xs font-semibold text-slate-300">Model Reasoning:</p>
                      {ai?.reasoning.map((r, i) => (
                        <div key={i} className="flex gap-2 text-[10px] text-slate-400 leading-relaxed">
                          <span className="text-blue-500">•</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Detailed Sentences List */}
                {activeResultTab === "sentences" && (
                  <div className="space-y-2">
                    {p && p.sentence_results.length === 0 && (
                      <p className="text-center py-6 text-slate-400 text-xs italic">No sentences mapped.</p>
                    )}

                    {/* Active focused sentence details helper */}
                    {selectedSentenceIndex !== null && p && p.sentence_results[selectedSentenceIndex] && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs space-y-2 mb-3 shadow-md">
                        <div className="flex justify-between items-center border-b border-blue-500/10 pb-1.5">
                          <span className="font-bold text-blue-300 uppercase tracking-wider text-[8px]">Focused Sentence</span>
                          <Badge variant="destructive" className="text-[9px] px-1.5 bg-blue-600 border-blue-400">{p.sentence_results[selectedSentenceIndex].similarity}% match</Badge>
                        </div>
                        <p className="text-white font-medium">"{p.sentence_results[selectedSentenceIndex].sentence}"</p>
                        {p.sentence_results[selectedSentenceIndex].matched_text && (
                          <div className="text-slate-400 bg-black/40 p-2 rounded-lg mt-1 border border-blue-500/5 leading-relaxed">
                            <p className="text-[9px] font-bold text-blue-400/80 uppercase tracking-tight mb-1">Source Match Footprint:</p>
                            <p className="italic">↳ "{p.sentence_results[selectedSentenceIndex].matched_text}"</p>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-2">Full Sentence breakdown list</p>
                    {p && (showAllSentences ? p.sentence_results : p.sentence_results.filter(s => s.flagged)).map((s, i) => {
                      const isSelected = selectedSentenceIndex === i;
                      return (
                        <div 
                          key={i} 
                          onClick={() => setSelectedSentenceIndex(i)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? "bg-blue-600/10 border-blue-500" 
                              : s.flagged ? "bg-blue-500/5 border-blue-500/15 hover:bg-blue-500/10" : "bg-transparent border-transparent hover:bg-slate-900"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <p className={`leading-normal flex-1 ${s.flagged ? "text-slate-200" : "text-slate-500"}`}>{s.sentence}</p>
                            <Badge 
                              variant={s.flagged ? "destructive" : "outline"} 
                              className={`text-[9px] px-1.5 shrink-0 select-none ${s.flagged ? "bg-blue-600 border-blue-400 text-white" : "border-blue-500/20 text-slate-400"}`}
                            >
                              {s.similarity}%
                            </Badge>
                          </div>
                          <Progress value={s.similarity} className="h-1 bg-blue-950 mt-1.5" />
                        </div>
                      );
                    })}

                    {p && p.sentence_results.length > 0 && (
                      <button
                        onClick={() => setShowAllSentences(!showAllSentences)}
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition mx-auto pt-3 pb-1"
                      >
                        {showAllSentences
                          ? <><ChevronUp className="h-3.5 w-3.5" /> Show flagged only</>
                          : <><ChevronDown className="h-3.5 w-3.5" /> Show all {p.sentence_results.length} sentences</>}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar footer Links */}
              <div className="p-4 border-t border-blue-500/10 bg-blue-950/20 flex items-center justify-center gap-3">
                <Link to="/history">
                  <Button variant="outline" size="sm" className="text-xs border-blue-500/30 text-slate-300 hover:bg-blue-500/10 h-8 px-3">
                    <History className="mr-1.5 h-3.5 w-3.5" /> History
                  </Button>
                </Link>
                {selectedGroupId && (
                  <Link to={`/compare/${selectedGroupId}`}>
                    <Button variant="outline" size="sm" className="text-xs border-blue-500/30 text-slate-300 hover:bg-blue-500/10 h-8 px-3">
                      <Users className="mr-1.5 h-3.5 w-3.5" /> View Leaderboard
                  </Button>
                  </Link>
                )}
                {!selectedGroupId && user && (
                  <Link to="/groups">
                    <Button variant="outline" size="sm" className="text-xs border-blue-500/30 text-slate-300 hover:bg-blue-500/10 h-8 px-3">
                      <Users className="mr-1.5 h-3.5 w-3.5" /> Join Group
                    </Button>
                  </Link>
                )}
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default OriginalityChecker;