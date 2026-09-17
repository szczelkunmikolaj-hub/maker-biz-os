
CREATE TABLE public.customer_notes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_customer_notes_all" ON public.customer_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
