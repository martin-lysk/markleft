export function serializeFile(markdown: string): string {
  return markdown.replace(/^\uFEFF/, "");
}
