import { lineRangeAt, markdownBlockRanges, type MarkdownBlockRange } from "./blocks";

const blockIdPattern = "b[a-zA-Z0-9]+";
const blockIdComment = new RegExp(
  `<!--\\s*markleft:block\\s+id=["'](${blockIdPattern})["']\\s*-->`,
  "g",
);

export interface IdentifiedMarkdownBlock extends MarkdownBlockRange {
  id: string | null;
  idCommentStart: number | null;
  idCommentEnd: number | null;
}

export interface BlockIdOptions {
  createId?: () => string;
}

export function documentHasBlockIds(markdown: string): boolean {
  blockIdComment.lastIndex = 0;
  return blockIdComment.test(documentBodySource(markdown));
}

export function identifiedMarkdownBlocks(markdown: string): IdentifiedMarkdownBlock[] {
  const blocks = markdownBlockRanges(markdown);
  const comments = blockIdComments(documentBodySource(markdown));
  return blocks.map((block) => {
    const comment = [...comments]
      .reverse()
      .find(
        (candidate) =>
          candidate.end <= block.start && markdown.slice(candidate.end, block.start).trim() === "",
      );
    return {
      ...block,
      id: comment?.id ?? null,
      idCommentStart: comment?.start ?? null,
      idCommentEnd: comment?.end ?? null,
    };
  });
}

export function ensureDocumentBlockIds(markdown: string, options: BlockIdOptions = {}): string {
  markdown = removeEscapedBlockIdArtifacts(markdown);
  const createId = options.createId ?? createBlockId;
  const blocks = identifiedMarkdownBlocks(markdown);
  const used = new Set(blocks.map((block) => block.id).filter((id): id is string => Boolean(id)));
  const assigned = new Map<number, string>();
  for (const block of blocks) {
    if (block.id) continue;
    let id = createId();
    while (!new RegExp(`^${blockIdPattern}$`).test(id) || used.has(id)) id = createId();
    used.add(id);
    assigned.set(block.start, id);
  }
  let next = markdown;
  for (const block of [...blocks].reverse()) {
    if (block.id) continue;
    const id = assigned.get(block.start);
    if (!id) continue;
    next = `${next.slice(0, block.start)}<!-- markleft:block id="${id}" -->\n${next.slice(block.start)}`;
  }
  return normalizeBlockIdSpacing(next);
}

export function stripDocumentBlockIds(markdown: string): string {
  markdown = removeEscapedBlockIdArtifacts(markdown);
  const boundary = documentBodyBoundary(markdown);
  const body = markdown
    .slice(0, boundary)
    .replace(/^[ \t]*<!--\s*markleft:block\s+id=["']b[a-zA-Z0-9]+["']\s*-->[ \t]*(?:\r?\n)?/gm, "");
  return `${body}${markdown.slice(boundary)}`.replace(/\n{3,}/g, "\n\n");
}

export function blockIdForSourceRange(markdown: string, start: number, end: number): string | null {
  const block = identifiedMarkdownBlocks(markdown).find(
    (candidate) => candidate.start === start && candidate.end === end,
  );
  return block?.id ?? null;
}

export function blockById(markdown: string, id: string): IdentifiedMarkdownBlock | null {
  return identifiedMarkdownBlocks(markdown).find((block) => block.id === id) ?? null;
}

export function documentBlockIds(markdown: string): Array<string | null> {
  return identifiedMarkdownBlocks(markdown).map((block) => block.id);
}

export function documentBodyBoundary(markdown: string): number {
  let cursor = 0;
  let fence: { character: string; length: number } | null = null;

  while (cursor < markdown.length) {
    const line = lineRangeAt(markdown, cursor);
    const text = markdown.slice(line.start, line.end);
    if (fence) {
      const closing = new RegExp(`^ {0,3}${escapeRegExp(fence.character)}{${fence.length},}\\s*$`);
      if (closing.test(text)) fence = null;
    } else {
      const opening = /^ {0,3}(`{3,}|~{3,})/.exec(text)?.[1];
      if (opening) {
        fence = { character: opening[0] ?? "`", length: opening.length };
      } else if (/^\[\^[^\]\n]+\]:/.test(text)) {
        return line.start;
      }
    }
    cursor = line.next;
  }

  return markdown.length;
}

function documentBodySource(markdown: string): string {
  return markdown.slice(0, documentBodyBoundary(markdown));
}

function blockIdComments(markdown: string): Array<{ id: string; start: number; end: number }> {
  const comments: Array<{ id: string; start: number; end: number }> = [];
  blockIdComment.lastIndex = 0;
  for (const match of markdown.matchAll(blockIdComment)) {
    if (match.index === undefined || !match[1]) continue;
    comments.push({ id: match[1], start: match.index, end: match.index + match[0].length });
  }
  return comments;
}

function createBlockId(): string {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return `b${(values[0] ?? 0).toString(16).padStart(8, "0").slice(0, 7)}`;
}

function normalizeBlockIdSpacing(markdown: string): string {
  return markdown.replace(
    /(<!--\s*markleft:block\s+id=["']b[a-zA-Z0-9]+["']\s*-->)[ \t]*(?:\r?\n)+/g,
    "$1\n",
  );
}

function removeEscapedBlockIdArtifacts(markdown: string): string {
  const id = `<!--\\s*markleft:block\\s+id=["']${blockIdPattern}["']\\s*-->`;
  const escapedId = `\\\\${id}`;
  return markdown.replace(
    new RegExp(
      `^[ \\t]*${id}[ \\t]*\\r?\\n(?:[ \\t]*${escapedId})+[ \\t]*\\r?\\n(?=^[ \\t]*${id}[ \\t]*$)`,
      "gm",
    ),
    "",
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
