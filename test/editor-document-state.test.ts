import { createEditorDocumentState } from "../src/editor/document-state";

test("creates normalized, host-neutral editor document state", () => {
  const state = createEditorDocumentState("\uFEFF---\r\ntitle: Draft\r\n---\r\n\r\n# Heading\r\n");

  expect(state).toEqual({
    markdown: "---\ntitle: Draft\n---\n\n# Heading\n",
    frontmatter: "title: Draft",
    body: "# Heading\n",
    dirty: false,
    syncCount: 0,
  });
});
