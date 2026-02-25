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

async function fetchRole(userId: string): Promise<Role | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data.role as Role;
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
    const r = await fetchRole(u.id);
    setRole(r);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (ignore) return;

      const u = session?.user ?? null;
      setUser(u);
      await loadRole(u);
      setLoading(false);
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        await loadRole(u);
        setLoading(false);
      }
    );

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [loadRole]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
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
