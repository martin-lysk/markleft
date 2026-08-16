import { createMarkdownHistory } from "../src/editor/markdown-history";

test("records, undoes, redoes, and replaces Markdown snapshots", () => {
  const history = createMarkdownHistory("first");

  history.commit("second");
  history.commit("third");
  expect(history.undo()).toBe("second");
  history.replace("second revised");
  expect(history.redo()).toBe("third");
  expect(history.undo()).toBe("second revised");

  history.commit("alternate");
  expect(history.redo()).toBeNull();
  expect(history.entries).toEqual(["first", "second revised", "alternate"]);
});
