import { useEffect, useState, useCallback } from 'react';
import { X, Cloud, CloudOff, RefreshCw, Trash2, FolderOpen, FilePlus2, Check } from 'lucide-react';
import { getToken } from '../lib/cloud.js';

// Cloud sync control panel. Lets the user connect with their passphrase, see
// sync status, and open / create / delete their cloud projects.
export default function CloudPanel({
  onClose, status, enabled,
  currentId, currentName,
  onConnect, onDisconnect, onList, onOpen, onRemove, onSaveNow,
  onRename, onNewProject,
}) {
  const [token, setTokenInput] = useState(() => getToken());
  const [projects, setProjects] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setBusy(true); setError('');
    try {
      setProjects(await onList());
    } catch (e) {
      setError(messageFor(e.code));
    } finally {
      setBusy(false);
    }
  }, [enabled, onList]);

  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const handleConnect = async () => {
    setBusy(true); setError('');
    const r = await onConnect(token.trim());
    setBusy(false);
    if (!r.ok) setError(messageFor(r.code));
  };

  const handleOpen = async (id) => {
    setBusy(true); setError('');
    try { await onOpen(id); onClose(); }
    catch (e) { setError(messageFor(e.code)); setBusy(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this project from the cloud? This cannot be undone.')) return;
    setBusy(true); setError('');
    try { await onRemove(id); await refresh(); }
    catch (e) { setError(messageFor(e.code)); setBusy(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#131316] border border-[#26262a] rounded-lg w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 flex items-center gap-2 border-b border-[#1f1f22] flex-shrink-0">
          <Cloud size={16} className="text-violet-400" />
          <div className="text-[14px] font-semibold">Cloud sync</div>
          <StatusPill status={status} />
          <button onClick={onClose} className="ml-auto text-[#6a6a70] hover:text-white p-1">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {!enabled ? (
            <Disconnected
              token={token}
              setToken={setTokenInput}
              onConnect={handleConnect}
              busy={busy}
              error={error}
            />
          ) : (
            <Connected
              currentId={currentId}
              currentName={currentName}
              projects={projects}
              busy={busy}
              error={error}
              onRefresh={refresh}
              onOpen={handleOpen}
              onDelete={handleDelete}
              onRename={onRename}
              onNewProject={onNewProject}
              onSaveNow={onSaveNow}
            />
          )}
        </div>

        {enabled && (
          <div className="h-11 px-4 flex items-center justify-between border-t border-[#1f1f22] flex-shrink-0">
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 text-[12px] text-[#8a8a90] hover:text-red-400 transition-colors"
            >
              <CloudOff size={13} /> Disconnect
            </button>
            <span className="text-[11px] text-[#5a5a60]">Edits sync automatically</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Disconnected({ token, setToken, onConnect, busy, error }) {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[#9a9aa0] leading-relaxed">
        Connect to sync your projects to the cloud and reach them from any device.
        Enter the sync passphrase you set on the server (leave blank if you didn't set one).
      </p>
      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#6a6a70] font-medium">Passphrase</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onConnect(); }}
          placeholder="••••••••"
          className="mt-1 w-full bg-[#0a0a0c] border border-[#26262a] rounded-md px-3 h-9 text-[13px] text-white outline-none focus:border-violet-500/60 transition-colors"
        />
      </div>
      {error && <div className="text-[12px] text-red-400">{error}</div>}
      <button
        onClick={onConnect}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 h-9 rounded-md bg-violet-500 text-white text-[13px] font-medium hover:bg-violet-400 transition-colors disabled:opacity-40"
      >
        <Cloud size={14} /> {busy ? 'Connecting…' : 'Connect'}
      </button>
    </div>
  );
}

function Connected({
  currentId, currentName, projects, busy, error,
  onRefresh, onOpen, onDelete, onRename, onNewProject, onSaveNow,
}) {
  return (
    <div className="space-y-5">
      {/* Active project */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-violet-400 font-medium mb-2">Active project</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={currentName}
            onChange={(e) => onRename(e.target.value)}
            className="flex-1 bg-[#0a0a0c] border border-[#26262a] rounded-md px-3 h-9 text-[13px] text-white outline-none focus:border-violet-500/60 transition-colors"
          />
          <button
            onClick={onSaveNow}
            title="Sync now"
            className="h-9 px-3 rounded-md bg-[#1a1a1d] border border-[#26262a] text-[12px] text-[#c4c4c8] hover:text-white hover:border-[#3a3a3e] transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Sync
          </button>
        </div>
      </div>

      {/* Cloud project list */}
      <div>
        <div className="flex items-center mb-2">
          <span className="text-[10px] uppercase tracking-wider text-violet-400 font-medium">Your cloud projects</span>
          <button onClick={onRefresh} title="Refresh" className="ml-auto text-[#6a6a70] hover:text-white p-1">
            <RefreshCw size={12} className={busy ? 'animate-spin' : ''} />
          </button>
        </div>

        {error && <div className="text-[12px] text-red-400 mb-2">{error}</div>}

        <div className="border border-[#1f1f22] rounded-md divide-y divide-[#1f1f22] overflow-hidden">
          {projects === null ? (
            <div className="px-3 py-4 text-[12px] text-[#5a5a60] text-center">Loading…</div>
          ) : !projects.length ? (
            <div className="px-3 py-4 text-[12px] text-[#5a5a60] text-center">No projects in the cloud yet — your active one will appear here once it syncs.</div>
          ) : (
            projects.map((p) => {
              const active = p.id === currentId;
              return (
                <div key={p.id} className={`flex items-center gap-2 px-3 py-2 ${active ? 'bg-violet-500/10' : 'hover:bg-[#1a1a1d]'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-white truncate flex items-center gap-1.5">
                      {active && <Check size={12} className="text-violet-400 flex-shrink-0" />}
                      {p.name || 'Untitled'}
                    </div>
                    <div className="text-[10px] text-[#5a5a60]">{fmtDate(p.updatedAt)}</div>
                  </div>
                  {!active && (
                    <button
                      onClick={() => onOpen(p.id)}
                      title="Open"
                      className="p-1.5 text-[#8a8a90] hover:text-white transition-colors"
                    >
                      <FolderOpen size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(p.id)}
                    title="Delete from cloud"
                    className="p-1.5 text-[#6a6a70] hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <button
          onClick={onNewProject}
          className="mt-3 w-full flex items-center justify-center gap-2 h-9 rounded-md border border-dashed border-[#26262a] text-[12px] text-[#8a8a90] hover:text-white hover:border-[#3a3a3e] transition-colors"
        >
          <FilePlus2 size={14} /> New project
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    disabled: ['Off', 'text-[#6a6a70]', 'bg-[#3a3a3e]'],
    connecting: ['Connecting…', 'text-amber-400', 'bg-amber-400'],
    saving: ['Saving…', 'text-amber-400', 'bg-amber-400'],
    saved: ['Synced', 'text-emerald-400', 'bg-emerald-400'],
    idle: ['Synced', 'text-emerald-400', 'bg-emerald-400'],
    offline: ['Offline', 'text-amber-400', 'bg-amber-400'],
    error: ['Error', 'text-red-400', 'bg-red-400'],
  };
  const [label, text, dot] = map[status] || map.disabled;
  return (
    <span className={`flex items-center gap-1.5 text-[11px] ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function messageFor(code) {
  if (code === 401) return 'Wrong passphrase.';
  if (code === 503) return 'Cloud isn’t configured on the server (no DATABASE_URL).';
  if (code === 'offline') return 'Can’t reach the cloud — are you running the deployed app (or `vercel dev`)?';
  return 'Something went wrong. Try again.';
}

function fmtDate(s) {
  if (!s) return '';
  try {
    const d = new Date(s);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}
