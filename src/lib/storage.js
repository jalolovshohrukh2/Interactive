import { STORAGE_KEY } from '../constants.js';

export function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProject(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function clearProject() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
