import { buildAddressAnnotationsPrompt } from "../src/host/prompt-builder";

test("builds a document-scoped instruction without relying on a browser host", () => {
  const prompt = buildAddressAnnotationsPrompt({ documentPath: "/workspace/draft.md" });

  expect(prompt).toContain("Markdown file:\n/workspace/draft.md");
  expect(prompt).toContain("This is an edit task, not a read-only review");
  expect(prompt).toContain("Do not modify, replace, delete, or reorder any existing document body content");
  expect(prompt).toContain("ensure each one is addressed by at least one appended reply or suggestion");
  expect(prompt).toContain("Finish only after the appended reply and suggestion definitions have been written");
});
