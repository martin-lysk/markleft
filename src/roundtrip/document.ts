// Compatibility entry point. New host-neutral consumers should import from ../core.
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
} from "../core/document";
