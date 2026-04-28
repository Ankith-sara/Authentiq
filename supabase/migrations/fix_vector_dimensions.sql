-- IMPORTANT: Run this if you already deployed with vector(1536).
-- This fixes the vector dimension from 1536 (OpenAI) to 768 (Gemini embedding-001).

-- Drop the old index (required before altering column type)
DROP INDEX IF EXISTS submissions_embedding_idx;

-- Alter the column to the correct Gemini dimension
ALTER TABLE public.submissions
  ALTER COLUMN embedding TYPE vector(768);

-- Recreate the ivfflat index with correct op class
CREATE INDEX submissions_embedding_idx
  ON public.submissions
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Fix match_submissions function signature to match
CREATE OR REPLACE FUNCTION public.match_submissions(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  cluster_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  text text,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.text,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM public.submissions s
  WHERE
    (cluster_filter IS NULL OR s.cluster_id = cluster_filter)
    AND (1 - (s.embedding <=> query_embedding)) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
