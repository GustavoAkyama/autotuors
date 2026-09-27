import { getState } from "./api.js";

/** The server's state, polled every second, and who wants to know when it changes. */
export const store = {
  state: { job: null, sessions: [], tours: [], missing: [] },
  online: true,
  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  async refresh() {
    try {
      this.state = await getState();
      this.online = true;
    } catch {
      this.online = false;
    }
    for (const listener of this.listeners) listener(this.state);
  },
};

export const go = (hash) => {
  location.hash = hash;
};

/** The current job if it is of this kind (and for this name). */
export const jobOf = (state, kind, name) =>
  state.job?.kind === kind && (name === undefined || state.job.name === name)
    ? state.job
    : null;

export const isBusy = (state) => state.job?.status === "running";

/** "criar-tarefa" → "Criar tarefa", for tours without an opening card. */
export const humanize = (name) => {
  const words = name.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
