import type { PwaFileHandle } from "./document-host";

export interface PwaLaunchParams {
  files: readonly PwaFileHandle[];
}

export interface PwaLaunchQueue {
  setConsumer(consumer: (params: PwaLaunchParams) => void): void;
}

export interface PwaFileLaunchWindow {
  launchQueue?: PwaLaunchQueue;
}

/**
 * Connect an installed PWA's OS file launch to the normal document-opening
 * flow. Chrome queues launch events until this consumer is registered.
 */
export function registerPwaFileLaunches(
  win: PwaFileLaunchWindow,
  openFile: (handle: PwaFileHandle) => void,
): boolean {
  if (!win.launchQueue) return false;
  win.launchQueue.setConsumer((params) => {
    const [handle] = params.files;
    if (handle) openFile(handle);
  });
  return true;
}
