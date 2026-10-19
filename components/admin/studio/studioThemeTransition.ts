/** BeUI circle reveal adapted from the approved Vistaire v29 deployment.
 * Copyright (c) 2026 Saurabh Chauhan, MIT (docs/licenses/beui-MIT.txt).
 * Keeps the existing private/public theme stores and never changes restaurant data.
 */
type TransitionDocument = {
  documentElement: { dataset: { studioThemeTransition?: string } };
  startViewTransition?: (update: () => void) => {
    ready: Promise<unknown>;
    updateCallbackDone: Promise<unknown>;
    finished: Promise<unknown>;
    skipTransition?: () => void;
  };
};
export function createStudioThemeTransition({
  document,
  getTheme,
  setTheme,
  onPendingChange = () => {},
}: {
  document: TransitionDocument;
  getTheme: () => "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  let active: {
    commit: () => void;
    close: () => void;
    skip?: () => void;
  } | null = null;
  let disposed = false;
  return {
    get pending() {
      return active !== null;
    },
    toggle(reduced: boolean) {
      if (disposed || active) return false;
      const next = getTheme() === "dark" ? "light" : "dark";
      if (reduced || !document.startViewTransition) {
        setTheme(next);
        return true;
      }
      const before = document.documentElement.dataset.studioThemeTransition;
      let committed = false;
      const task = {
        commit() {
          if (!committed) {
            setTheme(next);
            committed = true;
          }
        },
        close() {
          if (active !== task) return;
          try {
            task.commit();
          } finally {
            if (before === undefined)
              delete document.documentElement.dataset.studioThemeTransition;
            else
              document.documentElement.dataset.studioThemeTransition = before;
            active = null;
            if (!disposed) onPendingChange(false);
          }
        },
        skip: undefined as (() => void) | undefined,
      };
      active = task;
      onPendingChange(true);
      document.documentElement.dataset.studioThemeTransition = "circle";
      try {
        const transition = document.startViewTransition(task.commit);
        task.skip = () => transition.skipTransition?.();
        void transition.ready.catch(() => {});
        void transition.updateCallbackDone.catch(() => {});
        void transition.finished.then(task.close, task.close);
      } catch {
        task.close();
      }
      return true;
    },
    dispose() {
      disposed = true;
      const task = active;
      if (task) {
        try {
          task.skip?.();
        } finally {
          task.close();
        }
      }
    },
  };
}
