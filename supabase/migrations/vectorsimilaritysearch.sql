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
