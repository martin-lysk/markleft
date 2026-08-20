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
import type { MarkleftDocumentHost } from "./host/document-host";
import { installPwaOpenShortcut } from "./host/pwa/open-shortcut";
import { styles } from "./styles";
import {
  mountApp,
  type MarkleftApplicationMenu,
  type MarkleftApplicationMenuItem,
} from "./ui";
import landingMarkdown from "../landing.md";

declare const __MARKLEFT_PWA_BUILD__: string;

interface PwaWindow extends Window {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<PwaFileHandle[]>;
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<PwaDirectoryHandle>;
  launchQueue?: PwaLaunchQueue;
}

interface PwaInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome?: "accepted" | "dismissed" } | void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
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
const installNudgeDismissedAtKey = "markleft:pwa-install-nudge-dismissed-at";
const installNudgeCooldownMs = 21 * 24 * 60 * 60 * 1000;
let hasOpenDocument = false;
let deferredInstallPrompt: PwaInstallPromptEvent | null = null;

function pwaCanOfferInstall(): boolean {
  return deferredInstallPrompt !== null && !isInstalledPwa();
}

function isLocalInstallNudgePreview(): boolean {
  const url = new URL(window.location.href);
  return url.hostname === "localhost" && url.searchParams.get("previewInstall") === "1";
}

function pwaShouldShowInstallNudge(): boolean {
  if (isLocalInstallNudgePreview()) return true;
  if (!pwaCanOfferInstall()) return false;
  try {
    const dismissedAt = Number(window.localStorage.getItem(installNudgeDismissedAtKey));
    return !Number.isFinite(dismissedAt) || Date.now() - dismissedAt >= installNudgeCooldownMs;
  } catch {
    return true;
  }
}

function isInstalledPwa(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

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
      ];
      if (pwaCanOfferInstall()) {
        items.push({ kind: "action", label: "Install Markleft", action: () => promptToInstall() });
      }
      items.push({ kind: "separator" }, { kind: "label", label: "Open recent" });
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
  installPwaInstallPromotion();
  registerServiceWorker();
  installCrossWindowFileReceiver();
  installDragAndDrop();
  installPwaOpenShortcut(window, () => void openFromPicker());
  registerPwaFileLaunches(window as PwaWindow, (handle) => {
    void openIncomingDocument(handle);
  });
  const launchUrl = new URL(window.location.href);
  const httpPath = launchUrl.searchParams.get("httpPath");
  if (httpPath) {
    await openRemoteDocument(httpPath);
    return;
  }
  if ((await loadRecentDocuments()).length === 0) {
    await openLandingPage();
    return;
  }
  await renderStartScreen();
}

async function openLandingPage(): Promise<void> {
  const host: MarkleftDocumentHost = {
    id: "markleft:landing",
    displayName: "Markleft",
    capabilities: { canWatch: false, canResolveAssets: true, canInvokeAgent: false, canWrite: false },
    read: async () => ({ markdown: landingMarkdown, revision: "markleft:landing" }),
    write: async () => {
      throw new Error("The Markleft introduction is read-only. Open a local Markdown file to save changes.");
    },
    resolveAsset: async (source: string) => {
      try {
        return new URL(source, window.location.href).href;
      } catch {
        return null;
      }
    },
  };
  await mountApp(landingMarkdown, false, {
    documentHost: host,
    documentPath: "landing.md",
    applicationMenu: pwaApplicationMenu(),
    isLandingPage: true,
  });
  document.title = "Markleft — Markdown review for humans and AI";
  refreshInstallPromotion();
}

async function renderStartScreen(message = "Open a local Markdown file to begin."): Promise<void> {
  const recent = await loadRecentDocuments();
  document.body.replaceChildren();
  const toolbar = document.createElement("div");
  toolbar.className = "local-md-toolbar local-md-toolbar-start";
  toolbar.dataset.localMdWrapper = "true";
  toolbar.innerHTML = `
    <div class="local-md-app-menu markleft-pwa-start-menu">
      <button type="button" class="local-md-toolbar-button local-md-app-menu-trigger" data-start-menu-trigger aria-expanded="false">
        <span>Markleft</span>${uiChevronDown()}
      </button>
      <div class="local-md-app-menu-popover" data-start-menu-popover>
        <button type="button" class="local-md-app-menu-item" data-start-open>Open Markdown…<kbd>⌘O</kbd></button>
        ${pwaCanOfferInstall() ? '<button type="button" class="local-md-app-menu-item" data-start-install>Install Markleft</button>' : ""}
        <hr class="local-md-app-menu-separator">
        <div class="local-md-app-menu-label">Open recent</div>
        ${recent.length > 0 ? recent.map((item, index) => `<button type="button" class="local-md-app-menu-item" data-start-recent="${index}">${escapeHtml(item.name)}</button>`).join("") : '<button type="button" class="local-md-app-menu-item" disabled>No recent documents</button>'}
        <hr class="local-md-app-menu-separator">
        <button type="button" class="local-md-app-menu-item" data-start-new-window>New Markleft window</button>
      </div>
    </div>
    <div class="local-md-mode-toggle" hidden aria-hidden="true"></div>
    <div class="local-md-save-menu" hidden aria-hidden="true"></div>
  `;
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
  document.body.append(toolbar, shell);
  const startMenu = toolbar.querySelector<HTMLElement>(".markleft-pwa-start-menu");
  const startMenuTrigger = toolbar.querySelector<HTMLButtonElement>("[data-start-menu-trigger]");
  const closeStartMenu = () => {
    startMenu?.classList.remove("local-md-app-menu-open");
    startMenuTrigger?.setAttribute("aria-expanded", "false");
  };
  startMenuTrigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    const open = !startMenu?.classList.contains("local-md-app-menu-open");
    startMenu?.classList.toggle("local-md-app-menu-open", open);
    startMenuTrigger?.setAttribute("aria-expanded", String(open));
  });
  toolbar.querySelector<HTMLButtonElement>("[data-start-open]")?.addEventListener("click", () => {
    closeStartMenu();
    void openFromPicker();
  });
  toolbar.querySelector<HTMLButtonElement>("[data-start-install]")?.addEventListener("click", () => {
    closeStartMenu();
    void promptToInstall();
  });
  toolbar.querySelectorAll<HTMLButtonElement>("[data-start-recent]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = recent[Number(button.dataset.startRecent)];
      if (item) void openIncomingDocument(item.handle, item.directory);
    });
  });
  toolbar.querySelector<HTMLButtonElement>("[data-start-new-window]")?.addEventListener("click", () => {
    closeStartMenu();
    openNewMarkleftWindow();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!startMenu?.contains(event.target as Node)) closeStartMenu();
  });
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
  refreshInstallPromotion(shell);
}

function uiChevronDown(): string {
  return '<svg class="local-md-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>';
}

function installPwaInstallPromotion(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as PwaInstallPromptEvent;
    refreshInstallPromotion();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    try {
      window.localStorage.removeItem(installNudgeDismissedAtKey);
    } catch {
      // The installation is still complete if storage is unavailable.
    }
    refreshInstallPromotion();
  });
}

async function promptToInstall(): Promise<void> {
  const prompt = deferredInstallPrompt;
  if (!prompt) return;
  deferredInstallPrompt = null;
  refreshInstallPromotion();
  try {
    const result = await prompt.prompt();
    const choice = await prompt.userChoice.catch(() => result);
    if (choice?.outcome === "dismissed") dismissInstallNudge();
  } catch {
    // The browser owns the prompt and can reject it when its state changes.
  }
}

function dismissInstallNudge(): void {
  try {
    window.localStorage.setItem(installNudgeDismissedAtKey, String(Date.now()));
  } catch {
    // A session-only dismissal is still respected by removing the visible card.
  }
  refreshInstallPromotion();
}

function refreshInstallPromotion(startScreen?: HTMLElement): void {
  document.querySelectorAll("[data-markleft-install-promotion]").forEach((element) => element.remove());
  if (!pwaShouldShowInstallNudge()) return;

  const editorIsOpen = document.querySelector(".local-md-shell") !== null;
  const previewOnly = !pwaCanOfferInstall();
  const promotion = document.createElement("section");
  promotion.dataset.markleftInstallPromotion = "true";
  promotion.className = `markleft-pwa-install-promotion ${editorIsOpen ? "markleft-pwa-install-nudge" : "markleft-pwa-install-card"}`;
  promotion.innerHTML = `
    <span class="markleft-pwa-install-glyph" aria-hidden="true">⇩</span>
    <div class="markleft-pwa-install-copy">
      <strong>Use Markleft like an app</strong>
      <p>Open Markdown from Finder, keep recent documents, and work in its own window.</p>
      ${previewOnly ? '<span class="markleft-pwa-install-preview">Local preview</span>' : ""}
    </div>
    <div class="markleft-pwa-install-actions">
      <button type="button" class="markleft-pwa-install-action" data-install-markleft${previewOnly ? " disabled" : ""}>Install Markleft</button>
      <button type="button" class="markleft-pwa-install-dismiss" data-dismiss-install>Not now</button>
    </div>
  `;
  promotion.querySelector<HTMLButtonElement>("[data-install-markleft]")?.addEventListener("click", () => {
    void promptToInstall();
  });
  promotion.querySelector<HTMLButtonElement>("[data-dismiss-install]")?.addEventListener("click", dismissInstallNudge);
  (editorIsOpen ? document.body : startScreen ?? document.body).append(promotion);
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
    refreshInstallPromotion();
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
    refreshInstallPromotion();
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
    .markleft-pwa-install-promotion { box-sizing: border-box; border: 1px solid #c5b8a3; border-radius: 14px; background: linear-gradient(135deg, #fffdf8, #f3ede2); box-shadow: 0 16px 42px rgb(40 32 20 / 18%); color: #26313a; }
    .markleft-pwa-install-card { width: min(560px, calc(100vw - 64px)); display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 18px 20px; }
    .markleft-pwa-install-nudge { position: fixed; z-index: 90; right: 22px; bottom: 22px; width: min(390px, calc(100vw - 44px)); display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; padding: 16px; animation: markleft-pwa-install-enter 380ms cubic-bezier(.2,.8,.2,1) both; }
    .markleft-pwa-install-glyph { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: #3a5061; color: #fffdf8; font-size: 25px; font-weight: 700; line-height: 1; animation: markleft-pwa-install-bob 2.4s ease-in-out infinite; }
    .markleft-pwa-install-copy strong { display: block; font-size: 15px; }.markleft-pwa-install-copy p { margin: 4px 0 0; color: #5c6470; font-size: 13px; line-height: 1.4; }
    .markleft-pwa-install-preview { display: inline-block; margin-top: 7px; border-radius: 999px; background: #e4dbcb; color: #6b5a41; font-size: 11px; font-weight: 700; letter-spacing: .03em; padding: 3px 7px; text-transform: uppercase; }
    .markleft-pwa-install-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }.markleft-pwa-install-nudge .markleft-pwa-install-actions { grid-column: 2; justify-content: flex-start; }
    button.markleft-pwa-install-action { border-color: #3a5061; background: #3a5061; color: #fffdf8; font-size: 13px; font-weight: 650; white-space: nowrap; } button.markleft-pwa-install-action:hover, button.markleft-pwa-install-action:focus-visible { border-color: #263b4a; background: #263b4a; color: #fffdf8; }
    button.markleft-pwa-install-dismiss { border: 0; background: transparent; color: #66717a; font-size: 13px; white-space: nowrap; } button.markleft-pwa-install-dismiss:hover, button.markleft-pwa-install-dismiss:focus-visible { background: transparent; color: #26313a; text-decoration: underline; }
    @keyframes markleft-pwa-install-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } @keyframes markleft-pwa-install-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
    @media (max-width: 620px) { .markleft-pwa-install-card { grid-template-columns: 44px minmax(0, 1fr); }.markleft-pwa-install-card .markleft-pwa-install-actions { grid-column: 2; justify-content: flex-start; } } @media (prefers-reduced-motion: reduce) { .markleft-pwa-install-nudge, .markleft-pwa-install-glyph { animation: none; } }
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
