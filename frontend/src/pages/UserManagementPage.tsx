import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Trash2 } from 'lucide-react';

type Role = 'blocked' | 'member' | 'admin';

interface UserRoleRow {
  user_id: string;
  role: Role;
}

function parseEmailsInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes('@'));
}

export function UserManagementPage() {
  const { role: myRole } = useAuth();
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('member');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [adminEmails, setAdminEmails] = useState<string[]>([]);
  const [memberEmails, setMemberEmails] = useState<string[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [memberEmailInput, setMemberEmailInput] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [memberEmailSaving, setMemberEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [memberEmailError, setMemberEmailError] = useState<string | null>(null);
  const [memberEmailMessage, setMemberEmailMessage] = useState<string | null>(null);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .order('user_id');

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows(data as UserRoleRow[]);
    }
    setLoading(false);
  };

  const loadAdminEmails = async () => {
    setLoadingEmails(true);
    setEmailError(null);
    const { data, error: err } = await supabase.from('admin_emails').select('email').order('email');
    if (err) {
      setEmailError(err.message);
      setAdminEmails([]);
    } else {
      setAdminEmails((data ?? []).map((r) => r.email));
    }
    setLoadingEmails(false);
  };

  const loadMemberEmails = async () => {
    setMemberEmailError(null);
    const { data, error: err } = await supabase.from('member_emails').select('email').order('email');
    if (err) {
      setMemberEmailError(err.message);
      setMemberEmails([]);
    } else {
      setMemberEmails((data ?? []).map((r) => r.email));
    }
  };

  useEffect(() => {
    if (myRole === 'admin') {
      void loadRoles();
      void loadAdminEmails();
      void loadMemberEmails();
    }
  }, [myRole]);

  const handleAddAdminEmails = async () => {
    setEmailError(null);
    setEmailMessage(null);
    const toAdd = parseEmailsInput(emailInput);
    if (toAdd.length === 0) {
      setEmailError('Enter one or more valid emails (comma or newline separated).');
      return;
    }
    setEmailSaving(true);
    const { error: err } = await supabase.from('admin_emails').upsert(toAdd.map((email) => ({ email })), { onConflict: 'email' });
    if (err) {
      setEmailError(err.message);
    } else {
      setEmailMessage(`Added ${toAdd.length} email(s). They will get admin when they sign in.`);
      setEmailInput('');
      await loadAdminEmails();
    }
    setEmailSaving(false);
  };

  const handleRemoveAdminEmail = async (email: string) => {
    setEmailError(null);
    setEmailMessage(null);
    const { error: err } = await supabase.from('admin_emails').delete().eq('email', email);
    if (err) setEmailError(err.message);
    else await loadAdminEmails();
  };

  const handleAddMemberEmails = async () => {
    setMemberEmailError(null);
    setMemberEmailMessage(null);
    const toAdd = parseEmailsInput(memberEmailInput);
    if (toAdd.length === 0) {
      setMemberEmailError('Enter one or more valid emails (comma or newline separated).');
      return;
    }
    setMemberEmailSaving(true);
    const { error: err } = await supabase.from('member_emails').upsert(toAdd.map((email) => ({ email })), { onConflict: 'email' });
    if (err) {
      setMemberEmailError(err.message);
    } else {
      setMemberEmailMessage(`Added ${toAdd.length} email(s). They will get member access when they sign in.`);
      setMemberEmailInput('');
      await loadMemberEmails();
    }
    setMemberEmailSaving(false);
  };

  const handleRemoveMemberEmail = async (email: string) => {
    setMemberEmailError(null);
    setMemberEmailMessage(null);
    const { error: err } = await supabase.from('member_emails').delete().eq('email', email);
    if (err) setMemberEmailError(err.message);
    else await loadMemberEmails();
  };

  const handleSave = async () => {
    setError(null);
    setMessage(null);

    const trimmed = userIdInput.trim();
    if (!trimmed) {
      setError('Please paste a user ID.');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: trimmed, role: selectedRole }, { onConflict: 'user_id' });

    if (error) {
      setError(error.message);
    } else {
      setMessage(`Updated role for ${trimmed} to ${selectedRole}.`);
      setUserIdInput('');
      await loadRoles();
    }
    setSaving(false);
  };

  if (myRole !== 'admin') {
    return (
      <div className="max-w-xl mx-auto mt-16">
        <Card>
          <div className="p-6">
            <h1 className="text-xl font-semibold text-primary">Admin only</h1>
            <p className="text-sm text-secondary mt-2">
              You must be an admin to manage user roles.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary tracking-tight">
          User Management
        </h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => { void loadRoles(); void loadAdminEmails(); void loadMemberEmails(); }}
          disabled={loading || loadingEmails}
        >
          Refresh
        </Button>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">
            Set role by user ID
          </h2>
          <p className="text-sm text-secondary">
            In Supabase, go to <span className="font-mono">Authentication → Users</span>, copy the
            user&apos;s <span className="font-mono">id</span> (UUID), then paste it here.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              value={userIdInput}
              onChange={(e) => setUserIdInput(e.target.value)}
              placeholder="User ID (UUID)"
              className="flex-1 px-3 py-2 rounded-md border border-border bg-surface text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as Role)}
              className="px-3 py-2 rounded-md border border-border bg-surface text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="blocked">blocked</option>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save role'}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-500">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-green-600">
              {message}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">
            Pre-assign member by email
          </h2>
          <p className="text-sm text-secondary">
            Add emails here before they sign up. When someone with one of these emails logs in,
            they will automatically get member access. One email per line, or comma-separated.
          </p>
          <div className="flex flex-col gap-2">
            <textarea
              value={memberEmailInput}
              onChange={(e) => setMemberEmailInput(e.target.value)}
              placeholder="member@example.com&#10;other@example.com"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
            />
            <Button onClick={handleAddMemberEmails} disabled={memberEmailSaving}>
              {memberEmailSaving ? 'Adding…' : 'Add member emails'}
            </Button>
          </div>
          {memberEmailError && <p className="text-sm text-red-500">{memberEmailError}</p>}
          {memberEmailMessage && <p className="text-sm text-green-600">{memberEmailMessage}</p>}
          {memberEmailError && memberEmails.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              If the table is missing, run <span className="font-mono">supabase/admin_emails_setup.sql</span> in the Supabase SQL Editor.
            </p>
          )}
          {memberEmails.length === 0 && !memberEmailError ? (
            <p className="text-sm text-secondary">No pre-assigned member emails yet.</p>
          ) : memberEmails.length > 0 ? (
            <ul className="border border-border rounded-lg divide-y divide-border">
              {memberEmails.map((email) => (
                <li key={email} className="flex items-center justify-between px-3 py-2 text-sm text-primary">
                  <span className="truncate">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMemberEmail(email)}
                    className="p-1.5 rounded text-secondary hover:text-red-500 hover:bg-surfaceHover transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">
            Pre-assign admin by email
          </h2>
          <p className="text-sm text-secondary">
            Add emails here before they sign up. When someone with one of these emails logs in
            (e.g. with Google), they will automatically get admin. One email per line, or
            comma-separated.
          </p>
          <div className="flex flex-col gap-2">
            <textarea
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="admin@example.com&#10;other@example.com"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border bg-surface text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 resize-y"
            />
            <Button onClick={handleAddAdminEmails} disabled={emailSaving}>
              {emailSaving ? 'Adding…' : 'Add admin emails'}
            </Button>
          </div>
          {emailError && <p className="text-sm text-red-500">{emailError}</p>}
          {emailMessage && <p className="text-sm text-green-600">{emailMessage}</p>}
          {emailError && adminEmails.length === 0 && !loadingEmails && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              If the table is missing, run <span className="font-mono">supabase/admin_emails_setup.sql</span> in the Supabase SQL Editor.
            </p>
          )}
          {loadingEmails ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : adminEmails.length === 0 && !emailError ? (
            <p className="text-sm text-secondary">No pre-assigned admin emails yet.</p>
          ) : adminEmails.length > 0 ? (
            <ul className="border border-border rounded-lg divide-y divide-border">
              {adminEmails.map((email) => (
                <li key={email} className="flex items-center justify-between px-3 py-2 text-sm text-primary">
                  <span className="truncate">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAdminEmail(email)}
                    className="p-1.5 rounded text-secondary hover:text-red-500 hover:bg-surfaceHover transition-colors shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-primary mb-3">
            Current roles
          </h2>
          {loading ? (
            <p className="text-sm text-secondary">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-secondary">No roles found yet.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surfaceHover/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-secondary border-b border-border">
                      User ID
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-secondary border-b border-border">
                      Role
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.user_id} className="border-t border-border/60">
                      <td className="px-3 py-2 font-mono text-xs text-primary break-all">
                        {row.user_id}
                      </td>
                      <td className="px-3 py-2 capitalize text-primary">
                        {row.role}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

