export interface MarkdownHistory {
  entries: string[];
  index: number;
  typingTimer: number;
  commit(markdown: string): void;
  replace(markdown: string): void;
  undo(): string | null;
  redo(): string | null;
}

const maxHistoryEntries = 100;

export function createMarkdownHistory(initialMarkdown: string): MarkdownHistory {
  return {
    entries: [initialMarkdown],
    index: 0,
    typingTimer: 0,
    commit(markdown: string) {
      if (this.entries[this.index] === markdown) return;
      this.entries = this.entries.slice(0, this.index + 1);
      this.entries.push(markdown);
      if (this.entries.length > maxHistoryEntries) this.entries.shift();
      this.index = this.entries.length - 1;
    },
    replace(markdown: string) {
      this.entries[this.index] = markdown;
    },
    undo() {
      if (this.index <= 0) return null;
      this.index -= 1;
      return this.entries[this.index] ?? null;
    },
    redo() {
      if (this.index >= this.entries.length - 1) return null;
      this.index += 1;
      return this.entries[this.index] ?? null;
    },
  };
}

export function markdownHistoryShortcut(event: KeyboardEvent): "undo" | "redo" | null {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y" && !event.shiftKey) return "redo";

  const code = event.code;
  const keyIsUnreliable = key === "" || key === "unidentified" || key.startsWith("dead");
  if (!keyIsUnreliable) return null;
  if (code === "KeyZ") return event.shiftKey ? "redo" : "undo";
  if (code === "KeyY" && !event.shiftKey) return "redo";
  return null;
}

export function shouldUseMarkdownHistory(target: EventTarget | null): boolean {
  return !(target as Element | null)?.closest(
    ".local-md-comment-card textarea, .local-md-comment-card input",
  );
}
