import { useEffect, useRef, useState, useCallback } from 'react';
import * as cloud from '../lib/cloud.js';

// Cloud sync for the single active project. Strictly additive on top of the
// local-first store: if the cloud is off / unreachable, nothing here affects
// the app — the local copy keeps working.
//
// Model (v1, predictable & non-destructive):
//   - When connected, local edits AUTO-PUSH (debounced) to Neon.
//   - Pulling is EXPLICIT — the user opens a project from their cloud list.
//     We never silently overwrite local work on load.
//
// `project` is the current local snapshot: { id, name, image, shapes, pieces }.
export function useCloudSync({ enabled, project, onApplyRemote }) {
  const [status, setStatus] = useState(enabled ? 'idle' : 'disabled');

  const projectRef = useRef(project);
  projectRef.current = project;

  // The image is large; only resend it when it actually changed.
  const lastImageUrlRef = useRef(null);
  // Skip the auto-push that a just-pulled project would otherwise trigger.
  const skipNextRef = useRef(false);
  // Don't push on the first run after (re)enabling — treat current state as the
  // baseline so simply opening the app doesn't clobber a newer cloud copy.
  const firstRunRef = useRef(true);
  const timerRef = useRef(null);

  const pushNow = useCallback(async () => {
    const p = projectRef.current;
    if (!p?.id) return;
    const includeImage = (p.image?.url ?? null) !== lastImageUrlRef.current;
    const payload = { id: p.id, name: p.name, shapes: p.shapes, pieces: p.pieces };
    if (includeImage) payload.image = p.image ?? null;
    setStatus('saving');
    try {
      await cloud.putProject(payload);
      lastImageUrlRef.current = p.image?.url ?? null;
      setStatus('saved');
    } catch (e) {
      setStatus(e.code === 'offline' || e.code === 503 ? 'offline' : 'error');
    }
  }, []);

  // Debounced auto-push on local change.
  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      firstRunRef.current = true;
      return;
    }
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return; // baseline — no push
    }
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return; // we just pulled this
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { pushNow(); }, 1500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [enabled, project.id, project.name, project.image, project.shapes, project.pieces, pushNow]);

  // Validate the passphrase + reachability, then turn syncing on.
  const connect = useCallback(async (token) => {
    cloud.setToken(token);
    setStatus('connecting');
    try {
      await cloud.listProjects();
      cloud.setEnabled(true);
      lastImageUrlRef.current = null; // force image upload on first real sync
      firstRunRef.current = true;
      setStatus('saved');
      return { ok: true };
    } catch (e) {
      setStatus('error');
      return { ok: false, code: e.code };
    }
  }, []);

  const disconnect = useCallback(() => {
    cloud.setEnabled(false);
    setStatus('disabled');
  }, []);

  const list = useCallback(() => cloud.listProjects(), []);
  const remove = useCallback((id) => cloud.deleteProject(id), []);

  // Explicit pull — replaces local state with the cloud copy.
  const open = useCallback(async (id) => {
    const remote = await cloud.getProject(id);
    skipNextRef.current = true;
    lastImageUrlRef.current = remote.image?.url ?? null;
    onApplyRemote?.(remote);
    setStatus('saved');
    return remote;
  }, [onApplyRemote]);

  return { status, connect, disconnect, list, open, remove, saveNow: pushNow };
}
