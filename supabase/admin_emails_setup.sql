-- Run this in Supabase SQL Editor to enable pre-assign by email (admin and member).
-- 1. Creates tables admin_emails and member_emails (emails that get that role when they first sign in).
-- 2. Creates function get_role_for_user so the app can resolve role and auto-grant from these lists.

-- Table: list of emails that should become admin when they sign in (even if they don't have an account yet).
create table if not exists public.admin_emails (
  email text primary key
);

alter table public.admin_emails enable row level security;

-- Only existing admins can read/write admin_emails (checked via user_roles).
create policy "Admins can manage admin_emails"
  on public.admin_emails
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id::text = auth.uid()::text and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id::text = auth.uid()::text and role = 'admin'
    )
  );

-- Table: list of emails that should become member when they sign in (even if they don't have an account yet).
create table if not exists public.member_emails (
  email text primary key
);

alter table public.member_emails enable row level security;

create policy "Admins can manage member_emails"
  on public.member_emails
  for all
  using (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id::text = auth.uid()::text and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles
      where user_roles.user_id::text = auth.uid()::text and role = 'admin'
    )
  );

-- Function: returns role for a user. If no row in user_roles, checks admin_emails then member_emails by email;
-- if found, inserts admin into user_roles and returns 'admin'. Called by the app with the logged-in user's id and email.
create or replace function public.get_role_for_user(p_user_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from user_roles where user_roles.user_id::text = p_user_id::text limit 1;
  if v_role is not null then
    return v_role;
  end if;
  if exists (select 1 from admin_emails where email = p_email) then
    insert into user_roles (user_id, role) values (p_user_id::text, 'admin')
    on conflict (user_id) do update set role = 'admin';
    return 'admin';
  end if;
  if exists (select 1 from member_emails where email = p_email) then
    insert into user_roles (user_id, role) values (p_user_id::text, 'member')
    on conflict (user_id) do update set role = 'member';
    return 'member';
  end if;
  return null;
end;
$$;

-- Allow authenticated users to call this (they can only get their own role; the function uses their passed id/email).
grant execute on function public.get_role_for_user(uuid, text) to authenticated;
grant execute on function public.get_role_for_user(uuid, text) to service_role;
