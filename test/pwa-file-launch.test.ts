import { describe, expect, it } from "vitest";
import { registerPwaFileLaunches, type PwaLaunchParams } from "../src/host/pwa/file-launch";
import type { PwaFileHandle } from "../src/host/pwa/document-host";

const handle: PwaFileHandle = {
  name: "notes.md",
  getFile: () => Promise.resolve({ lastModified: 1, size: 0, text: () => Promise.resolve("") }),
  createWritable: () => Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() }),
};

describe("registerPwaFileLaunches", () => {
  it("opens the Markdown handle Chrome delivered through launchQueue", () => {
    let consumer: ((params: PwaLaunchParams) => void) | undefined;
    let opened: PwaFileHandle | undefined;
    const registered = registerPwaFileLaunches(
      { launchQueue: { setConsumer(next) { consumer = next; } } },
      (file) => {
        opened = file;
      },
    );

    consumer?.({ files: [handle] });

    expect(registered).toBe(true);
    expect(opened).toBe(handle);
  });

  it("leaves the picker flow as the fallback when launchQueue is unavailable", () => {
    expect(registerPwaFileLaunches({}, () => undefined)).toBe(false);
  });
});
