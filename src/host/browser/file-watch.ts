import type { WritableFileHandle } from "../../file/save";

interface FileSystemObserverLike {
  observe(handle: WritableFileHandle): Promise<void>;
  disconnect(): void;
}

type FileSystemObserverConstructor = new (callback: () => void) => FileSystemObserverLike;

export interface BrowserFileWatchWindow {
  setInterval(handler: () => void, timeout?: number): number;
  clearInterval(id?: number): void;
  FileSystemObserver?: FileSystemObserverConstructor;
}

/** Owns browser-native file observation and its polling fallback for one file handle. */
export class BrowserFileWatch {
  private observer: FileSystemObserverLike | null = null;
  private pollTimer = 0;

  constructor(
    private readonly win: BrowserFileWatchWindow,
    private readonly onChange: () => void,
    private readonly pollingInterval: number,
  ) {}

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.win.clearInterval(this.pollTimer);
    this.pollTimer = 0;
  }

  async start(handle: WritableFileHandle): Promise<void> {
    this.stop();
    if (!handle.getFile) return;

    const Observer = this.win.FileSystemObserver;
    if (Observer) {
      try {
        this.observer = new Observer(this.onChange);
        await this.observer.observe(handle);
        return;
      } catch {
        this.observer?.disconnect();
        this.observer = null;
      }
    }

    this.pollTimer = this.win.setInterval(this.onChange, this.pollingInterval);
  }
}
