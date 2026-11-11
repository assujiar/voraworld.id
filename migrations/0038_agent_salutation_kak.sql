-- VORA Virtual Agent: add the Indonesian form of address "Kak" to the visitor salutation choices.
-- Replaces the check from 0037 with a superset, so every row written before stays valid.
ALTER TABLE public.agent_sessions
  DROP CONSTRAINT IF EXISTS agent_sessions_visitor_salutation_check;

ALTER TABLE public.agent_sessions
  ADD CONSTRAINT agent_sessions_visitor_salutation_check
  CHECK (visitor_salutation IS NULL OR visitor_salutation IN ('bapak','ibu','kak','mr','ms','mrs','name'));
