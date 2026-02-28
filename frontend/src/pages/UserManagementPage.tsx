import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Trash2, Download, Loader2 } from 'lucide-react';

type Role = 'blocked' | 'member' | 'admin';

interface UserRoleRow {
  user_id: string;
  email: string | null;
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

  const [exportingStatus, setExportingStatus] = useState<'approved' | 'waitlisted' | 'rejected' | null>(null);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('admin_list_user_roles');

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      setRows((data ?? []) as UserRoleRow[]);
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

  const exportCsvForStatus = async (status: 'approved' | 'waitlisted' | 'rejected') => {
    if (myRole !== 'admin') return;
    setExportingStatus(status);
    try {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('deliberation_status', status)
        .order('score_overall', { ascending: false, nullsFirst: false });

      if (error) {
        console.error('Error exporting candidates:', error);
        alert('Failed to export CSV. Please try again.');
        return;
      }

      if (!data || data.length === 0) {
        alert('No candidates found for this decision group.');
        return;
      }

      const headers = Array.from(
        data.reduce<Set<string>>((set, row) => {
          Object.keys(row).forEach((key) => set.add(key));
          return set;
        }, new Set<string>()),
      );

      const escapeCell = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
          try {
            value = JSON.stringify(value);
          } catch {
            value = String(value);
          }
        }
        let str = String(value);
        const needsQuotes = /[",\r\n]/.test(str);
        if (needsQuotes) {
          str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const rows = data.map((row) =>
        headers.map((key) => escapeCell((row as any)[key])).join(','),
      );

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const prefix =
        status === 'approved'
          ? 'accepted'
          : status === 'waitlisted'
            ? 'waitlisted'
            : 'rejected';

      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${prefix}-candidates-${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Unexpected error while exporting CSV:', err);
      alert(
        'An unexpected error occurred while exporting. Please check the console for details.',
      );
    } finally {
      setExportingStatus(null);
    }
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">
            Admin
          </h1>
          <p className="text-sm text-secondary mt-1">
            Manage access and export decision CSVs for accepted, waitlisted, and rejected candidates.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void loadRoles();
              void loadAdminEmails();
              void loadMemberEmails();
            }}
            disabled={loading || loadingEmails}
          >
            Refresh
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportCsvForStatus('approved')}
              disabled={exportingStatus !== null}
            >
              {exportingStatus === 'approved' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1" />
              )}
              Export Accepted
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportCsvForStatus('waitlisted')}
              disabled={exportingStatus !== null}
            >
              {exportingStatus === 'waitlisted' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1" />
              )}
              Export Waitlisted
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportCsvForStatus('rejected')}
              disabled={exportingStatus !== null}
            >
              {exportingStatus === 'rejected' ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1" />
              )}
              Export Rejected
            </Button>
          </div>
        </div>
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
              className="flex-1 h-10 px-3 py-2 rounded-md border border-border bg-surface text-sm text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="w-full sm:w-40 shrink-0">
              <Select
                value={selectedRole}
                onChange={(val) => setSelectedRole(val as Role)}
                options={[
                  { value: 'blocked', label: 'blocked' },
                  { value: 'member', label: 'member' },
                  { value: 'admin', label: 'admin' },
                ]}
              />
            </div>
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

      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
        <strong>Auto-accept on sign-in:</strong> Emails in the lists below are only automatically accepted (and not blocked) if you have run{' '}
        <span className="font-mono">hauscr-hsylc/supabase/admin_emails_setup.sql</span> in the Supabase SQL Editor once. Otherwise, new sign-ins are blocked until you assign a role by user ID above.
      </div>

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
              If the table is missing, run{' '}
              <span className="font-mono">hauscr-hsylc/supabase/admin_emails_setup.sql</span> in the
              Supabase SQL Editor. That script is also required for emails in these lists to be{' '}
              <strong>automatically accepted</strong> on sign-in (otherwise they are blocked until you assign a role below).
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
              If the table is missing, run{' '}
              <span className="font-mono">hauscr-hsylc/supabase/admin_emails_setup.sql</span> in the
              Supabase SQL Editor. That script is also required for emails in these lists to be{' '}
              <strong>automatically accepted</strong> on sign-in (otherwise they are blocked until you assign a role below).
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
                      Email
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
                      <td className="px-3 py-2 text-sm text-primary">
                        {row.email ?? <span className="text-secondary italic">unknown</span>}
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

