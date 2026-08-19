import { makeEditable, stampBlocks } from "./editor/blocks";
import { getSelectionState, type SelectionState } from "./editor/caret";
import {
  activeCommentIdFromSelection,
  decorateRenderedComments,
  renderedCommentAnchorRect,
  resolveSelectionBlockEndToSourcePosition,
  resolveSelectionToSourceRange,
} from "./editor/comment-highlights";
import { trackComposition } from "./editor/input";
import {
  renderLocalNoteReferenceWidgets,
  restoreLocalNoteReferenceWidgets,
} from "./editor/local-note-widgets";
import { renderMermaidDiagrams } from "./editor/mermaid";
import { createReviewAnalysisCache } from "./editor/review-analysis";
import { syncRenderedToMarkdown, type SyncState } from "./editor/synchronize";
import {
  handleStorageKey,
  rememberDirectoryHandle,
  rememberFileHandle,
  restoreDirectoryHandles,
  restoreFileHandle,
} from "./file/handle-store";
import {
  canWriteWithoutPrompt,
  downloadFallback,
  pickDirectoryTarget,
  pickSaveTarget,
  suggestedFileNameFromLocation,
  writeFile,
  type WritableDirectoryHandle,
  type WritableFileHandle,
} from "./file/save";
import { serializeFile } from "./file/serialize";
import { loadMarkdown } from "./file/load";
import {
  activeCommentIdFromSourceRange,
  appendBlockOperationSuggestion,
  applyBlockOperationSuggestion,
  commentChildrenForComment,
  createChildComment,
  createBlockComment,
  createBlockSuggestionForSourceRange,
  createCodeComment,
  createImageComment,
  createRangeComment,
  createSvgComment,
  editCommentBody,
  extractCommentDefinitions,
  findCodeBlockAnchors,
  findImageAnchors,
  parseBlockSuggestions,
  parseComments,
  removeComment,
  sourceSelectionRangeForComment,
  stripCommentReferences,
  stripCommentDefinitions,
  unescapeCommentReferences,
} from "./markdown/comments";
import { composeMarkdown, splitFrontmatter } from "./markdown/frontmatter";
import { htmlToMarkdown } from "./markdown/from-html";
import { markdownToHtml } from "./markdown/to-html";
import { markdownBlockRanges } from "./roundtrip/blocks";
import {
  documentBlockIds,
  ensureDocumentBlockIds,
  blockIdForSourceRange,
  stripDocumentBlockIds,
} from "./roundtrip/block-ids";
import { createRoundtripReportCase, reportFileName } from "./roundtrip/report";

export interface LocalMdDebug {
  getSelectionState(): SelectionState;
  getMarkdown(): string;
  getSyncCount(): number;
}

declare global {
  interface Window {
    __localMdDebug?: LocalMdDebug;
    __localMdSourceIdentity?: {
      hash?: string;
      length?: number;
    };
    report?: () => Promise<void>;
  }
}

interface AppState extends SyncState {
  frontmatter: string;
  body: string;
  handle: WritableFileHandle | null;
  mode: "rendered" | "review" | "markdown";
  reviewDiffMode: ReviewDiffMode;
  composing: boolean;
  activeCommentId: string | null;
  includeBlockIds: boolean;
  isFallbackGuide: boolean;
}

interface MountAppOptions {
  isFallbackGuide?: boolean;
}

type ReviewDiffMode = "active" | "all" | "none";

interface FileSystemObserverRecord {
  type?: string;
  changedHandle?: WritableFileHandle;
}

interface FileSystemObserverLike {
  observe(handle: WritableFileHandle): Promise<void>;
  disconnect(): void;
}

interface LoadedFileIdentity {
  hash: string;
  acceptedHashes: string[];
  length: number;
  source: "bookmarklet";
}

type FileSystemObserverConstructor = new (
  callback: (records: FileSystemObserverRecord[], observer: FileSystemObserverLike) => void,
) => FileSystemObserverLike;

interface WatchedFileSnapshot {
  contents: string;
  lastModified: number | null;
}

function llmSavedDocumentPrompt(location: Location): string {
  const filePath = location.protocol === "file:" ? decodeFileUrlPath(location) : location.href;
  return `Read this Markdown document and all local-md footnote annotations. Then address every actionable annotation by editing the Markdown file and appending local-md reply or suggestion footnote definitions.

This is an edit task, not a read-only review. You are authorized and expected to write replies or suggestions into the file. Do not stop after summarizing the annotations. Do not modify, replace, delete, or reorder any existing document body content; the only permitted Markdown edits are new reply or suggestion footnote definitions appended at the end of the document.

Markdown file:
${filePath}

If the Markdown references images or SVG files with relative paths, treat those paths as files next to this Markdown document unless the path says otherwise. When a comment or suggestion concerns an image/SVG, inspect the referenced asset as part of the task. If you propose changing an image/SVG, create or edit a separate asset file next to the Markdown and make the suggestion footnote replace the Markdown image reference with the new relative path.

local-md comments use reserved footnote ids:
[^range-prev-N-chars-*] marks the N visible non-whitespace text characters before the footnote reference.
[^range-next-N-chars-*] marks the N visible non-whitespace text characters after the footnote reference.
[^block-*] marks the containing block.
[^image-X-Y-*] marks a point at normalized x/y coordinates in the preceding Markdown image, including SVG files rendered as images.
[^code-line-L-col-C-len-N-*] marks N code characters from 1-based line L, column C in the preceding fenced code block.
[^comment-*] is a child comment footnote. It starts with a Reply to [^parent-id] metadata line, followed by a blank line and the visible reply body.
When the document contains <!-- markleft:block id="b..." --> comments, those comments give stable ids to the real document blocks that follow them. Do not edit, remove, duplicate, or move those id comments.

For each annotation, first infer the human intent behind the comment. Decide whether it is a question, a request for a concrete content change, a request to inspect an image/code/table detail, a clarification request, or a general note. If the best response is an answer, explanation, or follow-up question, append a reply comment footnote. If the best response is a concrete document change, append a suggestion footnote. If both are needed, append both and keep them linked to the relevant annotation.

Treat every local-md annotation reference as review metadata, never as replacement content. Before writing replies or suggestions, inventory every actionable annotation and ensure each one is addressed by at least one appended reply or suggestion. When a source block contains annotation anchors such as [^range-prev-*], [^range-next-*], [^block-*], [^image-*], [^code-line-*], or [^comment-*], do not copy those anchors into the proposed replacement Markdown. The replacement must contain only the content that should remain after the suggestion is accepted.

To reply to an existing annotation or comment, append a new comment footnote definition only. Do not edit the parent footnote body. Use this shape:
[^comment-12345]: Reply to [^range-prev-20-chars-12345-abcd]
${"    "}
    Reply body Markdown.

Associate addressed annotations with a suggestion only through one final reference-only paragraph. After the replacement content, add one indented blank line followed by one indented paragraph containing only the existing annotation references addressed by that suggestion, separated by spaces. Do not put annotation references in headings, prose, tables, lists, code, image references, or any other part of the replacement. Do not invent or rename annotation references, and do not repeat the same reference within one suggestion.

Correct structure:
[^suggestion-s5-update-block-b55]:
    Replacement Markdown without local-md annotation anchors.
${"    "}
    [^range-prev-20-chars-12345-abcd] [^comment-67890-ef01]

For every actionable annotation, append a suggestion footnote definition at the end using one of these ids:
[^suggestion-s1-update-block-b55]: complete replacement Markdown for b55
[^suggestion-s2-insert-before-block-b55]: new Markdown inserted before b55
[^suggestion-s3-insert-after-block-b55]: new Markdown inserted after b55
[^suggestion-s4-delete-block-b55]: <!-- markleft:delete -->

Use a new unique s... suggestion id for every proposal and a new unique comment-NNNNN id for every reply. The final reference-only paragraph in a suggestion is association metadata and is not part of the proposed content. Every continuation line of a suggestion or reply footnote, including blank lines and relation metadata, must be indented by four spaces so it remains inside the footnote definition. For multiline block Markdown such as tables, put no content after the definition colon and indent every content line by four spaces. Emit a separate local suggestion for every affected block. Preserve every existing annotation definition and every original body anchor; excluding anchors from replacement content does not authorize removing them from the existing document. Finish only after the appended reply and suggestion definitions have been written to the Markdown file and all actionable annotations are addressed.`;
}

export async function mountApp(
  markdown: string,
  development: boolean,
  options: MountAppOptions = {},
): Promise<void> {
  const parts = splitFrontmatter(markdown);
  const state: AppState = {
    markdown: composeMarkdown(parts),
    frontmatter: parts.frontmatter,
    body: parts.body,
    dirty: false,
    syncCount: 0,
    handle: null,
    mode: "review",
    reviewDiffMode: "all",
    composing: false,
    activeCommentId: null,
    includeBlockIds: true,
    isFallbackGuide: options.isFallbackGuide === true,
  };
  const analyzeReview = createReviewAnalysisCache();
  const draftCommentIds = new Set<string>();
  const editingCommentIds = new Set<string>();
  const editingChildCommentIds = new Set<string>();
  const commentDrafts = new Map<string, string>();
  const replyDrafts = new Map<string, string>();
  const openReplyComposerIds = new Set<string>();
  const closeEmptyReplyComposerStatesExcept = (activeId: string | null) => {
    for (const id of openReplyComposerIds) {
      if (id !== activeId && !(replyDrafts.get(id)?.trim().length ?? 0)) {
        openReplyComposerIds.delete(id);
      }
    }
  };
  let pendingReviewOriginalBlockEdit: {
    startIndex: number;
    endIndex: number;
    focusTextOffset: number | null;
    insertedTextLength: number;
  } | null = null;
  let openedFileIdentityPromise: Promise<LoadedFileIdentity> | null = null;
  let activeReviewSuggestionId: string | null = null;
  let fileObserver: FileSystemObserverLike | null = null;
  let filePollTimer = 0;
  let fileWatchLastModified: number | null = null;
  let fileWatchLastContents: string | null = null;
  let fileWatchReloading = false;
  let pendingExternalFile: WatchedFileSnapshot | null = null;
  let llmPromptTimer = 0;
  let llmPromptHovered = false;

  const shell = document.createElement("main");
  shell.className = "local-md-shell";
  shell.innerHTML = `
    <div class="local-md-toolbar" data-local-md-wrapper="true">
      <button type="button" class="local-md-toolbar-save" data-testid="save">Save</button>
      <div class="local-md-brand">
        <span class="local-md-logo" aria-hidden="true">
          <svg viewBox="0 0 64 64" role="img">
            <rect x="6" y="6" width="52" height="52" rx="14" />
            <g transform="rotate(90 32 32)">
              <path class="local-md-logo-badge" d="M18 20h28c3.31 0 6 2.69 6 6v12c0 3.31-2.69 6-6 6H18c-3.31 0-6-2.69-6-6V26c0-3.31 2.69-6 6-6Z" />
              <path class="local-md-logo-mark" d="M18 38V26h4.2l3.8 4.95L29.8 26H34v12h-4v-6.18l-4 5.06-4-5.06V38h-4Z" />
              <path class="local-md-logo-arrow" d="M42 27v6h4.2L40 39.2 33.8 33H38v-6h4Z" />
            </g>
          </svg>
        </span>
        <strong>Local Markdown</strong>
      </div>
      <div class="local-md-actions">
        <div class="local-md-format-menu">
          <button type="button" class="local-md-toolbar-button local-md-format-trigger" data-format-trigger aria-expanded="false" aria-label="Paragraph style" title="Paragraph style">
            ${uiIcon("align-left")}
            <span data-format-label>Normal</span>
            ${uiIcon("chevron-down")}
          </button>
          <div class="local-md-format-popover">
            <button type="button" data-toolbar-command="paragraph">${uiIcon("align-left")}<span>Normal</span></button>
            <button type="button" data-toolbar-command="heading-1"><span class="local-md-heading-token">H1</span><span>Heading 1</span></button>
            <button type="button" data-toolbar-command="heading-2"><span class="local-md-heading-token">H2</span><span>Heading 2</span></button>
            <button type="button" data-toolbar-command="heading-3"><span class="local-md-heading-token">H3</span><span>Heading 3</span></button>
          </div>
        </div>
        <span class="local-md-toolbar-separator" aria-hidden="true"></span>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="bold" aria-label="Bold" title="Bold"><strong>B</strong></button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="italic" aria-label="Italic" title="Italic"><em>I</em></button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="underline" aria-label="Underline" title="Underline"><span class="local-md-underline-token">U</span></button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="strike" aria-label="Strikethrough" title="Strikethrough"><span class="local-md-strike-token">S</span></button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="inline-code" aria-label="Inline code" title="Inline code">${uiIcon("code")}</button>
        <span class="local-md-toolbar-separator" aria-hidden="true"></span>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="ordered-list" aria-label="Numbered list" title="Numbered list">${uiIcon("list-numbers")}</button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="unordered-list" aria-label="Bulleted list" title="Bulleted list">${uiIcon("list")}</button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="task-list" aria-label="Task list" title="Task list">${uiIcon("list-check")}</button>
        <span class="local-md-toolbar-separator" aria-hidden="true"></span>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="blockquote" aria-label="Quote" title="Quote">${uiIcon("blockquote")}</button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="code-block" aria-label="Code block" title="Code block">${uiIcon("code-box")}</button>
        <span class="local-md-toolbar-separator" aria-hidden="true"></span>
        <button type="button" class="local-md-toolbar-button" data-testid="add-comment" data-toolbar-command="comment" aria-label="Create annotation" title="Create annotation">${uiIcon("message-plus")}</button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="link" aria-label="Insert link" title="Insert link">${uiIcon("link")}</button>
        <button type="button" class="local-md-toolbar-button" data-toolbar-command="image" aria-label="Insert image" title="Insert image">${uiIcon("image")}</button>
        <span class="local-md-toolbar-separator" aria-hidden="true"></span>
        <div class="local-md-mode-menu" aria-label="Editor mode">
          <button type="button" class="local-md-toolbar-button local-md-mode-trigger" data-mode-trigger aria-expanded="false" aria-label="Editor mode" title="Editor mode">
            ${uiIcon("suggestion")}
            <span data-mode-label>Suggestions</span>
            ${uiIcon("chevron-down")}
          </button>
          <div class="local-md-mode-popover">
            <button type="button" data-testid="mode-rendered" aria-pressed="false" title="Editing">${uiIcon("pencil")}<span>Editing</span></button>
            <button type="button" data-testid="mode-review" aria-pressed="true" title="Suggestions">${uiIcon("suggestion")}<span>Suggestions</span></button>
            <button type="button" data-testid="mode-markdown" aria-pressed="false" title="Markdown">${uiIcon("markdown")}<span>Markdown</span></button>
          </div>
        </div>
        <label class="local-md-review-diff-control" data-testid="review-diff-control">
          <span>Diff</span>
          <select data-testid="review-diff-mode">
            <option value="active">Active block</option>
            <option value="all" selected>All blocks</option>
            <option value="none">No diff</option>
          </select>
        </label>
        <label class="local-md-block-id-control" data-testid="block-id-control">
          <input type="checkbox" data-testid="include-block-ids" checked>
          <span>Include block IDs</span>
        </label>
        <span data-testid="save-status">Saved</span>
      </div>
    </div>
  `;

  const rendered = document.createElement("article");
  rendered.dataset.testid = "rendered-editor";

  const properties = document.createElement("section");
  properties.className = "local-md-properties";
  properties.dataset.testid = "frontmatter-editor";
  properties.hidden = true;
  properties.innerHTML = `
    <div class="local-md-properties-header">
      <strong>Properties</strong>
      <span>YAML frontmatter</span>
    </div>
  `;

  const frontmatterEditor = document.createElement("textarea");
  frontmatterEditor.dataset.testid = "frontmatter-source";
  frontmatterEditor.placeholder = "title: Untitled\ntags:\n  - note";
  frontmatterEditor.value = state.frontmatter;
  properties.append(frontmatterEditor);

  const editor = document.createElement("textarea");
  editor.dataset.testid = "markdown-editor";
  editor.value = state.body;
  editor.hidden = true;

  const markdownLayer = document.createElement("div");
  markdownLayer.className = "local-md-markdown-layer";
  markdownLayer.hidden = true;
  const markdownHighlights = document.createElement("div");
  markdownHighlights.className = "local-md-markdown-highlights";
  markdownHighlights.setAttribute("aria-hidden", "true");
  markdownLayer.append(markdownHighlights, editor);

  const workspace = document.createElement("div");
  workspace.className = "local-md-workspace";

  const documentPane = document.createElement("div");
  documentPane.className = "local-md-document-pane";

  const frontmatterHeader = document.createElement("section");
  frontmatterHeader.className = "local-md-frontmatter-header";
  frontmatterHeader.dataset.testid = "frontmatter-header";

  const commentsColumn = document.createElement("aside");
  commentsColumn.className = "local-md-comments";
  commentsColumn.dataset.testid = "comments-column";

  const selectionToolbar = document.createElement("div");
  selectionToolbar.className = "local-md-selection-toolbar";
  selectionToolbar.hidden = true;
  selectionToolbar.dataset.testid = "selection-toolbar";
  selectionToolbar.innerHTML = `
    <button type="button" data-testid="selection-add-comment" aria-label="Add comment" title="Add comment">
      ${uiIcon("message-plus")}
    </button>
  `;
  const toastRegion = document.createElement("div");
  toastRegion.className = "local-md-toast-region";
  toastRegion.dataset.testid = "toast-region";
  toastRegion.innerHTML = `
    <section class="local-md-toast" data-testid="unsaved-toast" hidden>
      <span>Unsaved changes</span>
      <button type="button" data-testid="toast-save">Save</button>
    </section>
    <section class="local-md-toast local-md-toast-conflict" data-testid="external-change-toast" hidden>
      <span>The file changed on disk.</span>
      <button type="button" data-testid="toast-load-disk">Load from disk</button>
      <button type="button" data-testid="toast-save-mine">Save my state</button>
    </section>
  `;

  const repositoryCta = document.createElement("aside");
  repositoryCta.className = "local-md-repository-cta";
  repositoryCta.innerHTML = `
    <button type="button" class="local-md-repository-cta-close" aria-label="Hide repository link" title="Hide">×</button>
    <span>Feedback or want to share your love with a star?</span>
    <a href="https://github.com/martin-lysk/markleft" target="_blank" rel="noopener">
      github.com/martin-lysk/markleft
    </a>
  `;
  repositoryCta
    .querySelector<HTMLButtonElement>(".local-md-repository-cta-close")
    ?.addEventListener("click", () => repositoryCta.remove());

  const llmPrompt = document.createElement("section");
  llmPrompt.className = "local-md-llm-prompt";
  llmPrompt.dataset.testid = "llm-prompt";
  llmPrompt.hidden = true;
  llmPrompt.innerHTML = `
    <button type="button" class="local-md-llm-prompt-close" data-testid="close-llm-prompt" aria-label="Hide AI instructions" title="Hide">
      ${uiIcon("x")}
    </button>
    <div class="local-md-llm-prompt-header">
      <strong>File saved</strong>
      <p>Use this prompt when sending the Markdown file to an assistant.</p>
    </div>
    <textarea data-testid="llm-prompt-text" readonly>${escapeHtml(llmSavedDocumentPrompt(window.location))}</textarea>
    <div class="local-md-llm-prompt-actions">
      <button type="button" data-testid="copy-llm-prompt" aria-label="Copy AI instructions" title="Copy AI instructions">
        ${uiIcon("copy")}
        <span>Copy prompt</span>
      </button>
      <button type="button" data-testid="show-llm-prompt">
        <span>Show</span>
      </button>
    </div>
  `;

  documentPane.append(frontmatterHeader, rendered, markdownLayer);
  workspace.append(documentPane, commentsColumn);
  shell.append(properties, workspace, selectionToolbar, llmPrompt, toastRegion, repositoryCta);
  document.body.replaceChildren(shell);

  const status = required("[data-testid='save-status']");
  const toolbarActions = required<HTMLElement>(".local-md-actions");
  const renderedButton = required<HTMLButtonElement>("[data-testid='mode-rendered']");
  const reviewButton = required<HTMLButtonElement>("[data-testid='mode-review']");
  const markdownButton = required<HTMLButtonElement>("[data-testid='mode-markdown']");
  const reviewDiffControl = required<HTMLElement>("[data-testid='review-diff-control']");
  const reviewDiffModeSelect = required<HTMLSelectElement>("[data-testid='review-diff-mode']");
  const includeBlockIdsInput = required<HTMLInputElement>("[data-testid='include-block-ids']");
  reviewDiffControl.hidden = true;
  const selectionAddCommentButton = required<HTMLButtonElement>(
    "[data-testid='selection-add-comment']",
  );
  const saveButton = required<HTMLButtonElement>("[data-testid='save']");
  const unsavedToast = required<HTMLElement>("[data-testid='unsaved-toast']");
  const externalChangeToast = required<HTMLElement>("[data-testid='external-change-toast']");
  const toastSaveButton = required<HTMLButtonElement>("[data-testid='toast-save']");
  const toastLoadDiskButton = required<HTMLButtonElement>("[data-testid='toast-load-disk']");
  const toastSaveMineButton = required<HTMLButtonElement>("[data-testid='toast-save-mine']");
  const llmPromptPanel = required<HTMLElement>("[data-testid='llm-prompt']");
  const llmPromptText = required<HTMLTextAreaElement>("[data-testid='llm-prompt-text']");
  const copyLlmPromptButton = required<HTMLButtonElement>("[data-testid='copy-llm-prompt']");
  const showLlmPromptButton = required<HTMLButtonElement>("[data-testid='show-llm-prompt']");
  const closeLlmPromptButton = required<HTMLButtonElement>("[data-testid='close-llm-prompt']");

  const hideLlmPrompt = () => {
    window.clearTimeout(llmPromptTimer);
    llmPromptTimer = 0;
    llmPromptPanel.hidden = true;
  };
  const scheduleLlmPromptHide = () => {
    window.clearTimeout(llmPromptTimer);
    llmPromptTimer = window.setTimeout(() => {
      if (llmPromptHovered) {
        scheduleLlmPromptHide();
        return;
      }
      hideLlmPrompt();
    }, 10000);
  };
  const showLlmPrompt = () => {
    llmPromptText.value = llmSavedDocumentPrompt(window.location);
    llmPromptPanel.classList.remove("local-md-llm-prompt-expanded");
    showLlmPromptButton.hidden = false;
    llmPromptPanel.hidden = false;
    scheduleLlmPromptHide();
  };
  const updateUnsavedToast = () => {
    unsavedToast.hidden = !state.dirty;
    if (state.dirty) hideLlmPrompt();
  };
  const setStatus = (text: string, error = false) => {
    status.textContent = text;
    status.classList.toggle("local-md-error", error);
    if (text === "Modified") {
      state.dirty = true;
      updateUnsavedToast();
    } else if (text === "Saved" || text === "Ready" || text === "Reloaded") {
      updateUnsavedToast();
      if (text === "Saved") showLlmPrompt();
    }
  };
  const updateFolderButton = () => undefined;
  const history = createMarkdownHistory(state.markdown);

  const currentMarkdownSnapshot = () =>
    composeMarkdown({
      frontmatter: state.frontmatter,
      body: state.mode === "markdown" ? editor.value : state.body,
    });

  const commitHistory = () => {
    state.markdown = currentMarkdownSnapshot();
    history.commit(state.markdown);
  };

  const scheduleTypingHistory = () => {
    window.clearTimeout(history.typingTimer);
    history.typingTimer = window.setTimeout(() => {
      history.typingTimer = 0;
      commitHistory();
    }, typingHistoryDelay);
  };

  const restoreHistorySnapshot = async (markdown: string) => {
    const parts = splitFrontmatter(markdown);
    state.frontmatter = parts.frontmatter;
    state.body = parts.body;
    state.markdown = composeMarkdown(parts);
    state.dirty = true;
    frontmatterEditor.value = state.frontmatter;
    syncMarkdownEditorSurface();
    draftCommentIds.clear();
    editingCommentIds.clear();
    editingChildCommentIds.clear();
    commentDrafts.clear();
    replyDrafts.clear();
    openReplyComposerIds.clear();
    state.activeCommentId =
      state.mode === "markdown"
        ? activeCommentIdFromSourceRange(editor.value, editor.selectionStart, editor.selectionEnd)
        : null;
    if (state.mode === "rendered" || state.mode === "review") await render();
    else {
      renderCommentCards();
      layoutCommentCards();
    }
    setStatus("Modified");
  };

  const loadMarkdownFromSerializedFile = (contents: string): string => {
    if (!/<script\b[^>]*local-md\.js|<textarea\b/i.test(contents)) return contents;
    const parsed = new DOMParser().parseFromString(contents, "text/html");
    return loadMarkdown(parsed);
  };

  const applyExternalMarkdownSnapshot = async (markdown: string) => {
    const parts = splitFrontmatter(markdown);
    state.frontmatter = parts.frontmatter;
    state.body = parts.body;
    state.markdown = composeMarkdown(parts);
    state.dirty = false;
    frontmatterEditor.value = state.frontmatter;
    syncMarkdownEditorSurface();
    draftCommentIds.clear();
    editingCommentIds.clear();
    editingChildCommentIds.clear();
    commentDrafts.clear();
    replyDrafts.clear();
    openReplyComposerIds.clear();
    state.activeCommentId = null;
    history.replace(state.markdown);
    pendingExternalFile = null;
    externalChangeToast.hidden = true;
    if (state.mode === "rendered" || state.mode === "review") await render();
    else {
      renderCommentCards();
      layoutCommentCards();
    }
    setStatus("Reloaded");
  };

  const undoMarkdown = async () => {
    window.clearTimeout(history.typingTimer);
    history.typingTimer = 0;
    history.commit(currentMarkdownSnapshot());
    const snapshot = history.undo();
    if (!snapshot) return;
    await restoreHistorySnapshot(snapshot);
  };

  const redoMarkdown = async () => {
    window.clearTimeout(history.typingTimer);
    history.typingTimer = 0;
    const snapshot = history.redo();
    if (!snapshot) return;
    await restoreHistorySnapshot(snapshot);
  };

  const render = async () => {
    state.markdown = composeMarkdown(state);
    renderFrontmatterHeader(frontmatterHeader, state.frontmatter);
    rendered.innerHTML = await markdownToHtml(stripDocumentBlockIds(state.body));
    clearReviewDiffHighlights();
    makeEditable(rendered);
    await renderMermaidDiagrams(rendered);
    stampBlocks(rendered, state.includeBlockIds ? documentBlockIds(state.body) : []);
    if (state.mode === "review") await applyReviewSuggestions(rendered, state.body);
    paintReviewDiffHighlights();
    makeEditable(rendered);
    if (state.isFallbackGuide) installFallbackBookmarkletControl(rendered);
    stampBlocks(rendered, state.includeBlockIds ? documentBlockIds(state.body) : []);
    decorateRenderedComments(rendered, state.body, state.activeCommentId);
    positionImageCommentAnchors(rendered, state, activateReviewSuggestionForComment);
    renderCommentCards();
    layoutCommentCards();
    for (const image of rendered.querySelectorAll<HTMLImageElement>("img")) {
      if (!image.complete) image.addEventListener("load", layoutCommentCards, { once: true });
    }
    requestAnimationFrame(layoutCommentCards);
  };

  const applyReviewSuggestions = async (root: HTMLElement, markdownBody: string) => {
    const suggestions = parseBlockSuggestions(markdownBody);
    const usedBlocks = new Set<HTMLElement>();
    const diffTargets: Array<{ originalBlock: HTMLElement; replacement: HTMLElement }> = [];
    for (const suggestion of suggestions) {
      if (suggestion.missingDefinition || suggestion.missingTarget) continue;
      if (suggestion.targetBlockId) {
        const targetBlock = root.querySelector<HTMLElement>(
          `[data-block-id="${CSS.escape(suggestion.targetBlockId)}"]`,
        );
        if (!targetBlock) continue;
        const snippet = document.createElement("div");
        snippet.innerHTML = await markdownToHtml(suggestion.bodyMarkdown);
        snippet.querySelector("section[data-footnotes]")?.remove();
        renderLocalNoteReferenceWidgets(snippet);
        if (suggestion.operation === "insert-before" || suggestion.operation === "insert-after") {
          const insertion = document.createElement("div");
          insertion.className = `local-md-review-suggestion local-md-review-suggestion-${suggestion.operation}`;
          insertion.dataset.suggestionId = suggestion.id;
          insertion.replaceChildren(...Array.from(snippet.childNodes));
          if (suggestion.operation === "insert-before") targetBlock.before(insertion);
          else targetBlock.after(insertion);
        } else {
          const imageComparison =
            suggestion.operation === "update"
              ? reviewImageComparisonForTarget(targetBlock, snippet, suggestion.id)
              : null;
          const replacement =
            imageComparison ?? reviewSuggestionElementForTarget(targetBlock, snippet);
          replacement.className = "local-md-review-suggestion";
          if (imageComparison) replacement.classList.add("local-md-image-comparison");
          replacement.dataset.suggestionId = suggestion.id;
          if (!imageComparison) {
            const childNodes =
              suggestion.operation === "delete"
                ? []
                : reviewSuggestionChildNodesForTarget(snippet, targetBlock);
            replacement.replaceChildren(
              ...(childNodes.length > 0 ? childNodes : [reviewDeletionPlaceholder(document)]),
            );
          }
          targetBlock.replaceWith(replacement);
        }
        continue;
      }
      const marker =
        reviewSuggestionMarker(root, suggestion.id) ?? reviewRelatedCommentMarker(root, suggestion);
      if (!marker) continue;
      const markerBlock = marker.closest<HTMLElement>(
        "h1,h2,h3,h4,h5,h6,p,li,pre,td,th,blockquote,.local-md-image-comment-frame",
      );
      const markerOnly = markerBlock ? reviewBlockOnlyFootnoteRefs(markerBlock) : false;
      const markerQuote = marker.closest<HTMLElement>("blockquote");
      const markerList = marker.closest<HTMLElement>("ul,ol");
      const targetBlock =
        markerQuote ?? markerList ?? (markerOnly ? previousReviewBlock(markerBlock) : markerBlock);
      if (!targetBlock || usedBlocks.has(targetBlock)) continue;
      usedBlocks.add(targetBlock);
      const snippet = document.createElement("div");
      snippet.innerHTML = await markdownToHtml(
        reviewSuggestionMarkdown(markdownBody, suggestion.id, suggestion.bodyMarkdown),
      );
      snippet.querySelector("section[data-footnotes]")?.remove();
      renderLocalNoteReferenceWidgets(snippet);
      const imageComparison = reviewImageComparisonForTarget(targetBlock, snippet, suggestion.id);
      const replacement = imageComparison ?? reviewSuggestionElementForTarget(targetBlock, snippet);
      replacement.className = "local-md-review-suggestion";
      if (imageComparison) replacement.classList.add("local-md-image-comparison");
      replacement.dataset.suggestionId = suggestion.id;
      replacement.classList.toggle(
        "local-md-review-suggestion-active",
        suggestion.id === activeReviewSuggestionId,
      );
      if (!imageComparison) {
        const childNodes = reviewSuggestionChildNodesForTarget(snippet, targetBlock);
        replacement.replaceChildren(
          ...(childNodes.length > 0 ? childNodes : [reviewDeletionPlaceholder(document)]),
        );
      }
      if (
        state.reviewDiffMode === "all" ||
        (state.reviewDiffMode === "active" && suggestion.id === activeReviewSuggestionId)
      ) {
        diffTargets.push({
          originalBlock: targetBlock.cloneNode(true) as HTMLElement,
          replacement,
        });
      }
      if (markerOnly) markerBlock?.remove();
      targetBlock.replaceWith(replacement);
    }
    for (const target of diffTargets) {
      decorateReviewSuggestionDiff(target.originalBlock, target.replacement);
    }
    for (const item of root.querySelectorAll<HTMLElement>("li[id^='user-content-fn-']")) {
      const id = /^user-content-fn-(.+)$/.exec(item.id)?.[1] ?? "";
      if (id.startsWith("suggest-block-") || id.startsWith("suggestion-")) item.hidden = true;
    }
    const footnotes = root.querySelector<HTMLElement>("section[data-footnotes]");
    if (footnotes) {
      const hasVisibleItems = Array.from(footnotes.querySelectorAll("li")).some(
        (item) => !item.hidden,
      );
      if (!hasVisibleItems) footnotes.hidden = true;
    }
    requestAnimationFrame(() => {
      updateReviewSuggestionActiveClasses();
      void refreshReviewDiffDecorations();
    });
  };

  const refreshReviewDiffDecorations = async () => {
    clearReviewDiffHighlights();
    if (state.mode !== "review" || state.reviewDiffMode === "none") return;
    const suggestions = new Map(
      parseBlockSuggestions(state.body).map((suggestion) => [suggestion.id, suggestion]),
    );
    for (const region of rendered.querySelectorAll<HTMLElement>(
      ".local-md-review-suggestion[data-suggestion-id]",
    )) {
      const id = region.dataset.suggestionId;
      const suggestion = id ? suggestions.get(id) : null;
      if (!suggestion || suggestion.missingDefinition) continue;
      if (state.reviewDiffMode === "active" && id !== activeReviewSuggestionId) continue;
      const originalBlock = await reviewOriginalBlockForDiff(state.body, suggestion, region);
      if (!originalBlock) continue;
      decorateReviewSuggestionDiff(originalBlock, region);
    }
    paintReviewDiffHighlights();
  };

  const syncReviewToMarkdown = async (): Promise<{
    needsRender: boolean;
    focusSuggestionId: string | null;
    focusTextOffset: number | null;
  }> => {
    let nextBody = state.body;
    const suggestionsById = new Map(
      parseBlockSuggestions(nextBody).map((suggestion) => [suggestion.id, suggestion]),
    );
    for (const region of rendered.querySelectorAll<HTMLElement>(
      ".local-md-review-suggestion[data-suggestion-id]",
    )) {
      const id = region.dataset.suggestionId;
      if (!id) continue;
      const clone = region.cloneNode(true) as HTMLElement;
      restoreReviewCommentReferences(clone);
      clone.querySelector("section[data-footnotes]")?.remove();
      clone.querySelector(".local-md-review-empty-suggestion")?.remove();
      clone.querySelectorAll(".local-md-diff-marker").forEach((marker) => marker.remove());
      const rawSuggestionMarkdown = stripReviewSuggestionReferences(
        unescapeCommentReferences(await htmlToMarkdown(reviewSuggestionRegionHtml(clone))),
      ).trim();
      const suggestionMarkdown = preserveReviewSourceWrapper(
        suggestionsById.get(id)?.bodyMarkdown ?? "",
        rawSuggestionMarkdown,
      );
      nextBody = editCommentBody(nextBody, id, suggestionMarkdown);
    }
    const focusTextOffset =
      pendingReviewOriginalBlockEdit?.focusTextOffset === null ||
      pendingReviewOriginalBlockEdit?.focusTextOffset === undefined
        ? null
        : pendingReviewOriginalBlockEdit.focusTextOffset +
          pendingReviewOriginalBlockEdit.insertedTextLength;
    const withOriginalBlockSuggestions = await createSuggestionsFromEditedReviewBlocks(
      rendered,
      nextBody,
      pendingReviewOriginalBlockEdit,
      state.includeBlockIds,
    );
    pendingReviewOriginalBlockEdit = null;
    state.body = nextBody;
    if (withOriginalBlockSuggestions.markdown !== nextBody) {
      state.body = withOriginalBlockSuggestions.markdown;
      state.markdown = composeMarkdown(state);
      state.dirty = true;
      state.syncCount += 1;
      return {
        needsRender: true,
        focusSuggestionId: withOriginalBlockSuggestions.focusSuggestionId,
        focusTextOffset,
      };
    }
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    state.syncCount += 1;
    return { needsRender: false, focusSuggestionId: null, focusTextOffset: null };
  };

  const refreshActiveComment = () => {
    if (
      (state.mode === "rendered" || state.mode === "review") &&
      !selectionIsInside(rendered, document.getSelection())
    )
      return;
    if (
      state.mode === "markdown" &&
      document.activeElement &&
      commentsColumn.contains(document.activeElement)
    )
      return;
    const activeReviewSuggestionChanged = updateActiveReviewSuggestionFromSelection();
    const nextActive =
      state.mode === "rendered" || state.mode === "review"
        ? activeCommentIdFromSelection(rendered, state.body, document.getSelection())
        : activeCommentIdFromSourceRange(editor.value, editor.selectionStart, editor.selectionEnd);
    if (nextActive === state.activeCommentId) {
      if (activeReviewSuggestionChanged) {
        renderCommentCards();
        layoutCommentCards();
        if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
      }
      return;
    }
    if (nextActive) closeEmptyReplyComposerStatesExcept(nextActive);
    state.activeCommentId = nextActive;
    if (state.mode === "rendered" || state.mode === "review") {
      decorateRenderedComments(rendered, state.body, state.activeCommentId);
      positionImageCommentAnchors(rendered, state, activateReviewSuggestionForComment);
    }
    if (state.mode === "markdown") {
      renderMarkdownHighlights();
      layoutCommentCards();
    }
    renderCommentCards();
    if (activeReviewSuggestionChanged) layoutCommentCards();
    if (activeReviewSuggestionChanged && state.reviewDiffMode === "active")
      void refreshReviewDiffDecorations();
  };

  const updateActiveReviewSuggestionFromSelection = (): boolean => {
    if (state.mode !== "review") return false;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const node = selection.anchorNode;
    if (!node || !rendered.contains(node)) return false;
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    const region = element?.closest<HTMLElement>(".local-md-review-suggestion[data-suggestion-id]");
    const next = region?.dataset.suggestionId ?? null;
    if (next === activeReviewSuggestionId) return false;
    activeReviewSuggestionId = next;
    updateReviewSuggestionActiveClasses();
    return true;
  };

  const updateReviewSuggestionActiveClasses = () => {
    for (const region of rendered.querySelectorAll<HTMLElement>(
      ".local-md-review-suggestion[data-suggestion-id]",
    )) {
      const active = region.dataset.suggestionId === activeReviewSuggestionId;
      const wasActive = region.classList.contains("local-md-review-suggestion-active");
      region.classList.toggle("local-md-review-suggestion-active", active);
      if (region.classList.contains("local-md-image-comparison") && active !== wasActive) {
        setImageComparisonReveal(region, active ? 50 : 0);
      }
    }
  };

  const activateReviewSuggestionForComment = (commentId: string): void => {
    if (state.mode !== "review") return;
    const suggestionId = analyzeReview(state.body).suggestionIdByCommentId.get(commentId);
    if (!suggestionId || suggestionId === activeReviewSuggestionId) return;
    activeReviewSuggestionId = suggestionId;
    updateReviewSuggestionActiveClasses();
    if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
    renderCommentCards();
    layoutCommentCards();
  };

  const updateMarkdownEditorSize = () => {
    const lineHeight = textareaLineHeight(editor);
    editor.style.height = "auto";
    editor.style.height = `${Math.ceil(editor.scrollHeight + lineHeight * markdownEditorExtraLines)}px`;
    markdownHighlights.style.height = editor.style.height;
    markdownLayer.style.minHeight = editor.style.height;
  };

  const renderMarkdownHighlights = () => {
    const source = editor.value;
    const ranges = parseComments(source)
      .map((comment) => {
        if (comment.kind === "dangling") return null;
        const range = sourceSelectionRangeForComment(comment);
        if (!range) return null;
        return {
          start: Math.max(0, Math.min(range.start, source.length)),
          end: Math.max(0, Math.min(range.end, source.length)),
          className: markdownHighlightClass(comment, comment.id === state.activeCommentId),
        };
      })
      .filter((range): range is MarkdownHighlightRange => range !== null && range.end > range.start)
      .sort((left, right) => left.start - right.start || right.end - left.end);

    let cursor = 0;
    let html = "";
    for (const range of ranges) {
      if (range.start < cursor) continue;
      html += escapeHtml(source.slice(cursor, range.start));
      html += `<mark class="${range.className}">${escapeHtml(source.slice(range.start, range.end))}</mark>`;
      cursor = range.end;
    }
    html += escapeHtml(source.slice(cursor));
    if (source.endsWith("\n")) html += "\n";
    markdownHighlights.innerHTML = html;
  };

  const syncMarkdownEditorSurface = () => {
    editor.value = state.body;
    updateMarkdownEditorSize();
    renderMarkdownHighlights();
    layoutCommentCards();
  };

  const scheduleCommentLayout = () => {
    requestAnimationFrame(() => {
      layoutCommentCards();
      requestAnimationFrame(layoutCommentCards);
    });
  };

  const resizeCommentTextarea = (input: HTMLTextAreaElement) => {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  };

  const resizeCommentTextareas = (root: ParentNode = commentsColumn) => {
    for (const input of root.querySelectorAll<HTMLTextAreaElement>(
      ".local-md-comment-card textarea",
    )) {
      resizeCommentTextarea(input);
    }
  };

  const rememberReplyDrafts = () => {
    for (const card of commentsColumn.querySelectorAll<HTMLElement>(".local-md-comment-card")) {
      const id = card.dataset.commentId;
      const input = card.querySelector<HTMLTextAreaElement>("[data-testid='comment-reply-input']");
      if (!id || !input) continue;
      if (input.value.trim().length > 0) replyDrafts.set(id, input.value);
      else replyDrafts.delete(id);
    }
  };

  const rememberCommentDrafts = () => {
    for (const input of commentsColumn.querySelectorAll<HTMLTextAreaElement>(
      "[data-testid='comment-input']",
    )) {
      const reviewId = input.closest<HTMLElement>("[data-review-comment-id]")?.dataset
        .reviewCommentId;
      const cardId = input.closest<HTMLElement>(".local-md-comment-card[data-comment-id]")?.dataset
        .commentId;
      const id = reviewId ?? cardId;
      if (!id) continue;
      commentDrafts.set(id, input.value);
    }
  };

  const updateSelectionToolbar = () => {
    const range = visibleRenderedSelectionRange(rendered, state.mode);
    if (!range) {
      selectionToolbar.hidden = true;
      return;
    }

    selectionToolbar.hidden = false;
    const selection = document.getSelection();
    const selectionLineRect = selectionFocusLineRect(selection, range);
    const toolbarRect = selectionToolbar.getBoundingClientRect();
    const documentRect = documentPane.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - toolbarRect.width - selectionToolbarMargin,
      Math.max(
        selectionToolbarMargin,
        documentRect.right + selectionToolbarGutter - toolbarRect.width / 2,
      ),
    );
    const top = Math.min(
      window.innerHeight - toolbarRect.height - selectionToolbarMargin,
      Math.max(
        selectionToolbarMargin,
        selectionLineRect.top + selectionLineRect.height / 2 - toolbarRect.height / 2,
      ),
    );
    selectionToolbar.style.left = `${Math.round(left)}px`;
    selectionToolbar.style.top = `${Math.round(top)}px`;
  };

  const renderReviewCommentBox = (comment: ReturnType<typeof parseComments>[number]) => {
    const isDraft = draftCommentIds.has(comment.id);
    const isEditing = isDraft || editingCommentIds.has(comment.id);
    const display = commentDisplayParts(comment.bodyMarkdown);
    return `
      <section class="local-md-review-comment-box${comment.id === state.activeCommentId ? " local-md-review-comment-box-active" : ""}" data-review-comment-id="${escapeHtml(comment.id)}">
        <div class="local-md-comment-card-header">
          ${
            !isEditing
              ? `
                <div class="local-md-comment-inline-actions">
                  <button type="button" data-action="edit-review-comment" data-comment-id="${escapeHtml(comment.id)}" aria-label="Edit comment" title="Edit comment" class="local-md-comment-icon-button">
                    ${uiIcon("pencil")}
                  </button>
                  <button type="button" data-action="remove-review-comment" data-comment-id="${escapeHtml(comment.id)}" aria-label="Delete comment" title="Delete comment" class="local-md-comment-icon-button">
                    ${uiIcon("trash")}
                  </button>
                </div>
              `
              : ""
          }
        </div>
        ${
          isEditing
            ? `
              <textarea data-testid="comment-input" class="local-md-comment-compose" placeholder="Comment">${escapeHtml(commentDrafts.get(comment.id) ?? comment.bodyMarkdown)}</textarea>
              <div class="local-md-comment-card-actions">
                <button type="button" data-action="cancel-review-comment" data-comment-id="${escapeHtml(comment.id)}" class="local-md-text-button">Cancel</button>
                <button type="button" data-action="save-review-comment" data-comment-id="${escapeHtml(comment.id)}" class="local-md-primary-button">Save</button>
              </div>
            `
            : `<p class="local-md-comment-body">${escapeHtml(display.body || "(missing comment body)")}</p>`
        }
      </section>
    `;
  };

  const refreshAfterCommentMutation = () => {
    if (state.mode === "markdown") {
      renderCommentCards();
      renderMarkdownHighlights();
      layoutCommentCards();
      return;
    }
    void render();
  };

  const renderCommentCards = () => {
    rememberCommentDrafts();
    rememberReplyDrafts();
    const reviewAnalysis = state.mode === "review" ? analyzeReview(state.body) : null;
    const comments = reviewAnalysis?.comments ?? parseComments(state.body);
    const reviewDiscussions = reviewAnalysis?.discussions ?? [];
    const hiddenReviewCommentIds = new Set(
      reviewDiscussions.flatMap((discussion) => [
        ...discussion.addressedComments.map((comment) => comment.id),
        ...discussion.suggestionComments.map((comment) => comment.id),
      ]),
    );
    const existingCards = new Map(
      Array.from(commentsColumn.querySelectorAll<HTMLElement>(".local-md-comment-card")).map(
        (card) => [
          card.dataset.cardId ?? card.dataset.commentId ?? card.dataset.suggestionId,
          card,
        ],
      ),
    );
    const nextCards: HTMLElement[] = [];
    const newCards: HTMLElement[] = [];
    for (const comment of comments) {
      if (hiddenReviewCommentIds.has(comment.id)) continue;
      const cardId = `comment:${comment.id}`;
      const existingCard = existingCards.get(cardId);
      const card = existingCard ?? document.createElement("section");
      card.className = "local-md-comment-card";
      if (!existingCard) {
        card.classList.add("local-md-comment-card-placing");
        newCards.push(card);
      }
      card.dataset.cardId = cardId;
      card.dataset.commentId = comment.id;
      delete card.dataset.suggestionId;
      card.dataset.commentState = comment.missingDefinition
        ? "broken"
        : comment.kind !== "dangling" && comment.stale
          ? "stale"
          : "current";
      card.classList.toggle("local-md-comment-card-active", comment.id === state.activeCommentId);
      card.dataset.testid = "comment-card";
      const isDraft = draftCommentIds.has(comment.id);
      const isEditing = isDraft || editingCommentIds.has(comment.id);
      const display = commentDisplayParts(comment.bodyMarkdown);
      const commentChildren =
        comment.kind !== "dangling" ? commentChildrenForComment(state.body, comment.id) : [];
      const replyDraft = replyDrafts.get(comment.id) ?? "";
      const showReplyComposer =
        comment.id === state.activeCommentId ||
        openReplyComposerIds.has(comment.id) ||
        replyDraft.length > 0;
      const showReplyActions = openReplyComposerIds.has(comment.id) || replyDraft.length > 0;
      const canSaveReply = replyDraft.trim().length > 0;
      card.innerHTML = `
        <div class="local-md-comment-card-header">
          ${
            !isEditing
              ? `
                <div class="local-md-comment-inline-actions">
                  <button type="button" data-action="edit" aria-label="Edit comment" title="Edit comment" class="local-md-comment-icon-button">
                    ${uiIcon("pencil")}
                  </button>
                  <button type="button" data-action="remove" aria-label="Delete comment" title="Delete comment" class="local-md-comment-icon-button">
                    ${uiIcon("trash")}
                  </button>
                </div>
              `
              : ""
          }
          </div>
        ${
          isEditing
            ? `
              <textarea data-testid="comment-input" class="local-md-comment-compose" placeholder="Comment">${escapeHtml(commentDrafts.get(comment.id) ?? comment.bodyMarkdown)}</textarea>
              <div class="local-md-comment-card-actions">
                <button type="button" data-action="cancel-comment" class="local-md-text-button">Cancel</button>
                <button type="button" data-action="save-comment" class="local-md-primary-button">Save</button>
              </div>
            `
            : `
              <p class="local-md-comment-body">${escapeHtml(display.body || "(missing comment body)")}</p>
              ${
                commentChildren.length > 0
                  ? `<div class="local-md-comment-children">${commentChildren
                      .map((child) =>
                        child.kind === "block-suggestion"
                          ? `
                          <section class="local-md-suggestion" data-suggestion-id="${escapeHtml(child.id)}">
                            <div class="local-md-suggestion-header">
                              <strong>Suggestion</strong>
                              <div class="local-md-suggestion-actions">
                                <button type="button" data-action="remove-suggestion" data-suggestion-id="${escapeHtml(child.id)}">Delete</button>
                              </div>
                            </div>
                            <pre>${escapeHtml(child.bodyMarkdown)}</pre>
                          </section>
                        `
                          : `
                          <section class="local-md-comment-reply" data-child-comment-id="${escapeHtml(child.id)}">
                            <div class="local-md-child-comment-header">
                              <strong>Comment</strong>
                              <div class="local-md-comment-inline-actions">
                                <button type="button" data-action="edit-child-comment" data-child-id="${escapeHtml(child.id)}" aria-label="Edit comment" title="Edit comment" class="local-md-comment-icon-button">
                                  ${uiIcon("pencil")}
                                </button>
                                <button type="button" data-action="remove-child-comment" data-child-id="${escapeHtml(child.id)}" aria-label="Delete comment" title="Delete comment" class="local-md-comment-icon-button">
                                  ${uiIcon("trash")}
                                </button>
                              </div>
                            </div>
                            ${
                              editingChildCommentIds.has(child.id)
                                ? `
                                  <textarea data-testid="child-comment-input" class="local-md-comment-reply-compose">${escapeHtml(child.bodyMarkdown)}</textarea>
                                  <div class="local-md-comment-card-actions">
                                    <button type="button" data-action="cancel-child-comment" data-child-id="${escapeHtml(child.id)}" class="local-md-text-button">Cancel</button>
                                    <button type="button" data-action="save-child-comment" data-child-id="${escapeHtml(child.id)}" class="local-md-primary-button">Save</button>
                                  </div>
                                `
                                : `<p>${escapeHtml(child.bodyMarkdown)}</p>`
                            }
                          </section>
                        `,
                      )
                      .join("")}</div>`
                  : ""
              }
              ${
                showReplyComposer
                  ? `
                    <textarea data-testid="comment-reply-input" class="local-md-comment-reply-compose" placeholder="Add a comment...">${escapeHtml(
                      replyDraft,
                    )}</textarea>
                    <div class="local-md-comment-card-actions" data-reply-actions${showReplyActions ? "" : " hidden"}>
                      <button type="button" data-action="cancel-reply" class="local-md-text-button">Cancel</button>
                      <button type="button" data-action="save-reply" class="local-md-primary-button"${canSaveReply ? "" : " disabled"}>Reply</button>
                    </div>
                  `
                  : ""
              }
            `
        }
      `;
      card.onclick = (event) => {
        const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset
          .action;
        if (!action && (event.target as HTMLElement).closest("textarea,input")) return;
        closeEmptyReplyComposerStatesExcept(comment.id);
        let changed = false;
        if (action === "edit") {
          editingCommentIds.add(comment.id);
          renderCommentCards();
          focusCommentInput(comment.id);
        } else if (action === "save-comment") {
          const input = card.querySelector<HTMLTextAreaElement>("[data-testid='comment-input']");
          const next = input?.value.trim() ?? "";
          if (next) {
            const wasDraft = draftCommentIds.has(comment.id);
            const source = state.mode === "markdown" ? editor.value : state.body;
            state.body = editCommentBody(source, comment.id, next);
            if (state.mode === "markdown") syncMarkdownEditorSurface();
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            if (wasDraft) history.replace(state.markdown);
            else commitHistory();
            draftCommentIds.delete(comment.id);
            editingCommentIds.delete(comment.id);
            commentDrafts.delete(comment.id);
            state.activeCommentId = comment.id;
            changed = true;
            refreshAfterCommentMutation();
          }
        } else if (action === "cancel-comment") {
          if (draftCommentIds.has(comment.id)) {
            const source = state.mode === "markdown" ? editor.value : state.body;
            state.body = removeComment(source, comment.id);
            if (state.mode === "markdown") syncMarkdownEditorSurface();
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            commitHistory();
            draftCommentIds.delete(comment.id);
            editingCommentIds.delete(comment.id);
            commentDrafts.delete(comment.id);
            if (state.activeCommentId === comment.id) state.activeCommentId = null;
            changed = true;
            refreshAfterCommentMutation();
          } else {
            editingCommentIds.delete(comment.id);
            commentDrafts.delete(comment.id);
            renderCommentCards();
          }
        } else if (action === "save-reply") {
          const input = card.querySelector<HTMLTextAreaElement>(
            "[data-testid='comment-reply-input']",
          );
          const reply = input?.value.trim() ?? "";
          if (reply) {
            const source = state.mode === "markdown" ? editor.value : state.body;
            state.body = createChildComment(source, comment.id, reply);
            if (state.mode === "markdown") syncMarkdownEditorSurface();
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            commitHistory();
            if (input) input.value = "";
            replyDrafts.delete(comment.id);
            openReplyComposerIds.delete(comment.id);
            changed = true;
            refreshAfterCommentMutation();
          }
        } else if (action === "cancel-reply") {
          const input = card.querySelector<HTMLTextAreaElement>(
            "[data-testid='comment-reply-input']",
          );
          if (input) input.value = "";
          replyDrafts.delete(comment.id);
          openReplyComposerIds.delete(comment.id);
          renderCommentCards();
        } else if (action === "edit-child-comment") {
          const childId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.childId;
          if (childId) {
            editingChildCommentIds.add(childId);
            renderCommentCards();
          }
        } else if (action === "save-child-comment") {
          const childId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.childId;
          const input = childId
            ? card.querySelector<HTMLTextAreaElement>(
                `[data-child-comment-id="${CSS.escape(childId)}"] [data-testid='child-comment-input']`,
              )
            : null;
          const next = input?.value.trim() ?? "";
          if (childId && next) {
            const source = state.mode === "markdown" ? editor.value : state.body;
            state.body = editCommentBody(source, childId, next);
            if (state.mode === "markdown") syncMarkdownEditorSurface();
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            commitHistory();
            editingChildCommentIds.delete(childId);
            changed = true;
            refreshAfterCommentMutation();
          }
        } else if (action === "cancel-child-comment") {
          const childId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.childId;
          if (childId) {
            editingChildCommentIds.delete(childId);
            renderCommentCards();
          }
        } else if (action === "remove-child-comment") {
          const childId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.childId;
          if (childId) {
            const source = state.mode === "markdown" ? editor.value : state.body;
            state.body = removeComment(source, childId);
            if (state.mode === "markdown") syncMarkdownEditorSurface();
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            commitHistory();
            changed = true;
            refreshAfterCommentMutation();
          }
        } else if (action === "remove-suggestion") {
          const suggestionId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.suggestionId;
          if (suggestionId) {
            const source = state.mode === "markdown" ? editor.value : state.body;
            state.body = removeComment(source, suggestionId);
            if (state.mode === "markdown") syncMarkdownEditorSurface();
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            commitHistory();
            changed = true;
            refreshAfterCommentMutation();
          }
        } else if (action === "remove") {
          const source = state.mode === "markdown" ? editor.value : state.body;
          state.body = removeComment(source, comment.id);
          if (state.mode === "markdown") syncMarkdownEditorSurface();
          state.markdown = composeMarkdown(state);
          state.dirty = true;
          commitHistory();
          draftCommentIds.delete(comment.id);
          editingCommentIds.delete(comment.id);
          commentDrafts.delete(comment.id);
          changed = true;
          refreshAfterCommentMutation();
        } else {
          if (state.mode === "markdown") {
            const range = sourceSelectionRangeForComment(comment);
            if (range) {
              editor.focus();
              editor.setSelectionRange(range.start, range.end);
              scrollTextareaSelectionIntoView(editor, range.start);
            }
          } else {
            rendered
              .querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(comment.id)}"]`)
              ?.scrollIntoView({
                block: "center",
              });
          }
          state.activeCommentId = comment.id;
          activeReviewSuggestionId = null;
          updateReviewSuggestionActiveClasses();
          if (state.mode === "rendered" || state.mode === "review") {
            decorateRenderedComments(rendered, state.body, state.activeCommentId);
            positionImageCommentAnchors(rendered, state, activateReviewSuggestionForComment);
          }
          renderCommentCards();
        }
        if (changed) {
          if (state.mode === "markdown") {
            renderMarkdownHighlights();
            layoutCommentCards();
          }
          setStatus("Modified");
        }
      };
      card.onkeydown = (event) => {
        if (event.key !== "Escape") return;
        const input = (event.target as HTMLElement).closest("[data-testid='comment-input']");
        if (!input) return;
        event.preventDefault();
        if (draftCommentIds.has(comment.id)) {
          const source = state.mode === "markdown" ? editor.value : state.body;
          state.body = removeComment(source, comment.id);
          if (state.mode === "markdown") syncMarkdownEditorSurface();
          state.markdown = composeMarkdown(state);
          state.dirty = true;
          commitHistory();
          draftCommentIds.delete(comment.id);
          editingCommentIds.delete(comment.id);
          commentDrafts.delete(comment.id);
          if (state.activeCommentId === comment.id) state.activeCommentId = null;
          refreshAfterCommentMutation();
          setStatus("Modified");
        } else {
          editingCommentIds.delete(comment.id);
          commentDrafts.delete(comment.id);
          renderCommentCards();
        }
      };
      nextCards.push(card);
    }
    for (const discussion of reviewDiscussions) {
      const cardId = `suggestion:${discussion.suggestion.id}`;
      const existingCard = existingCards.get(cardId);
      const card = existingCard ?? document.createElement("section");
      card.className = "local-md-comment-card local-md-suggestion-discussion-card";
      if (!existingCard) {
        card.classList.add("local-md-comment-card-placing");
        newCards.push(card);
      }
      card.dataset.cardId = cardId;
      card.dataset.suggestionId = discussion.suggestion.id;
      delete card.dataset.commentId;
      card.dataset.commentState = discussion.suggestion.missingDefinition ? "broken" : "current";
      card.classList.toggle(
        "local-md-comment-card-active",
        activeReviewSuggestionId === discussion.suggestion.id ||
          Boolean(
            state.activeCommentId &&
            [...discussion.addressedComments, ...discussion.suggestionComments].some(
              (comment) => comment.id === state.activeCommentId,
            ),
          ),
      );
      card.dataset.testid = "suggestion-discussion-card";
      card.innerHTML = `
        <div class="local-md-comment-card-header">
          <strong>Suggestion discussion</strong>
          <div class="local-md-review-actions">
            <button type="button" data-action="apply-review-suggestion" aria-label="Apply suggestion" title="Apply suggestion">${uiIcon("check")}</button>
            <button type="button" data-action="discard-review-suggestion" aria-label="Discard suggestion" title="Discard suggestion">${uiIcon("x")}</button>
          </div>
        </div>
        <section class="local-md-review-discussion-section">
          <h3>Should address</h3>
          ${
            discussion.addressedComments.length > 0
              ? discussion.addressedComments
                  .map((comment) => renderReviewCommentBox(comment))
                  .join("")
              : `<p class="local-md-muted">No linked comments.</p>`
          }
        </section>
        <section class="local-md-review-discussion-section">
          <h3>On suggestion</h3>
          ${
            discussion.suggestionComments.length > 0
              ? discussion.suggestionComments
                  .map((comment) => renderReviewCommentBox(comment))
                  .join("")
              : `<p class="local-md-muted">No comments yet.</p>`
          }
        </section>
      `;
      card.onclick = (event) => {
        const action = (event.target as HTMLElement).closest<HTMLButtonElement>("button")?.dataset
          .action;
        if (!action && activeReviewSuggestionId !== discussion.suggestion.id) {
          activeReviewSuggestionId = discussion.suggestion.id;
          updateReviewSuggestionActiveClasses();
          if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
          renderCommentCards();
          layoutCommentCards();
          return;
        }
        if (action === "apply-review-suggestion") {
          state.body = discussion.suggestion.targetBlockId
            ? applyBlockOperationSuggestion(state.body, discussion.suggestion.id)
            : applyReviewSuggestionToMarkdown(state.body, discussion.suggestion.id);
          state.markdown = composeMarkdown(state);
          state.dirty = true;
          commitHistory();
          void render();
          setStatus("Modified");
          return;
        }
        if (action === "discard-review-suggestion") {
          state.body = removeComment(state.body, discussion.suggestion.id);
          state.markdown = composeMarkdown(state);
          state.dirty = true;
          commitHistory();
          void render();
          setStatus("Modified");
          return;
        }
        if (action === "edit-review-comment") {
          const commentId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.commentId;
          if (commentId) {
            editingCommentIds.add(commentId);
            renderCommentCards();
            focusCommentInput(commentId);
          }
          return;
        }
        if (action === "remove-review-comment") {
          const commentId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.commentId;
          if (commentId) {
            state.body = removeComment(state.body, commentId);
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            commitHistory();
            draftCommentIds.delete(commentId);
            editingCommentIds.delete(commentId);
            commentDrafts.delete(commentId);
            if (state.activeCommentId === commentId) state.activeCommentId = null;
            void render();
            setStatus("Modified");
          }
          return;
        }
        if (action === "save-review-comment") {
          const commentId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.commentId;
          const input = commentId
            ? card.querySelector<HTMLTextAreaElement>(
                `[data-review-comment-id="${CSS.escape(commentId)}"] [data-testid='comment-input']`,
              )
            : null;
          const next = input?.value.trim() ?? "";
          if (commentId && next) {
            const wasDraft = draftCommentIds.has(commentId);
            state.body = editCommentBody(state.body, commentId, next);
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            if (wasDraft) history.replace(state.markdown);
            else commitHistory();
            draftCommentIds.delete(commentId);
            editingCommentIds.delete(commentId);
            commentDrafts.delete(commentId);
            state.activeCommentId = commentId;
            void render();
            setStatus("Modified");
          }
          return;
        }
        if (action === "cancel-review-comment") {
          const commentId = (event.target as HTMLElement).closest<HTMLButtonElement>("button")
            ?.dataset.commentId;
          if (commentId && draftCommentIds.has(commentId)) {
            state.body = removeComment(state.body, commentId);
            state.markdown = composeMarkdown(state);
            state.dirty = true;
            draftCommentIds.delete(commentId);
            editingCommentIds.delete(commentId);
            commentDrafts.delete(commentId);
            if (state.activeCommentId === commentId) state.activeCommentId = null;
            commitHistory();
            void render();
            setStatus("Modified");
          } else if (commentId) {
            editingCommentIds.delete(commentId);
            commentDrafts.delete(commentId);
            renderCommentCards();
          }
          return;
        }
        const commentId = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-review-comment-id]",
        )?.dataset.reviewCommentId;
        if (commentId) {
          state.activeCommentId = commentId;
          decorateRenderedComments(rendered, state.body, state.activeCommentId);
          renderCommentCards();
        }
      };
      nextCards.push(card);
    }
    let insertionPoint: ChildNode | null = commentsColumn.firstChild;
    for (const card of nextCards) {
      if (card === insertionPoint) {
        insertionPoint = card.nextSibling;
      } else {
        commentsColumn.insertBefore(card, insertionPoint);
      }
    }
    const nextCardIds = new Set(nextCards.map((card) => card.dataset.cardId).filter(Boolean));
    for (const [id, card] of existingCards) {
      if (!id || !nextCardIds.has(id)) card.remove();
    }
    resizeCommentTextareas();
    layoutCommentCards();
    if (newCards.length > 0) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          for (const card of newCards) card.classList.remove("local-md-comment-card-placing");
        });
      });
    }
  };

  const focusCommentInput = (id: string) => {
    requestAnimationFrame(() => {
      const input =
        commentsColumn.querySelector<HTMLTextAreaElement>(
          `.local-md-comment-card[data-comment-id="${CSS.escape(id)}"] [data-testid='comment-input']`,
        ) ??
        commentsColumn.querySelector<HTMLTextAreaElement>(
          `.local-md-comment-card [data-review-comment-id="${CSS.escape(id)}"] [data-testid='comment-input']`,
        );
      input?.focus();
      input?.select();
      if (input) {
        resizeCommentTextarea(input);
        scheduleCommentLayout();
      }
    });
  };

  const markNewestCommentAsDraft = (previousIds: Set<string>) => {
    const created = parseComments(state.body).find((comment) => !previousIds.has(comment.id));
    if (!created) return;
    state.activeCommentId = created.id;
    draftCommentIds.add(created.id);
    editingCommentIds.add(created.id);
  };

  const flushPendingCommentEditors = () => {
    let source = state.mode === "markdown" ? editor.value : state.body;
    let changed = false;

    for (const card of commentsColumn.querySelectorAll<HTMLElement>(".local-md-comment-card")) {
      const id = card.dataset.commentId;
      if (!id) continue;

      const commentInput = card.querySelector<HTMLTextAreaElement>("[data-testid='comment-input']");
      const nextComment = commentInput?.value.trim() ?? "";
      if (commentInput && nextComment) {
        source = editCommentBody(source, id, nextComment);
        draftCommentIds.delete(id);
        editingCommentIds.delete(id);
        commentDrafts.delete(id);
        state.activeCommentId = id;
        changed = true;
      }

      for (const childInput of card.querySelectorAll<HTMLTextAreaElement>(
        "[data-child-comment-id] [data-testid='child-comment-input']",
      )) {
        const childId =
          childInput.closest<HTMLElement>("[data-child-comment-id]")?.dataset.childCommentId;
        const nextChildComment = childInput.value.trim();
        if (!childId || !nextChildComment) continue;
        source = editCommentBody(source, childId, nextChildComment);
        editingChildCommentIds.delete(childId);
        changed = true;
      }

      const replyInput = card.querySelector<HTMLTextAreaElement>(
        "[data-testid='comment-reply-input']",
      );
      const reply = replyInput?.value.trim() ?? "";
      if (reply) {
        source = createChildComment(source, id, reply);
        replyDrafts.delete(id);
        changed = true;
      }
    }

    if (!changed) return false;
    state.body = source;
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    if (state.mode === "markdown") syncMarkdownEditorSurface();
    renderCommentCards();
    commitHistory();
    return true;
  };

  const layoutCommentCards = () => {
    const cards = Array.from(
      commentsColumn.querySelectorAll<HTMLElement>(".local-md-comment-card"),
    );
    const positionedMode =
      state.mode === "rendered" || state.mode === "review" || state.mode === "markdown";
    commentsColumn.classList.toggle(
      "local-md-comments-positioned",
      positionedMode && cards.length > 0,
    );
    if (!positionedMode || cards.length === 0) {
      commentsColumn.style.minHeight = "";
      for (const card of cards) card.style.removeProperty("--comment-y");
      return;
    }

    const reviewAnalysis = state.mode === "review" ? analyzeReview(state.body) : null;
    const comments = reviewAnalysis?.comments ?? parseComments(state.body);
    const documentRect = documentPane.getBoundingClientRect();
    const commentItems = comments
      .map((comment) => {
        const card = commentsColumn.querySelector<HTMLElement>(
          `.local-md-comment-card[data-card-id="comment:${CSS.escape(comment.id)}"]`,
        );
        if (!card || comment.kind === "dangling") return null;
        const desiredTop =
          state.mode === "review"
            ? (reviewCommentAnchorRect(
                rendered,
                reviewAnalysis?.suggestionIdByCommentId.get(comment.id),
              )?.top ??
                renderedCommentAnchorRect(rendered, state.body, comment)?.top ??
                documentRect.top) - documentRect.top
            : state.mode === "rendered"
              ? (renderedCommentAnchorRect(rendered, state.body, comment)?.top ??
                  documentRect.top) - documentRect.top
              : markdownAnchorTop(editor, comment.markerSourceStart);
        return {
          card,
          keyId: comment.id,
          active: comment.id === state.activeCommentId,
          desiredTop: Math.max(0, desiredTop),
          orderOffset: comment.kind === "image" ? comment.y / 10000 + comment.x / 100000000 : 0,
          height: card.offsetHeight,
          y: 0,
        };
      })
      .filter((item): item is CommentLayoutItem => Boolean(item));
    const suggestionItems =
      state.mode === "review"
        ? (reviewAnalysis?.discussions ?? [])
            .map((suggestion) => {
              const card = commentsColumn.querySelector<HTMLElement>(
                `.local-md-comment-card[data-card-id="suggestion:${CSS.escape(suggestion.suggestion.id)}"]`,
              );
              const region = rendered.querySelector<HTMLElement>(
                `.local-md-review-suggestion[data-suggestion-id="${CSS.escape(suggestion.suggestion.id)}"]`,
              );
              if (!card || !region) return null;
              return {
                card,
                keyId: suggestion.suggestion.id,
                active:
                  (!state.activeCommentId &&
                    activeReviewSuggestionId === suggestion.suggestion.id) ||
                  Boolean(
                    state.activeCommentId &&
                    [...suggestion.addressedComments, ...suggestion.suggestionComments].some(
                      (comment) => comment.id === state.activeCommentId,
                    ),
                  ),
                desiredTop: region.getBoundingClientRect().top - documentRect.top,
                orderOffset: 0,
                height: card.offsetHeight,
                y: 0,
              };
            })
            .filter((item): item is CommentLayoutItem => Boolean(item))
        : [];
    const items = [...commentItems, ...suggestionItems].sort(
      (left, right) => left.desiredTop + left.orderOffset - (right.desiredTop + right.orderOffset),
    );

    const activeIndex = items.findIndex((item) => item.active);
    if (activeIndex === -1) {
      layoutCommentStack(items, items[0]?.desiredTop ?? 0);
    } else {
      layoutCommentStack(items.slice(activeIndex), items[activeIndex]?.desiredTop ?? 0);
      for (let index = activeIndex - 1; index >= 0; index -= 1) {
        const next = items[index + 1];
        const item = items[index];
        if (!item || !next) continue;
        item.y = Math.min(item.desiredTop, next.y - item.height - commentCardGap);
      }
    }

    let maxBottom = 0;
    for (const item of items) {
      item.card.style.setProperty("--comment-y", `${Math.round(item.y)}px`);
      maxBottom = Math.max(maxBottom, item.y + item.height);
    }
    commentsColumn.style.minHeight = `${Math.ceil(Math.max(maxBottom, documentPane.offsetHeight))}px`;
  };

  const syncMarkdownEditorFromTextarea = () => {
    state.body = editor.value;
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    syncMarkdownEditorSurface();
    scheduleTypingHistory();
    setStatus("Modified");
  };

  const applyMarkdownInsertion = (snippet: string, selectedText: string) => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end);
    const next = selected ? snippet.replace(selectedText, selected) : snippet;
    editor.setRangeText(next, start, end, "select");
    syncMarkdownEditorFromTextarea();
  };

  const wrapMarkdownSelection = (before: string, after: string, placeholder: string) => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || placeholder;
    editor.setRangeText(`${before}${selected}${after}`, start, end, "select");
    syncMarkdownEditorFromTextarea();
  };

  const prefixMarkdownLines = (prefix: string) => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = value.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const lines = value.slice(lineStart, lineEnd).split("\n");
    const next = lines
      .map((line) => line.replace(/^(?:#{1,6}\s+|>\s+|- \[ \]\s+|- \s+|\d+\.\s+)/, ""))
      .map((line) => (prefix ? `${prefix}${line}` : line))
      .join("\n");
    editor.setRangeText(next, lineStart, lineEnd, "select");
    syncMarkdownEditorFromTextarea();
  };

  const closeFormatMenu = () => {
    const menu = toolbarActions.querySelector<HTMLElement>(".local-md-format-menu");
    const trigger = toolbarActions.querySelector<HTMLButtonElement>("[data-format-trigger]");
    menu?.classList.remove("local-md-format-menu-open");
    trigger?.setAttribute("aria-expanded", "false");
  };

  const toggleFormatMenu = () => {
    const menu = toolbarActions.querySelector<HTMLElement>(".local-md-format-menu");
    const trigger = toolbarActions.querySelector<HTMLButtonElement>("[data-format-trigger]");
    const open = !menu?.classList.contains("local-md-format-menu-open");
    menu?.classList.toggle("local-md-format-menu-open", open);
    trigger?.setAttribute("aria-expanded", String(open));
  };

  const updateFormatLabel = (command: string) => {
    const labels: Record<string, string> = {
      paragraph: "Normal",
      "heading-1": "Heading 1",
      "heading-2": "Heading 2",
      "heading-3": "Heading 3",
    };
    const label = labels[command];
    const target = toolbarActions.querySelector<HTMLElement>("[data-format-label]");
    if (label && target) target.textContent = label;
  };

  const closeModeMenu = () => {
    const menu = toolbarActions.querySelector<HTMLElement>(".local-md-mode-menu");
    const trigger = toolbarActions.querySelector<HTMLButtonElement>("[data-mode-trigger]");
    menu?.classList.remove("local-md-mode-menu-open");
    trigger?.setAttribute("aria-expanded", "false");
  };

  const toggleModeMenu = () => {
    const menu = toolbarActions.querySelector<HTMLElement>(".local-md-mode-menu");
    const trigger = toolbarActions.querySelector<HTMLButtonElement>("[data-mode-trigger]");
    const open = !menu?.classList.contains("local-md-mode-menu-open");
    closeFormatMenu();
    menu?.classList.toggle("local-md-mode-menu-open", open);
    trigger?.setAttribute("aria-expanded", String(open));
  };

  const updateModeTrigger = (mode: AppState["mode"]) => {
    const labels: Record<AppState["mode"], string> = {
      rendered: "Editing",
      review: "Suggestions",
      markdown: "Markdown",
    };
    const icons: Record<AppState["mode"], "markdown" | "pencil" | "suggestion"> = {
      rendered: "pencil",
      review: "suggestion",
      markdown: "markdown",
    };
    const trigger = toolbarActions.querySelector<HTMLButtonElement>("[data-mode-trigger]");
    if (!trigger) return;
    trigger.innerHTML = `${uiIcon(icons[mode])}<span data-mode-label>${labels[mode]}</span>${uiIcon("chevron-down")}`;
  };

  const applyMarkdownCommand = (command: string) => {
    if (command === "paragraph") return prefixMarkdownLines("");
    if (command === "heading-1") return prefixMarkdownLines("# ");
    if (command === "heading-2") return prefixMarkdownLines("## ");
    if (command === "heading-3") return prefixMarkdownLines("### ");
    if (command === "bold") return wrapMarkdownSelection("**", "**", "bold text");
    if (command === "italic") return wrapMarkdownSelection("_", "_", "emphasis");
    if (command === "underline") return wrapMarkdownSelection("<u>", "</u>", "underlined text");
    if (command === "strike") return wrapMarkdownSelection("~~", "~~", "removed text");
    if (command === "inline-code") return wrapMarkdownSelection("`", "`", "code");
    if (command === "code-block") return wrapMarkdownSelection("```\n", "\n```", "code");
    if (command === "ordered-list") return prefixMarkdownLines("1. ");
    if (command === "unordered-list") return prefixMarkdownLines("- ");
    if (command === "task-list") return prefixMarkdownLines("- [ ] ");
    if (command === "blockquote") return prefixMarkdownLines("> ");
  };

  const runToolbarCommand = async (command: string) => {
    if (command === "comment") {
      await addComment();
      return;
    }
    if (state.mode === "markdown") {
      if (command === "image") return applyMarkdownInsertion("![alt text](image.png)", "alt text");
      if (command === "link")
        return applyMarkdownInsertion("[link text](https://example.com)", "link text");
      applyMarkdownCommand(command);
      return;
    }
    if (command === "image" || command === "link") {
      await setMode("markdown");
      if (command === "image") applyMarkdownInsertion("![alt text](image.png)", "alt text");
      else applyMarkdownInsertion("[link text](https://example.com)", "link text");
      return;
    }
    rendered.focus();
    const exec = (name: string, value?: string) => {
      document.execCommand(name, false, value);
      rendered.dispatchEvent(
        new InputEvent("input", { bubbles: true, inputType: `format${name}` }),
      );
    };
    const block = (tagName: string) => exec("formatBlock", tagName);
    if (command === "paragraph") block("p");
    else if (command === "heading-1") block("h1");
    else if (command === "heading-2") block("h2");
    else if (command === "heading-3") block("h3");
    else if (command === "bold") exec("bold");
    else if (command === "italic") exec("italic");
    else if (command === "underline") exec("underline");
    else if (command === "strike") exec("strikeThrough");
    else if (command === "ordered-list") exec("insertOrderedList");
    else if (command === "unordered-list") exec("insertUnorderedList");
    else if (command === "blockquote") block("blockquote");
    else if (command === "inline-code" || command === "code-block") block("pre");
  };

  const setMode = async (mode: AppState["mode"]) => {
    if (state.mode === "markdown" && mode !== "markdown") {
      state.body = state.includeBlockIds
        ? ensureDocumentBlockIds(editor.value)
        : stripDocumentBlockIds(editor.value);
      editor.value = state.body;
      await render();
    }
    if (state.mode === "review" && mode !== "review") {
      await syncReviewToMarkdown();
    }
    state.mode = mode;
    frontmatterHeader.hidden = mode === "markdown" || !frontmatterHeader.innerHTML.trim();
    rendered.hidden = mode === "markdown";
    markdownLayer.hidden = mode !== "markdown";
    editor.hidden = mode !== "markdown";
    renderedButton.setAttribute("aria-pressed", String(mode === "rendered"));
    reviewButton.setAttribute("aria-pressed", String(mode === "review"));
    markdownButton.setAttribute("aria-pressed", String(mode === "markdown"));
    updateModeTrigger(mode);
    closeModeMenu();
    reviewDiffControl.hidden = mode !== "review";
    if (mode === "markdown") {
      syncMarkdownEditorSurface();
      selectionToolbar.hidden = true;
    } else {
      markdownHighlights.textContent = "";
      await render();
    }
    refreshActiveComment();
    renderCommentCards();
    layoutCommentCards();
    updateSelectionToolbar();
  };

  const addComment = async () => {
    const previousIds = new Set(parseComments(state.body).map((comment) => comment.id));

    if (state.mode === "markdown") {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      state.body =
        start !== end
          ? createRangeComment(editor.value, start, end, "")
          : createBlockComment(editor.value, start, "");
      editor.value = state.body;
      markNewestCommentAsDraft(previousIds);
      state.markdown = composeMarkdown(state);
      state.dirty = true;
      commitHistory();
      renderCommentCards();
      refreshActiveComment();
      focusCommentInput(state.activeCommentId ?? "");
      setStatus("Modified");
      return;
    }

    const selection = document.getSelection();
    if (state.mode === "review") {
      const reviewComment = createReviewSuggestionComment(rendered, state.body, selection);
      if (reviewComment) {
        state.body = reviewComment.markdown;
        markNewestCommentAsDraft(previousIds);
        state.markdown = composeMarkdown(state);
        state.dirty = true;
        commitHistory();
        await render();
        focusCommentInput(state.activeCommentId ?? "");
        selectionToolbar.hidden = true;
        setStatus("Modified");
        return;
      }
    }
    const codeSelection = resolveCodeCommentSelection(rendered, state.body, selection);
    const selectedRange = resolveSelectionToSourceRange(rendered, state.body, selection);
    const blockEnd = resolveSelectionBlockEndToSourcePosition(rendered, state.body, selection);
    state.body = codeSelection
      ? createCodeComment(
          state.body,
          codeSelection.codeSourceStart,
          codeSelection.line,
          codeSelection.col,
          codeSelection.length,
          "",
        )
      : selectedRange
        ? createRangeComment(state.body, selectedRange.start, selectedRange.end, "")
        : createBlockComment(state.body, blockEnd ?? state.body.length, "");
    markNewestCommentAsDraft(previousIds);
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    commitHistory();
    await render();
    focusCommentInput(state.activeCommentId ?? "");
    selectionToolbar.hidden = true;
    setStatus("Modified");
  };

  const readHandleFile = async (
    handle: WritableFileHandle,
  ): Promise<{ contents: string; lastModified: number | null } | null> => {
    if (!handle.getFile) return null;
    try {
      const file = await handle.getFile();
      return { contents: await file.text(), lastModified: file.lastModified ?? null };
    } catch {
      return null;
    }
  };

  const rememberFileWatchSnapshot = async (handle: WritableFileHandle, knownContents?: string) => {
    const file = await readHandleFile(handle);
    fileWatchLastContents = knownContents ?? file?.contents ?? null;
    fileWatchLastModified = file?.lastModified ?? null;
  };

  const reloadChangedFile = async () => {
    if (!state.handle || fileWatchReloading) return;
    fileWatchReloading = true;
    try {
      const file = await readHandleFile(state.handle);
      if (!file) return;
      const unchangedByContent =
        fileWatchLastContents !== null && file.contents === fileWatchLastContents;
      const unchangedByTime =
        fileWatchLastContents === null &&
        file.lastModified !== null &&
        file.lastModified === fileWatchLastModified;
      if (unchangedByContent || unchangedByTime) return;

      const currentContents = serializeFile(currentMarkdownSnapshot());
      if (file.contents === currentContents) {
        fileWatchLastContents = file.contents;
        fileWatchLastModified = file.lastModified;
        return;
      }

      if (state.dirty) {
        pendingExternalFile = file;
        externalChangeToast.hidden = false;
        setStatus("External changes available");
        return;
      }

      pendingExternalFile = null;
      externalChangeToast.hidden = true;
      fileWatchLastContents = file.contents;
      fileWatchLastModified = file.lastModified;
      await applyExternalMarkdownSnapshot(loadMarkdownFromSerializedFile(file.contents));
    } catch {
      setStatus("Reload failed", true);
    } finally {
      fileWatchReloading = false;
    }
  };

  const reloadFileFromDisk = async () => {
    if (pendingExternalFile && !externalChangeToast.hidden) {
      const file = pendingExternalFile;
      fileWatchLastContents = file.contents;
      fileWatchLastModified = file.lastModified;
      await applyExternalMarkdownSnapshot(loadMarkdownFromSerializedFile(file.contents));
      return;
    }
    if (fileWatchReloading) return;
    fileWatchReloading = true;
    try {
      if (!state.handle) {
        state.handle = await resolveCurrentFileHandle(true);
        if (state.handle) useResolvedFileHandle(state.handle);
      }
      if (!state.handle) {
        setStatus("File not available", true);
        return;
      }
      const file = await readHandleFile(state.handle);
      if (!file) {
        setStatus("Reload failed", true);
        return;
      }
      if (state.dirty) {
        pendingExternalFile = file;
        externalChangeToast.hidden = false;
        setStatus("External changes available");
        return;
      }
      fileWatchLastContents = file.contents;
      fileWatchLastModified = file.lastModified;
      await applyExternalMarkdownSnapshot(loadMarkdownFromSerializedFile(file.contents));
    } catch {
      setStatus("Reload failed", true);
    } finally {
      fileWatchReloading = false;
    }
  };

  const stopFileWatch = () => {
    fileObserver?.disconnect();
    fileObserver = null;
    window.clearInterval(filePollTimer);
    filePollTimer = 0;
  };

  const startFileWatch = async (handle: WritableFileHandle, knownContents?: string) => {
    stopFileWatch();
    if (!handle.getFile) return;
    await rememberFileWatchSnapshot(handle, knownContents);

    const Observer = (window as Window & { FileSystemObserver?: FileSystemObserverConstructor })
      .FileSystemObserver;
    if (Observer) {
      try {
        fileObserver = new Observer(() => {
          void reloadChangedFile();
        });
        await fileObserver.observe(handle);
        return;
      } catch {
        fileObserver?.disconnect();
        fileObserver = null;
      }
    }

    filePollTimer = window.setInterval(() => {
      void reloadChangedFile();
    }, fileWatchPollingInterval);
  };

  const useResolvedFileHandle = (handle: WritableFileHandle, knownContents?: string) => {
    logFileHandling("use resolved file handle", {
      handleName: handle.name ?? "(unnamed)",
      hasGetFile: typeof handle.getFile === "function",
      hasCreateWritable: typeof handle.createWritable === "function",
      knownContentsLength: knownContents?.length ?? null,
    });
    state.handle = handle;
    updateFolderButton();
    void rememberFileHandle(window, handleStorageKey(window.location), handle);
    void startFileWatch(handle, knownContents);
  };

  const resolveFileFromRememberedFolders = async (
    allowPermissionPrompt: boolean,
  ): Promise<WritableFileHandle | null> => {
    const directories = await restoreDirectoryHandles(window);
    const identity = await openedFileIdentityPromise;
    logFileHandling("restore remembered folders", {
      count: directories.length,
      allowPermissionPrompt,
      location: window.location.href,
      openedHash: identity?.hash ?? null,
      openedLength: identity?.length ?? null,
      openedSource: identity?.source ?? null,
    });
    for (const directory of directories) {
      logFileHandling("try remembered folder", { name: directory.name ?? "(unnamed)" });
      const handle = await resolveFileHandleFromDirectory(
        directory,
        window.location,
        allowPermissionPrompt,
        identity ?? null,
      );
      if (handle) {
        logFileHandling("remembered folder resolved file", {
          folderName: directory.name ?? "(unnamed)",
          handleName: handle.name ?? "(unnamed)",
        });
        return handle;
      }
    }
    logFileHandling("remembered folders did not resolve current file");
    return null;
  };

  const pickFolderAndResolveFile = async (): Promise<WritableFileHandle | null> => {
    logFileHandling("choose folder requested", {
      copiedParentPath: parentFolderPathFromLocation(window.location),
      suggestedName: suggestedFileNameFromLocation(window.location),
    });
    await copyCurrentParentPathToClipboard(window);
    const directory = await pickDirectoryTarget(window);
    if (!directory) {
      logFileHandling("folder picker cancelled");
      return null;
    }
    logFileHandling("folder picked", { name: directory.name ?? "(unnamed)" });
    const identity = await openedFileIdentityPromise;
    const handle = await resolveFileHandleFromDirectory(
      directory,
      window.location,
      true,
      identity ?? null,
    );
    if (handle) {
      logFileHandling("picked folder resolved file", {
        folderName: directory.name ?? "(unnamed)",
        handleName: handle.name ?? "(unnamed)",
      });
      void rememberDirectoryHandle(window, directory);
      return handle;
    }
    logFileHandling("picked folder did not include current file", {
      folderName: directory.name ?? "(unnamed)",
      candidates: candidateFilePathsForDirectory(directory, window.location).map((path) =>
        path.join("/"),
      ),
    });
    window.alert(
      `The selected folder does not include ${suggestedFileNameFromLocation(window.location)}.`,
    );
    setStatus("File not in folder", true);
    return null;
  };

  const resolveCurrentFileHandle = async (
    allowDirectoryPicker: boolean,
  ): Promise<WritableFileHandle | null> => {
    logFileHandling("resolve current file handle", {
      allowDirectoryPicker,
      hasExistingHandle: Boolean(state.handle),
      hasDirectoryPicker: hasDirectoryPicker(window),
    });
    const remembered = await resolveFileFromRememberedFolders(allowDirectoryPicker);
    if (remembered) {
      useResolvedFileHandle(remembered);
      return remembered;
    }
    if (!allowDirectoryPicker) {
      logFileHandling("resolve current file handle stopped before picker");
      return null;
    }
    const picked = await pickFolderAndResolveFile();
    if (picked) useResolvedFileHandle(picked);
    else logFileHandling("resolve current file handle failed");
    return picked;
  };

  const save = async (forcePick: boolean) => {
    try {
      logFileHandling("save start", {
        forcePick,
        mode: state.mode,
        hasHandle: Boolean(state.handle),
        handleName: state.handle?.name ?? null,
        dirty: state.dirty,
        location: window.location.href,
      });
      state.frontmatter = frontmatterEditor.value;
      if (state.mode === "rendered") {
        logFileHandling("save sync rendered to markdown");
        await syncRenderedToMarkdown(rendered, state);
      } else if (state.mode === "review") {
        logFileHandling("save sync review to markdown");
        await syncReviewToMarkdown();
      } else {
        logFileHandling("save read markdown textarea", { valueLength: editor.value.length });
        state.body = editor.value;
      }
      flushPendingCommentEditors();
      state.body = state.includeBlockIds
        ? ensureDocumentBlockIds(state.body)
        : stripDocumentBlockIds(state.body);
      if (state.mode === "markdown") editor.value = state.body;
      state.markdown = composeMarkdown(state);
      const contents = serializeFile(state.markdown);
      const suggestedName = suggestedFileNameFromLocation(window.location);
      logFileHandling("save composed contents", {
        markdownLength: state.markdown.length,
        serializedLength: contents.length,
        suggestedName,
      });
      if (forcePick || !state.handle) {
        if (forcePick) {
          logFileHandling("save force pick file");
          state.handle = await pickSaveTarget(window, { suggestedName });
          if (state.handle) useResolvedFileHandle(state.handle);
        } else {
          state.handle = await resolveCurrentFileHandle(true);
          if (!state.handle && !hasDirectoryPicker(window)) {
            logFileHandling("save fallback to file picker because directory picker is unavailable");
            state.handle = await pickSaveTarget(window, { suggestedName });
            if (state.handle) useResolvedFileHandle(state.handle);
          }
        }
      }
      if (!state.handle && !forcePick && hasDirectoryPicker(window)) {
        logFileHandling("save stopped without handle after folder flow", {
          status: status.textContent,
        });
        return;
      }
      if (state.handle) {
        logFileHandling("save writing file", {
          handleName: state.handle.name ?? "(unnamed)",
          contentsLength: contents.length,
        });
        await writeFile(state.handle, contents);
        logFileHandling("save write complete", { handleName: state.handle.name ?? "(unnamed)" });
        await rememberFileWatchSnapshot(state.handle, contents);
        void startFileWatch(state.handle, contents);
      } else if (!("showSaveFilePicker" in window)) {
        logFileHandling("save using download fallback");
        downloadFallback(state.markdown, document, suggestedName);
      } else {
        logFileHandling("save no handle and no fallback; keeping modified");
        setStatus("Modified");
        return;
      }
      state.dirty = false;
      pendingExternalFile = null;
      externalChangeToast.hidden = true;
      setStatus("Saved");
      logFileHandling("save finished", { status: status.textContent });
    } catch (error) {
      logFileHandling("save failed", {
        handleName: state.handle?.name ?? null,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
      setStatus("Save failed", true);
    }
  };

  const currentReportSelection = () => {
    if (state.mode === "markdown") {
      return {
        text: editor.value.slice(editor.selectionStart, editor.selectionEnd),
        start: editor.selectionStart,
        end: editor.selectionEnd,
      };
    }
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return {
        text: "",
        start: null,
        end: null,
      };
    }
    const sourceRange =
      state.mode === "rendered"
        ? resolveSelectionToSourceRange(rendered, state.body, selection)
        : null;
    return {
      text: selection.toString(),
      start: sourceRange?.start ?? null,
      end: sourceRange?.end ?? null,
    };
  };

  const downloadReportCase = async () => {
    const description = window.prompt(
      "What went wrong? Describe the shortest reproducible problem.",
    );
    if (description === null) return;
    try {
      state.frontmatter = frontmatterEditor.value;
      if (state.mode === "rendered") await syncRenderedToMarkdown(rendered, state);
      else if (state.mode === "review") await syncReviewToMarkdown();
      else state.body = editor.value;
      flushPendingCommentEditors();
      state.markdown = composeMarkdown(state);
      const report = createRoundtripReportCase({
        markdown: state.markdown,
        description,
        context: {
          location: window.location.href,
          mode: state.mode,
          reviewDiffMode: state.reviewDiffMode,
          activeCommentId: state.activeCommentId,
          selection: currentReportSelection(),
        },
      });
      downloadJsonFile(report, reportFileName(report), document);
      setStatus("Report downloaded");
    } catch (error) {
      if (development) console.error(error);
      setStatus("Report failed", true);
    }
  };

  trackComposition(rendered, state);
  rendered.addEventListener("beforeinput", (event) => {
    pendingReviewOriginalBlockEdit =
      state.mode === "review"
        ? reviewOriginalBlockSelectionRange(rendered, document.getSelection(), event)
        : null;
  });
  rendered.addEventListener("input", () => {
    if (state.composing) return;
    setStatus("Modified");
    const sync =
      state.mode === "review"
        ? syncReviewToMarkdown
        : () => syncRenderedToMarkdown(rendered, state);
    void sync()
      .then(async (result) => {
        if (isReviewSyncResult(result) && result.needsRender) {
          await render();
          restoreReviewSuggestionCaret(result.focusSuggestionId, result.focusTextOffset);
          scheduleTypingHistory();
          return;
        }
        if (state.mode === "review") await refreshReviewDiffDecorations();
        decorateRenderedComments(rendered, state.body, state.activeCommentId);
        positionImageCommentAnchors(rendered, state, activateReviewSuggestionForComment);
        renderCommentCards();
        layoutCommentCards();
        scheduleTypingHistory();
      })
      .catch((error: unknown) => {
        setStatus("Sync failed", true);
        if (development) console.error(error);
      });
  });
  rendered.addEventListener("local-md-sync", () => {
    setStatus("Modified");
    const sync =
      state.mode === "review"
        ? syncReviewToMarkdown
        : () => syncRenderedToMarkdown(rendered, state);
    void sync().then((result) => {
      if (isReviewSyncResult(result) && result.needsRender) {
        void render();
        return;
      }
      void (async () => {
        if (state.mode === "review") await refreshReviewDiffDecorations();
        decorateRenderedComments(rendered, state.body, state.activeCommentId);
        positionImageCommentAnchors(rendered, state, activateReviewSuggestionForComment);
        renderCommentCards();
        layoutCommentCards();
      })();
    });
  });
  rendered.addEventListener("click", (event) => {
    if ((event.target as Element | null)?.closest(".local-md-image-comment-anchor")) return;
    void maybeAddImageComment(event);
  });
  rendered.addEventListener("click", refreshActiveComment);
  rendered.addEventListener("focusin", refreshActiveComment);
  rendered.addEventListener("keyup", () => {
    refreshActiveComment();
    if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
    updateSelectionToolbar();
  });
  rendered.addEventListener("mouseup", () => {
    refreshActiveComment();
    if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
    updateSelectionToolbar();
  });
  rendered.addEventListener("pointerup", () => {
    refreshActiveComment();
    if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
    updateSelectionToolbar();
  });
  document.addEventListener("selectionchange", () => {
    refreshActiveComment();
    if (state.reviewDiffMode === "active") void refreshReviewDiffDecorations();
    updateSelectionToolbar();
  });
  commentsColumn.addEventListener("focusin", (event) => {
    const input = (event.target as HTMLElement | null)?.closest<HTMLTextAreaElement>(
      ".local-md-comment-card textarea",
    );
    if (!input) return;
    resizeCommentTextarea(input);
    const replyInput = input.matches("[data-testid='comment-reply-input']") ? input : null;
    const card = input.closest<HTMLElement>(".local-md-comment-card[data-comment-id]");
    const id = card?.dataset.commentId;
    if (!replyInput) {
      scheduleCommentLayout();
      return;
    }
    if (!id) return;
    openReplyComposerIds.add(id);
    card.querySelector<HTMLElement>("[data-reply-actions]")?.removeAttribute("hidden");
    scheduleCommentLayout();
  });
  commentsColumn.addEventListener("focusout", (event) => {
    const input = (event.target as HTMLElement | null)?.closest<HTMLTextAreaElement>(
      "[data-testid='comment-input']",
    );
    if (!input || input.value.trim().length > 0) return;

    const reviewBox = input.closest<HTMLElement>("[data-review-comment-id]");
    const card = input.closest<HTMLElement>(".local-md-comment-card[data-comment-id]");
    const id = reviewBox?.dataset.reviewCommentId ?? card?.dataset.commentId;
    if (!id || !draftCommentIds.has(id)) return;

    const editorBox = reviewBox ?? card;
    const nextTarget = event.relatedTarget;
    if (editorBox && nextTarget instanceof Node && editorBox.contains(nextTarget)) return;

    const source = state.mode === "markdown" ? editor.value : state.body;
    state.body = removeComment(source, id);
    if (state.mode === "markdown") syncMarkdownEditorSurface();
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    history.replace(state.markdown);
    draftCommentIds.delete(id);
    editingCommentIds.delete(id);
    commentDrafts.delete(id);
    if (state.activeCommentId === id) state.activeCommentId = null;
    refreshAfterCommentMutation();
    setStatus("Modified");
  });
  commentsColumn.addEventListener("input", (event) => {
    const input = (event.target as HTMLElement | null)?.closest<HTMLTextAreaElement>(
      ".local-md-comment-card textarea",
    );
    if (!input) return;
    resizeCommentTextarea(input);
    const card = input.closest<HTMLElement>(".local-md-comment-card[data-comment-id]");
    const id = card?.dataset.commentId;
    if (input.matches("[data-testid='comment-input']")) {
      const reviewId = input.closest<HTMLElement>("[data-review-comment-id]")?.dataset
        .reviewCommentId;
      const commentId = reviewId ?? id;
      if (commentId) commentDrafts.set(commentId, input.value);
      scheduleCommentLayout();
      return;
    }
    if (!input.matches("[data-testid='comment-reply-input']")) {
      scheduleCommentLayout();
      return;
    }
    if (!id) return;
    if (input.value.trim().length > 0) replyDrafts.set(id, input.value);
    else replyDrafts.delete(id);
    const saveButton = card.querySelector<HTMLButtonElement>("button[data-action='save-reply']");
    if (saveButton) saveButton.disabled = input.value.trim().length === 0;
    scheduleCommentLayout();
  });
  commentsColumn.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey)) return;
    const input = (event.target as HTMLElement | null)?.closest<HTMLTextAreaElement>(
      ".local-md-comment-card textarea",
    );
    if (!input) return;
    event.preventDefault();
    if (input.value.trim().length === 0) return;
    let saveButton: HTMLButtonElement | null = null;
    if (input.matches("[data-testid='comment-input']")) {
      const reviewBox = input.closest<HTMLElement>("[data-review-comment-id]");
      saveButton = reviewBox
        ? reviewBox.querySelector<HTMLButtonElement>("button[data-action='save-review-comment']")
        : (input
            .closest<HTMLElement>(".local-md-comment-card")
            ?.querySelector<HTMLButtonElement>("button[data-action='save-comment']") ?? null);
    } else if (input.matches("[data-testid='comment-reply-input']")) {
      saveButton = input
        .closest<HTMLElement>(".local-md-comment-card")
        ?.querySelector<HTMLButtonElement>("button[data-action='save-reply']") ?? null;
    } else if (input.matches("[data-testid='child-comment-input']")) {
      saveButton = input
        .closest<HTMLElement>("[data-child-comment-id]")
        ?.querySelector<HTMLButtonElement>("button[data-action='save-child-comment']") ?? null;
    }
    saveButton?.click();
  });
  editor.addEventListener("input", () => {
    state.body = editor.value;
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    updateMarkdownEditorSize();
    renderMarkdownHighlights();
    refreshActiveComment();
    layoutCommentCards();
    scheduleTypingHistory();
    setStatus("Modified");
  });
  editor.addEventListener("click", refreshActiveComment);
  editor.addEventListener("focus", refreshActiveComment);
  editor.addEventListener("keyup", () => {
    refreshActiveComment();
    layoutCommentCards();
  });
  editor.addEventListener("select", () => {
    refreshActiveComment();
    layoutCommentCards();
  });
  editor.addEventListener("mouseup", () => {
    refreshActiveComment();
    layoutCommentCards();
  });
  window.addEventListener("resize", layoutCommentCards);
  window.addEventListener("resize", updateMarkdownEditorSize);
  window.addEventListener("resize", updateSelectionToolbar);
  window.addEventListener("scroll", updateSelectionToolbar, { passive: true });
  frontmatterEditor.addEventListener("input", () => {
    state.frontmatter = frontmatterEditor.value;
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    scheduleTypingHistory();
    setStatus("Modified");
  });
  const handleHistoryKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (!shouldUseMarkdownHistory(event.target)) return;
    const shortcut = markdownHistoryShortcut(event);
    if (!shortcut) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (shortcut === "undo") void undoMarkdown();
    else void redoMarkdown();
  };
  const handleHistoryBeforeInput = (event: InputEvent) => {
    if (event.defaultPrevented) return;
    if (!shouldUseMarkdownHistory(event.target)) return;
    if (event.inputType !== "historyUndo" && event.inputType !== "historyRedo") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.inputType === "historyUndo") void undoMarkdown();
    else void redoMarkdown();
  };
  window.addEventListener("keydown", handleHistoryKeydown, { capture: true });
  document.addEventListener("keydown", handleHistoryKeydown, { capture: true });
  rendered.addEventListener("keydown", handleHistoryKeydown, { capture: true });
  editor.addEventListener("keydown", handleHistoryKeydown, { capture: true });
  frontmatterEditor.addEventListener("keydown", handleHistoryKeydown, { capture: true });
  document.addEventListener("beforeinput", handleHistoryBeforeInput, { capture: true });
  rendered.addEventListener("beforeinput", handleHistoryBeforeInput, { capture: true });
  editor.addEventListener("beforeinput", handleHistoryBeforeInput, { capture: true });
  frontmatterEditor.addEventListener("beforeinput", handleHistoryBeforeInput, { capture: true });

  renderedButton.addEventListener("click", () => void setMode("rendered"));
  reviewButton.addEventListener("click", () => void setMode("review"));
  markdownButton.addEventListener("click", () => void setMode("markdown"));
  reviewDiffModeSelect.addEventListener("change", () => {
    state.reviewDiffMode = reviewDiffModeSelect.value as ReviewDiffMode;
    updateActiveReviewSuggestionFromSelection();
    void refreshReviewDiffDecorations();
  });
  includeBlockIdsInput.addEventListener("change", () => {
    state.includeBlockIds = includeBlockIdsInput.checked;
    const sourceBody = state.mode === "markdown" ? editor.value : state.body;
    state.body = state.includeBlockIds
      ? ensureDocumentBlockIds(sourceBody)
      : stripDocumentBlockIds(sourceBody);
    state.markdown = composeMarkdown(state);
    editor.value = state.body;
    state.dirty = true;
    commitHistory();
    void render();
    setStatus("Modified");
  });
  toolbarActions.addEventListener("mousedown", (event) => {
    if ((event.target as HTMLElement | null)?.closest("[data-toolbar-command]"))
      event.preventDefault();
  });
  toolbarActions.addEventListener("click", (event) => {
    const formatTrigger = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-format-trigger]",
    );
    if (formatTrigger) {
      event.preventDefault();
      toggleFormatMenu();
      return;
    }
    const modeTrigger = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-mode-trigger]",
    );
    if (modeTrigger) {
      event.preventDefault();
      toggleModeMenu();
      return;
    }
    const command = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-toolbar-command]",
    )?.dataset.toolbarCommand;
    if (!command) return;
    event.preventDefault();
    updateFormatLabel(command);
    closeFormatMenu();
    void runToolbarCommand(command);
  });
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest(".local-md-format-menu")) closeFormatMenu();
    if (!target?.closest(".local-md-mode-menu")) closeModeMenu();
  });
  selectionToolbar.addEventListener("mousedown", (event) => event.preventDefault());
  selectionAddCommentButton.addEventListener("click", () => void addComment());
  llmPromptPanel.addEventListener("pointerenter", () => {
    llmPromptHovered = true;
  });
  llmPromptPanel.addEventListener("pointerleave", () => {
    llmPromptHovered = false;
    if (!llmPromptPanel.hidden) scheduleLlmPromptHide();
  });
  copyLlmPromptButton.addEventListener("click", () => {
    void copyTextToClipboard(window, llmPromptText.value).then((copied) => {
      copyLlmPromptButton.title = copied ? "Copied" : "Copy failed";
      copyLlmPromptButton.setAttribute(
        "aria-label",
        copied ? "Copied AI instructions" : "Copy failed",
      );
      window.setTimeout(() => {
        copyLlmPromptButton.title = "Copy AI instructions";
        copyLlmPromptButton.setAttribute("aria-label", "Copy AI instructions");
      }, 1500);
    });
  });
  showLlmPromptButton.addEventListener("click", () => {
    llmPromptPanel.classList.add("local-md-llm-prompt-expanded");
    showLlmPromptButton.hidden = true;
    scheduleLlmPromptHide();
  });
  closeLlmPromptButton.addEventListener("click", hideLlmPrompt);
  toastSaveButton.addEventListener("click", () => void save(false));
  toastSaveMineButton.addEventListener("click", () => void save(false));
  toastLoadDiskButton.addEventListener("click", () => {
    void (async () => {
      await reloadFileFromDisk();
    })();
  });
  saveButton.addEventListener("click", () => void save(false));
  window.report = downloadReportCase;
  window.addEventListener(
    "keydown",
    (event) => {
      if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key !== "s" && key !== "r") return;
      event.preventDefault();
      event.stopPropagation();
      if (key === "s") void save(false);
      else void reloadFileFromDisk();
    },
    { capture: true },
  );

  await setMode(state.mode);
  const loadedContents = serializeFile(state.markdown);
  openedFileIdentityPromise = createLoadedFileIdentity();
  updateFolderButton();

  void restoreFileHandle(window, handleStorageKey(window.location)).then(async (handle) => {
    const openedIdentity = await openedFileIdentityPromise;
    if (handle && (await restoredHandleMatchesLoadedDocument(handle, openedIdentity))) {
      state.handle = handle;
      void startFileWatch(handle, loadedContents);
    } else {
      const folderHandle = await resolveFileFromRememberedFolders(false);
      if (
        !folderHandle ||
        !(await restoredHandleMatchesLoadedDocument(folderHandle, openedIdentity))
      ) {
        updateFolderButton();
        if (!state.handle && hasDirectoryPicker(window)) setStatus("Choose folder");
        return;
      }
      state.handle = folderHandle;
      void rememberFileHandle(window, handleStorageKey(window.location), folderHandle);
      void startFileWatch(folderHandle, loadedContents);
      handle = folderHandle;
    }
    if (await canWriteWithoutPrompt(handle)) {
      setStatus("Ready");
    }
  });

  if (development) {
    console.info("local-md development build");
    window.__localMdDebug = {
      getSelectionState: () => getSelectionState(rendered),
      getMarkdown: () => state.markdown,
      getSyncCount: () => state.syncCount,
    };
  }

  async function maybeAddImageComment(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(".local-md-review-suggestion")) return;
    const hit = resolveImageCommentHit(rendered, state.body, target, event.clientX, event.clientY);
    if (!hit) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const previousIds = new Set(parseComments(state.body).map((comment) => comment.id));
    state.body =
      hit.target === "bitmap"
        ? createImageComment(state.body, hit.sourceStart, hit.x, hit.y, "")
        : createSvgComment(state.body, hit.sourceStart, hit.svgPath, hit.x, hit.y, "");
    markNewestCommentAsDraft(previousIds);
    state.markdown = composeMarkdown(state);
    state.dirty = true;
    commitHistory();
    await render();
    focusCommentInput(state.activeCommentId ?? "");
    layoutCommentCards();
    setStatus("Modified");
  }
}

function required<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${selector}`);
  return element;
}

const typingHistoryDelay = 650;
const maxHistoryEntries = 100;
const markdownEditorExtraLines = 10;

interface MarkdownHighlightRange {
  start: number;
  end: number;
  className: string;
}

interface ReviewDiffToken {
  text: string;
  start: number;
  end: number;
}

interface ReviewDiffChange {
  kind: "insert" | "replace" | "delete";
  start: number;
  end: number;
  originalStart: number;
  originalEnd: number;
  originalText: string;
}

interface MarkdownHistory {
  entries: string[];
  index: number;
  typingTimer: number;
  commit(markdown: string): void;
  replace(markdown: string): void;
  undo(): string | null;
  redo(): string | null;
}

function createMarkdownHistory(initialMarkdown: string): MarkdownHistory {
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

function markdownHistoryShortcut(event: KeyboardEvent): "undo" | "redo" | null {
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

function shouldUseMarkdownHistory(target: EventTarget | null): boolean {
  return !(target as Element | null)?.closest(
    ".local-md-comment-card textarea, .local-md-comment-card input",
  );
}

function markdownHighlightClass(
  comment: Exclude<ReturnType<typeof parseComments>[number], { kind: "dangling" }>,
  active: boolean,
): string {
  if (active) return "local-md-markdown-highlight-active";
  if (comment.missingDefinition) return "local-md-markdown-highlight-broken";
  if (comment.stale) return "local-md-markdown-highlight-stale";
  return "local-md-markdown-highlight-current";
}

function markdownAnchorTop(textarea: HTMLTextAreaElement, sourcePosition: number): number {
  const position = textareaSourcePositionRect(textarea, sourcePosition);
  const pane = textarea.closest<HTMLElement>(".local-md-document-pane");
  const paneTop = pane?.getBoundingClientRect().top ?? 0;
  const layerTop = (textarea.parentElement ?? textarea).getBoundingClientRect().top - paneTop;
  return layerTop + position.top;
}

function textareaLineHeight(textarea: HTMLTextAreaElement): number {
  const style = window.getComputedStyle(textarea);
  return Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.55 || 20;
}

function textareaSourcePositionRect(
  textarea: HTMLTextAreaElement,
  sourcePosition: number,
): { top: number; left: number } {
  const safePosition = Math.max(0, Math.min(sourcePosition, textarea.value.length));
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  mirror.className = "local-md-textarea-measure";
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.minHeight = `${textarea.clientHeight}px`;
  mirror.style.font = style.font;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.padding = `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`;
  mirror.style.border = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.tabSize = style.tabSize;
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.textContent = textarea.value.slice(0, safePosition);
  marker.textContent = "\u200b";
  mirror.append(marker, document.createTextNode(textarea.value.slice(safePosition) || "\u200b"));
  textarea.parentElement?.append(mirror);
  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const position = {
    top: markerRect.top - mirrorRect.top,
    left: markerRect.left - mirrorRect.left,
  };
  mirror.remove();
  return position;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeCssString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ");
}

interface BlogFrontmatter {
  slug: string;
  tags: string[];
  date: string;
  image: string;
  authors: string[];
}

function renderFrontmatterHeader(target: HTMLElement, frontmatter: string): void {
  const meta = parseBlogFrontmatter(frontmatter);
  const hasHeader = Boolean(
    meta.slug || meta.tags.length > 0 || meta.date || meta.image || meta.authors.length > 0,
  );
  target.hidden = !hasHeader;
  if (!hasHeader) {
    target.replaceChildren();
    return;
  }
  const image = meta.image
    ? `<span class="local-md-frontmatter-image" role="img" aria-label="" style="background-image: url(&quot;${escapeCssString(meta.image)}&quot;)"></span>`
    : `<span class="local-md-frontmatter-placeholder">icon</span>`;
  const tags = meta.tags
    .map((tag) => `<span class="local-md-frontmatter-tag">${escapeHtml(tag)}</span>`)
    .join("");
  const authors = meta.authors.map(formatFrontmatterPerson).join(", ");
  target.innerHTML = `
    <div class="local-md-frontmatter-media">${image}</div>
    <div class="local-md-frontmatter-meta">
      <div class="local-md-frontmatter-row">
        <div class="local-md-frontmatter-author">${authors ? `by ${escapeHtml(authors)}` : ""}</div>
        <div class="local-md-frontmatter-date">${meta.date ? escapeHtml(formatFrontmatterDate(meta.date)) : ""}</div>
      </div>
      <div class="local-md-frontmatter-row local-md-frontmatter-row-secondary">
        <div class="local-md-frontmatter-slug">${meta.slug ? escapeHtml(meta.slug) : ""}</div>
        ${tags ? `<div class="local-md-frontmatter-tags">${tags}</div>` : "<div></div>"}
      </div>
    </div>
  `;
}

function parseBlogFrontmatter(frontmatter: string): BlogFrontmatter {
  const fields = new Map<string, string | string[]>();
  const lines = frontmatter.replace(/\r\n?/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = (match[1] ?? "").trim();
    const value = (match[2] ?? "").trim();
    if (value) {
      fields.set(key, value);
      continue;
    }
    const list: string[] = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1] ?? "";
      const item = /^\s*-\s+(.+?)\s*$/.exec(next);
      if (!item) break;
      list.push(cleanFrontmatterScalar(item[1] ?? ""));
      index += 1;
    }
    fields.set(key, list);
  }
  return {
    slug: frontmatterScalar(fields.get("slug")),
    tags: frontmatterList(fields.get("tags")),
    date: frontmatterScalar(fields.get("date")),
    image: frontmatterScalar(fields.get("image")),
    authors: frontmatterList(fields.get("authors")),
  };
}

function frontmatterScalar(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return cleanFrontmatterScalar(value ?? "");
}

function frontmatterList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map(cleanFrontmatterScalar).filter(Boolean);
  const scalar = cleanFrontmatterScalar(value ?? "");
  if (!scalar) return [];
  const bracket = /^\[(.*)\]$/.exec(scalar);
  const rawItems = bracket ? (bracket[1] ?? "").split(",") : scalar.split(",");
  return rawItems.map(cleanFrontmatterScalar).filter(Boolean);
}

function cleanFrontmatterScalar(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function formatFrontmatterDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function formatFrontmatterPerson(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function uiIcon(
  name:
    | "align-left"
    | "blockquote"
    | "check"
    | "chevron-down"
    | "code"
    | "code-box"
    | "copy"
    | "image"
    | "link"
    | "list"
    | "list-check"
    | "list-numbers"
    | "markdown"
    | "message-plus"
    | "pencil"
    | "suggestion"
    | "trash"
    | "x",
): string {
  const paths: Record<typeof name, string> = {
    "align-left": `
      <path d="M5 6h14" />
      <path d="M5 12h10" />
      <path d="M5 18h14" />
    `,
    blockquote: `
      <path d="M6 8h12" />
      <path d="M6 12h8" />
      <path d="M4 6v12" />
    `,
    check: `<path d="M5 12l5 5l10 -10" />`,
    "chevron-down": `<path d="M6 9l6 6l6 -6" />`,
    code: `
      <path d="M8 9l-4 3l4 3" />
      <path d="M16 9l4 3l-4 3" />
    `,
    "code-box": `
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M10 10l-2 2l2 2" />
      <path d="M14 10l2 2l-2 2" />
    `,
    copy: `
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 15V7a2 2 0 0 1 2 -2h8" />
    `,
    image: `
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M8 14l2.5 -2.5l2 2l2.5 -3.5l3 4" />
      <circle cx="9" cy="9" r="1" />
    `,
    link: `
      <path d="M9 15l6 -6" />
      <path d="M11 6l1 -1a4 4 0 0 1 6 6l-1 1" />
      <path d="M13 18l-1 1a4 4 0 0 1 -6 -6l1 -1" />
    `,
    list: `
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M5 6h.01" />
      <path d="M5 12h.01" />
      <path d="M5 18h.01" />
    `,
    "list-check": `
      <path d="M10 6h10" />
      <path d="M10 12h10" />
      <path d="M10 18h10" />
      <path d="M4 6l1 1l2 -2" />
      <path d="M4 12l1 1l2 -2" />
      <path d="M4 18l1 1l2 -2" />
    `,
    "list-numbers": `
      <path d="M11 6h9" />
      <path d="M11 12h9" />
      <path d="M11 18h9" />
      <path d="M5 6h1v4" />
      <path d="M4 10h3" />
      <path d="M4 14a2 2 0 1 1 3 2l-3 2h4" />
    `,
    markdown: `
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 15v-6l3 3l3 -3v6" />
      <path d="M16 9v6" />
      <path d="M14 13l2 2l2 -2" />
    `,
    "message-plus": `
      <path d="M8 9h8" />
      <path d="M8 13h5" />
      <path d="M12 20l-4 -4h-2a3 3 0 0 1 -3 -3v-5a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v4" />
      <path d="M16 19h6" />
      <path d="M19 16v6" />
    `,
    pencil: `
      <path d="M4 20h4l10.5 -10.5a2.83 2.83 0 0 0 -4 -4l-10.5 10.5v4" />
      <path d="M13.5 6.5l4 4" />
    `,
    suggestion: `
      <path d="M6 4h9l3 3v13h-12z" />
      <path d="M14 4v4h4" />
      <path d="M9 15l2 2l4 -5" />
    `,
    trash: `
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    `,
    x: `
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    `,
  };
  return `<svg class="local-md-icon" aria-hidden="true" viewBox="0 0 24 24">${paths[name]}</svg>`;
}

function commentDisplayParts(bodyMarkdown: string): { body: string; replies: string[] } {
  const lines = bodyMarkdown
    .replace(/\r\n?/g, "\n")
    .replace(/\[\^suggest-block-\d{1,5}-[0-9a-fA-F]{4}\]/g, "")
    .replace(/\[\^comment-\d{1,5}-[0-9a-fA-F]{4}\]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const replies: string[] = [];
  const bodyLines: string[] = [];
  for (const line of lines) {
    const reply = /^(?:Reply|Suggestion):\s*(.*)$/i.exec(line);
    if (reply) replies.push(reply[1] ?? "");
    else bodyLines.push(line);
  }
  return { body: bodyLines.join(" "), replies };
}

function reviewSuggestionMarkdown(
  markdown: string,
  suggestionId: string,
  bodyMarkdown: string,
): string {
  const referenced = new Set(
    Array.from(bodyMarkdown.matchAll(/\[\^([^\]]+)\]/g), (match) => match[1]).filter(Boolean),
  );
  const definitions = extractCommentDefinitions(markdown).filter((definition) => {
    const id = /^\[\^([^\]]+)\]:/.exec(definition)?.[1];
    return Boolean(id && id !== suggestionId && referenced.has(id));
  });
  return definitions.length > 0 ? `${bodyMarkdown}\n\n${definitions.join("\n")}` : bodyMarkdown;
}

function reviewDeletionPlaceholder(document: Document): HTMLElement {
  const placeholder = document.createElement("p");
  placeholder.className = "local-md-review-empty-suggestion";
  placeholder.textContent = "Deleted block";
  return placeholder;
}

function reviewImageComparisonForTarget(
  target: HTMLElement,
  snippet: HTMLElement,
  suggestionId: string,
): HTMLElement | null {
  const originalImage = imageOnlyVisual(target);
  const suggestedImage = imageOnlyVisual(snippet);
  if (!originalImage || !suggestedImage) return null;

  const comparison = document.createElement("div");
  const stage = document.createElement("div");
  stage.className = "local-md-image-comparison-stage";

  const originalLayer = document.createElement("div");
  originalLayer.className = "local-md-image-comparison-original";
  originalLayer.append(originalImage);

  const suggestionLayer = document.createElement("div");
  suggestionLayer.className = "local-md-image-comparison-suggestion";
  suggestionLayer.append(suggestedImage);

  const markerLayer = document.createElement("div");
  markerLayer.className = "local-md-image-comparison-markers";
  for (const marker of Array.from(target.querySelectorAll<HTMLElement>("sup"))) {
    const id = marker.querySelector<HTMLAnchorElement>("a[data-footnote-ref]")
      ? footnoteIdFromHref(
          marker.querySelector<HTMLAnchorElement>("a[data-footnote-ref]")?.getAttribute("href") ??
            "",
        )
      : null;
    if (id && id !== suggestionId) markerLayer.append(marker);
  }

  const slider = document.createElement("div");
  slider.className = "local-md-image-comparison-slider";
  slider.tabIndex = 0;
  slider.setAttribute("role", "slider");
  slider.setAttribute("aria-label", "Reveal original image");
  slider.setAttribute("aria-valuemin", "0");
  slider.setAttribute("aria-valuemax", "100");
  slider.setAttribute("aria-valuenow", "0");
  slider.innerHTML = '<span class="local-md-image-comparison-knob" aria-hidden="true"></span>';

  const updateFromPointer = (clientX: number) => {
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;
    setImageComparisonReveal(comparison, ((clientX - rect.left) / rect.width) * 100);
  };
  slider.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    updateFromPointer(event.clientX);
    const pointerId = event.pointerId;
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      updateFromPointer(moveEvent.clientX);
    };
    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  });
  slider.addEventListener("keydown", (event) => {
    const current = Number(slider.getAttribute("aria-valuenow") ?? "50");
    const next =
      event.key === "ArrowLeft" || event.key === "ArrowDown"
        ? current - 5
        : event.key === "ArrowRight" || event.key === "ArrowUp"
          ? current + 5
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 100
              : null;
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    setImageComparisonReveal(comparison, next);
  });

  stage.append(originalLayer, suggestionLayer, slider, markerLayer);
  comparison.append(stage);
  setImageComparisonReveal(comparison, 0);
  return comparison;
}

function imageOnlyVisual(root: HTMLElement): HTMLElement | SVGSVGElement | null {
  const visuals = Array.from(root.querySelectorAll<HTMLElement | SVGSVGElement>("img,svg")).filter(
    (visual) => !visual.closest("sup,section[data-footnotes],[data-local-md-wrapper='true']"),
  );
  if (visuals.length !== 1) return null;
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("img,svg,sup,section[data-footnotes]").forEach((node) => node.remove());
  if ((clone.textContent ?? "").trim()) return null;
  return visuals[0] ?? null;
}

function setImageComparisonReveal(comparison: HTMLElement, value: number): void {
  const reveal = Math.max(0, Math.min(100, value));
  comparison.style.setProperty("--local-md-image-reveal", `${reveal}%`);
  const slider = comparison.querySelector<HTMLElement>(".local-md-image-comparison-slider");
  slider?.setAttribute("aria-valuenow", `${Math.round(reveal)}`);
  slider?.setAttribute("aria-valuetext", `${Math.round(reveal)}% original image visible`);
}

function reviewSuggestionElementForTarget(target: HTMLElement, snippet: HTMLElement): HTMLElement {
  if (target.matches("ul,ol")) return document.createElement(target.tagName.toLowerCase());
  if (target.matches("pre")) return document.createElement("pre");
  if (target.matches("blockquote")) return document.createElement("blockquote");
  if (target.matches("h1,h2,h3,h4,h5,h6"))
    return document.createElement(target.tagName.toLowerCase());
  if (target.matches("p") && singleTopLevelParagraph(snippet)) return document.createElement("p");
  return document.createElement("div");
}

function reviewSuggestionChildNodesForTarget(
  snippet: HTMLElement,
  target: HTMLElement,
): ChildNode[] {
  if (target.matches("p") && singleTopLevelParagraph(snippet)) {
    const paragraph = snippet.querySelector("p");
    if (paragraph) return Array.from(paragraph.childNodes);
  }
  if (target.matches("h1,h2,h3,h4,h5,h6")) {
    const heading = snippet.querySelector(target.tagName.toLowerCase());
    if (heading) return Array.from(heading.childNodes);
  }
  if (target.matches("ul,ol")) {
    const list =
      snippet.querySelector(target.tagName.toLowerCase()) ?? snippet.querySelector("ul,ol");
    if (list) return Array.from(list.childNodes);
  }
  if (target.matches("pre")) {
    const code = snippet.querySelector("pre code");
    if (code) {
      const nextCode = document.createElement("code");
      nextCode.className = code.className;
      nextCode.replaceChildren(...Array.from(code.childNodes));
      return [nextCode];
    }
    const pre = snippet.querySelector("pre");
    if (pre) return Array.from(pre.childNodes);
  }
  if (target.matches("blockquote")) {
    const quote = snippet.querySelector("blockquote");
    if (quote) return Array.from(quote.childNodes);
  }
  return Array.from(snippet.childNodes);
}

function singleTopLevelParagraph(snippet: HTMLElement): boolean {
  const children = Array.from(snippet.children);
  return children.length === 1 && children[0]?.tagName.toLowerCase() === "p";
}

async function reviewOriginalBlockForDiff(
  markdown: string,
  suggestion: ReturnType<typeof parseBlockSuggestions>[number],
  suggestionRegion: HTMLElement,
): Promise<HTMLElement | null> {
  if (suggestion.operation === "insert-before" || suggestion.operation === "insert-after") {
    return document.createElement("p");
  }
  const originalMarkdown = stripCommentReferences(
    stripReviewSuggestionReferences(
      markdown.slice(suggestion.blockSourceStart, suggestion.blockSourceEnd),
    ),
  ).trim();
  if (!originalMarkdown) return null;
  const snippet = document.createElement("div");
  snippet.innerHTML = await markdownToHtml(originalMarkdown);
  snippet.querySelector("section[data-footnotes]")?.remove();
  if (suggestionRegion.matches("ul,ol")) {
    return (
      snippet.querySelector<HTMLElement>(suggestionRegion.tagName.toLowerCase()) ??
      snippet.querySelector<HTMLElement>("ul,ol")
    );
  }
  if (suggestionRegion.matches("table") || suggestionRegion.querySelector("table")) {
    return snippet.querySelector<HTMLElement>("table");
  }
  if (suggestionRegion.matches("blockquote")) return snippet.querySelector("blockquote");
  if (suggestionRegion.matches("pre")) return snippet.querySelector("pre");
  const heading = snippet.querySelector<HTMLElement>("h1,h2,h3,h4,h5,h6");
  return heading ?? snippet.querySelector<HTMLElement>("p,li");
}

const reviewDiffHighlightNames = ["local-md-diff-insert", "local-md-diff-replace"];
const reviewDiffHighlightRanges: Array<{ kind: "insert" | "replace"; range: Range }> = [];
let reviewDiffDynamicHighlightNames: string[] = [];

function decorateReviewSuggestionDiff(
  originalBlock: HTMLElement,
  suggestionRegion: HTMLElement,
): void {
  const structuredPairs = reviewStructuredDiffPairs(originalBlock, suggestionRegion);
  if (structuredPairs) {
    for (const pair of structuredPairs)
      decorateReviewTextDiff(pair.original, pair.suggestion, pair.markerTarget);
    return;
  }
  if (!shouldDecorateReviewSuggestionDiff(originalBlock, suggestionRegion)) return;

  decorateReviewTextDiff(originalBlock, suggestionRegion, suggestionRegion);
}

interface ReviewDiffElementPair {
  original: HTMLElement | null;
  suggestion: HTMLElement | null;
  markerTarget: HTMLElement;
}

function reviewStructuredDiffPairs(
  originalBlock: HTMLElement,
  suggestionRegion: HTMLElement,
): ReviewDiffElementPair[] | null {
  const originalTable = originalBlock.matches("table")
    ? originalBlock
    : originalBlock.querySelector<HTMLElement>("table");
  const suggestionTable = suggestionRegion.matches("table")
    ? suggestionRegion
    : suggestionRegion.querySelector<HTMLElement>("table");
  if (originalTable && suggestionTable) {
    return pairReviewDiffElements(
      Array.from(originalTable.querySelectorAll<HTMLElement>("th,td")),
      Array.from(suggestionTable.querySelectorAll<HTMLElement>("th,td")),
      suggestionTable,
    );
  }

  const originalList = originalBlock.matches("ul,ol")
    ? originalBlock
    : originalBlock.querySelector<HTMLElement>("ul,ol");
  const suggestionList = suggestionRegion.matches("ul,ol")
    ? suggestionRegion
    : suggestionRegion.querySelector<HTMLElement>("ul,ol");
  if (originalList && suggestionList) {
    return pairReviewDiffElements(
      Array.from(originalList.querySelectorAll<HTMLElement>("li")),
      Array.from(suggestionList.querySelectorAll<HTMLElement>("li")),
      suggestionList,
    );
  }
  return null;
}

function pairReviewDiffElements(
  original: HTMLElement[],
  suggestion: HTMLElement[],
  fallbackMarkerTarget: HTMLElement,
): ReviewDiffElementPair[] {
  const originalText = original.map(reviewDiffText);
  const suggestionText = suggestion.map(reviewDiffText);
  const rows = original.length + 1;
  const cols = suggestion.length + 1;
  const lengths = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = original.length - 1; i >= 0; i -= 1) {
    for (let j = suggestion.length - 1; j >= 0; j -= 1) {
      const row = lengths[i];
      if (!row) continue;
      row[j] =
        originalText[i] === suggestionText[j]
          ? (lengths[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(lengths[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const pairs: ReviewDiffElementPair[] = [];
  let originalIndex = 0;
  let suggestionIndex = 0;
  while (originalIndex < original.length || suggestionIndex < suggestion.length) {
    if (
      originalIndex < original.length &&
      suggestionIndex < suggestion.length &&
      originalText[originalIndex] === suggestionText[suggestionIndex]
    ) {
      const suggestionElement = suggestion[suggestionIndex] as HTMLElement;
      pairs.push({
        original: original[originalIndex] as HTMLElement,
        suggestion: suggestionElement,
        markerTarget: suggestionElement,
      });
      originalIndex += 1;
      suggestionIndex += 1;
      continue;
    }

    const skipOriginal = lengths[originalIndex + 1]?.[suggestionIndex] ?? 0;
    const skipSuggestion = lengths[originalIndex]?.[suggestionIndex + 1] ?? 0;
    if (
      originalIndex < original.length &&
      suggestionIndex < suggestion.length &&
      skipOriginal === skipSuggestion
    ) {
      const suggestionElement = suggestion[suggestionIndex] as HTMLElement;
      pairs.push({
        original: original[originalIndex] as HTMLElement,
        suggestion: suggestionElement,
        markerTarget: suggestionElement,
      });
      originalIndex += 1;
      suggestionIndex += 1;
    } else if (
      suggestionIndex < suggestion.length &&
      (originalIndex >= original.length || skipSuggestion > skipOriginal)
    ) {
      const suggestionElement = suggestion[suggestionIndex] as HTMLElement;
      pairs.push({
        original: null,
        suggestion: suggestionElement,
        markerTarget: suggestionElement,
      });
      suggestionIndex += 1;
    } else if (originalIndex < original.length) {
      const markerTarget =
        suggestion[Math.min(suggestionIndex, suggestion.length - 1)] ??
        suggestion[suggestion.length - 1] ??
        fallbackMarkerTarget;
      pairs.push({
        original: original[originalIndex] as HTMLElement,
        suggestion: null,
        markerTarget,
      });
      originalIndex += 1;
    }
  }
  return pairs;
}

function decorateReviewTextDiff(
  originalElement: HTMLElement | null,
  suggestionElement: HTMLElement | null,
  markerTarget: HTMLElement,
): void {
  const originalText = originalElement ? reviewDiffText(originalElement) : "";
  const suggestionText = suggestionElement ? reviewDiffText(suggestionElement) : "";
  if (originalText === suggestionText) return;
  if (!suggestionText && originalText.trim()) {
    placeReviewDiffMarker(markerTarget, 0, originalText.trim());
    return;
  }

  const changes = diffReviewText(originalText, suggestionText);
  for (const change of [...changes].reverse()) {
    if (suggestionElement && (change.kind === "insert" || change.kind === "replace")) {
      const range = reviewDiffRangeForOffsets(suggestionElement, change.start, change.end);
      if (range) {
        reviewDiffHighlightRanges.push({ kind: change.kind, range });
      }
    }
    if (change.originalText.trim()) {
      placeReviewDiffMarker(
        suggestionElement ?? markerTarget,
        suggestionElement ? change.end : 0,
        change.originalText,
      );
    }
  }
}

function shouldDecorateReviewSuggestionDiff(
  originalBlock: HTMLElement,
  suggestionRegion: HTMLElement,
): boolean {
  if (!originalBlock.matches("p,h1,h2,h3,h4,h5,h6")) return false;
  if (suggestionRegion.matches("pre,blockquote,table,td,th,ul,ol,li")) return false;
  return !suggestionRegion.querySelector("pre,blockquote,table,thead,tbody,tr,td,th,ul,ol,li");
}

function diffReviewText(originalText: string, suggestionText: string): ReviewDiffChange[] {
  const original = tokenizeReviewDiffText(originalText);
  const suggestion = tokenizeReviewDiffText(suggestionText);
  if (suggestion.length === 0) return [];
  if (original.length === 0) {
    return [
      {
        kind: "insert",
        start: 0,
        end: suggestionText.length,
        originalStart: 0,
        originalEnd: 0,
        originalText: "",
      },
    ];
  }
  if (original.length * suggestion.length > 160000) return [];

  const rows = original.length + 1;
  const cols = suggestion.length + 1;
  const lengths = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = original.length - 1; i >= 0; i -= 1) {
    for (let j = suggestion.length - 1; j >= 0; j -= 1) {
      const row = lengths[i];
      if (!row) continue;
      row[j] =
        original[i]?.text === suggestion[j]?.text
          ? (lengths[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(lengths[i + 1]?.[j] ?? 0, lengths[i]?.[j + 1] ?? 0);
    }
  }

  const changes: ReviewDiffChange[] = [];
  let deleted: ReviewDiffToken[] = [];
  let inserted: ReviewDiffToken[] = [];
  let insertionPoint = 0;
  let originalInsertionPoint = 0;

  const flush = () => {
    const originalPhrase = tokensText(deleted).trim();
    const insertedPhrase = tokensText(inserted).trim();
    if (inserted.length > 0 && insertedPhrase) {
      changes.push({
        kind: deleted.length > 0 ? "replace" : "insert",
        start: inserted[0]?.start ?? insertionPoint,
        end: inserted[inserted.length - 1]?.end ?? insertionPoint,
        originalStart: deleted[0]?.start ?? originalInsertionPoint,
        originalEnd: deleted[deleted.length - 1]?.end ?? originalInsertionPoint,
        originalText: deleted.length > 0 ? originalPhrase : "",
      });
    } else if (deleted.length > 0 && originalPhrase) {
      changes.push({
        kind: "delete",
        start: insertionPoint,
        end: insertionPoint,
        originalStart: deleted[0]?.start ?? originalInsertionPoint,
        originalEnd: deleted[deleted.length - 1]?.end ?? originalInsertionPoint,
        originalText: originalPhrase,
      });
    }
    deleted = [];
    inserted = [];
  };

  let i = 0;
  let j = 0;
  while (i < original.length || j < suggestion.length) {
    if (i < original.length && j < suggestion.length && original[i]?.text === suggestion[j]?.text) {
      flush();
      insertionPoint = suggestion[j]?.end ?? insertionPoint;
      originalInsertionPoint = original[i]?.end ?? originalInsertionPoint;
      i += 1;
      j += 1;
    } else if (
      j < suggestion.length &&
      (i >= original.length || (lengths[i]?.[j + 1] ?? 0) >= (lengths[i + 1]?.[j] ?? 0))
    ) {
      inserted.push(suggestion[j] as ReviewDiffToken);
      j += 1;
    } else if (i < original.length) {
      deleted.push(original[i] as ReviewDiffToken);
      i += 1;
    }
  }
  flush();
  return mergeNearbyReviewDiffChanges(changes, originalText, suggestionText).map((change) =>
    refineReviewDiffChange(change, originalText, suggestionText),
  );
}

function tokenizeReviewDiffText(text: string): ReviewDiffToken[] {
  const tokens: ReviewDiffToken[] = [];
  for (const match of text.matchAll(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]+/gu)) {
    const value = match[0];
    const start = match.index ?? 0;
    tokens.push({ text: value, start, end: start + value.length });
  }
  return tokens;
}

function tokensText(tokens: ReviewDiffToken[]): string {
  return tokens.map((token) => token.text).join("");
}

function mergeNearbyReviewDiffChanges(
  changes: ReviewDiffChange[],
  originalText: string,
  suggestionText: string,
): ReviewDiffChange[] {
  const merged: ReviewDiffChange[] = [];
  for (const change of changes) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.kind !== "insert" &&
      change.kind !== "insert" &&
      reviewDiffGlueText(originalText.slice(previous.originalEnd, change.originalStart)) &&
      reviewDiffGlueText(suggestionText.slice(previous.end, change.start))
    ) {
      previous.kind = "replace";
      previous.end = change.end;
      previous.originalEnd = change.originalEnd;
      previous.originalText = originalText
        .slice(previous.originalStart, previous.originalEnd)
        .trim();
    } else {
      merged.push({ ...change });
    }
  }
  return merged;
}

function refineReviewDiffChange(
  change: ReviewDiffChange,
  originalText: string,
  suggestionText: string,
): ReviewDiffChange {
  if (change.kind !== "replace") return change;
  const originalSegment = originalText.slice(change.originalStart, change.originalEnd);
  const suggestionSegment = suggestionText.slice(change.start, change.end);
  let prefixLength = 0;
  while (
    prefixLength < originalSegment.length &&
    prefixLength < suggestionSegment.length &&
    originalSegment[prefixLength] === suggestionSegment[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < originalSegment.length - prefixLength &&
    suffixLength < suggestionSegment.length - prefixLength &&
    originalSegment[originalSegment.length - 1 - suffixLength] ===
      suggestionSegment[suggestionSegment.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const nextOriginalStart = change.originalStart + prefixLength;
  const nextOriginalEnd = change.originalEnd - suffixLength;
  const nextStart = change.start + prefixLength;
  const nextEnd = change.end - suffixLength;
  const nextOriginalText = originalText.slice(nextOriginalStart, nextOriginalEnd).trim();
  const nextSuggestionText = suggestionText.slice(nextStart, nextEnd).trim();

  if (!nextOriginalText && !nextSuggestionText) return change;
  if (!nextOriginalText) {
    return {
      ...change,
      kind: "insert",
      start: nextStart,
      end: nextEnd,
      originalStart: nextOriginalStart,
      originalEnd: nextOriginalStart,
      originalText: "",
    };
  }
  if (!nextSuggestionText) {
    return {
      ...change,
      kind: "delete",
      start: nextStart,
      end: nextStart,
      originalStart: nextOriginalStart,
      originalEnd: nextOriginalEnd,
      originalText: nextOriginalText,
    };
  }
  return {
    ...change,
    start: nextStart,
    end: nextEnd,
    originalStart: nextOriginalStart,
    originalEnd: nextOriginalEnd,
    originalText: nextOriginalText,
  };
}

function reviewDiffGlueText(text: string): boolean {
  const compact = text.trim().toLowerCase();
  if (!compact) return true;
  if (/[.,;:!?()[\]{}]/.test(compact)) return false;
  return ["a", "an", "the", "to", "of"].includes(compact);
}

function reviewDiffText(root: HTMLElement): string {
  return reviewDiffTextNodes(root)
    .map((entry) => entry.node.textContent ?? "")
    .join("");
}

function reviewDiffTextNodes(root: HTMLElement): Array<{ node: Text; start: number; end: number }> {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        parent?.closest(
          ".local-md-diff-marker, .local-md-comment-anchor, .local-md-image-comment-anchor, a[data-footnote-ref], sup, section[data-footnotes], [data-local-md-wrapper='true']",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes: Array<{ node: Text; start: number; end: number }> = [];
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    nodes.push({ node: node as Text, start: offset, end: offset + text.length });
    offset += text.length;
  }
  return nodes;
}

function reviewDiffRangeForOffsets(root: HTMLElement, start: number, end: number): Range | null {
  if (end <= start) return null;
  const startPoint = reviewDiffDomPointAtOffset(root, start);
  const endPoint = reviewDiffDomPointAtOffset(root, end);
  if (!startPoint || !endPoint) return null;
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range.collapsed ? null : range;
}

function reviewDiffDomPointAtOffset(
  root: HTMLElement,
  offset: number,
): { node: Text; offset: number } | null {
  const nodes = reviewDiffTextNodes(root);
  for (const entry of nodes) {
    if (offset >= entry.start && offset <= entry.end)
      return { node: entry.node, offset: offset - entry.start };
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last.node, offset: (last.node.textContent ?? "").length } : null;
}

function placeReviewDiffMarker(root: HTMLElement, offset: number, originalText: string): void {
  const range =
    reviewDiffRangeForOffsets(root, Math.max(0, offset - 1), offset) ??
    reviewDiffCollapsedRangeForOffset(root, offset);
  const rect =
    range?.getClientRects()[range.getClientRects().length - 1] ?? range?.getBoundingClientRect();
  if (!rect) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "local-md-diff-marker";
  button.contentEditable = "false";
  button.dataset.original = originalText;
  button.setAttribute("aria-label", `Removed text: ${originalText}`);
  button.innerHTML = reviewDiffMarkerIcon();
  button.style.left = `${rect.right + window.scrollX - 6}px`;
  button.style.top = `${rect.top + window.scrollY - 9}px`;
  document.body.append(button);
}

function reviewDiffMarkerIcon(): string {
  return `<svg class="local-md-diff-marker-icon" viewBox="0 0 14 22" aria-hidden="true">
    <path class="local-md-diff-marker-stem" d="M7 10v10" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
    <circle class="local-md-diff-marker-head" cx="7" cy="5.4" r="4.5"/>
    <path class="local-md-diff-marker-x" d="M5.35 3.75l3.3 3.3M8.65 3.75l-3.3 3.3" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round"/>
  </svg>`;
}

function reviewDiffCollapsedRangeForOffset(root: HTMLElement, offset: number): Range | null {
  const point = reviewDiffDomPointAtOffset(root, offset);
  if (!point) return null;
  const range = document.createRange();
  range.setStart(point.node, point.offset);
  range.collapse(true);
  return range;
}

function clearReviewDiffHighlights(): void {
  reviewDiffHighlightRanges.length = 0;
  for (const name of [...reviewDiffHighlightNames, ...reviewDiffDynamicHighlightNames])
    CSS.highlights?.delete(name);
  reviewDiffDynamicHighlightNames = [];
  document.getElementById("local-md-diff-highlight-styles")?.remove();
  document.querySelectorAll(".local-md-diff-marker").forEach((marker) => marker.remove());
}

function paintReviewDiffHighlights(): void {
  if (!("Highlight" in window) || !CSS.highlights) return;
  const insertNames: string[] = [];
  const replaceNames: string[] = [];
  reviewDiffHighlightRanges.forEach((entry, index) => {
    const name = `local-md-diff-${entry.kind}-${index}`;
    reviewDiffDynamicHighlightNames.push(name);
    if (entry.kind === "replace") replaceNames.push(name);
    else insertNames.push(name);
    const highlight = new Highlight(entry.range);
    highlight.priority = entry.kind === "replace" ? 9 : 8;
    CSS.highlights.set(name, highlight);
  });
  installReviewDiffHighlightStyles(insertNames, replaceNames);
}

function installReviewDiffHighlightStyles(insertNames: string[], replaceNames: string[]): void {
  document.getElementById("local-md-diff-highlight-styles")?.remove();
  if (insertNames.length === 0 && replaceNames.length === 0) return;
  const style = document.createElement("style");
  style.id = "local-md-diff-highlight-styles";
  const selectors = [...insertNames, ...replaceNames].map((name) => `::highlight(${name})`);
  style.textContent = `${selectors.join(",")} {
  background: color-mix(in srgb, #dafbe1 55%, transparent);
  color: inherit;
  text-decoration-line: underline;
  text-decoration-color: #2da44e;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.16em;
}`;
  document.head.append(style);
}

async function createSuggestionsFromEditedReviewBlocks(
  root: HTMLElement,
  markdown: string,
  pendingSelection: { startIndex: number; endIndex: number } | null,
  useOperationSuggestions = false,
): Promise<{ markdown: string; focusSuggestionId: string | null }> {
  if (!pendingSelection) return { markdown, focusSuggestionId: null };

  const sourceBlocks = reviewOriginalSourceBlocks(markdown);
  const renderedBlocks = reviewOriginalBlockElements(root);
  const changes: Array<{ index: number; replacement: string }> = [];

  const selectedCount = pendingSelection.endIndex - pendingSelection.startIndex + 1;
  const nextOriginal = sourceBlocks[pendingSelection.endIndex + 1];
  const firstRendered = renderedBlocks[pendingSelection.startIndex];
  const firstReplacement = firstRendered ? await markdownFromReviewBlockElement(firstRendered) : "";
  const firstLooksLikeNextOriginal =
    Boolean(nextOriginal) &&
    normalizeReviewBlockMarkdown(firstReplacement) ===
      normalizeReviewBlockMarkdown(nextOriginal?.markdown ?? "");

  for (let offset = 0; offset < selectedCount; offset += 1) {
    const source = sourceBlocks[pendingSelection.startIndex + offset];
    if (!source) continue;
    const rawReplacement = offset === 0 && !firstLooksLikeNextOriginal ? firstReplacement : "";
    const replacement = preserveReviewSourceWrapper(source.markdown, rawReplacement);
    if (
      normalizeReviewBlockMarkdown(replacement) !== normalizeReviewBlockMarkdown(source.markdown)
    ) {
      changes.push({ index: pendingSelection.startIndex + offset, replacement });
    }
  }

  let nextMarkdown = markdown;
  let focusSuggestionId: string | null = null;
  for (const change of changes.sort((left, right) => right.index - left.index)) {
    const source = sourceBlocks[change.index];
    if (!source) continue;
    const targetBlockId = useOperationSuggestions
      ? blockIdForSourceRange(nextMarkdown, source.start, source.end)
      : null;
    const result = targetBlockId
      ? appendBlockOperationSuggestion(
          nextMarkdown,
          "update",
          targetBlockId,
          change.replacement,
          [],
        )
      : createBlockSuggestionForSourceRange(nextMarkdown, source, change.replacement);
    nextMarkdown = result.markdown;
    if (change.index === pendingSelection.startIndex) focusSuggestionId = result.id;
  }
  return { markdown: nextMarkdown, focusSuggestionId };
}

function reviewOriginalSourceBlocks(markdown: string) {
  const suggestions = parseBlockSuggestions(markdown);
  return reviewEditableSourceRanges(markdown).filter((block) => {
    if (/\[\^suggest-block-\d{1,5}-[0-9a-fA-F]{4}\]/.test(block.markdown)) return false;
    return !suggestions.some((suggestion) => sourceRangesOverlapForReview(block, suggestion));
  });
}

function sourceRangesOverlapForReview(
  left: { start: number; end: number },
  right: { blockSourceStart: number; blockSourceEnd: number },
): boolean {
  return left.start < right.blockSourceEnd && left.end > right.blockSourceStart;
}

function reviewEditableSourceRanges(
  markdown: string,
): Array<{ start: number; end: number; markdown: string }> {
  return markdownBlockRanges(markdown);
}

function reviewOriginalBlockElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]")).filter((block) => {
    if (
      block.closest(".local-md-review-suggestion, section[data-footnotes], .local-md-comment-card")
    )
      return false;
    const parentBlock = block.parentElement?.closest("[data-block-id]");
    return !parentBlock;
  });
}

async function markdownFromReviewBlockElement(block: HTMLElement): Promise<string> {
  const clone = block.cloneNode(true) as HTMLElement;
  restoreReviewCommentReferences(clone);
  clone.querySelector("section[data-footnotes]")?.remove();
  return unescapeCommentReferences(await htmlToMarkdown(reviewSourceBlockHtml(clone))).trim();
}

function reviewSourceBlockHtml(block: HTMLElement): string {
  return block.outerHTML;
}

function reviewSuggestionRegionHtml(region: HTMLElement): string {
  const suggestedImage = region.querySelector<HTMLElement>(".local-md-image-comparison-suggestion");
  if (suggestedImage) return suggestedImage.innerHTML;
  return region.outerHTML;
}

function normalizeReviewBlockMarkdown(markdown: string): string {
  return stripCommentReferences(markdown).replace(/\s+/g, " ").trim();
}

function preserveReviewSourceWrapper(sourceMarkdown: string, replacementMarkdown: string): string {
  if (!replacementMarkdown.trim()) return "";
  const unwrappedHeadingImage = replacementMarkdown.replace(/^\s{0,3}#{1,6}\s+/, "");
  if (
    isStandaloneMarkdownImage(sourceMarkdown) &&
    isStandaloneMarkdownImage(unwrappedHeadingImage)
  ) {
    return unwrappedHeadingImage.trim();
  }
  const listMarker = /^(\s{0,3}(?:[-+*]|\d+[.)])\s+)/.exec(sourceMarkdown)?.[1];
  if (listMarker && !/^\s{0,3}(?:[-+*]|\d+[.)])\s+/.test(replacementMarkdown)) {
    return `${listMarker}${replacementMarkdown.trim()}`;
  }
  return replacementMarkdown;
}

function isStandaloneMarkdownImage(markdown: string): boolean {
  return /^\s*!\[[^\]\n]*\]\([^\n)]+(?:\s+["'][^\n"']*["'])?\)\s*$/.test(markdown);
}

function stripReviewSuggestionReferences(markdown: string): string {
  return markdown.replace(/\[\^suggest-block-\d{1,5}-[0-9a-fA-F]{4}\]/g, "");
}

function isReviewSyncResult(value: unknown): value is {
  needsRender: boolean;
  focusSuggestionId: string | null;
  focusTextOffset: number | null;
} {
  return Boolean(value && typeof value === "object" && "needsRender" in value);
}

function reviewTextOffsetFromSelection(
  root: HTMLElement,
  selection: Selection | null,
): number | null {
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode) return null;
  const element =
    selection.anchorNode.nodeType === Node.ELEMENT_NODE
      ? (selection.anchorNode as Element)
      : selection.anchorNode.parentElement;
  let block = element?.closest<HTMLElement>("[data-block-id]");
  const blocks = reviewOriginalBlockElements(root);
  while (block && !blocks.includes(block)) {
    block = block.parentElement?.closest<HTMLElement>("[data-block-id]") ?? null;
  }
  if (!block || !root.contains(block)) return null;
  return meaningfulTextOffsetWithin(block, selection.anchorNode, selection.anchorOffset);
}

function restoreReviewSuggestionCaret(
  suggestionId: string | null,
  textOffset: number | null,
): void {
  if (!suggestionId || textOffset === null) return;
  const region = document.querySelector<HTMLElement>(
    `.local-md-review-suggestion[data-suggestion-id="${CSS.escape(suggestionId)}"]`,
  );
  if (!region) return;
  const target = meaningfulTextNodeAtOffset(region, textOffset);
  if (!target) return;
  const selection = document.getSelection();
  const range = document.createRange();
  range.setStart(target.node, target.offset);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
  region.focus();
}

function meaningfulTextOffsetWithin(root: HTMLElement, target: Node, targetOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.textContent ?? "";
    if (node === target) return offset + targetOffset;
    if (text.trim().length > 0) offset += text.length;
  }
  return offset;
}

function meaningfulTextNodeAtOffset(
  root: HTMLElement,
  targetOffset: number,
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let lastText: Text | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if ((node.textContent ?? "").trim().length === 0) continue;
    lastText = node;
    const length = node.textContent?.length ?? 0;
    if (offset + length >= targetOffset) {
      return { node, offset: Math.max(0, Math.min(length, targetOffset - offset)) };
    }
    offset += length;
  }
  return lastText ? { node: lastText, offset: lastText.textContent?.length ?? 0 } : null;
}

function reviewOriginalBlockSelectionRange(
  root: HTMLElement,
  selection: Selection | null,
  event?: InputEvent,
): {
  startIndex: number;
  endIndex: number;
  focusTextOffset: number | null;
  insertedTextLength: number;
} | null {
  const focusTextOffset = reviewTextOffsetFromSelection(root, selection);
  const insertedTextLength = event?.inputType === "insertText" ? (event.data?.length ?? 0) : 0;
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    const point = reviewOriginalBlockIndexAtNode(root, selection?.anchorNode ?? null);
    return point ? { ...point, focusTextOffset, insertedTextLength } : null;
  }
  const range = selection.getRangeAt(0);
  const start = reviewOriginalBlockIndexAtNode(root, range.startContainer);
  const end = reviewOriginalBlockIndexAtNode(root, range.endContainer);
  if (!start || !end) {
    const point = start ?? end;
    return point ? { ...point, focusTextOffset, insertedTextLength } : null;
  }
  return {
    startIndex: Math.min(start.startIndex, end.startIndex),
    endIndex: Math.max(start.endIndex, end.endIndex),
    focusTextOffset,
    insertedTextLength,
  };
}

function reviewOriginalBlockIndexAtNode(
  root: HTMLElement,
  node: Node | null,
): { startIndex: number; endIndex: number } | null {
  if (!node) return null;
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const blocks = reviewOriginalBlockElements(root);
  let block = element?.closest<HTMLElement>("[data-block-id]");
  while (block && !blocks.includes(block)) {
    block = block.parentElement?.closest<HTMLElement>("[data-block-id]") ?? null;
  }
  if (!block || block.closest(".local-md-review-suggestion, section[data-footnotes]")) return null;
  const index = blocks.indexOf(block);
  return index === -1 ? null : { startIndex: index, endIndex: index };
}

function applyReviewSuggestionToMarkdown(markdown: string, suggestionId: string): string {
  const suggestion = parseBlockSuggestions(markdown).find(
    (candidate) => candidate.id === suggestionId,
  );
  if (!suggestion || suggestion.missingDefinition) return markdown;
  const before = markdown.slice(0, suggestion.blockSourceStart);
  const after = markdown.slice(suggestion.blockSourceEnd);
  return removeComment(`${before}${suggestion.bodyMarkdown.trim()}${after}`, suggestionId);
}

function restoreReviewCommentReferences(root: HTMLElement): void {
  restoreLocalNoteReferenceWidgets(root);
}

function reviewSuggestionMarker(root: HTMLElement, suggestionId: string): HTMLElement | null {
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")) {
    if (footnoteIdFromHref(link.getAttribute("href") ?? "") !== suggestionId) continue;
    return link.closest<HTMLElement>("sup") ?? link;
  }
  return null;
}

function reviewRelatedCommentMarker(
  root: HTMLElement,
  suggestion: ReturnType<typeof parseBlockSuggestions>[number],
): HTMLElement | null {
  for (const commentId of suggestion.relatedCommentIds) {
    const marker = reviewSuggestionMarker(root, commentId);
    if (marker) return marker;
  }
  return null;
}

function reviewBlockOnlyFootnoteRefs(block: HTMLElement): boolean {
  const clone = block.cloneNode(true) as HTMLElement;
  for (const sup of clone.querySelectorAll("sup")) {
    if (sup.querySelector("a[data-footnote-ref]")) sup.remove();
  }
  return clone.textContent?.trim().length === 0;
}

function previousReviewBlock(element: HTMLElement | null): HTMLElement | null {
  let previous = element?.previousElementSibling;
  while (previous) {
    if (
      previous instanceof HTMLElement &&
      previous.matches(
        "h1,h2,h3,h4,h5,h6,p,ul,ol,li,pre,table,blockquote,.local-md-image-comment-frame",
      )
    ) {
      return previous;
    }
    previous = previous.previousElementSibling;
  }
  return null;
}

function footnoteIdFromHref(href: string): string | null {
  const match = /#user-content-fn-(.+)$/.exec(href);
  return match?.[1] ?? null;
}

function reviewCommentAnchorRect(
  root: HTMLElement,
  suggestionId: string | undefined,
): DOMRect | null {
  if (!suggestionId) return null;
  return (
    root
      .querySelector<HTMLElement>(
        `.local-md-review-suggestion[data-suggestion-id="${CSS.escape(suggestionId)}"]`,
      )
      ?.getBoundingClientRect() ?? null
  );
}

function selectionIsInside(root: HTMLElement, selection: Selection | null): boolean {
  if (!selection || selection.rangeCount === 0) return true;
  return root.contains(selection.getRangeAt(0).commonAncestorContainer);
}

const selectionToolbarGutter = 8;
const selectionToolbarMargin = 8;
const fileWatchPollingInterval = 3000;

function visibleRenderedSelectionRange(root: HTMLElement, mode: AppState["mode"]): Range | null {
  if (mode !== "rendered" && mode !== "review") return null;
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  if (range.toString().trim().length === 0) return null;
  if (range.getClientRects().length === 0) return null;
  return range;
}

function createReviewSuggestionComment(
  root: HTMLElement,
  markdown: string,
  selection: Selection | null,
): { markdown: string } | null {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const region = closestCommonElement(range)?.closest<HTMLElement>(
    ".local-md-review-suggestion[data-suggestion-id]",
  );
  const suggestionId = region?.dataset.suggestionId;
  if (
    !region ||
    !suggestionId ||
    !region.contains(range.startContainer) ||
    !region.contains(range.endContainer)
  )
    return null;
  const suggestion = parseBlockSuggestions(markdown).find(
    (candidate) => candidate.id === suggestionId,
  );
  if (!suggestion) return null;
  const nextSuggestionBody = selection.isCollapsed
    ? createBlockComment(
        suggestion.bodyMarkdown,
        resolveSelectionBlockEndToSourcePosition(region, suggestion.bodyMarkdown, selection) ??
          suggestion.bodyMarkdown.length,
        "",
      )
    : (() => {
        const sourceRange = resolveSelectionToSourceRange(
          region,
          suggestion.bodyMarkdown,
          selection,
        );
        return sourceRange
          ? createRangeComment(suggestion.bodyMarkdown, sourceRange.start, sourceRange.end, "")
          : null;
      })();
  if (!nextSuggestionBody) return null;
  const definitions = extractCommentDefinitions(nextSuggestionBody);
  const suggestionBody = stripCommentDefinitions(nextSuggestionBody).trim();
  const updated = editCommentBody(markdown, suggestionId, suggestionBody);
  const needsSeparator = updated.endsWith("\n") ? "\n" : "\n\n";
  return {
    markdown:
      definitions.length > 0 ? `${updated}${needsSeparator}${definitions.join("\n")}\n` : updated,
  };
}

function resolveCodeCommentSelection(
  root: HTMLElement,
  markdown: string,
  selection: Selection | null,
): { codeSourceStart: number; line: number; col: number; length: number } | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const code = closestCommonElement(range)?.closest<HTMLElement>("pre code");
  const selectedText = range.toString();
  if (selectedText.length === 0) return null;

  const mermaidSelection = resolveMermaidCodeCommentSelection(root, markdown, range, selectedText);
  if (mermaidSelection) return mermaidSelection;

  if (!code || !code.contains(range.startContainer) || !code.contains(range.endContainer))
    return null;
  const length = selectedText.length;

  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>("pre code"));
  const sourceCode = findCodeBlockAnchors(markdown)[codeBlocks.indexOf(code)];
  if (!sourceCode) return null;

  const startOffset = textOffsetWithin(code, range.startContainer, range.startOffset);
  const position = lineColForTextOffset(code.textContent ?? "", startOffset);
  return {
    codeSourceStart: sourceCode.start,
    line: position.line,
    col: position.col,
    length,
  };
}

function resolveMermaidCodeCommentSelection(
  root: HTMLElement,
  markdown: string,
  range: Range,
  selectedText: string,
): { codeSourceStart: number; line: number; col: number; length: number } | null {
  const figure = closestCommonElement(range)?.closest<HTMLElement>(".local-md-mermaid");
  if (
    !figure ||
    !root.contains(figure) ||
    !figure.contains(range.startContainer) ||
    !figure.contains(range.endContainer)
  )
    return null;

  const mermaidIndex = Number(figure.dataset.localMdMermaidIndex ?? "-1");
  const sourceCode = findCodeBlockAnchors(markdown).filter((anchor) => isMermaidInfo(anchor.info))[
    mermaidIndex
  ];
  if (!sourceCode) return null;

  const selectedSource = selectedText.trim();
  if (!selectedSource) return null;
  const sourceOffset = sourceCode.code.indexOf(selectedSource);
  if (sourceOffset === -1) return null;
  const position = lineColForTextOffset(sourceCode.code, sourceOffset);
  return {
    codeSourceStart: sourceCode.start,
    line: position.line,
    col: position.col,
    length: selectedSource.length,
  };
}

function closestCommonElement(range: Range): Element | null {
  const node = range.commonAncestorContainer;
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

function textOffsetWithin(root: HTMLElement, node: Node, nodeOffset: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode() as Text | null;
  while (current) {
    if (current === node) return offset + nodeOffset;
    offset += current.data.length;
    current = walker.nextNode() as Text | null;
  }
  return offset;
}

function lineColForTextOffset(text: string, offset: number): { line: number; col: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < safeOffset; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, col: safeOffset - lineStart + 1 };
}

function isMermaidInfo(info: string): boolean {
  return info.trim().split(/\s+/, 1)[0]?.toLowerCase() === "mermaid";
}

function selectionFocusLineRect(selection: Selection | null, range: Range): DOMRect {
  const focusRect = selection ? boundaryLineRect(selection.focusNode, selection.focusOffset) : null;
  if (focusRect) return focusRect;

  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  );
  const fallbackRect = selectionIsForward(selection) ? rects[rects.length - 1] : rects[0];
  return fallbackRect ?? range.getBoundingClientRect();
}

function boundaryLineRect(node: Node | null, offset: number): DOMRect | null {
  if (!node) return null;

  const collapsed = document.createRange();
  try {
    collapsed.setStart(node, offset);
    collapsed.collapse(true);
  } catch {
    return null;
  }

  const collapsedRect = firstVisibleRect(collapsed);
  if (collapsedRect) return collapsedRect;

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text;
    const start = Math.max(0, Math.min(offset - 1, text.data.length - 1));
    const end = Math.min(text.data.length, Math.max(offset, start + 1));
    if (start < end) {
      const textRange = document.createRange();
      textRange.setStart(text, start);
      textRange.setEnd(text, end);
      return firstVisibleRect(textRange);
    }
  }

  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const child =
    element?.childNodes[Math.min(offset, Math.max(0, element.childNodes.length - 1))] ?? null;
  if (!child) return null;
  const childRange = document.createRange();
  childRange.selectNode(child);
  return firstVisibleRect(childRange);
}

function firstVisibleRect(range: Range): DOMRect | null {
  return (
    Array.from(range.getClientRects()).find((rect) => rect.width > 0 || rect.height > 0) ?? null
  );
}

function selectionIsForward(selection: Selection | null): boolean {
  if (!selection?.anchorNode || !selection.focusNode) return true;
  if (selection.anchorNode === selection.focusNode)
    return selection.anchorOffset <= selection.focusOffset;
  return Boolean(
    selection.anchorNode.compareDocumentPosition(selection.focusNode) &
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

function positionImageCommentAnchors(
  root: HTMLElement,
  state: AppState,
  onCommentClick?: (commentId: string) => void,
): void {
  root.querySelectorAll(".local-md-image-comment-frame").forEach((node) => {
    if (node.classList.contains("local-md-image-comment-frame")) {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      node.remove();
    }
  });

  const anchors = findImageAnchors(state.body);
  const bitmapAnchors = anchors.filter((anchor) => anchor.kind === "markdown-image");
  const svgAnchors = anchors.filter((anchor) => anchor.kind === "inline-svg");
  const bitmapElements = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  const svgElements = Array.from(root.querySelectorAll<SVGSVGElement>("svg"));
  const comments = parseComments(state.body).filter((comment) => comment.kind === "image");

  for (const [index, image] of bitmapElements.entries()) {
    const anchor = bitmapAnchors[index];
    if (!anchor) continue;
    const frame = wrapImageTarget(image);
    const imageComments = comments.filter(
      (comment) => comment.target === "bitmap" && comment.imageSourceStart === anchor.start,
    );
    for (const comment of imageComments) {
      positionImageAnchor(
        root,
        frame,
        comment.id,
        comment.x,
        comment.y,
        comment.id === state.activeCommentId,
        onCommentClick,
      );
    }
  }

  for (const [index, svg] of svgElements.entries()) {
    const anchor = svgAnchors[index];
    if (!anchor) continue;
    const frame = wrapImageTarget(svg);
    const svgComments = comments.filter(
      (comment) => comment.target === "svg" && comment.imageSourceStart === anchor.start,
    );
    for (const comment of svgComments) {
      const position = inlineSvgCommentPosition(svg, comment.svgPath ?? "");
      positionImageAnchor(
        root,
        frame,
        comment.id,
        position?.x ?? comment.x,
        position?.y ?? comment.y,
        comment.id === state.activeCommentId,
        onCommentClick,
      );
    }
  }
}

function wrapImageTarget<T extends HTMLElement | SVGSVGElement>(target: T): HTMLElement {
  const comparisonStage = target
    .closest<HTMLElement>(".local-md-image-comparison-original")
    ?.closest<HTMLElement>(".local-md-image-comparison-stage");
  if (comparisonStage) return comparisonStage;
  const existing = target.parentElement?.classList.contains("local-md-image-comment-frame")
    ? target.parentElement
    : null;
  if (existing) return existing;
  const frame = document.createElement("span");
  frame.className = "local-md-image-comment-frame";
  target.replaceWith(frame);
  frame.append(target);
  return frame;
}

function positionImageAnchor(
  root: HTMLElement,
  frame: HTMLElement,
  id: string,
  x: number,
  y: number,
  active: boolean,
  onCommentClick?: (commentId: string) => void,
): void {
  const marker = root.querySelector<HTMLElement>(
    `.local-md-image-comment-anchor[data-comment-id="${CSS.escape(id)}"]`,
  );
  if (!marker) return;
  marker.classList.toggle("local-md-image-comment-anchor-active", active);
  marker.style.left = `${x / 100}%`;
  marker.style.top = `${y / 100}%`;
  marker.hidden = false;
  marker.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCommentClick?.(id);
    const card = document.querySelector<HTMLElement>(
      `.local-md-comment-card[data-comment-id="${CSS.escape(id)}"]`,
    );
    card?.click();
  };
  frame.append(marker);
}

function resolveImageCommentHit(
  root: HTMLElement,
  markdown: string,
  target: Element,
  clientX: number,
  clientY: number,
): ImageCommentHit | null {
  const anchors = findImageAnchors(markdown);
  const image = target.closest<HTMLImageElement>("img");
  if (image && root.contains(image)) {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
    const anchor = anchors.filter((candidate) => candidate.kind === "markdown-image")[
      images.indexOf(image)
    ];
    if (!anchor) return null;
    const rect = image.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      target: "bitmap",
      sourceStart: anchor.start,
      x: normalizedCoordinate(clientX, rect.left, rect.width),
      y: normalizedCoordinate(clientY, rect.top, rect.height),
    };
  }

  const svg = target.closest("svg");
  if (svg && root.contains(svg)) {
    const svgs = Array.from(root.querySelectorAll<SVGSVGElement>("svg"));
    const anchor = anchors.filter((candidate) => candidate.kind === "inline-svg")[
      svgs.indexOf(svg)
    ];
    if (!anchor) return null;
    const clicked = target instanceof SVGElement ? target : svg;
    const rect = clicked.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      target: "svg",
      sourceStart: anchor.start,
      svgPath: svgElementPath(svg, clicked),
      x: normalizedCoordinate(clientX, rect.left, rect.width),
      y: normalizedCoordinate(clientY, rect.top, rect.height),
    };
  }

  return null;
}

function normalizedCoordinate(value: number, start: number, size: number): number {
  return Math.max(0, Math.min(10000, Math.round(((value - start) / size) * 10000)));
}

function svgElementPath(svg: SVGElement, element: SVGElement): string {
  if (element.id) return `id.${element.id}`;
  if (element === svg) return "svg.1";
  const parts: string[] = [];
  let current: SVGElement | null = element;
  while (current) {
    const parent: SVGElement | null =
      current.parentElement instanceof SVGElement ? current.parentElement : null;
    const siblings = parent
      ? Array.from(parent.children).filter((child) => child.tagName === current?.tagName)
      : [];
    const index = parent ? Math.max(1, siblings.indexOf(current) + 1) : 1;
    parts.unshift(`${current.tagName.toLowerCase()}.${index}`);
    if (current === svg) break;
    current = parent;
  }
  return parts.join("-") || "svg.1";
}

function inlineSvgCommentPosition(
  svg: SVGSVGElement,
  locator: string,
): { x: number; y: number } | null {
  return svgElementCommentPosition(svg, resolveSvgLocator(svg, locator));
}

function svgElementCommentPosition(
  svg: SVGElement,
  element: SVGElement | null,
): { x: number; y: number } | null {
  if (!element) return null;
  const svgRect = svg.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  if (
    svgRect.width <= 0 ||
    svgRect.height <= 0 ||
    elementRect.width <= 0 ||
    elementRect.height <= 0
  )
    return null;
  return {
    x: normalizedCoordinate(elementRect.left + elementRect.width / 2, svgRect.left, svgRect.width),
    y: normalizedCoordinate(elementRect.top + elementRect.height / 2, svgRect.top, svgRect.height),
  };
}

function resolveSvgLocator(svg: SVGElement, locator: string): SVGElement | null {
  if (locator.startsWith("id.")) {
    return svg.ownerDocument.getElementById(locator.slice("id.".length)) as SVGElement | null;
  }
  let current: SVGElement | null = svg;
  const parts = locator.split("-");
  for (const [index, part] of parts.entries()) {
    const match = /^([A-Za-z][A-Za-z0-9:_-]*)\.(\d+)$/.exec(part);
    if (!match) return null;
    const tag = match[1]?.toLowerCase() ?? "";
    const ordinal = Number(match[2]);
    if (index === 0 && current.tagName.toLowerCase() === tag && ordinal === 1) continue;
    const matches: SVGElement[] = Array.from(current.children).filter(
      (child): child is SVGElement =>
        isSvgElementNode(child) && child.tagName.toLowerCase() === tag,
    );
    current = matches[ordinal - 1] ?? null;
    if (!current) return null;
  }
  return current;
}

function isSvgElementNode(value: unknown): value is SVGElement {
  return Boolean(
    value &&
    typeof value === "object" &&
    "nodeType" in value &&
    (value as Node).nodeType === Node.ELEMENT_NODE &&
    "namespaceURI" in value &&
    (value as Element).namespaceURI === "http://www.w3.org/2000/svg",
  );
}

type ImageCommentHit =
  | { target: "bitmap"; sourceStart: number; x: number; y: number }
  | { target: "svg"; sourceStart: number; svgPath: string; x: number; y: number };

const commentCardGap = 12;

interface CommentLayoutItem {
  card: HTMLElement;
  keyId: string;
  active: boolean;
  desiredTop: number;
  orderOffset: number;
  height: number;
  y: number;
}

function layoutCommentStack(items: CommentLayoutItem[], startTop: number): void {
  let nextTop = startTop;
  for (const item of items) {
    item.y = Math.max(item.desiredTop, nextTop);
    nextTop = item.y + item.height + commentCardGap;
  }
}

function scrollTextareaSelectionIntoView(textarea: HTMLTextAreaElement, position: number): void {
  const targetTop = textareaSourcePositionRect(textarea, position).top;
  const viewportTop = textarea.getBoundingClientRect().top + window.scrollY + targetTop;
  window.scrollTo({
    top: Math.max(0, viewportTop - window.innerHeight / 2 + textareaLineHeight(textarea)),
    behavior: "auto",
  });
}

async function restoredHandleMatchesLoadedDocument(
  handle: WritableFileHandle,
  openedIdentity: LoadedFileIdentity | null,
): Promise<boolean> {
  if (!handle.getFile) return true;
  try {
    const file = await handle.getFile();
    const contents = await file.text();
    const hash = await hashText(contents);
    const matches = Boolean(openedIdentity && openedIdentity.acceptedHashes.includes(hash));
    logFileHandling("restored handle content check", {
      handleName: handle.name ?? "(unnamed)",
      matches,
      hash,
      openedHash: openedIdentity?.hash ?? null,
      acceptedHashes: openedIdentity?.acceptedHashes ?? [],
      fileLength: contents.length,
      openedLength: openedIdentity?.length ?? null,
      openedSource: openedIdentity?.source ?? null,
    });
    return matches;
  } catch (error) {
    logFileHandling("restored handle content check failed", {
      handleName: handle.name ?? "(unnamed)",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return false;
  }
}

function createLoadedFileIdentity(): Promise<LoadedFileIdentity> {
  const bookmarkletHash = sourceHashFromLoader();
  const bookmarkletLength = sourceLengthFromLoader();
  const identity: LoadedFileIdentity = {
    hash: bookmarkletHash ?? "",
    acceptedHashes: bookmarkletHash ? [bookmarkletHash] : [],
    length: bookmarkletLength ?? 0,
    source: "bookmarklet",
  };
  logFileHandling("opened file identity", {
    hash: identity.hash,
    acceptedHashes: identity.acceptedHashes,
    length: identity.length,
    loaderLength: bookmarkletLength,
    loaderHash: bookmarkletHash,
    loaderDetails: sourceIdentityDetails(),
    source: identity.source,
  });
  if (!bookmarkletHash)
    logFileHandling("opened file identity missing bookmarklet hash; file handle matching disabled");
  return Promise.resolve(identity);
}

function sourceHashFromLoader(): string | null {
  const hash =
    window.__localMdSourceIdentity?.hash?.trim() ??
    sourceIdentityMeta()?.dataset.sourceHash?.trim() ??
    sourceLoaderElement()?.dataset.sourceHash?.trim() ??
    "";
  return /^[A-Za-z0-9:_-]+$/.test(hash) ? hash : null;
}

function sourceLengthFromLoader(): number | null {
  const length =
    window.__localMdSourceIdentity?.length ??
    sourceIdentityMeta()?.dataset.sourceLength ??
    sourceLoaderElement()?.dataset.sourceLength ??
    "";
  const parsed = Number(length);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceIdentityMeta(): HTMLElement | null {
  return document.querySelector<HTMLElement>('meta[name="local-md-source"]');
}

function sourceLoaderElement(): HTMLElement | null {
  return (
    document.getElementById("local-md-loader") ??
    document.querySelector<HTMLElement>('script[src$="local-md.js"], script[src*="local-md.js"]')
  );
}

function sourceIdentityDetails(): Record<string, unknown> {
  const meta = sourceIdentityMeta();
  const loader = sourceLoaderElement();
  return {
    hasMeta: Boolean(meta),
    globalHash: window.__localMdSourceIdentity?.hash ?? null,
    globalLength: window.__localMdSourceIdentity?.length ?? null,
    metaHash: meta?.dataset.sourceHash ?? null,
    metaLength: meta?.dataset.sourceLength ?? null,
    hasLoader: Boolean(loader),
    loaderId: loader?.id ?? null,
    loaderHash: loader?.dataset.sourceHash ?? null,
    loaderLength: loader?.dataset.sourceLength ?? null,
    loaderSrc: loader instanceof HTMLScriptElement ? loader.src : null,
  };
}

async function fileHandleMatchesOpenedIdentity(
  handle: WritableFileHandle,
  openedIdentity: LoadedFileIdentity | null,
  candidate: string,
): Promise<boolean> {
  if (!openedIdentity) {
    logFileHandling("candidate identity unavailable; rejecting", {
      candidate,
      handleName: handle.name ?? "(unnamed)",
    });
    return false;
  }
  if (!handle.getFile) {
    logFileHandling("candidate cannot be read for identity; rejecting", {
      candidate,
      handleName: handle.name ?? "(unnamed)",
    });
    return false;
  }
  try {
    const file = await handle.getFile();
    const contents = await file.text();
    const hash = await hashText(contents);
    const matches = openedIdentity.acceptedHashes.includes(hash);
    logFileHandling("candidate identity check", {
      candidate,
      handleName: handle.name ?? "(unnamed)",
      matches,
      hash,
      openedHash: openedIdentity.hash,
      acceptedHashes: openedIdentity.acceptedHashes,
      length: contents.length,
      openedLength: openedIdentity.length,
      openedSource: openedIdentity.source,
    });
    return matches;
  } catch (error) {
    logFileHandling("candidate identity check failed", {
      candidate,
      handleName: handle.name ?? "(unnamed)",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return false;
  }
}

async function hashText(value: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

async function resolveFileHandleFromDirectory(
  directory: WritableDirectoryHandle,
  location: Location,
  allowPermissionPrompt: boolean,
  openedIdentity: LoadedFileIdentity | null,
): Promise<WritableFileHandle | null> {
  const hasPermission = await ensureDirectoryReadPermission(directory, allowPermissionPrompt);
  logFileHandling("directory permission result", {
    folderName: directory.name ?? "(unnamed)",
    allowPermissionPrompt,
    hasPermission,
  });
  if (!hasPermission) return null;
  const candidates = candidateFilePathsForDirectory(directory, location);
  logFileHandling("directory candidates", {
    folderName: directory.name ?? "(unnamed)",
    candidates: candidates.map((path) => path.join("/")),
  });
  for (const path of candidates) {
    const handle = await getFileHandleByPath(directory, path);
    if (handle) {
      const matchesIdentity = await fileHandleMatchesOpenedIdentity(
        handle,
        openedIdentity,
        path.join("/"),
      );
      if (!matchesIdentity) continue;
      logFileHandling("directory candidate matched identity", {
        folderName: directory.name ?? "(unnamed)",
        candidate: path.join("/"),
        handleName: handle.name ?? "(unnamed)",
      });
      return handle;
    }
  }
  logFileHandling("directory candidates exhausted", { folderName: directory.name ?? "(unnamed)" });
  return null;
}

async function ensureDirectoryReadPermission(
  directory: WritableDirectoryHandle,
  allowPermissionPrompt: boolean,
): Promise<boolean> {
  try {
    if (!directory.queryPermission) {
      logFileHandling("directory permission unavailable; assuming true", {
        folderName: directory.name ?? "(unnamed)",
      });
      return true;
    }
    const current = await directory.queryPermission({ mode: "readwrite" });
    logFileHandling("directory queryPermission", {
      folderName: directory.name ?? "(unnamed)",
      current,
      allowPermissionPrompt,
    });
    if (current === "granted") return true;
    if (!allowPermissionPrompt || !directory.requestPermission) return false;
    const requested = await directory.requestPermission({ mode: "readwrite" });
    logFileHandling("directory requestPermission", {
      folderName: directory.name ?? "(unnamed)",
      requested,
    });
    return requested === "granted";
  } catch (error) {
    logFileHandling("directory permission check failed", {
      folderName: directory.name ?? "(unnamed)",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return false;
  }
}

function candidateFilePathsForDirectory(
  directory: WritableDirectoryHandle,
  location: Location,
): string[][] {
  const segments = decodeLocationPathSegments(location);
  const fileName = suggestedFileNameFromLocation(location);
  const candidates: string[][] = [];
  const directoryName = directory.name;
  if (directoryName) {
    for (let index = segments.length - 2; index >= 0; index -= 1) {
      if (segments[index] === directoryName) candidates.push(segments.slice(index + 1));
    }
  }
  for (let index = 0; index < segments.length - 1; index += 1) {
    candidates.push(segments.slice(index));
  }
  candidates.push([fileName]);
  return uniquePathCandidates(candidates.filter((candidate) => candidate.length > 0));
}

function decodeLocationPathSegments(location: Location): string[] {
  return location.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

async function copyCurrentParentPathToClipboard(win: Window): Promise<void> {
  const path = parentFolderPathFromLocation(win.location);
  if (!path) return;
  await copyTextToClipboard(win, path);
}

async function copyTextToClipboard(win: Window, text: string): Promise<boolean> {
  if (!text || !win.navigator.clipboard?.writeText) return false;
  try {
    await win.navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard access is best effort; the folder picker still works without it.
    return false;
  }
}

function downloadJsonFile(value: unknown, fileName: string, doc: Document): void {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  doc.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function parentFolderPathFromLocation(location: Location): string {
  if (location.protocol !== "file:") return "";
  const segments = decodeLocationPathSegments(location);
  if (segments.length <= 1) return "/";
  return `/${segments.slice(0, -1).join("/")}`;
}

function decodeFileUrlPath(location: Location): string {
  try {
    return decodeURIComponent(location.pathname);
  } catch {
    return location.pathname;
  }
}

function uniquePathCandidates(candidates: string[][]): string[][] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.join("/");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getFileHandleByPath(
  directory: WritableDirectoryHandle,
  path: string[],
): Promise<WritableFileHandle | null> {
  let current = directory;
  try {
    for (const segment of path.slice(0, -1)) {
      logFileHandling("directory descend", { folderName: current.name ?? "(unnamed)", segment });
      current = await current.getDirectoryHandle(segment);
    }
    const fileName = path.at(-1);
    if (!fileName) return null;
    logFileHandling("directory getFileHandle", {
      folderName: current.name ?? "(unnamed)",
      fileName,
    });
    return await current.getFileHandle(fileName);
  } catch (error) {
    logFileHandling("directory path miss", {
      candidate: path.join("/"),
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    return null;
  }
}

function hasDirectoryPicker(win: Window): boolean {
  return (
    typeof (win as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function"
  );
}

function logFileHandling(message: string, details: Record<string, unknown> = {}): void {
  console.info("[local-md:file]", message, details);
}

function installFallbackBookmarkletControl(root: HTMLElement): void {
  const link = root.querySelector<HTMLAnchorElement>('a[href^="javascript:"]');
  if (!link) return;

  link.classList.add("local-md-bookmarklet-install");
  link.contentEditable = "false";
  link.draggable = true;
  link.title = "Drag this link to your bookmarks bar";

  const hintId = "local-md-bookmarklet-drag-hint";
  let hint = root.querySelector<HTMLElement>(`#${hintId}`);
  if (!hint) {
    hint = document.createElement("span");
    hint.id = hintId;
    hint.className = "local-md-bookmarklet-drag-hint";
    hint.hidden = true;
    hint.setAttribute("role", "status");
    link.after(hint);
  }
  link.setAttribute("aria-describedby", hintId);

  const showDragHint = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    link.classList.remove("local-md-bookmarklet-install-shake");
    void link.offsetWidth;
    link.classList.add("local-md-bookmarklet-install-shake");
    hint.hidden = false;
    hint.textContent = "Drag me to your bookmarks bar";
  };

  link.addEventListener("click", showDragHint, { capture: true });
  link.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") showDragHint(event);
    },
    { capture: true },
  );
}
