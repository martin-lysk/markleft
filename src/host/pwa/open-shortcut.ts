export interface PwaOpenShortcutWindow {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
}

/** Intercepts the browser's Open command and sends it through Markleft's file flow. */
export function installPwaOpenShortcut(
  win: PwaOpenShortcutWindow,
  openMarkdown: () => void,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key.toLowerCase() !== "o" || (!event.metaKey && !event.ctrlKey) || event.altKey || event.repeat) return;
    event.preventDefault();
    openMarkdown();
  };
  win.addEventListener("keydown", onKeyDown);
  return () => win.removeEventListener("keydown", onKeyDown);
}
