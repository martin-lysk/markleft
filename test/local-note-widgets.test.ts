// @vitest-environment jsdom

import {
  renderLocalNoteReferenceWidgets,
  restoreLocalNoteReferenceWidgets,
} from "../src/editor/local-note-widgets";

test("renders literal local note refs as atomic comment widgets and restores them", () => {
  const root = document.createElement("div");
  root.innerHTML =
    '<p>Neither is a pers-chsang[^range-prev-5-chars-27698-49b2]e decision. <code>test[^range-prev-2-chars-29413-4b52]</code></p><pre><code>[^range-prev-5-chars-27698-49b2]</code></pre>';

  renderLocalNoteReferenceWidgets(root);

  const marker = root.querySelector<HTMLElement>(".local-md-comment-anchor");
  expect(marker?.dataset.commentId).toBe("range-prev-5-chars-27698-49b2");
  expect(marker?.contentEditable).toBe("false");
  expect(root.querySelector("p")?.textContent).toBe("Neither is a pers-chsang•e decision. test•");
  expect(root.querySelector("p code")?.textContent).toBe("test•");
  expect(root.querySelector("pre code")?.textContent).toBe("[^range-prev-5-chars-27698-49b2]");

  restoreLocalNoteReferenceWidgets(root);

  expect(root.querySelector("p")?.textContent).toBe(
    "Neither is a pers-chsang[^range-prev-5-chars-27698-49b2]e decision. test[^range-prev-2-chars-29413-4b52]",
  );
  expect(root.querySelector(".local-md-comment-anchor")).toBeNull();
});
