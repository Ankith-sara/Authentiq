-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create submissions table for storing AI text submissions and embeddings
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  text text NOT NULL,
  embedding vector(768),
  cluster_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX ON public.submissions USING ivfflat (embedding vector_cosine_ops);

-- Create index for cluster lookups
CREATE INDEX idx_submissions_cluster ON public.submissions(cluster_id);
CREATE INDEX idx_submissions_location ON public.submissions(location_hash);

-- Enable Row Level Security
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (privacy-safe, no personal data)
CREATE POLICY "Submissions are viewable by everyone" 
ON public.submissions 
FOR SELECT 
USING (true);

-- Create policy for public insert (anyone can submit for analysis)
CREATE POLICY "Anyone can submit for analysis" 
ON public.submissions 
FOR INSERT 
WITH CHECK (true);

-- Create beta_signups table
CREATE TABLE public.beta_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  usage TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.beta_signups ENABLE ROW LEVEL SECURITY;

-- Create policy for public insert (anyone can signup)
CREATE POLICY "Anyone can signup for beta" 
ON public.beta_signups 
FOR INSERT 
WITH CHECK (true);