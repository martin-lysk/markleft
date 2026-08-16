import { composeMarkdown, splitFrontmatter } from "../core";

export interface EditorDocumentState {
  markdown: string;
  frontmatter: string;
  body: string;
  dirty: boolean;
  syncCount: number;
}

/** Creates the host-neutral document state used by the editor controller. */
export function createEditorDocumentState(markdown: string): EditorDocumentState {
  const parts = splitFrontmatter(markdown);
  return {
    markdown: composeMarkdown(parts),
    frontmatter: parts.frontmatter,
    body: parts.body,
    dirty: false,
    syncCount: 0,
  };
}
