import {
  findCodeBlockAnchors,
  occurrenceIndexBefore,
  parseComments,
  resolveRenderedTextRange,
  type ParsedComment,
} from "../markdown/comments";

const highlightNames = [
  "local-md-comment-range-current",
  "local-md-comment-range-active",
  "local-md-comment-range-stale",
  "local-md-comment-range-broken",
  "local-md-comment-block-current",
  "local-md-comment-block-active",
  "local-md-comment-block-stale",
  "local-md-comment-block-broken",
];

export function resolveSelectionToSourceRange(
  root: HTMLElement,
  markdown: string,
  selection: Selection | null,
): { start: number; end: number } | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  if (anchorTextForRange(range).length === 0) return null;

  const selectedText = logicalTextForRange(range);
  const renderedText = logicalText(root);
  const renderedStart = logicalTextOffset(root, range.startContainer, range.startOffset);
  const occurrence = occurrenceIndexBefore(renderedText, selectedText, renderedStart);
  return resolveRenderedTextRange(markdown, selectedText, occurrence);
}

export function resolveSelectionBlockEndToSourcePosition(
  root: HTMLElement,
  markdown: string,
  selection: Selection | null,
): number | null {
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;

  const element =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const block = element?.closest<HTMLElement>("h1,h2,h3,h4,h5,h6,p,li,pre,td,th,blockquote");
  if (!block) return null;

  const blockText = logicalText(block);
  if (!blockText) return null;

  const renderedText = logicalText(root);
  const blockStart = logicalTextOffset(root, block, 0);
  const occurrence = occurrenceIndexBefore(renderedText, blockText, blockStart);
  const sourceRange = resolveRenderedTextRange(markdown, blockText, occurrence);
  return sourceRange?.end ?? null;
}

export function decorateRenderedComments(
  root: HTMLElement,
  markdown: string,
  activeCommentId: string | null,
): void {
  const comments = parseComments(markdown);
  prepareRenderedFootnotes(root, comments);
  clearCommentHighlights();

  if (!supportsCustomHighlights()) return;

  const buckets = new Map<string, Range[]>();
  for (const comment of comments) {
    if (comment.kind === "dangling") continue;
    const range = renderedRangeForComment(root, markdown, comment);
    if (!range) continue;
    const active = comment.id === activeCommentId;
    const bucketName = bucketForComment(comment, active);
    buckets.set(bucketName, [...(buckets.get(bucketName) ?? []), range]);
  }

  for (const [name, ranges] of buckets) {
    const highlight = new Highlight(...ranges);
    highlight.priority = highlightPriority(name);
    CSS.highlights?.set(name, highlight);
  }
}

export function activeCommentIdFromSelection(
  root: HTMLElement,
  markdown: string,
  selection: Selection | null,
): string | null {
  if (!selection || selection.rangeCount === 0) return null;
  const caretRange = selection.getRangeAt(0).cloneRange();
  if (!root.contains(caretRange.commonAncestorContainer)) return null;

  const comments = parseComments(markdown).filter((comment) => comment.kind !== "dangling");
  const containing = comments
    .map((comment) => ({ comment, range: renderedRangeForComment(root, markdown, comment) }))
    .filter(
      (
        candidate,
      ): candidate is { comment: Exclude<ParsedComment, { kind: "dangling" }>; range: Range } =>
        Boolean(candidate.range),
    )
    .filter((candidate) => rangesOverlap(root, candidate.range, caretRange));

  if (containing.length > 0) {
    return (
      containing.sort(
        (left, right) => left.range.toString().length - right.range.toString().length,
      )[0]?.comment.id ?? null
    );
  }

  const anchor = closestCommentAnchor(caretRange);
  return anchor?.dataset.commentId ?? null;
}

export function renderedCommentAnchorRect(
  root: HTMLElement,
  markdown: string,
  comment: Exclude<ParsedComment, { kind: "dangling" }>,
): DOMRect | null {
  const anchor = root.querySelector<HTMLElement>(
    `.local-md-comment-anchor[data-comment-id="${CSS.escape(comment.id)}"]`,
  );
  if (anchor) return anchor.getBoundingClientRect();

  const range = renderedRangeForComment(root, markdown, comment);
  if (!range) return null;
  const firstRect = range.getClientRects()[0];
  return firstRect ?? null;
}

function prepareRenderedFootnotes(root: HTMLElement, comments: ParsedComment[]): void {
  const localIds = new Set(comments.map((comment) => comment.id));
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
  for (const link of root.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")) {
    const id = commentIdFromHref(link.getAttribute("href") ?? "");
    if (!id || !localIds.has(id)) continue;
    const comment = commentsById.get(id);
    const marker = link.closest<HTMLElement>("sup") ?? link;
    marker.classList.add("local-md-comment-anchor");
    if (comment?.kind === "image") {
      marker.classList.add("local-md-image-comment-anchor");
    }
    marker.dataset.commentId = id;
    marker.dataset.commentState = commentState(comment);
    marker.contentEditable = "false";
    link.contentEditable = "false";
  }

  const footnotes = root.querySelector<HTMLElement>("section[data-footnotes]");
  if (footnotes) {
    footnotes.contentEditable = "false";
    for (const item of footnotes.querySelectorAll<HTMLElement>("li[id^='user-content-fn-']")) {
      const id = commentIdFromFootnoteId(item.id);
      if (id && localIds.has(id)) item.hidden = true;
    }
    const hasVisibleItems = Array.from(footnotes.querySelectorAll("li")).some(
      (item) => !item.hidden,
    );
    if (!hasVisibleItems) footnotes.hidden = true;
  }
}

function renderedRangeForComment(
  root: HTMLElement,
  markdown: string,
  comment: Exclude<ParsedComment, { kind: "dangling" }>,
): Range | null {
  if (comment.kind === "code") return codeRangeForComment(root, markdown, comment);

  const anchor = root.querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(comment.id)}"]`);
  if (!anchor) return null;

  if (comment.kind === "block") {
    const block = anchor.closest<HTMLElement>("h1,h2,h3,h4,h5,h6,p,li,pre,td,th,blockquote");
    if (!block) return null;
    const range = document.createRange();
    range.selectNodeContents(block);
    return range;
  }

  if (comment.kind === "image") return null;

  return logicalRangeAroundAnchor(root, anchor, comment.direction, comment.logicalLength);
}

function codeRangeForComment(
  root: HTMLElement,
  markdown: string,
  comment: Extract<ParsedComment, { kind: "code" }>,
): Range | null {
  const codeBlocks = findCodeBlockAnchors(markdown);
  const sourceCode = codeBlocks.find((code) => code.start === comment.codeSourceStart);
  if (!sourceCode) return null;

  if (isMermaidInfo(sourceCode.info))
    return mermaidRangeForComment(root, codeBlocks, sourceCode, comment);

  const nonMermaidIndex = codeBlocks.filter(
    (code) => !isMermaidInfo(code.info) && code.start < sourceCode.start,
  ).length;
  const codeElement = Array.from(root.querySelectorAll<HTMLElement>("pre code"))[nonMermaidIndex];
  if (!codeElement) return null;
  const codeText = codeElement.textContent ?? "";
  const start = textOffsetForLineCol(codeText, comment.line, comment.col);
  const end = Math.min(codeText.length, start + comment.length);
  return textRangeWithin(codeElement, start, end);
}

function mermaidRangeForComment(
  root: HTMLElement,
  codeBlocks: ReturnType<typeof findCodeBlockAnchors>,
  sourceCode: ReturnType<typeof findCodeBlockAnchors>[number],
  comment: Extract<ParsedComment, { kind: "code" }>,
): Range | null {
  const mermaidIndex = codeBlocks.filter(
    (code) => isMermaidInfo(code.info) && code.start < sourceCode.start,
  ).length;
  const figure = Array.from(root.querySelectorAll<HTMLElement>(".local-md-mermaid"))[mermaidIndex];
  if (!figure) return null;
  const start = textOffsetForLineCol(sourceCode.code, comment.line, comment.col);
  const sourceText = sourceCode.code
    .slice(start, Math.min(sourceCode.code.length, start + comment.length))
    .trim();
  if (!sourceText) return null;
  return textRangeForFirstMatch(figure, sourceText);
}

function textOffsetForLineCol(text: string, line: number, col: number): number {
  let offset = 0;
  for (let currentLine = 1; currentLine < line && offset < text.length; currentLine += 1) {
    const nextBreak = text.indexOf("\n", offset);
    if (nextBreak === -1) return text.length;
    offset = nextBreak + 1;
  }
  return Math.min(text.length, offset + Math.max(0, col - 1));
}

function textRangeWithin(root: HTMLElement, start: number, end: number): Range | null {
  const range = document.createRange();
  const startPoint = textPointWithin(root, start);
  const endPoint = textPointWithin(root, end);
  if (!startPoint || !endPoint) return null;
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  return range;
}

function textPointWithin(root: HTMLElement, offset: number): { node: Text; offset: number } | null {
  const safeOffset = Math.max(0, offset);
  let currentOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const nextOffset = currentOffset + node.data.length;
    if (safeOffset <= nextOffset) return { node, offset: safeOffset - currentOffset };
    currentOffset = nextOffset;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

function textRangeForFirstMatch(root: HTMLElement, text: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const start = node.data.indexOf(text);
    if (start !== -1) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + text.length);
      return range;
    }
    node = walker.nextNode() as Text | null;
  }
  return null;
}

function isMermaidInfo(info: string): boolean {
  return info.trim().split(/\s+/, 1)[0]?.toLowerCase() === "mermaid";
}

function logicalRangeAroundAnchor(
  root: HTMLElement,
  anchor: HTMLElement,
  direction: "next" | "prev",
  logicalLength: number,
): Range | null {
  const offsets = anchorTextOffsets(root);
  const anchorOffset = boundaryOffset(root, anchor, direction === "prev" ? "before" : "after");
  const beforeAnchor = offsets.filter((offset) => offset.end <= anchorOffset);
  const selected =
    direction === "prev"
      ? beforeAnchor.slice(Math.max(0, beforeAnchor.length - logicalLength))
      : offsets.filter((offset) => offset.start >= anchorOffset).slice(0, logicalLength);

  if (selected.length === 0) return null;
  const first = selected[0];
  const last = selected[selected.length - 1];
  if (!first || !last) return null;
  const range = document.createRange();
  range.setStart(first.node, first.startOffset);
  range.setEnd(last.node, last.endOffset);
  return range;
}

function logicalText(root: HTMLElement): string {
  return logicalTextOffsets(root)
    .map((offset) => offset.node.data.slice(offset.startOffset, offset.endOffset))
    .join("");
}

function logicalTextForRange(range: Range): string {
  const wrapper = document.createElement("div");
  wrapper.append(range.cloneContents());
  return logicalText(wrapper);
}

function anchorTextForRange(range: Range): string {
  const wrapper = document.createElement("div");
  wrapper.append(range.cloneContents());
  return anchorTextOffsets(wrapper)
    .map((offset) => offset.node.data.slice(offset.startOffset, offset.endOffset))
    .join("");
}

function logicalTextOffset(root: HTMLElement, node: Node, nodeOffset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, nodeOffset);
  const wrapper = document.createElement("div");
  wrapper.append(range.cloneContents());
  return logicalText(wrapper).length;
}

function logicalTextOffsets(root: HTMLElement): LogicalTextOffset[] {
  const offsets: LogicalTextOffset[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isIgnoredLogicalTextNode(node)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let logicalOffset = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    for (let index = 0; index < node.data.length; index += 1) {
      offsets.push({
        node,
        start: logicalOffset,
        end: logicalOffset + 1,
        startOffset: index,
        endOffset: index + 1,
      });
      logicalOffset += 1;
    }
    node = walker.nextNode() as Text | null;
  }
  return offsets;
}

function anchorTextOffsets(root: HTMLElement): LogicalTextOffset[] {
  return logicalTextOffsets(root).filter(
    (offset) => !isAnchorWhitespace(offset.node.data.slice(offset.startOffset, offset.endOffset)),
  );
}

function boundaryOffset(root: HTMLElement, element: HTMLElement, side: "after" | "before"): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  if (side === "before") {
    range.setEndBefore(element);
  } else {
    range.setEndAfter(element);
  }
  const wrapper = document.createElement("div");
  wrapper.append(range.cloneContents());
  return logicalText(wrapper).length;
}

function isIgnoredLogicalTextNode(node: Node): boolean {
  const parent = node.parentElement;
  if (/^\s+$/.test(node.textContent ?? "")) {
    const previous = node.previousSibling;
    const next = node.nextSibling;
    if (
      parent?.closest("table,thead,tbody,tfoot,tr") ||
      (isTableCellElement(previous) && isTableCellElement(next)) ||
      (isBlockElement(previous) && isBlockElement(next))
    ) {
      return true;
    }
  }
  return Boolean(
    parent?.closest(".local-md-comment-anchor, section[data-footnotes], [contenteditable='false']"),
  );
}

function isTableCellElement(node: Node | null): boolean {
  return node instanceof HTMLElement && (node.tagName === "TD" || node.tagName === "TH");
}

function isBlockElement(node: Node | null): boolean {
  return (
    node instanceof HTMLElement &&
    /^(BLOCKQUOTE|DIV|H[1-6]|LI|OL|P|PRE|TABLE|UL)$/.test(node.tagName)
  );
}

function clearCommentHighlights(): void {
  for (const name of highlightNames) {
    CSS.highlights?.delete(name);
  }
}

function bucketForComment(
  comment: Exclude<ParsedComment, { kind: "dangling" }>,
  active: boolean,
): string {
  const prefix = comment.kind === "block" ? "local-md-comment-block" : "local-md-comment-range";
  if (active) return `${prefix}-active`;
  return `${prefix}-${commentState(comment)}`;
}

function highlightPriority(name: string): number {
  if (name.endsWith("-active")) return 20;
  if (name.endsWith("-broken")) return 12;
  if (name.endsWith("-stale")) return 11;
  return 10;
}

function commentState(comment: ParsedComment | undefined): "broken" | "current" | "stale" {
  if (!comment) return "broken";
  return comment.missingDefinition
    ? "broken"
    : comment.kind !== "dangling" && comment.stale
      ? "stale"
      : "current";
}

function supportsCustomHighlights(): boolean {
  return "Highlight" in window && Boolean(CSS.highlights);
}

function rangesOverlap(root: HTMLElement, commentRange: Range, selectionRange: Range): boolean {
  const commentStart = logicalTextOffset(
    root,
    commentRange.startContainer,
    commentRange.startOffset,
  );
  const commentEnd = logicalTextOffset(root, commentRange.endContainer, commentRange.endOffset);
  const selectionStart = logicalTextOffset(
    root,
    selectionRange.startContainer,
    selectionRange.startOffset,
  );
  const selectionEnd = logicalTextOffset(
    root,
    selectionRange.endContainer,
    selectionRange.endOffset,
  );
  if (selectionRange.collapsed) {
    return selectionStart >= commentStart && selectionStart <= commentEnd;
  }
  return commentStart < selectionEnd && commentEnd > selectionStart;
}

function closestCommentAnchor(range: Range): HTMLElement | null {
  const node = range.startContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest<HTMLElement>("[data-comment-id]") ?? null;
}

function commentIdFromHref(href: string): string | null {
  const match = /#user-content-fn-(.+)$/.exec(href);
  return match?.[1] ?? null;
}

function commentIdFromFootnoteId(id: string): string | null {
  const match = /^user-content-fn-(.+)$/.exec(id);
  return match?.[1] ?? null;
}

interface LogicalTextOffset {
  node: Text;
  start: number;
  end: number;
  startOffset: number;
  endOffset: number;
}

function isAnchorWhitespace(char: string): boolean {
  return /\s/u.test(char);
}
