-- Fix the search_path for the match_submissions function
CREATE OR REPLACE FUNCTION match_submissions(
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
    submissions.id,
    submissions.text,
    1 - (submissions.embedding <=> query_embedding) AS similarity
  FROM submissions
  WHERE 
    (cluster_filter IS NULL OR submissions.cluster_id = cluster_filter)
    AND (1 - (submissions.embedding <=> query_embedding)) > match_threshold
  ORDER BY submissions.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;