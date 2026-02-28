import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldX, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UnauthorizedPage() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  // If the user gets promoted while viewing this page, send them into the app
  useEffect(() => {
    if (role === 'member' || role === 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [role, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-md p-8 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
            <ShieldX className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-primary tracking-tight">
            Access Denied
          </h1>
          <p className="text-sm text-secondary mt-2">
            You're signed in as <span className="font-medium text-primary">{user?.email}</span>, but your account hasn't been approved yet.
          </p>
          <p className="text-sm text-secondary mt-1">
            Contact an administrator to get access.
          </p>
          <button
            onClick={handleSignOut}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface hover:bg-surfaceHover text-primary font-medium text-sm transition-colors duration-150"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
