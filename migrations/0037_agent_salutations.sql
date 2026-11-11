-- VORA Virtual Agent: visitor-selected form of address, stored on private session only.
-- Never infer gender or marital status from names or contact records.
ALTER TABLE public.agent_sessions
  ADD COLUMN IF NOT EXISTS visitor_salutation varchar(8);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_sessions_visitor_salutation_check'
      AND conrelid = 'public.agent_sessions'::regclass
  ) THEN
    ALTER TABLE public.agent_sessions ADD CONSTRAINT agent_sessions_visitor_salutation_check
      CHECK (visitor_salutation IS NULL OR visitor_salutation IN ('bapak','ibu','mr','ms','mrs','name'));
  END IF;
END $$;
