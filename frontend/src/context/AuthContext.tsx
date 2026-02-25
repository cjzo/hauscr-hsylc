import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Role = 'blocked' | 'member' | 'admin';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

async function fetchRole(userId: string, userEmail?: string | null): Promise<Role | null> {
  try {
    // Prefer RPC so that admin_emails are applied (pre-assign admin by email before sign-up).
    if (userEmail) {
      const { data, error } = await supabase.rpc('get_role_for_user', {
        p_user_id: userId,
        p_email: userEmail,
      });
      if (!error && data != null) return data as Role;
    }
    // Fallback: direct read (e.g. before running admin_emails_setup.sql).
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return data.role as Role;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  const loadRole = useCallback(async (u: User | null) => {
    if (!u) {
      setRole(null);
      return;
    }
    const r = await fetchRole(u.id, u.email ?? undefined);
    setRole(r);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (ignore) return;

        const u = session?.user ?? null;
        setUser(u);
        // Don't block loading on role fetch – fire and forget
        loadRole(u);
      } catch {
        if (ignore) return;
        setUser(null);
        setRole(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        // Again, don't block loading on role fetch
        loadRole(u);
        setLoading(false);
      },
    );

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [loadRole]);

  const signInWithGoogle = useCallback(async () => {
    // Use env override for Vercel/preview URLs; otherwise current origin (required for Supabase allowlist)
    const redirectTo =
      (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/$/, '') ||
      window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }, []);

  const signOutFn = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, role, loading, signInWithGoogle, signOut: signOutFn }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
