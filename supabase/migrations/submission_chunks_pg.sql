-- submission_chunks_pg.sql
-- Replaces flat-file corpus with Postgres + pgvector.
-- Run after pgvectorextension.sql.
-- The Python backend writes here when POSTGRES_DSN is set.

CREATE TABLE IF NOT EXISTS public.submission_chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  text        text        NOT NULL,
  embedding   vector(384) NOT NULL,   -- all-MiniLM-L6-v2 produces 384-dim
  source_id   text,                   -- links back to the parent submission
  created_at  timestamptz DEFAULT now() NOT NULL
);

-- IVFFlat index for fast ANN search (~10ms at 1M rows)
-- lists = sqrt(row_count) is a good starting point
CREATE INDEX IF NOT EXISTS submission_chunks_embedding_idx
  ON public.submission_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS submission_chunks_source_id_idx
  ON public.submission_chunks (source_id);

-- RLS
ALTER TABLE public.submission_chunks ENABLE ROW LEVEL SECURITY;

-- Service role (backend) can read + write
CREATE POLICY "service_role_all" ON public.submission_chunks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users can read (for audit / "submitted by you on date X")
CREATE POLICY "authenticated_read" ON public.submission_chunks
  FOR SELECT TO authenticated
  USING (source_id = auth.uid()::text);


-- match_chunks: fast vector search over submission_chunks
-- Replaces / supplements match_submissions for the new table
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(384),
  match_threshold float DEFAULT 0.75,
  match_count     int   DEFAULT 5,
  source_filter   text  DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  text        text,
  source_id   text,
  similarity  float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.text,
    c.source_id,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.submission_chunks c
  WHERE
    (source_filter IS NULL OR c.source_id = source_filter)
    AND (1 - (c.embedding <=> query_embedding)) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
