import {
  decodeHtmlCommentBody,
  renderHtmlCommentBlocks,
  restoreRenderedHtmlCommentBlocks,
  restoreRenderedHtmlCommentElements,
} from "../src/roundtrip/artifacts/html-comment";
import { JSDOM } from "jsdom";

test("renders raw HTML comments as protected visible blocks", () => {
  const html = "<p>Before</p><!-- truncate --><p>After</p>";
  const rendered = renderHtmlCommentBlocks(html);

  expect(rendered).toContain('class="local-md-html-comment-block"');
  expect(rendered).toContain('data-local-md-html-comment="%20truncate%20"');
  expect(rendered).toContain("&lt;!-- truncate --&gt;");
  expect(rendered).toContain('contenteditable="false"');
});

test("restores protected HTML comment blocks from serialized HTML", () => {
  const html = [
    "<p>Before</p>",
    '<div class="local-md-html-comment-block" data-local-md-html-comment="%20truncate%20" contenteditable="false">',
    "<span>HTML comment</span><code>&lt;!-- truncate --&gt;</code>",
    "</div>",
    "<p>After</p>",
  ].join("");

  expect(restoreRenderedHtmlCommentBlocks(html)).toContain("<!-- truncate -->");
});

test("restores protected HTML comment DOM elements before Markdown sync", () => {
  const root = new JSDOM("<div></div>").window.document.querySelector("div");
  if (!root) throw new Error("Expected root element");
  root.innerHTML = [
    "<p>Before</p>",
    '<div class="local-md-html-comment-block" data-local-md-html-comment="%20truncate%20" contenteditable="false">',
    "<span>HTML comment</span><code>&lt;!-- truncate --&gt;</code>",
    "</div>",
    "<p>After</p>",
  ].join("");

  restoreRenderedHtmlCommentElements(root);

  expect(root.innerHTML).toContain("<!-- truncate -->");
  expect(root.textContent).not.toContain("<!-- truncate -->");
  expect(root.querySelector(".local-md-html-comment-block")).toBeNull();
});

test("falls back to undecoded HTML comment body when URI decoding fails", () => {
  expect(decodeHtmlCommentBody("%")).toBe("%");
});
