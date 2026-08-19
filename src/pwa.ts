import {
  PwaDocumentHost,
  type PwaDirectoryHandle,
  type PwaFileHandle,
} from "./host/pwa/document-host";
import { registerPwaFileLaunches, type PwaLaunchQueue } from "./host/pwa/file-launch";
import { firstDroppedMarkdownHandle } from "./host/pwa/drag-drop";
import { loadRecentDocuments, rememberRecentDocument, type RecentPwaDocument } from "./host/pwa/recent-documents";
import {
  restoreProjectLocation,
  verifyProjectLocation,
  type PwaProjectLocation,
} from "./host/pwa/project-access";
import { HttpDocumentHost } from "./host/http/document-host";
import { installPwaOpenShortcut } from "./host/pwa/open-shortcut";
import { styles } from "./styles";
import {
  mountApp,
  type MarkleftApplicationMenu,
  type MarkleftApplicationMenuItem,
} from "./ui";

declare const __MARKLEFT_PWA_BUILD__: string;

interface PwaWindow extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<PwaFileHandle[]>;
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<PwaDirectoryHandle>;
  launchQueue?: PwaLaunchQueue;
}

const pickerOptions = {
  multiple: false,
  types: [
    {
      description: "Markdown",
      accept: {
        "text/markdown": [".md", ".markdown", ".mdx"],
        "text/plain": [".md", ".markdown", ".mdx"],
      },
    },
  ],
};

const crossWindowMessageType = "markleft:pwa-open-file";
const crossWindowReadyType = "markleft:pwa-open-file-ready";
let hasOpenDocument = false;

function pwaApplicationMenu(): MarkleftApplicationMenu {
  return {
    getItems: async () => {
      const recent = await loadRecentDocuments();
      const items: MarkleftApplicationMenuItem[] = [
        {
          kind: "action",
          label: "Open Markdown…",
          shortcut: "⌘O",
          action: () => openFromPicker(),
        },
        { kind: "separator" },
        { kind: "label", label: "Open recent" },
      ];
      if (recent.length === 0) {
        items.push({ kind: "action", label: "No recent documents", disabled: true, action: () => undefined });
      } else {
        items.push(
          ...recent.map((item) => ({
            kind: "action" as const,
            label: item.name,
            action: () => openIncomingDocument(item.handle, item.directory),
          })),
        );
      }
      items.push(
        { kind: "separator" },
        { kind: "action", label: "New Markleft window", action: () => openNewMarkleftWindow() },
      );
      return items;
    },
  };
}

async function start(): Promise<void> {
  installStyles();
  registerServiceWorker();
  installCrossWindowFileReceiver();
  installDragAndDrop();
  installPwaOpenShortcut(window, () => void openFromPicker());
  registerPwaFileLaunches(window as PwaWindow, (handle) => {
    void openIncomingDocument(handle);
  });
  const httpPath = new URL(window.location.href).searchParams.get("httpPath");
  if (httpPath) {
    await openRemoteDocument(httpPath);
    return;
  }
  await renderStartScreen();
}

async function renderStartScreen(message = "Open a local Markdown file to begin."): Promise<void> {
  const recent = await loadRecentDocuments();
  document.body.replaceChildren();
  const shell = document.createElement("main");
  shell.className = "markleft-pwa-start";
  shell.innerHTML = `
    <section class="markleft-pwa-card">
      <p class="markleft-pwa-eyebrow">MARKLEFT</p>
      <h1>Markdown review, saved directly to your file.</h1>
      <p>${escapeHtml(message)}</p>
      <button type="button" class="local-md-primary-button" data-open-markdown>Open Markdown</button>
      <p class="markleft-pwa-note">Your document stays local. Chrome asks before Markleft can write to it.</p>
    </section>
    ${recent.length > 0 ? recentMarkup(recent) : ""}
  `;
  document.body.append(shell);
  shell.querySelector<HTMLButtonElement>("[data-open-markdown]")?.addEventListener("click", () => {
    void openFromPicker();
  });
  shell.querySelectorAll<HTMLButtonElement>("[data-recent-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.recentIndex);
      const item = recent[index];
      if (item) void openIncomingDocument(item.handle, item.directory);
    });
  });
}

function recentMarkup(recent: RecentPwaDocument[]): string {
  return `<section class="markleft-pwa-recents"><h2>Recent documents</h2><ul>${recent
    .map(
      (item, index) =>
        `<li><button type="button" data-recent-index="${index}">${escapeHtml(item.name)}</button></li>`,
    )
    .join("")}</ul></section>`;
}

async function openFromPicker(): Promise<void> {
  const picker = (window as PwaWindow).showOpenFilePicker;
  if (!picker) {
    await renderStartScreen("This browser does not support direct local-file access. Please use Chrome on desktop.");
    return;
  }
  try {
    const [handle] = await picker(pickerOptions);
    if (handle) await openIncomingDocument(handle);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    await renderStartScreen(`Could not open that file: ${errorMessage(error)}`);
  }
}

async function openDocument(handle: PwaFileHandle, directory?: PwaDirectoryHandle): Promise<void> {
  try {
    const selectedProject = directory ? await verifyProjectLocation(handle, directory) : null;
    const project = (await restoreProjectLocation(handle)) ?? selectedProject;
    const host = new PwaDocumentHost(handle, project ?? undefined);
    const snapshot = await host.read();
    setLocalDocumentTitle(handle, project);
    await rememberRecentDocument(handle, project?.root ?? directory);
    await mountApp(snapshot.markdown, false, {
      documentHost: host,
      documentPath: handle.name,
      applicationMenu: pwaApplicationMenu(),
      requestAssetAccess: async () => {
        const picker = (window as PwaWindow).showDirectoryPicker;
        if (!picker) {
          window.alert("This browser does not support project-folder access. Please use Chrome on desktop.");
          return false;
        }
        try {
          const root = await picker({ mode: "read" });
          const verified = await verifyProjectLocation(handle, root);
          if (!verified) {
            window.alert(`The selected folder does not contain the open Markdown file ${handle.name}.`);
            return false;
          }
          const project = (await restoreProjectLocation(handle)) ?? verified;
          host.attachProject(project);
          setLocalDocumentTitle(handle, project);
          await rememberRecentDocument(handle, project.root);
          return true;
        } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            window.alert(`Could not use that project folder: ${errorMessage(error)}`);
          }
          return false;
        }
      },
    });
    hasOpenDocument = true;
  } catch (error) {
    await renderStartScreen(`Could not open ${handle.name}: ${errorMessage(error)}`);
  }
}

function setLocalDocumentTitle(handle: PwaFileHandle, project: PwaProjectLocation | null): void {
  const path = project?.documentPath.join("/") || handle.name;
  document.title = `Markleft — ${path}`;
}

async function openRemoteDocument(url: string): Promise<void> {
  try {
    await renderStartScreen("Loading remote Markdown…");
    const host = await HttpDocumentHost.open(url);
    const snapshot = await host.read();
    await mountApp(snapshot.markdown, false, {
      documentHost: host,
      documentPath: host.source.canonicalUrl,
      applicationMenu: pwaApplicationMenu(),
    });
    document.title = `Markleft — ${host.displayName}`;
    hasOpenDocument = true;
  } catch (error) {
    await renderStartScreen(`Could not open remote Markdown: ${errorMessage(error)}`);
  }
}

async function openIncomingDocument(
  handle: PwaFileHandle,
  directory?: PwaDirectoryHandle,
): Promise<void> {
  if (!hasOpenDocument) {
    await openDocument(handle, directory);
    return;
  }
  openDocumentInNewWindow(handle);
}

function openDocumentInNewWindow(handle: PwaFileHandle): void {
  const token = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const popup = window.open(`./?open=${encodeURIComponent(token)}`, `markleft-${token}`, "popup");
  if (!popup) {
    window.alert("Chrome blocked the new Markleft window. Allow pop-ups for Markleft, then drop the file again.");
    return;
  }

  const sendHandle = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || event.source !== popup) return;
    const message = event.data as { type?: string; token?: string } | null;
    if (message?.type !== crossWindowReadyType || message.token !== token) return;
    popup.postMessage({ type: crossWindowMessageType, token, handle }, window.location.origin);
    window.removeEventListener("message", sendHandle);
  };
  window.addEventListener("message", sendHandle);
  window.setTimeout(() => window.removeEventListener("message", sendHandle), 15000);
}

function openNewMarkleftWindow(): void {
  const token = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const popup = window.open("./", `markleft-new-${token}`, "popup");
  if (!popup) {
    window.alert("Chrome blocked the new Markleft window. Allow pop-ups for Markleft, then try again.");
  }
}

function installCrossWindowFileReceiver(): void {
  const token = new URL(window.location.href).searchParams.get("open");
  const opener = window.opener as WindowProxy | null;
  if (!token || !opener) return;
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin) return;
    const message = event.data as { type?: string; token?: string; handle?: PwaFileHandle } | null;
    if (message?.type !== crossWindowMessageType || message.token !== token || !message.handle) return;
    void openDocument(message.handle);
  });
  opener.postMessage({ type: crossWindowReadyType, token }, window.location.origin);
}

function installDragAndDrop(): void {
  let dragDepth = 0;
  const overlay = () => {
    let element = document.querySelector<HTMLElement>("[data-markleft-drop-overlay]");
    if (element) return element;
    element = document.createElement("div");
    element.dataset.markleftDropOverlay = "true";
    element.className = "markleft-pwa-drop-overlay";
    element.textContent = "Drop a Markdown file to open it";
    document.body.append(element);
    return element;
  };
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  window.addEventListener("dragenter", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    overlay().hidden = false;
  });
  window.addEventListener("dragover", (event) => {
    if (hasFiles(event)) event.preventDefault();
  });
  window.addEventListener("dragleave", (event) => {
    if (!hasFiles(event)) return;
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      overlay().hidden = true;
    }
  });
  window.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    overlay().hidden = true;
    void (async () => {
      const handle = await firstDroppedMarkdownHandle(event.dataTransfer?.items ?? []);
      if (!handle) {
        window.alert("Drop a .md, .markdown, or .mdx file into Markleft.");
        return;
      }
      await openIncomingDocument(handle);
    })();
  });
}

function installStyles(): void {
  if (document.head.querySelector("style[data-markleft-pwa]")) return;
  const style = document.createElement("style");
  style.dataset.markleftPwa = "true";
  style.textContent = `${styles}
    .markleft-pwa-start { min-height: 100vh; display: grid; place-content: center; gap: 18px; padding: 32px; background: #f4f1e8; color: #19202a; }
    .markleft-pwa-card, .markleft-pwa-recents { width: min(560px, calc(100vw - 64px)); box-sizing: border-box; background: #fffdf8; border: 1px solid #d9d1c2; border-radius: 12px; padding: 30px; box-shadow: 0 8px 24px rgb(33 29 20 / 8%); }
    .markleft-pwa-card h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.15; }.markleft-pwa-card p { line-height: 1.5; }.markleft-pwa-eyebrow { color: #7b5535; font-size: 12px; font-weight: 700; letter-spacing: .12em; }.markleft-pwa-note { margin-top: 20px; color: #666; font-size: 13px; }.markleft-pwa-recents h2 { margin: 0 0 10px; font-size: 16px; }.markleft-pwa-recents ul, .markleft-pwa-file-list { margin: 0; padding: 0; list-style: none; }.markleft-pwa-recents button, .markleft-pwa-file-list button { width: 100%; border: 0; background: transparent; padding: 10px 0; color: #384d5e; text-align: left; cursor: pointer; font: inherit; }.markleft-pwa-recents button:hover, .markleft-pwa-file-list button:hover { text-decoration: underline; }.markleft-pwa-drop-overlay { position: fixed; z-index: 10000; inset: 18px; display: grid; place-items: center; border: 3px dashed #384d5e; border-radius: 16px; background: rgb(244 241 232 / 92%); color: #384d5e; font-size: 22px; font-weight: 700; pointer-events: none; }.markleft-pwa-drop-overlay[hidden] { display: none; }
  `;
  document.head.append(style);
}

function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.register(`./pwa-service-worker.js?v=${__MARKLEFT_PWA_BUILD__}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void start());
else void start();
