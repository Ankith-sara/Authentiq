import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertTriangle, Shield, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface FlaggedSentence {
  sentence: string;
  similarity: number;
}

interface CheckResult {
  originality_score: number;
  similarity_score: number;
  flagged_sentences: FlaggedSentence[];
  total_sentences: number;
  document_similarity: number;
}

export default function CheckOriginality() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  const handleCheck = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to check your text.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!text || text.length < 10) {
      toast({
        title: "Text too short",
        description: "Please enter at least 10 characters to check.",
        variant: "destructive",
      });
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      // Call the real Supabase edge function
      const { data, error } = await supabase.functions.invoke("check-originality", {
        body: { text },
      });

      if (error) throw error;

      if (!data || typeof data.originality_score === "undefined") {
        throw new Error("Invalid response from server.");
      }

      setResult(data);

      toast({
        title: "Analysis complete!",
        description: `Your text is ${data.originality_score}% original.`,
      });
    } catch (error) {
      console.error("Check error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to check text.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  const getOriginalityColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-8 w-8 text-green-600" />;
    if (score >= 60) return <AlertTriangle className="h-8 w-8 text-yellow-600" />;
    return <AlertCircle className="h-8 w-8 text-red-600" />;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
      <Card className="p-6 border-2">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-6 w-6" />
          <h2 className="text-2xl font-bold">Check Your Text Originality</h2>
        </div>
        <p className="text-muted-foreground mb-6">
          Paste your text below to analyze its uniqueness.
        </p>

        <Textarea
          placeholder="Paste your text here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="mb-4 font-mono"
        />

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {text.length} characters • {text.split(/\s+/).filter(Boolean).length} words
          </span>

          <Button
            onClick={handleCheck}
            disabled={checking || text.length < 10}
            size="lg"
          >
            {checking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Check Originality
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {result && (
        <Card className="p-6 border-2 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {getScoreIcon(result.originality_score)}
              <div>
                <h3 className="text-3xl font-bold">
                  <span className={getOriginalityColor(result.originality_score)}>
                    {result.originality_score}%
                  </span>{" "}
                  Original
                </h3>
                <p className="text-sm text-muted-foreground">Overall Originality Score</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-3xl font-bold text-muted-foreground">
                {result.similarity_score}%
              </p>
              <p className="text-sm text-muted-foreground">Similarity Found</p>
            </div>
          </div>

          <Progress value={result.originality_score} className="mb-4 h-3" />

          {/* Flagged Sentences */}
          {result.flagged_sentences.length > 0 && (
            <div className="mt-4 space-y-3">
              <h4 className="font-semibold">
                Flagged Sentences ({result.flagged_sentences.length}/{result.total_sentences}):
              </h4>
              {result.flagged_sentences.map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className="text-sm text-red-900 dark:text-red-100">{item.sentence}</p>
                    <Badge variant="destructive" className="shrink-0">
                      {item.similarity}% match
                    </Badge>
                  </div>
                  <Progress value={item.similarity} className="h-1.5" />
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground space-x-3">
            <span>Document similarity: {result.document_similarity}%</span>
            <span>•</span>
            <span>Sentences analyzed: {result.total_sentences}</span>
          </div>

          {result.originality_score >= 80 && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-green-800 dark:text-green-200 text-sm text-center">
                Excellent! Your text is highly original.
              </p>
            </div>
          )}

          {result.originality_score < 60 && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
              <p className="text-red-800 dark:text-red-200 text-sm text-center">
                ⚠️ Your text shows significant similarity to existing submissions.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
