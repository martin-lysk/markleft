export interface SourceRange {
  start: number;
  end: number;
}

export type MarkdownBlockKind =
  "paragraph" | "heading" | "list" | "table" | "blockquote" | "code" | "raw-html" | "html-comment";

export interface MarkdownBlockRange extends SourceRange {
  kind: MarkdownBlockKind;
  markdown: string;
  next: number;
}

export interface MarkdownBlockOptions {
  includeHtmlComments?: boolean;
}

export function markdownBlockRanges(
  markdown: string,
  options: MarkdownBlockOptions = {},
): MarkdownBlockRange[] {
  const ranges: MarkdownBlockRange[] = [];
  let cursor = 0;

  while (cursor < markdown.length) {
    let line = lineRangeAt(markdown, cursor);
    while (cursor < markdown.length && markdown.slice(line.start, line.end).trim().length === 0) {
      cursor = line.next;
      line = lineRangeAt(markdown, cursor);
    }
    if (cursor >= markdown.length) break;

    if (/^\[\^[^\]]+\]:/.test(markdown.slice(line.start, line.end))) break;

    const htmlComment = htmlCommentBlockRange(markdown, line.start);
    if (htmlComment) {
      if (options.includeHtmlComments) ranges.push(toBlock(markdown, "html-comment", htmlComment));
      cursor = htmlComment.next;
      continue;
    }

    const rawHtml = rawHtmlBlockRange(markdown, line.start);
    if (rawHtml) {
      ranges.push(toBlock(markdown, "raw-html", rawHtml));
      cursor = rawHtml.next;
      continue;
    }

    const code = fencedCodeBlockRange(markdown, line.start);
    if (code) {
      ranges.push(toBlock(markdown, "code", code));
      cursor = code.next;
      continue;
    }

    const table = tableBlockRange(markdown, line.start);
    if (table) {
      ranges.push(toBlock(markdown, "table", table));
      cursor = table.next;
      continue;
    }

    const list = listBlockRange(markdown, line.start);
    if (list) {
      ranges.push(toBlock(markdown, "list", list));
      cursor = list.next;
      continue;
    }

    const blockquote = blockquoteBlockRange(markdown, line.start);
    if (blockquote) {
      ranges.push(toBlock(markdown, "blockquote", blockquote));
      cursor = blockquote.next;
      continue;
    }

    const blank = markdown.indexOf("\n\n", cursor);
    const htmlCommentStart = nextStandaloneHtmlCommentStart(markdown, line.next);
    const boundary = Math.min(
      blank === -1 ? markdown.length : blank,
      htmlCommentStart ?? markdown.length,
    );
    const end = trimBlockEnd(markdown, boundary);
    const kind = /^ {0,3}#{1,6}\s+/.test(markdown.slice(line.start, line.end))
      ? "heading"
      : "paragraph";
    ranges.push(
      toBlock(markdown, kind, {
        start: cursor,
        end,
        next:
          htmlCommentStart !== null && htmlCommentStart === boundary
            ? htmlCommentStart
            : blank === -1
              ? markdown.length
              : blank + 2,
      }),
    );
    cursor =
      htmlCommentStart !== null && htmlCommentStart === boundary
        ? htmlCommentStart
        : blank === -1
          ? markdown.length
          : blank + 2;
  }

  return ranges.filter((range) => range.markdown.trim().length > 0);
}

export function markdownBlockAt(
  markdown: string,
  position: number,
  options: MarkdownBlockOptions = {},
): MarkdownBlockRange | null {
  return (
    markdownBlockRanges(markdown, options).find(
      (range) => position >= range.start && position <= range.end,
    ) ?? null
  );
}

export function markdownBlockEndingAt(
  markdown: string,
  end: number,
  options: MarkdownBlockOptions = {},
): MarkdownBlockRange | null {
  return markdownBlockRanges(markdown, options).find((range) => range.end === end) ?? null;
}

export function lineRangeAt(
  markdown: string,
  position: number,
): { start: number; end: number; next: number } {
  const safePosition = Math.max(0, Math.min(position, markdown.length));
  const start = markdown.lastIndexOf("\n", Math.max(0, safePosition - 1)) + 1;
  const nextBreak = markdown.indexOf("\n", safePosition);
  return {
    start,
    end: nextBreak === -1 ? markdown.length : nextBreak,
    next: nextBreak === -1 ? markdown.length : nextBreak + 1,
  };
}

export function trimBlockEnd(markdown: string, end: number): number {
  let cursor = end;
  while (cursor > 0 && (markdown[cursor - 1] === "\n" || markdown[cursor - 1] === "\r"))
    cursor -= 1;
  return cursor;
}

export function isMarkdownListBlock(markdown: string): boolean {
  return isMarkdownListItemLine(markdown.split(/\r?\n/, 1)[0] ?? "");
}

export function isMarkdownTableBlock(markdown: string): boolean {
  const lines = markdown.split(/\r?\n/);
  return (
    lines.length >= 2 &&
    isMarkdownTableRow(lines[0] ?? "") &&
    isMarkdownTableDelimiter(lines[1] ?? "")
  );
}

export function isFencedCodeBlock(markdown: string): boolean {
  return /^ {0,3}(```+|~~~+)/.test(markdown.split(/\r?\n/, 1)[0] ?? "");
}

function toBlock(
  markdown: string,
  kind: MarkdownBlockKind,
  range: { start: number; end: number; next: number },
): MarkdownBlockRange {
  return {
    kind,
    start: range.start,
    end: range.end,
    next: range.next,
    markdown: markdown.slice(range.start, range.end),
  };
}

function htmlCommentBlockRange(
  markdown: string,
  start: number,
): { start: number; end: number; next: number } | null {
  const first = lineRangeAt(markdown, start);
  const firstText = markdown.slice(first.start, first.end);
  if (!/^ {0,3}<!--/.test(firstText)) return null;

  let end = first.end;
  let next = first.next;
  while (end < markdown.length && !markdown.slice(first.start, end).includes("-->")) {
    const line = lineRangeAt(markdown, next);
    if (line.start === line.end && line.next === next) break;
    end = line.end;
    next = line.next;
  }

  return { start: first.start, end, next };
}

function nextStandaloneHtmlCommentStart(markdown: string, start: number): number | null {
  let cursor = start;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const text = markdown.slice(line.start, line.end);
    if (text.trim().length === 0) return null;
    if (/^ {0,3}<!--/.test(text)) return line.start;
    cursor = line.next;
  }
  return null;
}

function rawHtmlBlockRange(
  markdown: string,
  start: number,
): { start: number; end: number; next: number } | null {
  const first = lineRangeAt(markdown, start);
  const firstText = markdown.slice(first.start, first.end);
  const tag = /^ {0,3}<([A-Za-z][\w:-]*)(?:\s[^>]*)?>/i.exec(firstText)?.[1];
  if (!tag) return null;

  let depth = htmlTagDepth(firstText, tag);
  if (depth <= 0) return { start: first.start, end: first.end, next: first.next };

  let cursor = first.next;
  let end = first.end;
  let next = first.next;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    depth += htmlTagDepth(markdown.slice(line.start, line.end), tag);
    end = line.end;
    next = line.next;
    if (depth <= 0) return { start: first.start, end: trimBlockEnd(markdown, end), next };
    cursor = line.next;
  }

  return null;
}

function htmlTagDepth(source: string, tag: string): number {
  const escapedTag = escapeRegExp(tag);
  const opening = source.match(new RegExp(`<${escapedTag}(?=[\\s>])`, "gi"))?.length ?? 0;
  const closing = source.match(new RegExp(`</${escapedTag}\\s*>`, "gi"))?.length ?? 0;
  return opening - closing;
}

function fencedCodeBlockRange(
  markdown: string,
  start: number,
): { start: number; end: number; next: number } | null {
  const first = lineRangeAt(markdown, start);
  const opening = /^( {0,3})(`{3,}|~{3,})/.exec(markdown.slice(first.start, first.end));
  if (!opening) return null;

  const fence = opening[2] ?? "";
  const fenceChar = fence[0] ?? "`";
  let end = first.end;
  let next = first.next;
  let scan = first.next;
  while (scan < markdown.length) {
    const line = lineRangeAt(markdown, scan);
    const text = markdown.slice(line.start, line.end);
    end = line.end;
    next = line.next;
    if (new RegExp(`^ {0,3}${escapeRegExp(fenceChar)}{${fence.length},}\\s*$`).test(text)) break;
    scan = line.next;
  }

  return { start: first.start, end: trimBlockEnd(markdown, end), next };
}

function tableBlockRange(
  markdown: string,
  start: number,
): { start: number; end: number; next: number } | null {
  const first = lineRangeAt(markdown, start);
  const second = lineRangeAt(markdown, first.next);
  if (
    !isMarkdownTableRow(markdown.slice(first.start, first.end)) ||
    !isMarkdownTableDelimiter(markdown.slice(second.start, second.end))
  ) {
    return null;
  }

  let end = second.end;
  let next = second.next;
  let cursor = second.next;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    if (!isMarkdownTableRow(markdown.slice(line.start, line.end))) break;
    end = line.end;
    next = line.next;
    cursor = line.next;
  }

  return { start: first.start, end: trimBlockEnd(markdown, end), next };
}

function listBlockRange(
  markdown: string,
  start: number,
): { start: number; end: number; next: number } | null {
  const first = lineRangeAt(markdown, start);
  const firstText = markdown.slice(first.start, first.end);
  if (!isMarkdownListItemLine(firstText)) return null;
  const baseIndent = leadingSpaces(firstText);
  let end = first.end;
  let next = first.next;
  let cursor = first.next;
  let pendingBlank: { end: number; next: number } | null = null;

  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const text = markdown.slice(line.start, line.end);
    if (text.trim().length === 0) {
      pendingBlank = { end: line.end, next: line.next };
      cursor = line.next;
      continue;
    }

    const isListItem = isMarkdownListItemLine(text);
    const isContinuation = leadingSpaces(text) > baseIndent;
    if (!isListItem && !isContinuation) break;
    end = line.end;
    next = line.next;
    pendingBlank = null;
    cursor = line.next;
  }

  if (pendingBlank) next = pendingBlank.next;
  return { start: first.start, end: trimBlockEnd(markdown, end), next };
}

function blockquoteBlockRange(
  markdown: string,
  start: number,
): { start: number; end: number; next: number } | null {
  const first = lineRangeAt(markdown, start);
  if (!/^ {0,3}>/.test(markdown.slice(first.start, first.end))) return null;

  let end = first.end;
  let next = first.next;
  let cursor = first.next;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const text = markdown.slice(line.start, line.end);
    if (!/^ {0,3}>/.test(text)) break;
    end = line.end;
    next = line.next;
    cursor = line.next;
  }

  return { start: first.start, end: trimBlockEnd(markdown, end), next };
}

function isMarkdownTableRow(line: string): boolean {
  return line.includes("|") && line.trim().length > 0;
}

function isMarkdownTableDelimiter(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function isMarkdownListItemLine(line: string): boolean {
  return /^ {0,3}(?:[-+*]|\d+[.)])\s+/.test(line);
}

function leadingSpaces(line: string): number {
  return /^ */.exec(line)?.[0].length ?? 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
