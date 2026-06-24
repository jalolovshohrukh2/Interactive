// Client wrapper around the /api/projects endpoint.
//
// The app is local-first: every call here can fail (offline, running under the
// plain Vite dev server with no /api, or cloud not configured) and the caller
// just keeps using the local copy. Errors carry a `.code` so callers can tell
// "not configured / unauthorized / offline" apart.

const TOKEN_KEY = 'interactive-image:cloudToken';
const ENABLED_KEY = 'interactive-image:cloudEnabled';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};
export const setToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

export const isEnabled = () => {
  try { return localStorage.getItem(ENABLED_KEY) === '1'; } catch { return false; }
};
export const setEnabled = (on) => {
  try {
    if (on) localStorage.setItem(ENABLED_KEY, '1');
    else localStorage.removeItem(ENABLED_KEY);
  } catch {}
};

function err(message, code) {
  const e = new Error(message);
  e.code = code;
  return e;
}

async function call(path, opts = {}) {
  let res;
  try {
    res = await fetch('/api/' + path, {
      ...opts,
      headers: {
        'content-type': 'application/json',
        'x-app-token': getToken(),
        ...(opts.headers || {}),
      },
    });
  } catch {
    // Network failure / no server.
    throw err('offline', 'offline');
  }
  if (res.status === 503) throw err('cloud-not-configured', 503);
  if (res.status === 401) throw err('unauthorized', 401);
  if (res.status === 404) throw err('not-found', 404);
  if (!res.ok) throw err('http-' + res.status, res.status);
  // The plain Vite dev server answers unknown paths with index.html — guard
  // against parsing HTML as JSON and treat it as "cloud unavailable".
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw err('cloud-unavailable', 'offline');
  return res.json();
}

export const listProjects = () => call('projects');
export const getProject = (id) => call('projects?id=' + encodeURIComponent(id));
export const putProject = (project) =>
  call('projects?id=' + encodeURIComponent(project.id), {
    method: 'PUT',
    body: JSON.stringify(project),
  });
export const deleteProject = (id) =>
  call('projects?id=' + encodeURIComponent(id), { method: 'DELETE' });
