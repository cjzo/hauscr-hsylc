-- Add interviewer_ranking column to the interviews table.
-- Each interviewer can assign a tier ranking to the candidate they interviewed.
-- Run this in the Supabase SQL Editor.

ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS interviewer_ranking text
  CHECK (interviewer_ranking IN ('auto_accept', 'tier_1', 'tier_2', 'tier_3', 'tier_4'));
