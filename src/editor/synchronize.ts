import { htmlToMarkdown } from "../markdown/from-html";
import { restoreCommentDefinitions, unescapeCommentReferences } from "../markdown/comments";
import { composeMarkdown } from "../markdown/frontmatter";
import { restoreRenderedHtmlCommentElements } from "../roundtrip/artifacts/html-comment";
import { mergeImportedBodyWithPrevious, parseMarkleftDocument } from "../roundtrip/document";
import { injectPersistentBlockIdComments } from "./blocks";
import { restoreMermaidDiagrams } from "./mermaid";
import { normalizeElement } from "./normalize-dom";

export interface SyncState {
  markdown: string;
  frontmatter?: string;
  body?: string;
  dirty: boolean;
  syncCount: number;
  includeBlockIds?: boolean;
}

export async function syncRenderedToMarkdown(
  rendered: HTMLElement,
  state: SyncState,
): Promise<void> {
  const clone = rendered.cloneNode(true) as HTMLElement;
  restoreMermaidDiagrams(clone);
  restoreRenderedHtmlCommentElements(clone);
  restoreLocalCommentReferences(clone);
  injectPersistentBlockIdComments(clone);
  normalizeElement(clone);
  const convertedBody = unescapeFootnoteReferences(unescapeCommentReferences(await htmlToMarkdown(clone.innerHTML)));
  const restoredBody = restoreFootnoteDefinitions(restoreCommentDefinitions(convertedBody, state.body ?? ""), state.body ?? "");
  const body = mergeImportedBodyWithPrevious(
    state.body ?? "",
    restoredBody,
    state.includeBlockIds === undefined ? {} : { includeBlockIds: state.includeBlockIds },
  );
  const document = parseMarkleftDocument(composeMarkdown({ frontmatter: state.frontmatter ?? "", body }), {
    ensureBlockIds: state.includeBlockIds === true,
  });
  state.body = document.body;
  state.markdown = document.markdown;
  state.dirty = true;
  state.syncCount += 1;
}

function restoreLocalCommentReferences(rendered: HTMLElement): void {
  for (const frame of rendered.querySelectorAll<HTMLElement>(".local-md-image-comment-frame")) {
    const references = Array.from(
      frame.querySelectorAll<HTMLElement>(".local-md-image-comment-anchor[data-comment-id]"),
      (marker) => marker.dataset.commentId,
    ).filter((id): id is string => Boolean(id));
    frame.querySelectorAll(".local-md-image-comment-anchor[data-comment-id]").forEach((marker) => marker.remove());
    if (references.length > 0) {
      frame.after(document.createTextNode(references.map((id) => `[^${id}]`).join("")));
    }
  }

  for (const marker of rendered.querySelectorAll<HTMLElement>(".local-md-comment-anchor[data-comment-id]")) {
    const id = marker.dataset.commentId;
    if (!id) continue;
    marker.replaceWith(document.createTextNode(`[^${id}]`));
  }

  for (const link of rendered.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]")) {
    const id = footnoteIdFromHref(link.getAttribute("href") ?? "");
    if (!id) continue;
    const marker = link.closest<HTMLElement>("sup") ?? link;
    marker.replaceWith(document.createTextNode(`[^${id}]`));
  }

  for (const frame of rendered.querySelectorAll<HTMLElement>(".local-md-image-comment-frame")) {
    const parent = frame.parentNode;
    if (!parent) continue;
    while (frame.firstChild) parent.insertBefore(frame.firstChild, frame);
    frame.remove();
  }

  rendered.querySelector<HTMLElement>("section[data-footnotes]")?.remove();
}

function footnoteIdFromHref(href: string): string | null {
  const match = /#user-content-fn-(.+)$/.exec(href);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function restoreFootnoteDefinitions(markdown: string, previousMarkdown: string): string {
  const previousDefinitions = parseFootnoteDefinitions(previousMarkdown);
  if (previousDefinitions.length === 0) return markdown;
  const existingIds = new Set(parseFootnoteDefinitions(markdown).map((definition) => definition.id));
  const referencedIds = new Set(Array.from(markdown.matchAll(/\[\^([^\]\n]+)\]/g), (match) => match[1]).filter(Boolean) as string[]);
  const definitions = previousDefinitions.filter((definition) => referencedIds.has(definition.id) && !existingIds.has(definition.id));
  if (definitions.length === 0) return markdown;
  return `${markdown.trimEnd()}\n\n${definitions.map((definition) => definition.markdown).join("\n")}\n`;
}

function unescapeFootnoteReferences(markdown: string): string {
  return markdown.replace(/\\\[\^([^\]\n]+)\]/g, "[^$1]");
}

function parseFootnoteDefinitions(markdown: string): Array<{ id: string; markdown: string }> {
  const definitions: Array<{ id: string; markdown: string }> = [];
  let cursor = 0;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const lineText = markdown.slice(line.start, line.end);
    const match = /^\[\^([^\]\n]+)\]:/.exec(lineText);
    if (!match?.[1]) {
      cursor = line.next > cursor ? line.next : cursor + 1;
      continue;
    }

    let end = line.end;
    let scan = line.next;
    while (scan < markdown.length) {
      const continuation = lineRangeAt(markdown, scan);
      const continuationText = markdown.slice(continuation.start, continuation.end);
      if (/^(?: {4}|\t)/.test(continuationText)) {
        end = continuation.end;
        scan = continuation.next;
        continue;
      }
      if (continuationText.trim() === "") {
        const nextLine = continuation.next < markdown.length ? lineRangeAt(markdown, continuation.next) : null;
        const nextText = nextLine ? markdown.slice(nextLine.start, nextLine.end) : "";
        if (nextLine && /^(?: {4}|\t)/.test(nextText)) {
          end = continuation.end;
          scan = continuation.next;
          continue;
        }
      }
      break;
    }
    definitions.push({ id: match[1], markdown: markdown.slice(line.start, end) });
    cursor = scan > cursor ? scan : line.next;
  }
  return definitions;
}

function lineRangeAt(text: string, position: number): { start: number; end: number; next: number } {
  const safePosition = Math.max(0, Math.min(position, text.length));
  const start = text.lastIndexOf("\n", Math.max(0, safePosition - 1)) + 1;
  const newline = text.indexOf("\n", safePosition);
  const end = newline === -1 ? text.length : newline;
  return { start, end, next: newline === -1 ? text.length : newline + 1 };
}
