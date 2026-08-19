// Markleft's host-neutral document API. Keep this module free of browser and host imports.
export {
  mergeImportedBodyWithPrevious,
  parseMarkleftDocument,
  replaceDocumentBlock,
  serializeMarkleftDocument,
  type MarkleftAnnotationIndex,
  type MarkleftDocument,
  type MarkleftDocumentBlock,
  type MarkleftDocumentOptions,
  type MergeImportedBodyOptions,
  type ReplaceBlockOptions,
} from "./document";

export type {
  MarkleftDocumentHost,
  MarkleftDocumentHostCapabilities,
  MarkleftDocumentSnapshot,
  MarkleftDocumentSource,
} from "../host/document-host";

export { composeMarkdown, splitFrontmatter, type MarkdownParts } from "../markdown/frontmatter";

export {
  blockById,
  blockIdForSourceRange,
  documentBlockIds,
  documentHasBlockIds,
  ensureDocumentBlockIds,
  identifiedMarkdownBlocks,
  stripDocumentBlockIds,
  type BlockIdOptions,
  type IdentifiedMarkdownBlock,
} from "../roundtrip/block-ids";

export {
  parseBlockSuggestions,
  parseComments,
  restoreCommentDefinitions,
  unescapeCommentReferences,
  type ParsedBlockSuggestion,
  type ParsedComment,
} from "../markdown/comments";
