import { BrowserFileWatch, type BrowserFileWatchWindow } from "../src/host/browser/file-watch";
import type { WritableFileHandle } from "../src/file/save";

const handle: WritableFileHandle = {
  createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }),
  getFile: () => Promise.resolve({ text: () => Promise.resolve("") }),
};

test("uses the browser file observer when it is available", async () => {
  let callback: () => void = () => {
    throw new Error("File observer callback was not configured.");
  };
  let disconnected = false;
  let changes = 0;
  const win: BrowserFileWatchWindow = {
    setInterval: () => 1,
    clearInterval: () => undefined,
    FileSystemObserver: class {
      constructor(next: () => void) {
        callback = next;
      }
      async observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  };
  const watch = new BrowserFileWatch(win, () => {
    changes += 1;
  }, 3000);

  await watch.start(handle);
  callback();
  watch.stop();

  expect(changes).toBe(1);
  expect(disconnected).toBe(true);
});

test("falls back to polling when the browser has no file observer", async () => {
  let intervalCallback: () => void = () => {
    throw new Error("Polling callback was not configured.");
  };
  let cleared: number | undefined;
  const win: BrowserFileWatchWindow = {
    setInterval(callback) {
      intervalCallback = callback;
      return 42;
    },
    clearInterval(id) {
      cleared = id;
    },
  };
  let changes = 0;
  const watch = new BrowserFileWatch(win, () => {
    changes += 1;
  }, 3000);

  await watch.start(handle);
  intervalCallback();
  watch.stop();

  expect(changes).toBe(1);
  expect(cleared).toBe(42);
});
