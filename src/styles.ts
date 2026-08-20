export const styles = `
:root {
  color-scheme: light;
  --rams-red: #af2e1b;
  --rams-orange: #cc6324;
  --rams-blue: #3b4b59;
  --rams-tan: #bfa07a;
  --rams-cream: #d9c3b0;
  --rams-black: #141414;
  --canvas: #ebe8dc;
  --paper: #fbfaf5;
  --surface: #f5f1e7;
  --surface-raised: #fffefa;
  --ink: var(--rams-black);
  --muted: #686256;
  --line: #cfc6b7;
  --line-soft: #e3dccf;
  --accent: var(--rams-blue);
  --accent-hover: #2d3b47;
  --accent-soft: #e4e9e8;
  --warm: var(--rams-orange);
  --warm-soft: #f4dec9;
  --danger: var(--rams-red);
  --danger-soft: #f3d7d0;
  --suggestion: #ead6a7;
  --suggestion-soft: #fff7d8;
  --shadow-soft: 0 1px 2px rgb(20 20 20 / 6%), 0 10px 28px rgb(20 20 20 / 8%);
  --shadow-active: 0 2px 5px rgb(20 20 20 / 8%), 0 18px 38px rgb(20 20 20 / 14%);
  --radius: 6px;
}
* { box-sizing: border-box; }
*:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 62%, transparent);
  outline-offset: 2px;
}
.local-md-bookmarklet-install {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 3px;
  padding: 3px 9px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--line));
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  cursor: grab;
  font-weight: 700;
  text-decoration: none;
  user-select: none;
}
.local-md-bookmarklet-install:active { cursor: grabbing; }
.local-md-bookmarklet-install:hover { background: color-mix(in srgb, var(--accent-soft) 72%, white); }
.local-md-bookmarklet-install-shake { animation: local-md-bookmarklet-shake 420ms ease-in-out; }
.local-md-bookmarklet-drag-hint {
  display: inline-block;
  margin-left: 7px;
  color: var(--muted);
  font-size: 0.88em;
  font-style: italic;
}
.local-md-bookmarklet-drag-hint[hidden] { display: none; }
@keyframes local-md-bookmarklet-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}
body {
  margin: 0;
  min-height: 100vh;
  background: var(--canvas);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.local-md-shell {
  width: 100%;
  margin: 0 auto;
  padding: 58px clamp(16px, 3vw, 32px) clamp(16px, 3vw, 32px);
}
.local-md-toolbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  width: auto;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  min-height: 58px;
  color: var(--muted);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
  background: var(--surface);
  box-shadow: 0 1px 18px rgb(20 20 20 / 5%);
  padding: 10px clamp(16px, 3vw, 32px);
}
.local-md-brand {
  display: none;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  letter-spacing: 0;
}
.local-md-brand strong {
  line-height: 1;
}
.local-md-toolbar-start .local-md-brand { display: flex; }
.local-md-toolbar-start .local-md-brand strong {
  color: var(--ink);
  font-size: 17px;
  font-weight: 750;
}
.local-md-mode-toggle {
  position: absolute;
  left: 50%;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: 0 1px 3px rgb(20 20 20 / 5%);
  overflow: hidden;
  transform: translateX(-50%);
}
.local-md-mode-toggle[hidden],
.local-md-save-menu[hidden] { display: none !important; }
.local-md-mode-toggle button {
  min-width: 82px;
  height: 34px;
  border: 0;
  border-right: 1px solid var(--line);
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  padding: 0 12px;
}
.local-md-mode-toggle button:last-child { border-right: 0; }
.local-md-mode-toggle button:hover { background: var(--accent-soft); color: var(--accent); }
.local-md-mode-toggle button[aria-pressed="true"] {
  background: var(--accent);
  color: var(--paper);
  box-shadow: none;
}
.local-md-logo {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 14%);
}
.local-md-logo svg {
  display: block;
  width: 100%;
  height: 100%;
}
.local-md-logo rect {
  fill: var(--rams-black);
}
.local-md-logo-badge {
  fill: var(--rams-cream);
}
.local-md-logo-mark {
  fill: var(--rams-black);
}
.local-md-logo-arrow {
  fill: var(--rams-orange);
}
.local-md-actions {
  flex: 1 1 auto;
  display: flex;
  flex-wrap: nowrap;
  gap: 2px;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  overflow: visible;
  scrollbar-width: none;
}
.local-md-actions[hidden] { display: none; }
.local-md-actions::-webkit-scrollbar {
  display: none;
}
.local-md-toolbar-separator {
  align-self: stretch;
  width: 1px;
  min-height: 28px;
  margin: 0 8px;
  background: color-mix(in srgb, var(--line) 74%, transparent);
}
.local-md-format-controls {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  min-width: 0;
  overflow: hidden;
}
.local-md-overflow-menu,
.local-md-save-menu {
  position: relative;
  flex: 0 0 auto;
}
.local-md-overflow-menu[hidden] { display: none; }
.local-md-overflow-menu.local-md-overflow-menu-open .local-md-overflow-popover,
.local-md-save-popover.local-md-save-menu-open { display: grid; }
.local-md-overflow-popover,
.local-md-save-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 60;
  display: none;
  min-width: 210px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-active);
  padding: 8px;
}
.local-md-save-popover {
  right: 0;
  left: auto;
}
.local-md-overflow-popover { left: auto; }
.local-md-overflow-popover .local-md-toolbar-separator { display: none; }
.local-md-overflow-popover .local-md-toolbar-button,
.local-md-overflow-popover .local-md-format-trigger,
.local-md-save-popover button {
  width: 100%;
  min-width: 0;
  justify-content: flex-start;
  border: 0;
  border-radius: 6px;
  color: var(--ink);
  text-align: left;
}
.local-md-overflow-popover .local-md-format-menu { width: 100%; }
.local-md-overflow-popover .local-md-format-trigger { font-size: 15px; }
.local-md-overflow-popover .local-md-format-popover {
  top: 0;
  left: calc(100% + 8px);
}
.local-md-toolbar-button,
.local-md-mode-trigger {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  padding: 0 8px;
}
.local-md-toolbar-button:hover,
.local-md-toolbar-button:focus-visible,
.local-md-mode-trigger:hover,
.local-md-mode-trigger:focus-visible {
  background: color-mix(in srgb, var(--line-soft) 68%, transparent);
  color: var(--ink);
}
.local-md-toolbar-button .local-md-icon,
.local-md-mode-menu .local-md-icon {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}
.local-md-format-menu,
.local-md-mode-menu,
.local-md-app-menu {
  position: relative;
}
.local-md-format-menu.local-md-format-menu-open .local-md-format-popover {
  display: grid;
}
.local-md-format-trigger {
  min-width: 156px;
  justify-content: flex-start;
  font-size: 18px;
}
.local-md-format-trigger .local-md-icon:last-child {
  margin-left: auto;
}
.local-md-format-popover,
.local-md-mode-popover,
.local-md-app-menu-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 60;
  display: none;
  min-width: 205px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: 8px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-active);
  padding: 8px;
}
.local-md-format-popover button,
.local-md-mode-popover button {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 44px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.local-md-format-popover button:hover,
.local-md-format-popover button:focus-visible,
.local-md-mode-popover button:hover,
.local-md-mode-popover button:focus-visible {
  background: color-mix(in srgb, var(--line-soft) 70%, transparent);
}
.local-md-heading-token {
  color: var(--ink);
  font-weight: 700;
}
.local-md-underline-token {
  text-decoration: underline;
  text-underline-offset: 0.18em;
}
.local-md-strike-token {
  text-decoration: line-through;
}
.local-md-mode-trigger {
  font-size: 18px;
  min-width: 144px;
  justify-content: flex-start;
}
.local-md-mode-trigger .local-md-icon:last-child {
  margin-left: auto;
}
.local-md-mode-menu.local-md-mode-menu-open .local-md-mode-popover {
  display: grid;
}
.local-md-mode-popover {
  right: auto;
  left: 0;
  min-width: 205px;
}
.local-md-app-menu-trigger {
  min-width: 116px;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 650;
}
.local-md-app-menu-trigger .local-md-icon:last-child { margin-left: 6px; width: 16px; height: 16px; }
.local-md-app-menu.local-md-app-menu-open .local-md-app-menu-popover { display: grid; }
.local-md-app-menu-popover {
  min-width: 260px;
  padding: 6px;
}
.local-md-app-menu-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 20px;
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 6px;
  padding: 7px 10px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  text-align: left;
}
.local-md-app-menu-item:hover,
.local-md-app-menu-item:focus-visible { background: color-mix(in srgb, var(--line-soft) 70%, transparent); }
.local-md-app-menu-item:disabled { color: var(--ink-muted); cursor: default; }
.local-md-app-menu-item:disabled:hover { background: transparent; }
.local-md-app-menu-item kbd { color: var(--ink-muted); font: 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.local-md-app-menu-label { padding: 7px 10px 4px; color: var(--ink-muted); font-size: 12px; font-weight: 700; letter-spacing: .03em; }
.local-md-app-menu-separator { width: 100%; height: 1px; margin: 5px 0; border: 0; background: var(--line-soft); }
.local-md-save-menu {
  display: inline-flex;
  margin-left: auto;
}
button.local-md-toolbar-save,
button.local-md-save-options {
  flex: 0 0 auto;
  height: 34px;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--paper);
}
button.local-md-toolbar-save {
  padding: 0 11px;
  border-radius: var(--radius) 0 0 var(--radius);
}
button.local-md-save-options {
  display: grid;
  place-items: center;
  width: 30px;
  padding: 0;
  border-left-color: color-mix(in srgb, var(--paper) 34%, var(--accent));
  border-radius: 0 var(--radius) var(--radius) 0;
}
button.local-md-save-options .local-md-icon { width: 16px; height: 16px; margin: 0; }
button.local-md-toolbar-save:hover,
button.local-md-save-options:hover { background: var(--accent-hover); }
button {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-raised);
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  padding: 7px 11px;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    color 120ms ease,
    box-shadow 120ms ease;
}
button:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: var(--accent-soft);
  color: var(--accent-hover);
}
button:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 62%, transparent);
  outline-offset: 2px;
}
button[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--paper);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
}
button[data-testid="save"] {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--paper);
}
button[data-testid="save"]:hover {
  background: var(--accent-hover);
}
.local-md-actions .local-md-toolbar-button,
.local-md-actions .local-md-mode-trigger {
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  padding: 0 8px;
  box-shadow: none;
}
@media (max-width: 620px) {
  .local-md-mode-trigger { min-width: 34px; width: 38px; padding: 0; }
  .local-md-mode-trigger span { display: none; }
  .local-md-mode-trigger .local-md-icon:last-child { display: none; }
}
@media (max-width: 480px) {
  .local-md-mode-toggle button { min-width: 0; padding: 0 7px; font-size: 12px; }
}
.local-md-actions .local-md-toolbar-button:hover,
.local-md-actions .local-md-toolbar-button:focus-visible,
.local-md-actions .local-md-mode-trigger:hover,
.local-md-actions .local-md-mode-trigger:focus-visible {
  border: 0;
  background: color-mix(in srgb, var(--line-soft) 68%, transparent);
  color: var(--ink);
  box-shadow: none;
}
.local-md-actions .local-md-mode-trigger[aria-expanded="true"] {
  border: 0;
  background: transparent;
  color: var(--ink);
  box-shadow: none;
}
[data-testid="save-status"] {
  width: 1px;
  height: 1px;
  overflow: hidden;
  color: transparent;
}
.local-md-toast-region {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 80;
  display: grid;
  gap: 8px;
  width: min(420px, calc(100vw - 36px));
  pointer-events: none;
}
.local-md-repository-cta {
  position: fixed;
  z-index: 60;
  bottom: 18px;
  left: 18px;
  display: grid;
  gap: 8px;
  width: min(350px, calc(100vw - 36px));
  padding: 12px 38px 12px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  box-shadow: var(--shadow-soft);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
.local-md-repository-cta a {
  color: var(--accent);
  font-weight: 700;
  text-decoration: underline;
}
.local-md-repository-cta a:hover { color: var(--accent-hover); }
.local-md-repository-cta-close {
  position: absolute;
  top: 6px;
  right: 7px;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 20px;
  line-height: 1;
}
.local-md-repository-cta-close:hover {
  background: var(--surface);
  color: var(--ink);
}
.local-md-toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius);
  background: var(--surface-raised);
  color: var(--ink);
  box-shadow: var(--shadow-soft);
  padding: 10px 12px;
  pointer-events: auto;
}
.local-md-toast[hidden] {
  display: none;
}
.local-md-toast span {
  min-width: 0;
  font-size: 14px;
}
.local-md-toast button {
  flex: 0 0 auto;
  height: 30px;
  border-color: var(--accent);
  background: var(--accent);
  color: var(--paper);
  padding: 0 10px;
}
.local-md-toast-conflict {
  border-color: color-mix(in srgb, var(--warm) 54%, var(--line));
}
.local-md-toast-conflict button:first-of-type {
  border-color: var(--line);
  background: transparent;
  color: var(--accent);
}
.local-md-asset-access-toast {
  animation: local-md-asset-access-enter 220ms ease-out;
}
.local-md-asset-access-toast .local-md-toast-dismiss {
  width: 28px;
  padding: 0;
  border-color: transparent;
  background: transparent;
  color: var(--muted);
  font-size: 20px;
  line-height: 1;
}
.local-md-asset-access-toast .local-md-toast-dismiss:hover {
  background: var(--surface);
  color: var(--ink);
}
@keyframes local-md-asset-access-enter {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .local-md-asset-access-toast { animation: none; }
}
.local-md-llm-prompt {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 70;
  display: grid;
  gap: 8px;
  width: min(340px, calc(100vw - 36px));
  border: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
  border-radius: var(--radius);
  background: var(--surface-raised);
  box-shadow: var(--shadow-soft);
  padding: 10px 12px;
  transition: width 160ms ease;
}
.local-md-llm-prompt[hidden] {
  display: none;
}
.local-md-llm-prompt-expanded {
  width: min(520px, calc(100vw - 36px));
}
.local-md-llm-prompt-header {
  padding-right: 32px;
}
.local-md-llm-prompt strong {
  display: block;
  font-size: 15px;
  line-height: 1.2;
}
.local-md-llm-prompt p {
  display: none;
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.35;
}
.local-md-llm-prompt-expanded p {
  display: block;
  margin-top: 2px;
}
.local-md-llm-prompt textarea {
  display: none;
  width: 100%;
  min-height: 156px;
  max-height: 260px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--paper);
  color: var(--ink);
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 8px 10px;
}
.local-md-llm-prompt-expanded textarea {
  display: block;
}
.local-md-llm-prompt-actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}
.local-md-llm-prompt button {
  display: grid;
  place-items: center;
  border-color: var(--line);
  background: transparent;
  color: var(--accent);
}
.local-md-llm-prompt-actions button {
  grid-auto-flow: column;
  gap: 6px;
  width: auto;
  height: 32px;
  padding: 0 10px;
}
.local-md-llm-prompt-actions button:hover {
  background: color-mix(in srgb, var(--line) 34%, transparent);
}
.local-md-llm-prompt-actions button span {
  font-size: 13px;
}
.local-md-llm-prompt-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 30px;
  height: 30px;
  padding: 0;
}
.local-md-properties {
  width: min(100%, calc(1012px + 420px + 16px));
  margin-right: auto;
  margin-left: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  margin-bottom: 14px;
  padding: 12px;
}
.local-md-properties-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 13px;
}
.local-md-properties-header strong {
  color: var(--ink);
  font-size: 14px;
}
[data-testid="frontmatter-source"] {
  width: 100%;
  min-height: 88px;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-raised);
  color: var(--ink);
  font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  padding: 10px;
}
[data-testid="frontmatter-source"]:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 16%, transparent);
}
.local-md-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1012px) minmax(280px, 420px);
  gap: 16px;
  align-items: start;
  justify-content: center;
  width: 100%;
}
.local-md-document-pane {
  min-width: 0;
  max-width: 1012px;
}
.local-md-frontmatter-header {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  width: 100%;
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: var(--radius) var(--radius) 0 0;
  background: var(--paper);
  box-shadow: 0 18px 48px rgb(20 20 20 / 10%);
  padding: clamp(18px, 3vw, 30px) clamp(20px, 5vw, 52px) 14px;
}
.local-md-frontmatter-header[hidden] {
  display: none;
}
.local-md-frontmatter-header:not([hidden]) + [data-testid="rendered-editor"] {
  min-height: calc(72vh - 120px);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  box-shadow: none;
  padding-top: 0;
}
.local-md-frontmatter-media {
  display: grid;
  place-items: center;
  width: 74px;
  height: 74px;
  overflow: hidden;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
}
.local-md-frontmatter-image {
  display: block;
  width: 100%;
  height: 100%;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}
.local-md-frontmatter-placeholder {
  color: var(--muted);
  letter-spacing: 0;
}
.local-md-frontmatter-meta {
  min-width: 0;
}
.local-md-frontmatter-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: baseline;
  min-width: 0;
}
.local-md-frontmatter-row + .local-md-frontmatter-row {
  margin-top: 6px;
}
.local-md-frontmatter-author,
.local-md-frontmatter-date {
  color: color-mix(in srgb, var(--ink) 70%, var(--muted));
  font-size: 14px;
  line-height: 1.25;
  font-weight: 500;
}
.local-md-frontmatter-date {
  white-space: nowrap;
  text-align: right;
}
.local-md-frontmatter-slug {
  overflow-wrap: anywhere;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.22;
  font-weight: 400;
}
.local-md-frontmatter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: flex-end;
  margin-top: 7px;
}
.local-md-frontmatter-tag {
  border: 1px solid color-mix(in srgb, var(--rams-red) 46%, var(--line));
  border-radius: 999px;
  background: transparent;
  color: color-mix(in srgb, var(--ink) 72%, var(--muted));
  font-size: 12px;
  line-height: 1.2;
  padding: 2px 8px 3px;
}
.local-md-comments {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.local-md-comments-positioned {
  position: relative;
  display: block;
}
.local-md-comment-card {
  position: relative;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-raised);
  padding: 16px;
  box-shadow: var(--shadow-soft);
  transition:
    transform 180ms ease,
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.local-md-comments-positioned .local-md-comment-card {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  transform: translate(var(--comment-x, 0), var(--comment-y, 0));
}
.local-md-comments-positioned .local-md-comment-card-placing {
  transition:
    background 180ms ease,
    border-color 180ms ease,
    box-shadow 180ms ease;
}
.local-md-comment-card-active {
  --comment-x: -12px;
  border-color: var(--ink);
  background: #fffefa;
  box-shadow: var(--shadow-active);
}
.local-md-comments:not(.local-md-comments-positioned) .local-md-comment-card-active {
  transform: translateX(-8px);
}
.local-md-workspace-compact-comments {
  position: relative;
}
.local-md-workspace-compact-comments .local-md-comments.local-md-comments-compact {
  position: absolute;
  z-index: 12;
  top: 0;
  left: 50%;
  width: 80vw;
  min-height: 0 !important;
  pointer-events: none;
  transform: translateX(-50%);
}
.local-md-workspace-compact-comments .local-md-comments-compact .local-md-comment-card {
  right: auto;
  left: 0;
  width: 100%;
  box-sizing: border-box;
  pointer-events: auto;
  transform: translate(0, var(--comment-y, 0px));
}
.local-md-workspace-compact-comments .local-md-comments-compact .local-md-comment-card:not(.local-md-comment-card-active) {
  display: none;
}
.local-md-comment-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
}
.local-md-comment-card:not(.local-md-suggestion-discussion-card) > .local-md-comment-card-header,
.local-md-review-comment-box > .local-md-comment-card-header {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  justify-content: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}
.local-md-comment-card:not(.local-md-suggestion-discussion-card):hover > .local-md-comment-card-header,
.local-md-comment-card:not(.local-md-suggestion-discussion-card):focus-within > .local-md-comment-card-header,
.local-md-comment-card-active:not(.local-md-suggestion-discussion-card) > .local-md-comment-card-header,
.local-md-review-comment-box:hover > .local-md-comment-card-header,
.local-md-review-comment-box:focus-within > .local-md-comment-card-header,
.local-md-review-comment-box-active > .local-md-comment-card-header {
  opacity: 1;
  pointer-events: auto;
}
.local-md-review-actions {
  display: flex;
  gap: 6px;
}
.local-md-review-actions button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  padding: 0;
  font-size: 20px;
  line-height: 1;
}
.local-md-review-actions button:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
.local-md-review-actions button[data-action="discard-review-suggestion"]:hover,
.local-md-review-actions button[data-action="discard-review-suggestion"]:focus-visible {
  background: var(--danger-soft);
  color: var(--danger);
}
.local-md-comment-inline-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}
.local-md-comment-reply .local-md-comment-inline-actions,
.local-md-review-comment-box .local-md-comment-inline-actions {
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
}
.local-md-comment-reply:hover .local-md-comment-inline-actions,
.local-md-comment-reply:focus-within .local-md-comment-inline-actions,
.local-md-review-comment-box:hover .local-md-comment-inline-actions,
.local-md-review-comment-box:focus-within .local-md-comment-inline-actions,
.local-md-review-comment-box-active .local-md-comment-inline-actions {
  opacity: 1;
  pointer-events: auto;
}
.local-md-comment-icon-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  padding: 0;
}
.local-md-comment-icon-button:hover {
  background: var(--accent-soft);
  color: var(--accent);
}
.local-md-comment-icon-button[data-action*="remove"]:hover,
.local-md-comment-icon-button[data-action*="remove"]:focus-visible {
  background: var(--danger-soft);
  color: var(--danger);
}
.local-md-comment-body {
  margin: 0;
  font-size: 15px;
  line-height: 1.45;
  min-height: 1.45em;
  overflow-wrap: anywhere;
}
.local-md-review-discussion-section {
  margin-top: 12px;
}
.local-md-review-discussion-section + .local-md-review-discussion-section {
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}
.local-md-review-discussion-section h3 {
  margin: 0 0 8px;
  color: var(--muted);
  font-size: 12px;
}
.local-md-review-discussion-section p {
  margin: 6px 0;
  line-height: 1.45;
}
.local-md-review-comment-box {
  position: relative;
  margin: 8px 0;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-raised);
  padding: 10px;
  box-shadow: 0 1px 2px rgb(20 20 20 / 6%);
}
.local-md-review-comment-box-active {
  border-color: color-mix(in srgb, var(--warm) 50%, var(--line));
  box-shadow: 0 2px 8px rgb(20 20 20 / 10%);
}
.local-md-review-comment-box .local-md-comment-body {
  margin-bottom: 0;
}
.local-md-review-comment-box[data-review-comment-id] {
  cursor: pointer;
}
.local-md-review-comment-box[data-review-comment-id]:hover {
  border-color: color-mix(in srgb, var(--warm) 45%, var(--line));
}
.local-md-muted {
  color: var(--muted);
}
.local-md-comment-card textarea {
  width: 100%;
  min-height: 46px;
  resize: none;
  border: 1px solid color-mix(in srgb, var(--muted) 45%, var(--line));
  border-radius: var(--radius);
  background: var(--paper);
  color: var(--ink);
  font: 16px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 8px 10px;
  overflow: hidden;
}
.local-md-comment-card textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}
.local-md-comment-card [data-testid="comment-reply-input"] {
  min-height: 40px;
  margin-top: 14px;
  border-radius: var(--radius);
  border-color: var(--line-soft);
  background: color-mix(in srgb, var(--paper) 80%, var(--surface));
  font-size: 15px;
  padding: 9px 12px;
}
.local-md-comment-card [data-testid="comment-reply-input"]::placeholder {
  color: color-mix(in srgb, var(--muted) 78%, transparent);
}
.local-md-comment-card [data-testid="comment-reply-input"]:not(:focus):placeholder-shown {
  cursor: text;
}
.local-md-comment-replies,
.local-md-comment-children {
  display: grid;
  gap: 8px;
  margin: 14px 0 4px;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--line) 70%, transparent);
}
.local-md-comment-reply {
  position: relative;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--accent-soft) 68%, var(--paper));
  padding: 10px 12px;
  line-height: 1.4;
}
.local-md-child-comment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: var(--muted);
  font-size: 12px;
  margin-bottom: 4px;
}
.local-md-comment-reply p {
  margin: 0;
}
.local-md-suggestions {
  display: grid;
  gap: 10px;
  margin: 14px 0 4px;
}
.local-md-suggestion {
  border: 1px solid color-mix(in srgb, var(--warm) 32%, var(--line));
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--suggestion-soft) 70%, var(--surface-raised));
  padding: 10px;
}
.local-md-suggestion-previewing {
  border-color: var(--warm);
  background: var(--suggestion-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warm) 25%, transparent);
}
.local-md-suggestion-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}
.local-md-suggestion-header strong {
  font-size: 14px;
}
.local-md-suggestion-actions {
  display: flex;
  gap: 6px;
}
.local-md-suggestion-actions button {
  padding: 4px 7px;
  font-size: 12px;
}
.local-md-suggestion pre {
  margin: 0;
  white-space: pre-wrap;
  font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.local-md-comment-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
}
.local-md-comment-card-actions[hidden] {
  display: none;
}
.local-md-comment-card-actions button {
  padding: 6px 9px;
  font-size: 14px;
}
.local-md-text-button {
  border-color: transparent;
  background: transparent;
  color: var(--accent);
  font-size: 15px;
}
.local-md-primary-button {
  min-width: 74px;
  border-color: var(--accent);
  border-radius: var(--radius);
  background: var(--accent);
  color: var(--paper);
  font-size: 15px;
  padding: 9px 18px;
}
.local-md-primary-button:hover {
  background: var(--accent-hover);
  color: var(--paper);
}
.local-md-primary-button:disabled {
  border-color: var(--line-soft);
  background: var(--line-soft);
  color: var(--muted);
  cursor: default;
}
.local-md-icon-button {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 0;
}
.local-md-icon {
  width: 18px;
  height: 18px;
  display: block;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}
.local-md-selection-toolbar {
  position: fixed;
  z-index: 20;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-active);
}
.local-md-selection-toolbar[hidden] {
  display: none;
}
.local-md-selection-toolbar button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  padding: 0;
}
.local-md-selection-toolbar button:hover {
  background: var(--accent-soft);
}
.local-md-comment-range {
  border-radius: 4px;
  background: var(--suggestion-soft);
  box-shadow: 0 0 0 2px var(--suggestion-soft);
}
::highlight(local-md-comment-range-current) {
  background: color-mix(in srgb, var(--suggestion-soft) 86%, transparent);
  color: inherit;
}
::highlight(local-md-comment-range-active) {
  background: color-mix(in srgb, var(--suggestion) 88%, transparent);
  color: inherit;
}
::highlight(local-md-comment-range-stale) {
  background: color-mix(in srgb, var(--rams-cream) 82%, transparent);
  color: inherit;
}
::highlight(local-md-comment-range-broken) {
  background: color-mix(in srgb, var(--danger-soft) 92%, transparent);
  color: inherit;
}
::highlight(local-md-comment-block-current) {
  background: color-mix(in srgb, var(--suggestion-soft) 56%, transparent);
  color: inherit;
}
::highlight(local-md-comment-block-active) {
  background: color-mix(in srgb, var(--suggestion) 72%, transparent);
  color: inherit;
}
::highlight(local-md-comment-block-stale) {
  background: color-mix(in srgb, var(--rams-cream) 70%, transparent);
  color: inherit;
}
::highlight(local-md-comment-block-broken) {
  background: color-mix(in srgb, var(--danger-soft) 76%, transparent);
  color: inherit;
}
::highlight(local-md-diff-insert),
::highlight(local-md-diff-replace) {
  background: color-mix(in srgb, #e8eadf 52%, transparent);
  color: inherit;
  text-decoration-line: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 58%, #7f8a62);
  text-decoration-thickness: 2px;
  text-underline-offset: 0.18em;
}
.local-md-comment-range.local-md-comment-stale {
  background: var(--rams-cream);
  box-shadow: 0 0 0 2px var(--rams-cream);
}
.local-md-comment-range.local-md-comment-broken {
  background: var(--danger-soft);
  box-shadow: 0 0 0 2px var(--danger-soft);
}
.local-md-comment-anchor,
.local-md-block-comment {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2em;
  color: var(--warm);
  cursor: pointer;
  font-weight: 700;
  user-select: none;
}
.local-md-comment-anchor {
  border: 1px solid color-mix(in srgb, currentColor 42%, transparent);
  border-radius: 999px;
  background: var(--surface-raised);
  font-size: 0.78em;
  line-height: 1;
  margin-left: 0.12em;
  padding: 0.08em 0.32em;
  vertical-align: super;
}
.local-md-comment-anchor[data-comment-id] a {
  color: inherit;
  text-decoration: none;
}
.local-md-block-comment {
  border-right: 4px solid currentColor;
  margin-left: 0.2em;
  padding-right: 0.2em;
}
.local-md-comment-stale {
  color: #7a5a21;
}
.local-md-comment-broken {
  color: var(--danger);
}
[data-testid="rendered-editor"],
.local-md-markdown-layer {
  width: 100%;
  min-height: 72vh;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: 0 1px 0 rgb(255 255 255 / 45%), 0 18px 48px rgb(20 20 20 / 10%);
}
[data-testid="rendered-editor"] {
  padding: clamp(20px, 5vw, 52px);
  line-height: 1.55;
}
[data-testid="rendered-editor"]:focus,
[data-testid="rendered-editor"]:focus-visible {
  outline: none;
}
[data-testid="markdown-editor"] {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  min-height: 72vh;
  overflow: hidden;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--ink);
  padding: 18px;
  font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: none;
  caret-color: var(--ink);
}
.local-md-markdown-layer {
  position: relative;
  overflow: hidden;
}
.local-md-markdown-layer[hidden] {
  display: none;
}
.local-md-markdown-highlights {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  min-height: 72vh;
  padding: 18px;
  color: transparent;
  font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  pointer-events: none;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.local-md-markdown-highlights mark {
  border-radius: 3px;
  color: transparent;
}
.local-md-markdown-highlight-current {
  background: var(--suggestion-soft);
}
.local-md-markdown-highlight-active {
  background: var(--suggestion);
}
.local-md-markdown-highlight-stale {
  background: var(--rams-cream);
}
.local-md-markdown-highlight-broken {
  background: var(--danger-soft);
}
.local-md-textarea-measure {
  box-sizing: border-box;
}
[data-testid="rendered-editor"] > :first-child { margin-top: 0; }
.local-md-html-comment-block {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: 1.2em 0;
  border-left: 2px solid var(--rams-tan);
  background: color-mix(in srgb, var(--surface) 70%, transparent);
  color: var(--muted);
  padding: 8px 10px;
  user-select: all;
}
.local-md-html-comment-block span {
  color: color-mix(in srgb, var(--muted) 78%, var(--ink));
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.local-md-html-comment-block code {
  min-width: 0;
  overflow-wrap: anywhere;
  background: transparent;
  color: var(--ink);
  padding: 0;
}
[data-testid="rendered-editor"] .local-md-review-suggestion {
  background: transparent;
  box-shadow: inset -2px 0 0 color-mix(in srgb, var(--rams-tan) 78%, var(--line));
  transition: box-shadow 160ms ease;
}
[data-testid="rendered-editor"] .local-md-review-suggestion-active {
  box-shadow: inset -4px 0 0 var(--warm);
}
[data-testid="rendered-editor"] li.local-md-review-suggestion {
  margin-block: 0;
  padding-block: 0;
  background: transparent;
}
[data-testid="rendered-editor"] .local-md-review-suggestion table {
  margin: 0;
}
[data-testid="rendered-editor"] .local-md-image-comparison {
  --local-md-image-reveal: 0%;
  width: 100%;
  box-shadow: none;
}
.local-md-image-comparison-stage {
  position: relative;
  display: block;
  width: 100%;
  overflow: hidden;
  isolation: isolate;
  cursor: ew-resize;
}
.local-md-image-comparison-original {
  position: absolute;
  z-index: 1;
  inset: 0;
}
.local-md-image-comparison-suggestion {
  position: relative;
  z-index: 2;
  clip-path: inset(0 calc(100% - var(--local-md-image-reveal)) 0 0);
}
.local-md-image-comparison-original > img,
.local-md-image-comparison-suggestion > img,
.local-md-image-comparison-original > svg,
.local-md-image-comparison-suggestion > svg,
.local-md-image-comparison-original > .local-md-image-comment-frame,
.local-md-image-comparison-suggestion > .local-md-image-comment-frame {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100%;
  object-fit: contain;
}
.local-md-image-comparison-markers {
  position: absolute;
  z-index: 5;
  inset: 0;
  pointer-events: none;
}
.local-md-image-comparison-stage > .local-md-image-comment-anchor {
  z-index: 6;
}
.local-md-image-comparison-slider {
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  left: var(--local-md-image-reveal);
  display: none;
  width: 32px;
  border: 0;
  outline: 0;
  cursor: ew-resize;
  touch-action: none;
  transform: translateX(-50%);
}
.local-md-review-suggestion-active .local-md-image-comparison-slider {
  display: block;
}
.local-md-image-comparison-slider::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 0 0 1px rgb(20 20 20 / 38%), 0 1px 5px rgb(20 20 20 / 28%);
  content: "";
  transform: translateX(-50%);
}
.local-md-image-comparison-label {
  position: absolute;
  top: 10px;
  left: 50%;
  width: 1px;
  height: 1px;
  pointer-events: none;
}
.local-md-image-comparison-label span {
  position: absolute;
  top: 0;
  padding: 5px 7px;
  border: 1px solid rgb(255 255 255 / 52%);
  border-radius: 6px;
  background: var(--rams-blue);
  box-shadow: 0 2px 7px rgb(20 20 20 / 28%);
  color: #fffdf8;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.01em;
  line-height: 1;
  text-shadow: none;
  text-decoration: none !important;
  white-space: nowrap;
}
.local-md-image-comparison-label span:first-child {
  right: 15px;
}
.local-md-image-comparison-label span:last-child {
  left: 15px;
  border-color: color-mix(in srgb, var(--warm) 72%, white);
  background: var(--warm);
}
.local-md-image-comparison-knob {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  border: 2px solid rgb(255 255 255 / 94%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--warm) 88%, var(--paper));
  box-shadow: 0 0 0 1px rgb(20 20 20 / 32%), 0 3px 10px rgb(20 20 20 / 28%);
  transform: translate(-50%, -50%);
}
.local-md-image-comparison-knob::before,
.local-md-image-comparison-knob::after {
  position: absolute;
  top: 50%;
  width: 0;
  height: 0;
  border-block: 4px solid transparent;
  content: "";
  transform: translateY(-50%);
}
.local-md-image-comparison-knob::before {
  left: 5px;
  border-right: 5px solid var(--paper);
}
.local-md-image-comparison-knob::after {
  right: 5px;
  border-left: 5px solid var(--paper);
}
.local-md-image-comparison-slider:focus-visible .local-md-image-comparison-knob {
  outline: 3px solid color-mix(in srgb, var(--accent) 62%, transparent);
  outline-offset: 2px;
}
[data-testid="rendered-editor"] blockquote.local-md-review-suggestion {
  margin-left: 0;
  padding-left: 1em;
  border-left: 4px solid var(--accent);
  background: transparent;
}
[data-testid="rendered-editor"] pre.local-md-review-suggestion {
  padding: 14px;
  background: #202528;
}
[data-testid="rendered-editor"] pre.local-md-review-suggestion code {
  color: #f7f2e8;
}
[data-testid="rendered-editor"] .local-md-review-suggestion > :first-child {
  margin-top: 0;
}
[data-testid="rendered-editor"] .local-md-review-suggestion > :last-child {
  margin-bottom: 0;
}
[data-testid="rendered-editor"] .local-md-review-empty-suggestion {
  min-height: 1.6em;
  color: var(--muted);
  font-style: italic;
}
.local-md-diff-marker {
  position: absolute;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 22px;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--danger);
  cursor: default;
  line-height: 1;
  padding: 0;
}
.local-md-diff-marker:hover,
.local-md-diff-marker:focus-visible {
  background: transparent;
  outline: 0;
}
.local-md-diff-marker:hover::before,
.local-md-diff-marker:focus-visible::before {
  position: absolute;
  z-index: 19;
  bottom: calc(100% + 1px);
  left: 50%;
  width: 1px;
  height: 8px;
  background: color-mix(in srgb, var(--danger) 76%, var(--rams-tan));
  content: "";
  transform: translateX(-50%);
}
.local-md-diff-marker-icon {
  display: block;
  width: 14px;
  height: 22px;
  overflow: visible;
  filter: drop-shadow(0 1px 0 var(--paper)) drop-shadow(0 1px 1px color-mix(in srgb, var(--danger) 14%, transparent));
}
.local-md-diff-marker-head {
  fill: var(--paper);
  stroke: currentColor;
  stroke-width: 1.15;
}
.local-md-diff-marker-stem {
  opacity: 0.86;
}
.local-md-diff-marker-x {
  color: var(--danger);
}
.local-md-diff-marker:hover::after,
.local-md-diff-marker:focus-visible::after {
  position: absolute;
  z-index: 20;
  bottom: calc(100% + 8px);
  left: 50%;
  min-width: max-content;
  max-width: min(280px, 34ch);
  border: 1px solid color-mix(in srgb, var(--danger) 38%, var(--rams-tan));
  border-radius: 10px;
  background: color-mix(in srgb, var(--paper) 92%, var(--rams-cream));
  box-shadow: 0 4px 10px color-mix(in srgb, var(--ink) 9%, transparent);
  color: var(--ink);
  content: attr(data-original);
  font-size: 0.82rem;
  font-weight: 400;
  line-height: 1.35;
  padding: 5px 11px 6px;
  text-align: center;
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--danger) 82%, var(--ink));
  text-decoration-thickness: 1.5px;
  text-underline-offset: -0.25em;
  transform: translateX(-50%);
  white-space: nowrap;
}
[data-testid="rendered-editor"] img {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
}
[data-testid="rendered-editor"] img[data-markleft-asset-placeholder="true"] {
  min-height: 140px;
  border-radius: var(--radius);
  background: var(--surface);
  cursor: pointer;
}
.local-md-image-comment-frame {
  position: relative;
  display: block;
  max-width: 100%;
}
.local-md-image-comment-frame > img,
.local-md-image-comment-frame > svg {
  cursor: crosshair;
}
.local-md-image-comment-anchor {
  position: absolute;
  z-index: 2;
  width: 26px;
  height: 26px;
  border: 2px solid var(--warm);
  border-radius: 999px;
  background: var(--suggestion-soft);
  color: var(--warm);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  transform: translate(-50%, -50%);
  box-shadow: 0 2px 10px rgb(20 20 20 / 20%);
  margin: 0;
  vertical-align: baseline;
}
.local-md-image-comment-anchor a {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
.local-md-image-comment-anchor-active {
  border-color: var(--rams-orange);
  background: var(--suggestion);
  color: var(--ink);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--suggestion-soft) 72%, transparent), 0 3px 12px rgb(20 20 20 / 24%);
}
h1 {
  border-bottom: 1px solid var(--line);
  line-height: 1.15;
  padding-bottom: 0.2em;
}
[data-testid="rendered-editor"] table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  scrollbar-width: thin;
}
[data-testid="rendered-editor"] th,
[data-testid="rendered-editor"] td {
  border: 1px solid var(--line);
  padding: 8px 10px;
  vertical-align: top;
  overflow-wrap: break-word;
}
[data-testid="rendered-editor"] th code,
[data-testid="rendered-editor"] td code {
  white-space: nowrap;
}
blockquote {
  margin-left: 0;
  border-left: 4px solid var(--accent);
  color: var(--muted);
  padding-left: 1em;
}
pre {
  overflow: auto;
  border-radius: var(--radius);
  background: #202528;
  color: #f7f2e8;
  padding: 14px;
}
code {
  border-radius: 4px;
  background: var(--surface);
  padding: 0.12em 0.3em;
}
pre code {
  background: transparent;
  padding: 0;
}
.local-md-mermaid {
  margin: 16px 0;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface-raised);
  padding: 16px;
}
.local-md-mermaid-output {
  display: flex;
  justify-content: center;
  min-width: 0;
}
.local-md-mermaid svg {
  max-width: 100%;
  height: auto;
}
pre.local-md-mermaid-error {
  border: 1px solid var(--danger);
}
.local-md-error {
  color: var(--danger);
  font-weight: 600;
}
@media (min-width: 1604px) {
  .local-md-properties {
    width: min(100%, calc(1012px + 840px + 32px));
    padding-right: calc(420px + 16px);
  }
  .local-md-workspace {
    grid-template-columns: minmax(280px, 420px) minmax(0, 1012px) minmax(280px, 420px);
  }
  .local-md-document-pane {
    grid-column: 2;
  }
  .local-md-comments {
    grid-column: 3;
  }
}
@media (max-width: 860px) {
  .local-md-workspace {
    grid-template-columns: 1fr;
  }
  .local-md-frontmatter-header {
    grid-template-columns: 74px minmax(0, 1fr);
    gap: 12px;
  }
  .local-md-frontmatter-media {
    width: 74px;
  }
  .local-md-frontmatter-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .local-md-frontmatter-date {
    text-align: left;
  }
  .local-md-frontmatter-tags {
    justify-content: flex-start;
    margin-top: 2px;
  }
  .local-md-comments {
    position: static;
    max-height: none;
  }
}
`;
