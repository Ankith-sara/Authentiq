// supabase/functions/check-originality/index.ts  (v3)
// Improvements:
//   - Parallel sentence embedding calls (Promise.all) instead of sequential loop
//   - CORS locked to ALLOWED_ORIGIN env var (not wildcard)
//   - Configurable thresholds via request body
//   - Similarity distribution stats (max, mean, median)
//   - Source attribution in match results
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://authentiq.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

/* ---------- UTILS ---------- */

function splitSentences(text: string): string[] {
  const seen = new Set<string>();
  return (text.match(/[^.!?]+[.!?]+/g) || [])
    .map(s => s.trim())
    .filter(s => {
      if (s.length <= 20 || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-embedding", {
      body: { text },
    });
    if (error || !data?.embedding) {
      console.error("Embedding error:", error, data);
      return null;
    }
    return data.embedding;
  } catch (e) {
    console.error("Embedding fetch threw:", e);
    return null;
  }
}

async function matchEmbedding(
  embedding: number[],
  threshold: number
): Promise<{ id: string; text: string; similarity: number; source_id?: string } | null> {
  const { data, error } = await supabase.rpc("match_submissions", {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 1,
    cluster_filter: null,
  });
  if (error || !data?.length) return null;
  return data[0];
}

/* ---------- HANDLER ---------- */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      text,
      doc_threshold  = 0.70,
      sent_threshold = 0.82,
    } = body;

    if (!text || typeof text !== "string" || text.length < 10) {
      return new Response(
        JSON.stringify({ error: "text is required and must be at least 10 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    /* ---------- DOCUMENT-LEVEL ---------- */
    const docEmbedding = await getEmbedding(text);
    let documentSimilarity = 0;

    if (docEmbedding) {
      const match = await matchEmbedding(docEmbedding, doc_threshold);
      documentSimilarity = match?.similarity ?? 0;
    }

    /* ---------- SENTENCE-LEVEL (parallel) ---------- */
    const sentences = splitSentences(text);

    // Fetch all embeddings in parallel — was sequential O(n) round-trips
    const embeddingResults = await Promise.all(
      sentences.map(s => getEmbedding(s))
    );

    // Match all available embeddings in parallel
    const matchTasks = embeddingResults.map((emb, i) => {
      if (!emb) return Promise.resolve(null);
      return matchEmbedding(emb, sent_threshold).then(match =>
        match ? { sentence: sentences[i], ...match } : null
      );
    });

    const matchResults = await Promise.all(matchTasks);

    const flagged: {
      sentence: string;
      similarity: number;
      matched_text?: string;
      source_id?: string;
    }[] = matchResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(r => ({
        sentence:     r.sentence,
        similarity:   Math.round(r.similarity * 100),
        matched_text: r.text,
        source_id:    r.source_id,
      }));

    /* ---------- SIMILARITY STATS ---------- */
    const allSims = flagged.map(f => f.similarity);
    const simStats = {
      max:    allSims.length ? Math.max(...allSims) : 0,
      mean:   allSims.length ? Math.round(allSims.reduce((a, b) => a + b, 0) / allSims.length) : 0,
      median: Math.round(median(allSims)),
    };

    /* ---------- ORIGINALITY SCORE ---------- */
    const flaggedRatio      = sentences.length > 0 ? flagged.length / sentences.length : 0;
    const combinedSimilarity = documentSimilarity * 0.7 + flaggedRatio * 0.3;
    const originalityScore  = Math.max(0, Math.round((1 - combinedSimilarity) * 100));

    /* ---------- RESPONSE ---------- */
    return new Response(
      JSON.stringify({
        originality_score:   originalityScore,
        similarity_score:    Math.round(combinedSimilarity * 100),
        flagged_sentences:   flagged,
        total_sentences:     sentences.length,
        document_similarity: Math.round(documentSimilarity * 100),
        similarity_stats:    simStats,
        thresholds_used:     { document: doc_threshold, sentence: sent_threshold },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in check-originality:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
