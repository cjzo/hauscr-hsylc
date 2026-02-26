-- =========================================
-- Admin / Member emails and role-by-email
-- Run this in the Supabase SQL Editor once.
-- After this, get_role_for_user() will assign roles from
-- admin_emails and member_emails when users sign in.
-- =========================================

-- 1. Tables for pre-assigned emails (admin wins over member)
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.member_emails (
  email text PRIMARY KEY
);

-- 2. Cached role per user (updated by get_role_for_user on sign-in)
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('blocked', 'member', 'admin'))
);

-- Also cache the user's email alongside their role so that
-- the admin UI can display "Current roles" with email + UUID.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS email text;

-- 3. RLS: allow authenticated to read (for User Management UI); only RPC writes
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read admin_emails" ON public.admin_emails;
CREATE POLICY "Authenticated can read admin_emails" ON public.admin_emails
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can insert admin_emails" ON public.admin_emails;
CREATE POLICY "Authenticated can insert admin_emails" ON public.admin_emails
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can update admin_emails" ON public.admin_emails;
CREATE POLICY "Authenticated can update admin_emails" ON public.admin_emails
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can delete admin_emails" ON public.admin_emails;
CREATE POLICY "Authenticated can delete admin_emails" ON public.admin_emails
  FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can read member_emails" ON public.member_emails;
CREATE POLICY "Authenticated can read member_emails" ON public.member_emails
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can insert member_emails" ON public.member_emails;
CREATE POLICY "Authenticated can insert member_emails" ON public.member_emails
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can update member_emails" ON public.member_emails;
CREATE POLICY "Authenticated can update member_emails" ON public.member_emails
  FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can delete member_emails" ON public.member_emails;
CREATE POLICY "Authenticated can delete member_emails" ON public.member_emails
  FOR DELETE TO authenticated USING (true);

-- user_roles: users can read their own row (for role display); only RPC writes/upserts
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Clean up any legacy admin-read-all policy (replaced by RPC below).
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;

-- 4. Function: resolve role from email lists and persist to user_roles (called on every sign-in)
CREATE OR REPLACE FUNCTION public.get_role_for_user(p_user_id uuid, p_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_role text;
  email_lower text;
BEGIN
  email_lower := lower(trim(coalesce(p_email, '')));

  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(trim(email)) = email_lower) THEN
    resolved_role := 'admin';
  ELSIF EXISTS (SELECT 1 FROM public.member_emails WHERE lower(trim(email)) = email_lower) THEN
    resolved_role := 'member';
  ELSE
    resolved_role := 'blocked';
  END IF;

  INSERT INTO public.user_roles (user_id, role, email)
  VALUES (p_user_id, resolved_role, email_lower)
  ON CONFLICT (user_id) DO UPDATE
    SET role = resolved_role,
        email = email_lower;

  RETURN resolved_role;
END;
$$;

-- Allow authenticated users to call this (they pass their own user_id and email; function enforces logic)
GRANT EXECUTE ON FUNCTION public.get_role_for_user(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_for_user(uuid, text) TO service_role;

-- 5. Admin-only view of all roles, exposed via RPC instead of direct SELECT with RLS.
-- This avoids complex RLS policies and keeps the admin UI simple:
--   SELECT * FROM admin_list_user_roles();
DROP FUNCTION IF EXISTS public.admin_list_user_roles();
CREATE OR REPLACE FUNCTION public.admin_list_user_roles()
RETURNS SETOF public.user_roles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.*
  FROM public.user_roles ur
  WHERE EXISTS (
    SELECT 1
    FROM public.admin_emails ae
    WHERE lower(trim(ae.email)) = lower(trim(auth.jwt() ->> 'email'))
  )
  ORDER BY ur.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_user_roles() TO authenticated;
