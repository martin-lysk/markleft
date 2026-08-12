import {
  isFencedCodeBlock as isRoundtripFencedCodeBlock,
  isMarkdownListBlock as isRoundtripMarkdownListBlock,
  isMarkdownTableBlock as isRoundtripMarkdownTableBlock,
  markdownBlockAt,
  markdownBlockEndingAt,
  markdownBlockRanges as roundtripMarkdownBlockRanges,
  type MarkdownBlockRange,
} from "../roundtrip/blocks";
import { blockById, ensureDocumentBlockIds } from "../roundtrip/block-ids";

const RANGE_COMMENT_ID = /^range-(prev|next)-(\d+)-chars-(\d{1,5})-([0-9a-fA-F]{4})$/;
const BLOCK_COMMENT_ID = /^block-(\d{1,5})-([0-9a-fA-F]{4})$/;
const IMAGE_COMMENT_ID = /^image-(\d{1,5})-(\d{1,5})-(\d{1,5})-([0-9a-fA-F]{4})$/;
const SVG_COMMENT_ID = /^svg-xpath_([A-Za-z0-9.~%-]+)_(\d{1,5})-([0-9a-fA-F]{4})$/;
const LEGACY_SVG_COMMENT_ID = /^svg-([A-Za-z0-9._~-]+)-(\d{1,5})-(\d{1,5})-(\d{1,5})-([0-9a-fA-F]{4})$/;
const CODE_COMMENT_ID = /^code-line-(\d{1,5})-col-(\d{1,5})-len-(\d{1,5})-(\d{1,5})-([0-9a-fA-F]{4})$/;
const CHILD_COMMENT_ID = /^comment-(\d{1,5})(?:-([0-9a-zA-Z]{4}))?$/;
const BLOCK_SUGGESTION_ID = /^suggest-block-(\d{1,5})-([0-9a-fA-F]{4})$/;
const LEGACY_RANGE_COMMENT_ID = /^rangecomment-(\d{1,5})-([0-9a-fA-F]{4})-(\d+)$/;
const LEGACY_BLOCK_COMMENT_ID = /^blockcomment-(\d{1,5})-([0-9a-fA-F]{4})$/;
const LOCAL_NOTE_ID = /(?:(?:range-(?:prev|next)-\d+-chars-\d{1,5}-[0-9a-fA-F]{4})|(?:block-\d{1,5}-[0-9a-fA-F]{4})|(?:image-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})|(?:svg-xpath_[A-Za-z0-9.~%-]+_\d{1,5}-[0-9a-fA-F]{4})|(?:svg-[A-Za-z0-9._~-]+-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})|(?:code-line-\d{1,5}-col-\d{1,5}-len-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})|(?:comment-\d{1,5}(?:-[0-9a-zA-Z]{4})?)|(?:suggest-block-\d{1,5}-[0-9a-fA-F]{4})|(?:suggestion-s[a-zA-Z0-9]+-(?:update|insert-before|insert-after|delete)-block-b[a-zA-Z0-9]+)|(?:rangecomment-[^\]]+)|(?:blockcomment-[^\]]+))/;
const COMMENT_REF = new RegExp(`\\[\\^(${LOCAL_NOTE_ID.source})\\]`, "g");
const ESCAPED_COMMENT_REF = new RegExp(`\\\\\\[\\^(${LOCAL_NOTE_ID.source})\\]`, "g");

export type ParsedComment =
  | {
      kind: "range";
      id: string;
      markerId: string;
      direction: "next" | "prev";
      timePart: number;
      storedHash: string;
      logicalLength: number;
      backwardLength: number;
      bodyMarkdown: string;
      markerSourceStart: number;
      markerSourceEnd: number;
      rangeSourceStart: number;
      rangeSourceEnd: number;
      currentHash: string;
      stale: boolean;
      missingDefinition: boolean;
    }
  | {
      kind: "block";
      id: string;
      markerId: string;
      timePart: number;
      storedHash: string;
      bodyMarkdown: string;
      markerSourceStart: number;
      markerSourceEnd: number;
      blockSourceStart: number;
      blockSourceEnd: number;
      currentHash: string;
      stale: boolean;
      missingDefinition: boolean;
    }
  | {
      kind: "image";
      id: string;
      markerId: string;
      target: "bitmap" | "svg";
      x: number;
      y: number;
      svgPath: string | null;
      timePart: number;
      storedHash: string;
      bodyMarkdown: string;
      markerSourceStart: number;
      markerSourceEnd: number;
      imageSourceStart: number;
      imageSourceEnd: number;
      imageMarkdown: string;
      currentHash: string;
      stale: boolean;
      missingDefinition: boolean;
    }
  | {
      kind: "code";
      id: string;
      markerId: string;
      line: number;
      col: number;
      length: number;
      timePart: number;
      storedHash: string;
      bodyMarkdown: string;
      markerSourceStart: number;
      markerSourceEnd: number;
      codeSourceStart: number;
      codeSourceEnd: number;
      codeContentStart: number;
      codeContentEnd: number;
      rangeSourceStart: number;
      rangeSourceEnd: number;
      currentHash: string;
      stale: boolean;
      missingDefinition: boolean;
    }
  | {
      kind: "dangling";
      id: string;
      markerId: string;
      bodyMarkdown: string;
      definitionSourceStart: number;
      definitionSourceEnd: number;
      missingDefinition: false;
      stale: false;
    };

interface CommentDefinition {
  id: string;
  bodyMarkdown: string;
  start: number;
  end: number;
}

interface SourceRange {
  start: number;
  end: number;
}

export interface ParsedBlockSuggestion {
  kind: "block-suggestion";
  id: string;
  markerId: string;
  parentCommentId: string;
  relatedCommentIds: string[];
  bodyMarkdown: string;
  markerSourceStart: number;
  markerSourceEnd: number;
  blockSourceStart: number;
  blockSourceEnd: number;
  definitionSourceStart: number;
  definitionSourceEnd: number;
  missingDefinition: boolean;
  operation: "update" | "insert-before" | "insert-after" | "delete";
  targetBlockId: string | null;
  missingTarget: boolean;
}

export interface ParsedChildComment {
  kind: "comment";
  id: string;
  markerId: string;
  parentCommentId: string;
  bodyMarkdown: string;
  markerSourceStart: number;
  markerSourceEnd: number;
  definitionSourceStart: number;
  definitionSourceEnd: number;
  missingDefinition: boolean;
}

export type ParsedCommentChild = ParsedChildComment | ParsedBlockSuggestion;

export function normalizeCommentSource(source: string): string {
  return source.replace(/\r\n?/g, "\n").normalize("NFC");
}

export function commentHash(source: string): string {
  return logicalCommentHash(source);
}

export function logicalCommentHash(source: string): string {
  return hashLogicalText(projectHashText(source));
}

function logicalCommentHashForRange(source: string, start: number, end: number): string {
  return hashLogicalText(projectHashTextForSourceRange(source, start, end));
}

function hashLogicalText(text: string): string {
  let hash = 2166136261;
  const normalized = normalizeCommentSource(text);
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 4);
}

export function stripCommentSyntax(source: string): string {
  return stripCommentDefinitions(stripCommentReferences(source));
}

export function stripCommentReferences(source: string): string {
  return replaceCommentReferencesOutsideCode(source, "");
}

export function stripCommentDefinitions(source: string): string {
  let stripped = source;
  const definitions = Array.from(parseCommentDefinitions(source).values()).sort((left, right) => right.start - left.start);
  for (const definition of definitions) {
    stripped = `${stripped.slice(0, definition.start)}${stripped.slice(definition.end)}`;
  }
  return stripped.replace(/\n{3,}/g, "\n\n");
}

export function unescapeCommentReferences(source: string): string {
  return source.replace(ESCAPED_COMMENT_REF, "[^$1]");
}

export function extractCommentDefinitions(source: string): string[] {
  return Array.from(parseCommentDefinitions(source).values(), (definition) => source.slice(definition.start, definition.end));
}

export function restoreCommentDefinitions(markdown: string, previousMarkdown: string): string {
  const definitions = extractCommentDefinitions(previousMarkdown);
  if (definitions.length === 0) return markdown;
  const withoutLocalDefinitions = stripCommentDefinitions(markdown).trimEnd();
  return `${withoutLocalDefinitions}\n\n${definitions.join("\n")}\n`;
}

export function parseComments(markdown: string): ParsedComment[] {
  const definitions = parseCommentDefinitions(markdown);
  const comments: ParsedComment[] = [];
  const referencedIds = new Set<string>();
  const ignoredRanges = ignoredCommentMarkerRanges(markdown);
  const relationRanges = [
    ...operationSuggestionRelationRanges(markdown, definitions),
    ...childCommentReplyRelationRanges(markdown, definitions),
  ];

  for (const match of markdown.matchAll(COMMENT_REF)) {
    const id = match[1];
    if (!id || match.index === undefined) continue;
    const markerSourceStart = match.index;
    const markerSourceEnd = markerSourceStart + match[0].length;
    if (rangeOverlapsIgnoredMarkerRange(markerSourceStart, markerSourceEnd, ignoredRanges)) continue;
    if (rangeOverlapsIgnoredMarkerRange(markerSourceStart, markerSourceEnd, relationRanges)) {
      referencedIds.add(id);
      continue;
    }
    if (markdown[markerSourceEnd] === ":") continue;
    if (parseBlockSuggestionId(id) || parseChildCommentId(id)) {
      referencedIds.add(id);
      continue;
    }
    const definition = definitions.get(id);
    referencedIds.add(id);

    const rangeId = parseRangeId(id);
    if (rangeId) {
      const sourceRange = resolveLogicalRange(markdown, markerSourceStart, markerSourceEnd, rangeId.direction, rangeId.logicalLength);
      const currentHash = logicalCommentHashForRange(markdown, sourceRange.start, sourceRange.end);
      comments.push({
        kind: "range",
        id,
        markerId: id,
        direction: rangeId.direction,
        timePart: rangeId.seed,
        storedHash: rangeId.hash,
        logicalLength: rangeId.logicalLength,
        backwardLength: rangeId.logicalLength,
        bodyMarkdown: definition?.bodyMarkdown ?? "",
        markerSourceStart,
        markerSourceEnd,
        rangeSourceStart: sourceRange.start,
        rangeSourceEnd: sourceRange.end,
        currentHash,
        stale: currentHash !== rangeId.hash,
        missingDefinition: !definition,
      });
      continue;
    }

    const blockId = parseBlockId(id);
    if (blockId) {
      const block = containingBlock(markdown, markerSourceStart);
      const currentHash = logicalCommentHash(markdown.slice(block.start, block.end));
      comments.push({
        kind: "block",
        id,
        markerId: id,
        timePart: blockId.seed,
        storedHash: blockId.hash,
        bodyMarkdown: definition?.bodyMarkdown ?? "",
        markerSourceStart,
        markerSourceEnd,
        blockSourceStart: block.start,
        blockSourceEnd: block.end,
        currentHash,
        stale: currentHash !== blockId.hash,
        missingDefinition: !definition,
      });
      continue;
    }

    const imageId = parseImageId(id);
    if (imageId) {
      const image = findImageAnchorBefore(markdown, markerSourceStart);
      const currentHash = image ? imageAnchorHash(image.markdown) : "";
      comments.push({
        kind: "image",
        id,
        markerId: id,
        target: imageId.target,
        x: imageId.x,
        y: imageId.y,
        svgPath: imageId.svgPath,
        timePart: imageId.seed,
        storedHash: imageId.hash,
        bodyMarkdown: definition?.bodyMarkdown ?? "",
        markerSourceStart,
        markerSourceEnd,
        imageSourceStart: image?.start ?? markerSourceStart,
        imageSourceEnd: image?.end ?? markerSourceStart,
        imageMarkdown: image?.markdown ?? "",
        currentHash,
        stale: currentHash !== imageId.hash,
        missingDefinition: !definition,
      });
      continue;
    }

    const codeId = parseCodeId(id);
    if (codeId) {
      const code = findCodeBlockBefore(markdown, markerSourceStart);
      const sourceRange = code ? codeSourceRangeForPosition(code, codeId.line, codeId.col, codeId.length) : null;
      const currentHash = sourceRange ? codeCommentHash(markdown.slice(sourceRange.start, sourceRange.end)) : "";
      comments.push({
        kind: "code",
        id,
        markerId: id,
        line: codeId.line,
        col: codeId.col,
        length: codeId.length,
        timePart: codeId.seed,
        storedHash: codeId.hash,
        bodyMarkdown: definition?.bodyMarkdown ?? "",
        markerSourceStart,
        markerSourceEnd,
        codeSourceStart: code?.start ?? markerSourceStart,
        codeSourceEnd: code?.end ?? markerSourceStart,
        codeContentStart: code?.contentStart ?? markerSourceStart,
        codeContentEnd: code?.contentEnd ?? markerSourceStart,
        rangeSourceStart: sourceRange?.start ?? markerSourceStart,
        rangeSourceEnd: sourceRange?.end ?? markerSourceStart,
        currentHash,
        stale: currentHash !== codeId.hash,
        missingDefinition: !definition,
      });
    }
  }

  for (const definition of definitions.values()) {
    if (referencedIds.has(definition.id)) continue;
    if (parseBlockSuggestionId(definition.id) || parseOperationSuggestionId(definition.id) || parseChildCommentId(definition.id)) continue;
    comments.push({
      kind: "dangling",
      id: definition.id,
      markerId: definition.id,
      bodyMarkdown: definition.bodyMarkdown,
      definitionSourceStart: definition.start,
      definitionSourceEnd: definition.end,
      missingDefinition: false,
      stale: false,
    });
  }

  return comments.sort((left, right) => commentSortPosition(left) - commentSortPosition(right));
}

export function activeCommentIdFromSourceRange(markdown: string, start: number, end: number): string | null {
  const selectionStart = Math.max(0, Math.min(start, end));
  const selectionEnd = Math.max(selectionStart, Math.min(markdown.length, Math.max(start, end)));
  const comments = parseComments(markdown).filter((comment) => comment.kind !== "dangling");
  const containing = comments.filter((comment) => sourceRangesOverlap(sourceActiveRange(comment), selectionStart, selectionEnd));
  if (containing.length === 0) return null;
  return containing.sort((left, right) => sourceRangeLength(sourceActiveRange(left)) - sourceRangeLength(sourceActiveRange(right)))[0]?.id ?? null;
}

export function sourceSelectionRangeForComment(comment: ParsedComment): { start: number; end: number } | null {
  if (comment.kind === "range") return { start: comment.rangeSourceStart, end: comment.rangeSourceEnd };
  if (comment.kind === "block") return { start: comment.blockSourceStart, end: comment.blockSourceEnd };
  if (comment.kind === "image") return { start: comment.imageSourceStart, end: comment.imageSourceEnd };
  if (comment.kind === "code") return { start: comment.rangeSourceStart, end: comment.rangeSourceEnd };
  return { start: comment.definitionSourceStart, end: comment.definitionSourceEnd };
}

export function createRangeComment(
  markdown: string,
  start: number,
  end: number,
  bodyMarkdown: string,
  now = Date.now(),
): string {
  const normalizedStart = Math.max(0, Math.min(start, end));
  const normalizedEnd = Math.min(markdown.length, Math.max(start, end));
  const logicalLength = projectAnchorTextForSourceRange(markdown, normalizedStart, normalizedEnd).length;
  if (logicalLength === 0) return createBlockComment(markdown, normalizedEnd, bodyMarkdown, now);
  const id = `range-prev-${logicalLength}-chars-${now % 100000}-${logicalCommentHashForRange(markdown, normalizedStart, normalizedEnd)}`;
  return insertComment(markdown, normalizedEnd, id, bodyMarkdown);
}

export function createBlockComment(
  markdown: string,
  position: number,
  bodyMarkdown: string,
  now = Date.now(),
): string {
  const insertionPoint = Math.max(0, Math.min(position, markdown.length));
  const block = containingBlock(markdown, insertionPoint);
  const id = `block-${now % 100000}-${logicalCommentHash(markdown.slice(block.start, block.end))}`;
  return insertComment(markdown, insertionPoint, id, bodyMarkdown);
}

export function createImageComment(
  markdown: string,
  imageSourceStart: number,
  x: number,
  y: number,
  bodyMarkdown: string,
  now = Date.now(),
): string {
  const image = imageAnchorAt(markdown, imageSourceStart);
  if (!image) return createBlockComment(markdown, imageSourceStart, bodyMarkdown, now);
  const id = `image-${clampCoordinate(x)}-${clampCoordinate(y)}-${now % 100000}-${imageAnchorHash(image.markdown)}`;
  return insertImageComment(markdown, imageCommentInsertionPoint(markdown, image.end), id, bodyMarkdown);
}

export function createSvgComment(
  markdown: string,
  svgSourceStart: number,
  svgPath: string,
  x: number,
  y: number,
  bodyMarkdown: string,
  now = Date.now(),
): string {
  const image = imageAnchorAt(markdown, svgSourceStart);
  if (!image) return createBlockComment(markdown, svgSourceStart, bodyMarkdown, now);
  const id = `svg-xpath_${encodeSvgLocator(svgPath)}_${now % 100000}-${imageAnchorHash(image.markdown)}`;
  return insertImageComment(markdown, imageCommentInsertionPoint(markdown, image.end), id, bodyMarkdown);
}

export function createCodeComment(
  markdown: string,
  codeSourceStart: number,
  line: number,
  col: number,
  length: number,
  bodyMarkdown: string,
  now = Date.now(),
): string {
  const code = codeBlockAt(markdown, codeSourceStart);
  if (!code) return createBlockComment(markdown, codeSourceStart, bodyMarkdown, now);
  const safeLine = Math.max(1, Math.round(line));
  const safeCol = Math.max(1, Math.round(col));
  const safeLength = Math.max(0, Math.round(length));
  if (safeLength === 0) return createBlockComment(markdown, code.end, bodyMarkdown, now);
  const sourceRange = codeSourceRangeForPosition(code, safeLine, safeCol, safeLength);
  const id = `code-line-${safeLine}-col-${safeCol}-len-${safeLength}-${now % 100000}-${codeCommentHash(
    markdown.slice(sourceRange.start, sourceRange.end),
  )}`;
  return insertDetachedComment(markdown, codeCommentInsertionPoint(markdown, code.end), id, bodyMarkdown);
}

export function removeComment(markdown: string, id: string): string {
  const definition = parseCommentDefinitions(markdown).get(id);
  const withoutDefinition = definition
    ? `${markdown.slice(0, definition.start)}${markdown.slice(definition.end)}`
    : markdown;
  return withoutDefinition
    .replace(new RegExp(`\\[\\^${escapeRegExp(id)}\\]`, "g"), "")
    .replace(/\n{3,}/g, "\n\n");
}

export function editCommentBody(markdown: string, id: string, bodyMarkdown: string): string {
  const existing = parseCommentDefinitions(markdown).get(id);
  if (!existing) return markdown;
  const existingReply = parseChildCommentReply(existing.bodyMarkdown);
  if (parseChildCommentId(id) && existingReply) {
    const nextBody = childCommentReplyBody(existingReply.parentCommentId, bodyMarkdown.trim());
    return `${markdown.slice(0, existing.start)}${footnoteDefinitionMarkdown(id, nextBody)}${markdown.slice(existing.end)}`;
  }
  const existingChildRefs = existing
    ? Array.from(existing.bodyMarkdown.matchAll(COMMENT_REF), (match) => match[0]).filter((ref) => {
        const childId = /^\[\^([^\]]+)\]$/.exec(ref)?.[1] ?? "";
        return Boolean(parseBlockSuggestionId(childId) || parseChildCommentId(childId));
      })
    : [];
  const nextBody = bodyMarkdown.trim();
  const preservedRefs = existingChildRefs.filter((ref) => !nextBody.includes(ref));
  const bodyWithRefs = [nextBody, ...preservedRefs].filter(Boolean).join(" ");
  return `${markdown.slice(0, existing.start)}${footnoteDefinitionMarkdown(id, bodyWithRefs)}${markdown.slice(existing.end)}`;
}

export function createBlockSuggestion(
  markdown: string,
  parentCommentId: string,
  replacementMarkdown: string,
  now = Date.now(),
): string {
  const parent = parseComments(markdown).find((comment) => comment.id === parentCommentId);
  if (!parent || parent.kind === "dangling") return markdown;
  const replacement = replacementMarkdown.trim();
  if (!replacement) return markdown;
  const target = blockReplacementRange(markdown, parent);
  const relatedCommentIds = relatedCommentIdsForBlock(markdown, target);
  const id = `suggest-block-${now % 100000}-${hashLogicalText(replacement)}`;
  let nextMarkdown = insertBlockSuggestionMarker(markdown, parent, target, id);
  for (const relatedCommentId of relatedCommentIds) {
    nextMarkdown = appendReferenceToDefinition(nextMarkdown, relatedCommentId, id);
  }
  const needsSeparator = nextMarkdown.endsWith("\n") ? "\n" : "\n\n";
  return `${nextMarkdown}${needsSeparator}${footnoteDefinitionMarkdown(id, replacement)}\n`;
}

export function createBlockSuggestionForSourceRange(
  markdown: string,
  target: { start: number; end: number },
  replacementMarkdown: string,
  now = Date.now(),
): { markdown: string; id: string } {
  const replacement = replacementMarkdown.trim();
  const id = `suggest-block-${now % 100000}-${hashLogicalText(replacement)}`;
  const relatedCommentIds = relatedCommentIdsForBlock(markdown, target);
  let nextMarkdown = insertSourceRangeSuggestionMarker(markdown, target, id);
  for (const relatedCommentId of relatedCommentIds) {
    nextMarkdown = appendReferenceToDefinition(nextMarkdown, relatedCommentId, id);
  }
  const needsSeparator = nextMarkdown.endsWith("\n") ? "\n" : "\n\n";
  return {
    markdown: `${nextMarkdown}${needsSeparator}${footnoteDefinitionMarkdown(id, replacement)}\n`,
    id,
  };
}

export function createChildComment(
  markdown: string,
  parentCommentId: string,
  bodyMarkdown: string,
  now = Date.now(),
): string {
  const parentDefinition = parseCommentDefinitions(markdown).get(parentCommentId);
  if (!parentDefinition) return markdown;
  const body = bodyMarkdown.trim();
  if (!body) return markdown;
  const id = `comment-${now % 100000}`;
  return appendChildFootnote(markdown, parentDefinition, id, childCommentReplyBody(parentCommentId, body));
}

export function blockSuggestionsForComment(markdown: string, parentCommentId: string): ParsedBlockSuggestion[] {
  return parseBlockSuggestions(markdown).filter((suggestion) => suggestion.relatedCommentIds.includes(parentCommentId));
}

export function childCommentsForComment(markdown: string, parentCommentId: string): ParsedChildComment[] {
  return commentChildrenForComment(markdown, parentCommentId).filter(
    (child): child is ParsedChildComment => child.kind === "comment",
  );
}

export function commentChildrenForComment(markdown: string, parentCommentId: string): ParsedCommentChild[] {
  const parentDefinition = parseCommentDefinitions(markdown).get(parentCommentId);
  if (!parentDefinition) return [];
  const definitions = parseCommentDefinitions(markdown);
  const suggestions = new Map(parseBlockSuggestions(markdown).map((suggestion) => [suggestion.id, suggestion]));
  const parentBodySourceStart = parentDefinition.end - parentDefinition.bodyMarkdown.length;
  const ignoredRanges = ignoredCommentMarkerRanges(parentDefinition.bodyMarkdown);
  const children: ParsedCommentChild[] = [];
  const seenIds = new Set<string>();
  for (const child of Array.from(parentDefinition.bodyMarkdown.matchAll(COMMENT_REF))
    .map((match): ParsedCommentChild | null => {
      const id = match[1];
      if (!id || match.index === undefined) return null;
      if (rangeOverlapsIgnoredMarkerRange(match.index, match.index + match[0].length, ignoredRanges)) return null;
      const definition = definitions.get(id);
      const markerSourceStart = parentBodySourceStart + match.index;
      const markerSourceEnd = markerSourceStart + match[0].length;
      if (parseBlockSuggestionId(id)) {
        const suggestion = suggestions.get(id);
        return {
          kind: "block-suggestion",
          id,
          markerId: id,
          parentCommentId,
          relatedCommentIds: suggestion?.relatedCommentIds ?? [parentCommentId],
          bodyMarkdown: definition?.bodyMarkdown ?? suggestion?.bodyMarkdown ?? "",
          markerSourceStart: suggestion?.markerSourceStart ?? markerSourceStart,
          markerSourceEnd: suggestion?.markerSourceEnd ?? markerSourceEnd,
          blockSourceStart: suggestion?.blockSourceStart ?? markerSourceStart,
          blockSourceEnd: suggestion?.blockSourceEnd ?? markerSourceEnd,
          definitionSourceStart: definition?.start ?? markerSourceStart,
          definitionSourceEnd: definition?.end ?? markerSourceEnd,
          missingDefinition: !definition,
          operation: suggestion?.operation ?? "update",
          targetBlockId: suggestion?.targetBlockId ?? null,
          missingTarget: suggestion?.missingTarget ?? false,
        };
      }
      if (parseChildCommentId(id)) {
        return {
          kind: "comment",
          id,
          markerId: id,
          parentCommentId,
          bodyMarkdown: definition?.bodyMarkdown ?? "",
          markerSourceStart,
          markerSourceEnd,
          definitionSourceStart: definition?.start ?? markerSourceStart,
          definitionSourceEnd: definition?.end ?? markerSourceEnd,
          missingDefinition: !definition,
        };
      }
      return null;
    })
    .filter((child): child is ParsedCommentChild => Boolean(child))) {
    children.push(child);
    seenIds.add(child.id);
  }

  for (const definition of definitions.values()) {
    if (seenIds.has(definition.id) || !parseChildCommentId(definition.id)) continue;
    const reply = parseChildCommentReply(definition.bodyMarkdown);
    if (!reply || reply.parentCommentId !== parentCommentId) continue;
    const line = lineRangeAt(markdown, definition.start);
    children.push({
      kind: "comment",
      id: definition.id,
      markerId: definition.id,
      parentCommentId,
      bodyMarkdown: reply.bodyMarkdown,
      markerSourceStart: line.start,
      markerSourceEnd: line.end,
      definitionSourceStart: definition.start,
      definitionSourceEnd: definition.end,
      missingDefinition: false,
    });
    seenIds.add(definition.id);
  }

  return children.sort((left, right) => commentChildSortPosition(left) - commentChildSortPosition(right));
}

export function parseBlockSuggestions(markdown: string): ParsedBlockSuggestion[] {
  const definitions = parseCommentDefinitions(markdown);
  const comments = parseComments(markdown);
  const relatedCommentIdsBySuggestion = new Map<string, string[]>();
  for (const comment of comments) {
    if (comment.kind === "dangling") continue;
    const body = definitions.get(comment.id)?.bodyMarkdown ?? "";
    const ignoredBodyRanges = ignoredCommentMarkerRanges(body);
    for (const match of body.matchAll(COMMENT_REF)) {
      const id = match[1];
      if (!id || !parseBlockSuggestionId(id)) continue;
      if (match.index !== undefined && rangeOverlapsIgnoredMarkerRange(match.index, match.index + match[0].length, ignoredBodyRanges)) continue;
      const ids = relatedCommentIdsBySuggestion.get(id) ?? [];
      if (!ids.includes(comment.id)) ids.push(comment.id);
      relatedCommentIdsBySuggestion.set(id, ids);
    }
  }

  const suggestions: ParsedBlockSuggestion[] = [];
  const seen = new Set<string>();
  const ignoredRanges = ignoredCommentMarkerRanges(markdown);
  for (const match of markdown.matchAll(COMMENT_REF)) {
    const id = match[1];
    if (!id || match.index === undefined || !parseBlockSuggestionId(id)) continue;
    const markerSourceStart = match.index;
    const markerSourceEnd = markerSourceStart + match[0].length;
    if (rangeOverlapsIgnoredMarkerRange(markerSourceStart, markerSourceEnd, ignoredRanges)) continue;
    if (markdown[markerSourceEnd] === ":" || isInsideCommentDefinitionLine(markdown, markerSourceStart)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const definition = definitions.get(id);
    const block = suggestionTargetBlock(markdown, markerSourceStart, markerSourceEnd);
    suggestions.push({
      kind: "block-suggestion",
      id,
      markerId: id,
      parentCommentId: relatedCommentIdsBySuggestion.get(id)?.[0] ?? "",
      relatedCommentIds: relatedCommentIdsBySuggestion.get(id) ?? [],
      bodyMarkdown: definition?.bodyMarkdown ?? "",
      markerSourceStart,
      markerSourceEnd,
      blockSourceStart: block.start,
      blockSourceEnd: block.end,
      definitionSourceStart: definition?.start ?? markerSourceStart,
      definitionSourceEnd: definition?.end ?? markerSourceEnd,
      missingDefinition: !definition,
      operation: "update",
      targetBlockId: null,
      missingTarget: false,
    });
  }

  for (const [id, relatedCommentIds] of relatedCommentIdsBySuggestion) {
    if (seen.has(id)) continue;
    seen.add(id);
    const relatedComment = comments.find((comment) => comment.kind !== "dangling" && relatedCommentIds.includes(comment.id));
    if (!relatedComment || relatedComment.kind === "dangling") continue;
    const definition = definitions.get(id);
    const block = suggestionTargetBlockForComment(markdown, relatedComment);
    suggestions.push({
      kind: "block-suggestion",
      id,
      markerId: id,
      parentCommentId: relatedCommentIds[0] ?? "",
      relatedCommentIds,
      bodyMarkdown: definition?.bodyMarkdown ?? "",
      markerSourceStart: relatedComment.markerSourceStart,
      markerSourceEnd: relatedComment.markerSourceEnd,
      blockSourceStart: block.start,
      blockSourceEnd: block.end,
      definitionSourceStart: definition?.start ?? relatedComment.markerSourceStart,
      definitionSourceEnd: definition?.end ?? relatedComment.markerSourceEnd,
      missingDefinition: !definition,
      operation: "update",
      targetBlockId: null,
      missingTarget: false,
    });
  }

  for (const definition of definitions.values()) {
    const parsedId = parseOperationSuggestionId(definition.id);
    if (!parsedId || seen.has(definition.id)) continue;
    const target = blockById(markdown, parsedId.targetBlockId);
    const body = operationSuggestionBody(definition.bodyMarkdown);
    suggestions.push({
      kind: "block-suggestion",
      id: definition.id,
      markerId: definition.id,
      parentCommentId: body.relatedCommentIds[0] ?? "",
      relatedCommentIds: body.relatedCommentIds,
      bodyMarkdown: parsedId.operation === "delete" ? "" : body.contentMarkdown,
      markerSourceStart: definition.start,
      markerSourceEnd: definition.start,
      blockSourceStart: target?.start ?? definition.start,
      blockSourceEnd: target?.end ?? definition.start,
      definitionSourceStart: definition.start,
      definitionSourceEnd: definition.end,
      missingDefinition: false,
      operation: parsedId.operation,
      targetBlockId: parsedId.targetBlockId,
      missingTarget: !target,
    });
  }

  return suggestions.sort((left, right) => left.markerSourceStart - right.markerSourceStart);
}

export function appendBlockOperationSuggestion(
  markdown: string,
  operation: ParsedBlockSuggestion["operation"],
  targetBlockId: string,
  contentMarkdown: string,
  relatedCommentIds: string[] = [],
  now = Date.now(),
): { markdown: string; id: string } {
  const suggestionId = `s${now % 100000}`;
  const id = `suggestion-${suggestionId}-${operation}-block-${targetBlockId}`;
  const references = relatedCommentIds.map((commentId) => `[^${commentId}]`).join(" ");
  const content = operation === "delete" ? "<!-- markleft:delete -->" : contentMarkdown.trim();
  const body = [content, references].filter(Boolean).join("\n\n");
  const separator = markdown.endsWith("\n") ? "\n" : "\n\n";
  return { markdown: `${markdown}${separator}${footnoteDefinitionMarkdown(id, body)}\n`, id };
}

export function applyBlockOperationSuggestion(markdown: string, suggestionId: string): string {
  const suggestion = parseBlockSuggestions(markdown).find((candidate) => candidate.id === suggestionId);
  if (!suggestion || suggestion.missingDefinition || suggestion.missingTarget || !suggestion.targetBlockId) return markdown;
  const target = blockById(markdown, suggestion.targetBlockId);
  if (!target) return markdown;
  const targetWithIdStart = target.idCommentStart ?? target.start;
  let changed = markdown;
  if (suggestion.operation === "update") {
    changed = `${markdown.slice(0, target.start)}${suggestion.bodyMarkdown.trim()}${markdown.slice(target.end)}`;
  } else if (suggestion.operation === "insert-before") {
    changed = `${markdown.slice(0, targetWithIdStart)}${suggestion.bodyMarkdown.trim()}\n\n${markdown.slice(targetWithIdStart)}`;
  } else if (suggestion.operation === "insert-after") {
    changed = `${markdown.slice(0, target.end)}\n\n${suggestion.bodyMarkdown.trim()}${markdown.slice(target.end)}`;
  } else {
    changed = `${markdown.slice(0, targetWithIdStart)}${markdown.slice(target.end)}`;
  }
  changed = removeComment(changed, suggestion.id);
  for (const commentId of suggestion.relatedCommentIds) changed = removeComment(changed, commentId);
  return ensureDocumentBlockIds(changed).replace(/\n{3,}/g, "\n\n");
}

function parseOperationSuggestionId(id: string): {
  operation: ParsedBlockSuggestion["operation"];
  targetBlockId: string;
} | null {
  const match = /^suggestion-s[a-zA-Z0-9]+-(update|insert-before|insert-after|delete)-block-(b[a-zA-Z0-9]+)$/.exec(id);
  if (!match?.[1] || !match[2]) return null;
  return { operation: match[1] as ParsedBlockSuggestion["operation"], targetBlockId: match[2] };
}

function operationSuggestionBody(bodyMarkdown: string): { contentMarkdown: string; relatedCommentIds: string[] } {
  const normalized = bodyMarkdown.trim();
  const paragraphs = normalized.split(/\n\s*\n/);
  const final = paragraphs.at(-1) ?? "";
  const references = Array.from(final.matchAll(/\[\^([^\]\n]+)\]/g), (match) => match[1]).filter(
    (id): id is string => Boolean(id),
  );
  const referenceOnly = references.length > 0 && final.replace(/\[\^[^\]\n]+\]/g, "").trim() === "";
  return {
    contentMarkdown: (referenceOnly ? paragraphs.slice(0, -1).join("\n\n") : normalized).trim(),
    relatedCommentIds: referenceOnly ? references : [],
  };
}

function parseChildCommentReply(bodyMarkdown: string): { parentCommentId: string; bodyMarkdown: string } | null {
  const normalized = bodyMarkdown.trim();
  const match = /^Reply to \[\^([^\]\n]+)\](?:[ \t]*\n+|[ \t]*$)/.exec(normalized);
  if (!match?.[1]) return null;
  return { parentCommentId: match[1], bodyMarkdown: normalized.slice(match[0].length).trim() };
}

function childCommentReplyBody(parentCommentId: string, bodyMarkdown: string): string {
  return `Reply to [^${parentCommentId}]\n\n${bodyMarkdown.trim()}`;
}

function operationSuggestionRelationRanges(
  markdown: string,
  definitions: Map<string, CommentDefinition>,
): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (const definition of definitions.values()) {
    if (!parseOperationSuggestionId(definition.id)) continue;
    const source = markdown.slice(definition.start, definition.end);
    const separator = source.lastIndexOf("\n\n");
    if (separator === -1) continue;
    const finalStart = definition.start + separator + 2;
    const final = markdown.slice(finalStart, definition.end).replace(/^\s{4}/gm, "").trim();
    if (!final || final.replace(/\[\^[^\]\n]+\]/g, "").trim() !== "") continue;
    ranges.push({ start: finalStart, end: definition.end });
  }
  return ranges;
}

function childCommentReplyRelationRanges(
  markdown: string,
  definitions: Map<string, CommentDefinition>,
): SourceRange[] {
  const ranges: SourceRange[] = [];
  for (const definition of definitions.values()) {
    if (!parseChildCommentId(definition.id) || !parseChildCommentReply(definition.bodyMarkdown)) continue;
    const line = lineRangeAt(markdown, definition.start);
    ranges.push({ start: line.start, end: line.end });
  }
  return ranges;
}

export function markdownBlockRanges(markdown: string): MarkdownBlockRange[] {
  return roundtripMarkdownBlockRanges(markdown);
}

export function applyBlockSuggestion(markdown: string, parentCommentId: string, suggestionId: string): string {
  const suggestion = blockSuggestionsForComment(markdown, parentCommentId).find((candidate) => candidate.id === suggestionId);
  if (!suggestion || suggestion.missingDefinition) return markdown;
  const target = { start: suggestion.blockSourceStart, end: suggestion.blockSourceEnd };
  const replacement = suggestion.bodyMarkdown.trim();
  const before = markdown.slice(0, target.start);
  const after = markdown.slice(target.end);
  return removeComment(removeComment(`${before}${replacement}${after}`, parentCommentId), suggestionId);
}

export function updateCommentAnchor(markdown: string, id: string): string {
  const comment = parseComments(markdown).find((candidate) => candidate.id === id);
  if (!comment) return markdown;
  const replacement =
    comment.kind === "range"
      ? `range-${comment.direction}-${comment.logicalLength}-chars-${Date.now() % 100000}-${comment.currentHash}`
      : comment.kind === "block"
        ? `block-${Date.now() % 100000}-${comment.currentHash}`
        : comment.kind === "image" && comment.target === "bitmap"
          ? `image-${comment.x}-${comment.y}-${Date.now() % 100000}-${comment.currentHash}`
        : comment.kind === "image" && comment.target === "svg"
            ? `svg-xpath_${encodeSvgLocator(comment.svgPath ?? "svg")}_${Date.now() % 100000}-${comment.currentHash}`
            : comment.kind === "code"
              ? `code-line-${comment.line}-col-${comment.col}-len-${comment.length}-${Date.now() % 100000}-${comment.currentHash}`
              : comment.id;
  return markdown.replaceAll(id, replacement);
}

export function markdownWithoutCommentSyntax(markdown: string): string {
  return stripCommentSyntax(markdown);
}

export function markdownForRendering(markdown: string): string {
  return markdown;
}

export interface ProjectedMarkdown {
  text: string;
  sourceOffsets: Array<{ start: number; end: number }>;
}

export function projectMarkdownText(markdown: string): ProjectedMarkdown {
  let text = "";
  const sourceOffsets: ProjectedMarkdown["sourceOffsets"] = [];
  let index = 0;

  const emit = (sourceIndex: number) => {
    text += markdown[sourceIndex] ?? "";
    sourceOffsets.push({ start: sourceIndex, end: sourceIndex + 1 });
  };

  while (index < markdown.length) {
    const lineStart = index === 0 || markdown[index - 1] === "\n";
    if (lineStart) {
      const definition = /^\[\^[^\]]+\]:[^\n]*(?:\n|$)/.exec(markdown.slice(index));
      if (definition) {
        index += definition[0].length;
        continue;
      }

      const blockquoteMarker = /^ {0,3}> ?/.exec(markdown.slice(index));
      if (blockquoteMarker) {
        index += blockquoteMarker[0].length;
        continue;
      }

      const tableLine = tableLineAt(markdown, index);
      if (tableLine && isGfmTableLine(markdown, tableLine)) {
        if (!isGfmTableDelimiter(tableLine.text)) {
          emitTableRowLogicalText(markdown, tableLine.start, tableLine.end, emit);
        }
        index = tableLine.nextIndex;
        continue;
      }
    }

    const footnoteRef = /^\[\^[^\]]+\]/.exec(markdown.slice(index));
    if (footnoteRef) {
      index += footnoteRef[0].length;
      continue;
    }

    if (markdown[index] === "<") {
      const tagEnd = markdown.indexOf(">", index + 1);
      if (tagEnd !== -1) {
        index = tagEnd + 1;
        continue;
      }
    }

    const linkDestinationEnd = inlineLinkDestinationEnd(markdown, index, markdown.length);
    if (linkDestinationEnd !== null) {
      index = linkDestinationEnd;
      continue;
    }

    if (isMarkdownSyntax(markdown, index)) {
      index += 1;
      continue;
    }

    const char = markdown[index];
    if (char === "\r" || char === "\n") {
      index += 1;
      continue;
    }

    emit(index);
    index += 1;
  }

  return { text, sourceOffsets };
}

export function projectAnchorUnits(markdown: string): ProjectedMarkdown {
  return filterProjectedText(projectMarkdownText(markdown), markdown, (char) => !isAnchorWhitespace(char));
}

export function projectHashText(markdown: string): string {
  return normalizeRenderedWhitespace(projectMarkdownText(markdown).text);
}

export function resolveRenderedTextRange(
  markdown: string,
  selectedText: string,
  renderedOccurrenceIndex = 0,
): { start: number; end: number } | null {
  const projected = projectMarkdownText(markdown);
  const projectedStart = nthIndexOf(projected.text, selectedText, renderedOccurrenceIndex);
  if (projectedStart !== -1) {
    const projectedEnd = projectedStart + selectedText.length;
    const start = projected.sourceOffsets[projectedStart]?.start;
    const end = projected.sourceOffsets[projectedEnd - 1]?.end;
    if (start !== undefined && end !== undefined) return { start, end };
  }

  const selectedAnchorText = projectAnchorUnits(selectedText).text;
  if (!selectedAnchorText) return null;
  const anchors = projectAnchorUnits(markdown);
  const anchorStart = nthIndexOf(anchors.text, selectedAnchorText, renderedOccurrenceIndex);
  if (anchorStart === -1) return null;
  const anchorEnd = anchorStart + selectedAnchorText.length;
  const start = anchors.sourceOffsets[anchorStart]?.start;
  const end = anchors.sourceOffsets[anchorEnd - 1]?.end;
  if (start === undefined || end === undefined) return null;
  return { start, end };
}

export function projectedTextForSourceRange(markdown: string, start: number, end: number): string {
  const projected = projectMarkdownText(markdown);
  return projected.sourceOffsets
    .filter((offset) => offset.start >= start && offset.end <= end)
    .map((offset) => markdown.slice(offset.start, offset.end))
    .join("");
}

export function projectAnchorTextForSourceRange(markdown: string, start: number, end: number): string {
  const projected = projectAnchorUnits(markdown);
  return projected.sourceOffsets
    .filter((offset) => offset.start >= start && offset.end <= end)
    .map((offset) => markdown.slice(offset.start, offset.end))
    .join("");
}

export function projectHashTextForSourceRange(markdown: string, start: number, end: number): string {
  return normalizeRenderedWhitespace(projectedTextForSourceRange(markdown, start, end));
}

export function projectedRangeForSourceRange(
  markdown: string,
  start: number,
  end: number,
): { start: number; end: number } | null {
  const projected = projectMarkdownText(markdown);
  const projectedStart = projected.sourceOffsets.findIndex((offset) => offset.start >= start);
  let projectedEnd = -1;
  for (let index = projected.sourceOffsets.length - 1; index >= 0; index -= 1) {
    const offset = projected.sourceOffsets[index];
    if (offset && offset.end <= end) {
      projectedEnd = index + 1;
      break;
    }
  }
  if (projectedStart === -1 || projectedEnd === -1 || projectedStart > projectedEnd) return null;
  return { start: projectedStart, end: projectedEnd };
}

function filterProjectedText(
  projected: ProjectedMarkdown,
  markdown: string,
  keep: (char: string) => boolean,
): ProjectedMarkdown {
  let text = "";
  const sourceOffsets: ProjectedMarkdown["sourceOffsets"] = [];
  for (const offset of projected.sourceOffsets) {
    const char = markdown.slice(offset.start, offset.end);
    if (!keep(char)) continue;
    text += char;
    sourceOffsets.push(offset);
  }
  return { text, sourceOffsets };
}

function normalizeRenderedWhitespace(text: string): string {
  return normalizeCommentSource(text).replace(/\s+/g, " ").trim();
}

function replaceCommentReferencesOutsideCode(source: string, replacement: string): string {
  const ignoredRanges = ignoredCommentMarkerRanges(source);
  return source.replace(COMMENT_REF, (match, _id: string, offset: number) =>
    rangeOverlapsIgnoredMarkerRange(offset, offset + match.length, ignoredRanges) ? match : replacement,
  );
}

function ignoredCommentMarkerRanges(markdown: string): SourceRange[] {
  return mergeSourceRanges([...fencedCodeRanges(markdown), ...inlineCodeSpanRanges(markdown)]);
}

function fencedCodeRanges(markdown: string): SourceRange[] {
  return findCodeBlockAnchors(markdown).map((code) => ({ start: code.start, end: code.end }));
}

function inlineCodeSpanRanges(markdown: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  const fencedRanges = fencedCodeRanges(markdown);
  let index = 0;
  while (index < markdown.length) {
    const fencedRange = rangeContainingPosition(index, fencedRanges);
    if (fencedRange) {
      index = Math.max(index + 1, fencedRange.end);
      continue;
    }
    if (markdown[index] !== "`") {
      index += 1;
      continue;
    }

    let tickEnd = index + 1;
    while (markdown[tickEnd] === "`") tickEnd += 1;
    const tickCount = tickEnd - index;
    const closing = markdown.indexOf("`".repeat(tickCount), tickEnd);
    if (closing === -1) {
      index = tickEnd;
      continue;
    }
    ranges.push({ start: index, end: closing + tickCount });
    index = closing + tickCount;
  }
  return ranges;
}

function mergeSourceRanges(ranges: SourceRange[]): SourceRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: SourceRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function rangeContainingPosition(position: number, ranges: SourceRange[]): SourceRange | null {
  return ranges.find((range) => position >= range.start && position < range.end) ?? null;
}

function rangeOverlapsIgnoredMarkerRange(start: number, end: number, ranges: SourceRange[]): boolean {
  return ranges.some((range) => start < range.end && end > range.start);
}

function isAnchorWhitespace(char: string): boolean {
  return /\s/u.test(char);
}

function parseCommentDefinitions(markdown: string): Map<string, CommentDefinition> {
  const definitions = new Map<string, CommentDefinition>();
  const fencedRanges = fencedCodeRanges(markdown);
  let cursor = 0;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    if (rangeOverlapsIgnoredMarkerRange(line.start, line.end, fencedRanges)) {
      cursor = line.next > cursor ? line.next : cursor + 1;
      continue;
    }
    const lineText = markdown.slice(line.start, line.end);
    const match = new RegExp(`^\\[\\^(${LOCAL_NOTE_ID.source})\\]:[ \\t]*(.*)$`).exec(lineText);
    if (!match) {
      cursor = line.next > cursor ? line.next : cursor + 1;
      continue;
    }

    const id = match[1];
    if (!id) {
      cursor = line.next > cursor ? line.next : cursor + 1;
      continue;
    }
    if (
      !parseRangeId(id) &&
      !parseBlockId(id) &&
      !parseImageId(id) &&
      !parseCodeId(id) &&
      !parseBlockSuggestionId(id) &&
      !parseOperationSuggestionId(id) &&
      !parseChildCommentId(id)
    ) {
      cursor = line.next > cursor ? line.next : cursor + 1;
      continue;
    }
    const bodyLines = [match[2] ?? ""];
    let end = line.end;
    let scan = line.next;
    while (scan < markdown.length) {
      const continuation = lineRangeAt(markdown, scan);
      const continuationText = markdown.slice(continuation.start, continuation.end);
      if (/^(?: {4}|\t)/.test(continuationText)) {
        bodyLines.push(continuationText.replace(/^(?: {4}|\t)/, ""));
        end = continuation.end;
        scan = continuation.next;
        continue;
      }
      if (continuationText.trim() === "") {
        const nextLine = continuation.next < markdown.length ? lineRangeAt(markdown, continuation.next) : null;
        const nextText = nextLine ? markdown.slice(nextLine.start, nextLine.end) : "";
        if (nextLine && /^(?: {4}|\t)/.test(nextText)) {
          bodyLines.push("");
          end = continuation.end;
          scan = continuation.next;
          continue;
        }
      }
      break;
    }
    definitions.set(id, {
      id,
      bodyMarkdown: bodyLines.join("\n").trim(),
      start: line.start,
      end,
    });
    cursor = scan > cursor ? scan : line.next;
  }
  return definitions;
}

function parseRangeId(id: string): { direction: "next" | "prev"; logicalLength: number; seed: number; hash: string } | null {
  const rangeMatch = RANGE_COMMENT_ID.exec(id);
  if (rangeMatch) {
    return {
      direction: rangeMatch[1] === "next" ? "next" : "prev",
      logicalLength: Number(rangeMatch[2]),
      seed: Number(rangeMatch[3]),
      hash: rangeMatch[4]?.toLowerCase() ?? "",
    };
  }

  const legacyMatch = LEGACY_RANGE_COMMENT_ID.exec(id);
  if (legacyMatch) {
    return {
      direction: "prev",
      logicalLength: Number(legacyMatch[3]),
      seed: Number(legacyMatch[1]),
      hash: legacyMatch[2]?.toLowerCase() ?? "",
    };
  }

  return null;
}

function parseImageId(
  id: string,
): { target: "bitmap"; x: number; y: number; seed: number; hash: string; svgPath: null } | { target: "svg"; x: number; y: number; seed: number; hash: string; svgPath: string } | null {
  const imageMatch = IMAGE_COMMENT_ID.exec(id);
  if (imageMatch) {
    return {
      target: "bitmap",
      x: Number(imageMatch[1]),
      y: Number(imageMatch[2]),
      seed: Number(imageMatch[3]),
      hash: imageMatch[4]?.toLowerCase() ?? "",
      svgPath: null,
    };
  }

  const svgMatch = SVG_COMMENT_ID.exec(id);
  if (svgMatch) {
    return {
      target: "svg",
      svgPath: decodeSvgLocator(svgMatch[1] ?? "svg"),
      x: 5000,
      y: 5000,
      seed: Number(svgMatch[2]),
      hash: svgMatch[3]?.toLowerCase() ?? "",
    };
  }

  const legacySvgMatch = LEGACY_SVG_COMMENT_ID.exec(id);
  if (legacySvgMatch) {
    return {
      target: "svg",
      svgPath: legacySvgMatch[1] ?? "svg",
      x: Number(legacySvgMatch[2]),
      y: Number(legacySvgMatch[3]),
      seed: Number(legacySvgMatch[4]),
      hash: legacySvgMatch[5]?.toLowerCase() ?? "",
    };
  }

  return null;
}

function parseBlockId(id: string): { seed: number; hash: string } | null {
  const blockMatch = BLOCK_COMMENT_ID.exec(id);
  if (blockMatch) {
    return {
      seed: Number(blockMatch[1]),
      hash: blockMatch[2]?.toLowerCase() ?? "",
    };
  }

  const legacyMatch = LEGACY_BLOCK_COMMENT_ID.exec(id);
  if (legacyMatch) {
    return {
      seed: Number(legacyMatch[1]),
      hash: legacyMatch[2]?.toLowerCase() ?? "",
    };
  }

  return null;
}

function parseCodeId(id: string): { line: number; col: number; length: number; seed: number; hash: string } | null {
  const codeMatch = CODE_COMMENT_ID.exec(id);
  if (!codeMatch) return null;
  return {
    line: Number(codeMatch[1]),
    col: Number(codeMatch[2]),
    length: Number(codeMatch[3]),
    seed: Number(codeMatch[4]),
    hash: codeMatch[5]?.toLowerCase() ?? "",
  };
}

function parseBlockSuggestionId(id: string): { seed: number; hash: string } | null {
  const suggestionMatch = BLOCK_SUGGESTION_ID.exec(id);
  if (!suggestionMatch) return null;
  return {
    seed: Number(suggestionMatch[1]),
    hash: suggestionMatch[2]?.toLowerCase() ?? "",
  };
}

function parseChildCommentId(id: string): { seed: number; suffix: string | null } | null {
  const commentMatch = CHILD_COMMENT_ID.exec(id);
  if (!commentMatch) return null;
  return {
    seed: Number(commentMatch[1]),
    suffix: commentMatch[2] ?? null,
  };
}

function commentSortPosition(comment: ParsedComment): number {
  return comment.kind === "dangling" ? comment.definitionSourceStart : comment.markerSourceStart;
}

function commentChildSortPosition(child: ParsedCommentChild): number {
  return child.missingDefinition ? child.markerSourceStart : child.definitionSourceStart;
}

function sourceActiveRange(comment: Exclude<ParsedComment, { kind: "dangling" }>): { start: number; end: number } {
  if (comment.kind === "range") {
    return {
      start: Math.min(comment.rangeSourceStart, comment.markerSourceStart),
      end: Math.max(comment.rangeSourceEnd, comment.markerSourceEnd),
    };
  }
  if (comment.kind === "image") {
    return {
      start: Math.min(comment.imageSourceStart, comment.markerSourceStart),
      end: Math.max(comment.imageSourceEnd, comment.markerSourceEnd),
    };
  }
  if (comment.kind === "code") {
    return {
      start: Math.min(comment.rangeSourceStart, comment.markerSourceStart),
      end: Math.max(comment.rangeSourceEnd, comment.markerSourceEnd),
    };
  }
  return {
    start: Math.min(comment.blockSourceStart, comment.markerSourceStart),
    end: Math.max(comment.blockSourceEnd, comment.markerSourceEnd),
  };
}

function sourceRangeLength(range: { start: number; end: number }): number {
  return range.end - range.start;
}

function blockReplacementRange(
  markdown: string,
  comment: Exclude<ParsedComment, { kind: "dangling" }>,
): { start: number; end: number } {
  if (comment.kind === "block") return listBlockAt(markdown, comment.blockSourceStart) ?? { start: comment.blockSourceStart, end: comment.blockSourceEnd };
  if (comment.kind === "code") return { start: comment.codeSourceStart, end: comment.codeSourceEnd };
  if (comment.kind === "image") return listBlockAt(markdown, comment.imageSourceStart) ?? containingBlock(markdown, comment.imageSourceStart);
  return listBlockAt(markdown, comment.rangeSourceStart) ?? containingBlock(markdown, comment.rangeSourceStart);
}

function relatedCommentIdsForBlock(markdown: string, target: { start: number; end: number }): string[] {
  return parseComments(markdown)
    .filter((comment): comment is Exclude<ParsedComment, { kind: "dangling" }> => comment.kind !== "dangling")
    .filter((comment) => sourceRangesOverlap(blockReplacementRange(markdown, comment), target.start, target.end))
    .map((comment) => comment.id);
}

function insertBlockSuggestionMarker(
  markdown: string,
  parent: Exclude<ParsedComment, { kind: "dangling" }>,
  target: { start: number; end: number },
  id: string,
): string {
  if (parent.kind === "code") {
    return insertDetachedMarker(markdown, codeCommentInsertionPoint(markdown, parent.codeSourceEnd), id);
  }
  if (parent.kind === "image") {
    return insertDetachedMarker(markdown, imageCommentInsertionPoint(markdown, parent.imageSourceEnd), id);
  }
  return `${markdown.slice(0, target.end)}[^${id}]${markdown.slice(target.end)}`;
}

function insertSourceRangeSuggestionMarker(markdown: string, target: { start: number; end: number }, id: string): string {
  if (isFencedCodeRange(markdown, target)) {
    return insertDetachedMarker(markdown, codeCommentInsertionPoint(markdown, target.end), id);
  }
  if (isTableRange(markdown, target)) {
    return insertDetachedBlockMarker(markdown, target.end, id);
  }
  return `${markdown.slice(0, target.end)}[^${id}]${markdown.slice(target.end)}`;
}

function isFencedCodeRange(markdown: string, target: { start: number; end: number }): boolean {
  return isRoundtripFencedCodeBlock(markdown.slice(target.start, target.end));
}

function isTableRange(markdown: string, target: { start: number; end: number }): boolean {
  return isRoundtripMarkdownTableBlock(markdown.slice(target.start, target.end));
}

function appendReferenceToDefinition(markdown: string, definitionId: string, referenceId: string): string {
  const definition = parseCommentDefinitions(markdown).get(definitionId);
  if (!definition) return markdown;
  const line = markdown.slice(definition.start, definition.end);
  const reference = `[^${referenceId}]`;
  if (line.includes(reference)) return markdown;
  return `${markdown.slice(0, definition.start)}${line} ${reference}${markdown.slice(definition.end)}`;
}

function isInsideCommentDefinitionLine(markdown: string, position: number): boolean {
  const line = lineRangeAt(markdown, position);
  const beforePosition = markdown.slice(line.start, position);
  return new RegExp(`^\\[\\^${LOCAL_NOTE_ID.source}\\]:`).test(beforePosition);
}

function suggestionTargetBlock(markdown: string, markerStart: number, markerEnd: number): { start: number; end: number } {
  const line = lineRangeAt(markdown, markerStart);
  const lineText = markdown.slice(line.start, line.end).trim();
  if (lineText === markdown.slice(markerStart, markerEnd) || isOnlyLocalDetachedCommentReference(lineText)) {
    return previousSuggestionTarget(markdown, line.start);
  }
  const list = listBlockAt(markdown, markerStart);
  if (list) return list;
  const target = containingBlock(markdown, markerStart);
  return {
    start: target.start,
    end: Math.max(target.start, markerStart),
  };
}

function suggestionTargetBlockForComment(markdown: string, comment: Exclude<ParsedComment, { kind: "dangling" }>): { start: number; end: number } {
  if (comment.kind === "code") return { start: comment.codeSourceStart, end: comment.codeSourceEnd };
  if (comment.kind === "image") return { start: comment.imageSourceStart, end: comment.imageSourceEnd };
  if (comment.kind === "block") return { start: comment.blockSourceStart, end: comment.blockSourceEnd };
  const list = listBlockAt(markdown, comment.rangeSourceStart);
  if (list) return list;
  return containingBlock(markdown, comment.rangeSourceStart);
}

function previousSuggestionTarget(markdown: string, markerLineStart: number): { start: number; end: number } {
  let cursor = markerLineStart;
  while (cursor > 0) {
    const previous = lineRangeAt(markdown, cursor - 1);
    const text = markdown.slice(previous.start, previous.end);
    if (text.trim().length === 0) {
      cursor = previous.start;
      continue;
    }
    const table = tableRangeEndingAt(markdown, previous.end);
    if (table) return table;
    const list = listBlockEndingAt(markdown, previous.end);
    if (list) return list;
    const target = containingBlock(markdown, previous.end);
    return { start: target.start, end: Math.min(target.end, previous.end) };
  }
  return { start: 0, end: 0 };
}

function listBlockAt(markdown: string, position: number): { start: number; end: number } | null {
  const block = markdownBlockAt(markdown, position);
  return block && isRoundtripMarkdownListBlock(block.markdown) ? { start: block.start, end: block.end } : null;
}

function listBlockEndingAt(markdown: string, end: number): { start: number; end: number } | null {
  const block = markdownBlockEndingAt(markdown, end);
  return block && isRoundtripMarkdownListBlock(block.markdown) ? { start: block.start, end: block.end } : null;
}

function tableRangeEndingAt(markdown: string, end: number): { start: number; end: number } | null {
  const lines: Array<{ start: number; end: number; next: number }> = [];
  let cursor = end;
  while (cursor > 0) {
    const line = lineRangeAt(markdown, cursor - 1);
    const text = markdown.slice(line.start, line.end);
    if (!isMarkdownTableRow(text)) break;
    lines.unshift(line);
    cursor = line.start;
  }
  if (lines.length < 2) return null;
  const delimiterIndex = lines.findIndex((line) => isMarkdownTableDelimiter(markdown.slice(line.start, line.end)));
  if (delimiterIndex !== 1) return null;
  return { start: lines[0]?.start ?? 0, end };
}

function sourceRangesOverlap(range: { start: number; end: number }, selectionStart: number, selectionEnd: number): boolean {
  if (selectionStart === selectionEnd) return selectionStart >= range.start && selectionStart <= range.end;
  return range.start < selectionEnd && range.end > selectionStart;
}

function resolveLogicalRange(
  markdown: string,
  markerStart: number,
  markerEnd: number,
  direction: "next" | "prev",
  logicalLength: number,
): { start: number; end: number } {
  const projected = projectAnchorUnits(markdown);
  if (logicalLength <= 0 || projected.sourceOffsets.length === 0) {
    return { start: markerStart, end: markerStart };
  }

  if (direction === "prev") {
    const beforeMarker = projected.sourceOffsets.filter((offset) => offset.end <= markerStart);
    const selected = beforeMarker.slice(Math.max(0, beforeMarker.length - logicalLength));
    return selected.length > 0
      ? { start: selected[0]?.start ?? markerStart, end: selected[selected.length - 1]?.end ?? markerStart }
      : { start: markerStart, end: markerStart };
  }

  const afterMarker = projected.sourceOffsets.filter((offset) => offset.start >= markerEnd);
  const selected = afterMarker.slice(0, logicalLength);
  return selected.length > 0
    ? { start: selected[0]?.start ?? markerEnd, end: selected[selected.length - 1]?.end ?? markerEnd }
    : { start: markerEnd, end: markerEnd };
}

function containingBlock(markdown: string, position: number): { start: number; end: number } {
  const safePosition = Math.max(0, Math.min(position, markdown.length));
  const before = markdown.lastIndexOf("\n\n", safePosition - 1);
  const after = markdown.indexOf("\n\n", safePosition);
  return {
    start: before === -1 ? 0 : before + 2,
    end: after === -1 ? markdown.length : after,
  };
}

function imageAnchorAt(markdown: string, position: number): ImageAnchor | null {
  return findImageAnchors(markdown).find((image) => position >= image.start && position <= image.end) ?? null;
}

function findImageAnchorBefore(markdown: string, position: number): ImageAnchor | null {
  const line = lineRangeAt(markdown, position);
  let cursor = line.start;
  while (cursor > 0) {
    const previous = lineRangeAt(markdown, cursor - 1);
    const text = markdown.slice(previous.start, previous.end).trim();
    const image = imageAnchorAt(markdown, previous.start);
    if (image) return image;
    if (text && !isOnlyLocalImageCommentReference(text)) return null;
    cursor = previous.start;
  }
  return imageAnchorAt(markdown, 0);
}

export function findImageAnchors(markdown: string): ImageAnchor[] {
  const anchors: ImageAnchor[] = [];
  const markdownImage = /!\[[^\]\n]*\]\(([^\)\n]+)\)/g;
  for (const match of markdown.matchAll(markdownImage)) {
    if (match.index === undefined) continue;
    anchors.push({
      kind: "markdown-image",
      start: match.index,
      end: match.index + match[0].length,
      markdown: match[0],
      url: (match[1] ?? "").trim(),
    });
  }

  const inlineSvg = /<svg\b[\s\S]*?<\/svg>/gi;
  for (const match of markdown.matchAll(inlineSvg)) {
    if (match.index === undefined) continue;
    anchors.push({
      kind: "inline-svg",
      start: match.index,
      end: match.index + match[0].length,
      markdown: match[0],
      url: "",
    });
  }

  return anchors.sort((left, right) => left.start - right.start);
}

function imageCommentInsertionPoint(markdown: string, imageEnd: number): number {
  let cursor = lineRangeAt(markdown, imageEnd).next;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const text = markdown.slice(line.start, line.end).trim();
    if (!isOnlyLocalImageCommentReference(text)) break;
    cursor = line.next;
  }
  return cursor === 0 ? 0 : cursor;
}

function imageAnchorHash(markdown: string): string {
  return hashLogicalText(markdown.trim());
}

function codeCommentHash(code: string): string {
  return hashLogicalText(code);
}

function codeBlockAt(markdown: string, position: number): CodeBlockAnchor | null {
  return findCodeBlockAnchors(markdown).find((code) => position >= code.start && position <= code.end) ?? null;
}

function findCodeBlockBefore(markdown: string, position: number): CodeBlockAnchor | null {
  const line = lineRangeAt(markdown, position);
  let cursor = line.start;
  while (cursor > 0) {
    const previous = lineRangeAt(markdown, cursor - 1);
    const text = markdown.slice(previous.start, previous.end).trim();
    const code = codeBlockAt(markdown, previous.start);
    if (code) return code;
    if (text && !isOnlyLocalDetachedCommentReference(text)) return null;
    cursor = previous.start;
  }
  return codeBlockAt(markdown, 0);
}

export function findCodeBlockAnchors(markdown: string): CodeBlockAnchor[] {
  const anchors: CodeBlockAnchor[] = [];
  let cursor = 0;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const opening = /^( {0,3})(`{3,}|~{3,})([^\n]*)$/.exec(markdown.slice(line.start, line.end));
    if (!opening) {
      cursor = line.next;
      continue;
    }

    const fence = opening[2] ?? "";
    const fenceChar = fence[0] ?? "`";
    let closingLine: ReturnType<typeof lineRangeAt> | null = null;
    let scan = line.next;
    while (scan < markdown.length) {
      const candidate = lineRangeAt(markdown, scan);
      const candidateText = markdown.slice(candidate.start, candidate.end);
      const closing = new RegExp(`^ {0,3}${escapeRegExp(fenceChar.repeat(fence.length))}${fenceChar}*[ \\t]*$`).exec(
        candidateText,
      );
      if (closing) {
        closingLine = candidate;
        break;
      }
      scan = candidate.next;
    }

    if (!closingLine) {
      cursor = line.next;
      continue;
    }

    const contentStart = line.next;
    const contentEnd = closingLine.start > contentStart && markdown[closingLine.start - 1] === "\n"
      ? closingLine.start - 1
      : closingLine.start;
    anchors.push({
      start: line.start,
      end: closingLine.end,
      contentStart,
      contentEnd,
      info: (opening[3] ?? "").trim(),
      code: markdown.slice(contentStart, contentEnd),
    });
    cursor = closingLine.next;
  }
  return anchors;
}

function codeSourceRangeForPosition(code: CodeBlockAnchor, line: number, col: number, length: number): { start: number; end: number } {
  const relativeStart = codeOffsetForLineCol(code.code, line, col);
  const relativeEnd = Math.min(code.code.length, relativeStart + Math.max(0, length));
  return {
    start: code.contentStart + relativeStart,
    end: code.contentStart + relativeEnd,
  };
}

function codeOffsetForLineCol(code: string, line: number, col: number): number {
  let offset = 0;
  for (let currentLine = 1; currentLine < line && offset < code.length; currentLine += 1) {
    const nextBreak = code.indexOf("\n", offset);
    if (nextBreak === -1) return code.length;
    offset = nextBreak + 1;
  }
  return Math.min(code.length, offset + Math.max(0, col - 1));
}

function codeLineColForOffset(code: string, offset: number): { line: number; col: number } {
  const safeOffset = Math.max(0, Math.min(offset, code.length));
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < safeOffset; index += 1) {
    if (code[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, col: safeOffset - lineStart + 1 };
}

export function codeCommentPositionForSourceRange(
  markdown: string,
  start: number,
  end: number,
): { codeSourceStart: number; line: number; col: number; length: number } | null {
  const normalizedStart = Math.max(0, Math.min(start, end));
  const normalizedEnd = Math.min(markdown.length, Math.max(start, end));
  const code = findCodeBlockAnchors(markdown).find(
    (candidate) => normalizedStart >= candidate.contentStart && normalizedEnd <= candidate.contentEnd,
  );
  if (!code) return null;
  const relativeStart = normalizedStart - code.contentStart;
  const position = codeLineColForOffset(code.code, relativeStart);
  return {
    codeSourceStart: code.start,
    line: position.line,
    col: position.col,
    length: normalizedEnd - normalizedStart,
  };
}

function lineRangeAt(markdown: string, position: number): { start: number; end: number; next: number } {
  const safePosition = Math.max(0, Math.min(position, markdown.length));
  const start = markdown.lastIndexOf("\n", Math.max(0, safePosition - 1)) + 1;
  const nextBreak = markdown.indexOf("\n", safePosition);
  const end = nextBreak === -1 ? markdown.length : nextBreak;
  return {
    start,
    end,
    next: nextBreak === -1 ? markdown.length : nextBreak + 1,
  };
}

function isMarkdownTableRow(line: string): boolean {
  return line.includes("|") && line.trim().length > 0;
}

function isMarkdownTableDelimiter(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function codeCommentInsertionPoint(markdown: string, codeEnd: number): number {
  let cursor = lineRangeAt(markdown, codeEnd).next;
  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const text = markdown.slice(line.start, line.end).trim();
    if (!isOnlyLocalDetachedCommentReference(text)) break;
    cursor = line.next;
  }
  return cursor === 0 ? 0 : cursor;
}

function isOnlyLocalImageCommentReference(text: string): boolean {
  return /^(?:\[\^(?:image-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4}|svg-xpath_[A-Za-z0-9.~%-]+_\d{1,5}-[0-9a-fA-F]{4}|svg-[A-Za-z0-9._~-]+-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})\])+$/.test(text);
}

function isOnlyLocalDetachedCommentReference(text: string): boolean {
  return /^(?:\[\^(?:image-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4}|svg-xpath_[A-Za-z0-9.~%-]+_\d{1,5}-[0-9a-fA-F]{4}|svg-[A-Za-z0-9._~-]+-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4}|code-line-\d{1,5}-col-\d{1,5}-len-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4}|suggest-block-\d{1,5}-[0-9a-fA-F]{4})\])+$/.test(text);
}

function clampCoordinate(value: number): number {
  return Math.max(0, Math.min(10000, Math.round(value)));
}

function encodeSvgLocator(locator: string): string {
  const encoded = encodeURIComponent(locator).replace(/_/g, "%5F").replace(/%2E/gi, ".").replace(/%2D/gi, "-");
  return encoded || "svg";
}

function decodeSvgLocator(locator: string): string {
  try {
    return decodeURIComponent(locator);
  } catch {
    return locator;
  }
}

function isMarkdownSyntax(markdown: string, index: number): boolean {
  const char = markdown[index];
  if (char === "*" || char === "_" || char === "`" || char === "~") return true;
  if (char === "[" || char === "]" || char === "(" || char === ")" || char === "!") return true;
  if (char === "#" && (index === 0 || markdown[index - 1] === "\n")) return true;
  if (char === ">" && (index === 0 || markdown[index - 1] === "\n")) return true;
  if ((char === "-" || char === "+" || char === "*") && isListMarker(markdown, index)) return true;
  return false;
}

function inlineLinkDestinationEnd(markdown: string, index: number, limit: number): number | null {
  if (markdown[index] !== "]" || markdown[index + 1] !== "(") return null;
  let depth = 1;
  let cursor = index + 2;
  while (cursor < limit) {
    const char = markdown[cursor];
    if (char === "\\") {
      cursor += 2;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return cursor + 1;
    }
    cursor += 1;
  }
  return null;
}

function isListMarker(markdown: string, index: number): boolean {
  const before = markdown.slice(0, index);
  const lineStart = before.lastIndexOf("\n") + 1;
  return markdown.slice(lineStart, index).trim() === "" && markdown[index + 1] === " ";
}

function tableLineAt(markdown: string, start: number): TableLine | null {
  const end = markdown.indexOf("\n", start);
  const lineEnd = end === -1 ? markdown.length : end;
  return {
    start,
    end: lineEnd,
    nextIndex: end === -1 ? markdown.length : end + 1,
    text: markdown.slice(start, lineEnd),
  };
}

function isGfmTableLine(markdown: string, line: TableLine): boolean {
  if (!line.text.includes("|")) return false;
  if (isGfmTableDelimiter(line.text)) return true;

  const previous = previousTableLine(markdown, line.start);
  const next = tableLineAt(markdown, line.nextIndex);
  return Boolean(
    (previous && isGfmTableDelimiter(previous.text)) ||
      (next && isGfmTableDelimiter(next.text)),
  );
}

function previousTableLine(markdown: string, start: number): TableLine | null {
  if (start <= 0) return null;
  const previousEnd = start - 1;
  const previousStart = markdown.lastIndexOf("\n", previousEnd - 1) + 1;
  return {
    start: previousStart,
    end: previousEnd,
    nextIndex: start,
    text: markdown.slice(previousStart, previousEnd),
  };
}

function isGfmTableDelimiter(line: string): boolean {
  const cells = tableCellRanges(line, 0).map((cell) => line.slice(cell.start, cell.end).trim());
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function emitTableRowLogicalText(
  markdown: string,
  start: number,
  end: number,
  emit: (sourceIndex: number) => void,
): void {
  for (const cell of tableCellRanges(markdown.slice(start, end), start)) {
    const trimmed = trimmedRange(markdown, cell.start, cell.end);
    emitInlineLogicalText(markdown, trimmed.start, trimmed.end, emit);
  }
}

function tableCellRanges(line: string, sourceStart: number): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const first = line.startsWith("|") ? 1 : 0;
  const last = line.endsWith("|") ? line.length - 1 : line.length;
  let cellStart = first;
  for (let index = first; index <= last; index += 1) {
    if (index === last || line[index] === "|") {
      ranges.push({ start: sourceStart + cellStart, end: sourceStart + index });
      cellStart = index + 1;
    }
  }
  return ranges;
}

function trimmedRange(markdown: string, start: number, end: number): { start: number; end: number } {
  let trimmedStart = start;
  let trimmedEnd = end;
  while (trimmedStart < trimmedEnd && /[ \t]/.test(markdown[trimmedStart] ?? "")) trimmedStart += 1;
  while (trimmedEnd > trimmedStart && /[ \t]/.test(markdown[trimmedEnd - 1] ?? "")) trimmedEnd -= 1;
  return { start: trimmedStart, end: trimmedEnd };
}

function emitInlineLogicalText(
  markdown: string,
  start: number,
  end: number,
  emit: (sourceIndex: number) => void,
): void {
  let index = start;
  while (index < end) {
    const footnoteRef = /^\[\^[^\]]+\]/.exec(markdown.slice(index, end));
    if (footnoteRef) {
      index += footnoteRef[0].length;
      continue;
    }

    if (markdown[index] === "<") {
      const tagEnd = markdown.indexOf(">", index + 1);
      if (tagEnd !== -1 && tagEnd < end) {
        index = tagEnd + 1;
        continue;
      }
    }

    const linkDestinationEnd = inlineLinkDestinationEnd(markdown, index, end);
    if (linkDestinationEnd !== null) {
      index = linkDestinationEnd;
      continue;
    }

    if (isMarkdownSyntax(markdown, index)) {
      index += 1;
      continue;
    }

    emit(index);
    index += 1;
  }
}

interface TableLine {
  start: number;
  end: number;
  nextIndex: number;
  text: string;
}

export interface ImageAnchor {
  kind: "markdown-image" | "inline-svg";
  start: number;
  end: number;
  markdown: string;
  url: string;
}

export interface CodeBlockAnchor {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  info: string;
  code: string;
}

function nthIndexOf(text: string, search: string, occurrenceIndex: number): number {
  if (!search) return -1;
  let from = 0;
  for (let count = 0; ; count += 1) {
    const found = text.indexOf(search, from);
    if (found === -1) return -1;
    if (count === occurrenceIndex) return found;
    from = found + search.length;
  }
}

export function occurrenceIndexBefore(text: string, search: string, selectedStart: number): number {
  if (!search) return 0;
  let occurrence = 0;
  let from = 0;
  while (from <= selectedStart) {
    const found = text.indexOf(search, from);
    if (found === -1 || found >= selectedStart) return occurrence;
    occurrence += 1;
    from = found + search.length;
  }
  return occurrence;
}

function insertComment(markdown: string, position: number, id: string, bodyMarkdown: string): string {
  const marker = `[^${id}]`;
  const definition = footnoteDefinitionMarkdown(id, bodyMarkdown);
  const needsSeparator = markdown.endsWith("\n") ? "\n" : "\n\n";
  return `${markdown.slice(0, position)}${marker}${markdown.slice(position)}${needsSeparator}${definition}\n`;
}

function insertImageComment(markdown: string, position: number, id: string, bodyMarkdown: string): string {
  return insertDetachedComment(markdown, position, id, bodyMarkdown);
}

function insertDetachedComment(markdown: string, position: number, id: string, bodyMarkdown: string): string {
  const marker = `[^${id}]`;
  const definition = footnoteDefinitionMarkdown(id, bodyMarkdown);
  const before = markdown.slice(0, position);
  const after = markdown.slice(position);
  const markerPrefix = before.endsWith("\n") || before.length === 0 ? "" : "\n";
  const markerSuffix = after.length === 0 ? "" : "\n";
  const nextMarkdown = `${before}${markerPrefix}${marker}${markerSuffix}${after}`;
  const needsSeparator = nextMarkdown.endsWith("\n") ? "\n" : "\n\n";
  return `${nextMarkdown}${needsSeparator}${definition}\n`;
}

function insertDetachedMarker(markdown: string, position: number, id: string): string {
  const marker = `[^${id}]`;
  const before = markdown.slice(0, position);
  const after = markdown.slice(position);
  const markerPrefix = before.endsWith("\n") || before.length === 0 ? "" : "\n";
  const markerSuffix = after.length === 0 ? "" : "\n";
  return `${before}${markerPrefix}${marker}${markerSuffix}${after}`;
}

function insertDetachedBlockMarker(markdown: string, position: number, id: string): string {
  const marker = `[^${id}]`;
  const before = markdown.slice(0, position).trimEnd();
  const after = markdown.slice(position).trimStart();
  return after.length > 0 ? `${before}\n\n${marker}\n\n${after}` : `${before}\n\n${marker}`;
}

function appendChildFootnote(markdown: string, _parentDefinition: CommentDefinition, id: string, bodyMarkdown: string): string {
  const definition = footnoteDefinitionMarkdown(id, bodyMarkdown);
  const needsSeparator = markdown.endsWith("\n") ? "\n" : "\n\n";
  return `${markdown}${needsSeparator}${definition}\n`;
}

function footnoteDefinitionMarkdown(id: string, bodyMarkdown: string): string {
  const lines = normalizeCommentSource(bodyMarkdown).trim().split("\n");
  const first = lines[0] ?? "";
  const rest = lines.slice(1).map((line) => `    ${line}`);
  return [`[^${id}]: ${first}`, ...rest].join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
