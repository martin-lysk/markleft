import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import {
  parseBlockSuggestions,
  parseComments,
  type ParsedBlockSuggestion,
  type ParsedComment,
} from "../markdown/comments";
import { composeMarkdown, splitFrontmatter } from "../markdown/frontmatter";
import {
  ensureDocumentBlockIds,
  identifiedMarkdownBlocks,
  type IdentifiedMarkdownBlock,
} from "../roundtrip/block-ids";

type MdastRoot = {
  type: "root";
  children: unknown[];
};

export interface MarkleftDocumentOptions {
  ensureBlockIds?: boolean;
  createBlockId?: () => string;
}

export interface MarkleftDocument {
  markdown: string;
  frontmatter: string;
  body: string;
  ast: MdastRoot;
  blocks: MarkleftDocumentBlock[];
  annotations: MarkleftAnnotationIndex;
}

export interface MarkleftDocumentBlock extends IdentifiedMarkdownBlock {
  changed: boolean;
}

export interface MarkleftAnnotationIndex {
  comments: ParsedComment[];
  suggestions: ParsedBlockSuggestion[];
  commentsById: Map<string, ParsedComment>;
  suggestionsById: Map<string, ParsedBlockSuggestion>;
  suggestionsByBlockId: Map<string, ParsedBlockSuggestion[]>;
}

export interface ReplaceBlockOptions {
  preserveBlockId?: boolean;
}

export interface MergeImportedBodyOptions {
  includeBlockIds?: boolean;
}

export function parseMarkleftDocument(
  markdown: string,
  options: MarkleftDocumentOptions = {},
): MarkleftDocument {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const parts = splitFrontmatter(normalized);
  const body =
    options.ensureBlockIds === true
      ? ensureDocumentBlockIds(
          parts.body,
          options.createBlockId ? { createId: options.createBlockId } : {},
        )
      : parts.body;
  const nextMarkdown = composeMarkdown({ frontmatter: parts.frontmatter, body });
  const ast = parseMarkdownAst(body);
  const blocks = identifiedMarkdownBlocks(body).map((block) => ({ ...block, changed: false }));

  return {
    markdown: nextMarkdown,
    frontmatter: parts.frontmatter,
    body,
    ast,
    blocks,
    annotations: buildAnnotationIndex(body),
  };
}

export function serializeMarkleftDocument(document: MarkleftDocument): string {
  return composeMarkdown({ frontmatter: document.frontmatter, body: document.body });
}

export function replaceDocumentBlock(
  document: MarkleftDocument,
  blockId: string,
  replacementMarkdown: string,
  options: ReplaceBlockOptions = {},
): MarkleftDocument {
  const block = document.blocks.find((candidate) => candidate.id === blockId);
  if (!block) throw new Error(`Unknown Markleft block id: ${blockId}`);

  const normalizedReplacement = replacementMarkdown.replace(/\r\n?/g, "\n").trim();
  const replacement =
    options.preserveBlockId === false || !block.id
      ? normalizedReplacement
      : `<!-- markleft:block id="${block.id}" -->\n${normalizedReplacement}`;
  const start = block.idCommentStart ?? block.start;
  const end = block.end;
  const nextBody = `${document.body.slice(0, start)}${replacement}${document.body.slice(end)}`;
  return parseMarkleftDocument(composeMarkdown({ frontmatter: document.frontmatter, body: nextBody }));
}

export function mergeImportedBodyWithPrevious(
  previousBody: string,
  importedBody: string,
  options: MergeImportedBodyOptions = {},
): string {
  if (options.includeBlockIds !== true) return importedBody;

  const previousDocument = parseMarkleftDocument(previousBody);
  const importedDocument = parseMarkleftDocument(importedBody, { ensureBlockIds: true });
  const previousBlocks = new Map(
    previousDocument.blocks
      .filter((block) => block.id)
      .map((block) => [block.id as string, block]),
  );

  let merged = importedDocument.body;
  for (const importedBlock of [...importedDocument.blocks].reverse()) {
    if (!importedBlock.id) continue;
    const previousBlock = previousBlocks.get(importedBlock.id);
    if (!previousBlock) continue;
    if (normalizeBlockForComparison(previousBlock.markdown) !== normalizeBlockForComparison(importedBlock.markdown)) {
      continue;
    }

    const importedStart = importedBlock.idCommentStart ?? importedBlock.start;
    const previousStart = previousBlock.idCommentStart ?? previousBlock.start;
    const previousSource = previousDocument.body.slice(previousStart, previousBlock.end);
    merged = `${merged.slice(0, importedStart)}${previousSource}${merged.slice(importedBlock.end)}`;
  }

  return merged;
}

function parseMarkdownAst(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

function buildAnnotationIndex(markdown: string): MarkleftAnnotationIndex {
  const comments = parseComments(markdown);
  const suggestions = parseBlockSuggestions(markdown);
  const commentsById = new Map(comments.map((comment) => [comment.id, comment]));
  const suggestionsById = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));
  const suggestionsByBlockId = new Map<string, ParsedBlockSuggestion[]>();

  for (const suggestion of suggestions) {
    const blockId = suggestion.targetBlockId;
    if (!blockId) continue;
    const existing = suggestionsByBlockId.get(blockId) ?? [];
    existing.push(suggestion);
    suggestionsByBlockId.set(blockId, existing);
  }

  return {
    comments,
    suggestions,
    commentsById,
    suggestionsById,
    suggestionsByBlockId,
  };
}

function normalizeBlockForComparison(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
