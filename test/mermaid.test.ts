import { JSDOM } from "jsdom";

import { restoreMermaidDiagrams } from "../src/editor/mermaid";

test("restores rendered Mermaid figures to editable code blocks before Markdown sync", () => {
  const dom = new JSDOM(`<main></main>`);
  const root = dom.window.document.querySelector("main");
  if (!root) throw new Error("Missing test root.");

  const figure = dom.window.document.createElement("figure");
  figure.className = "local-md-mermaid";
  figure.dataset.localMdMermaidSource = "flowchart LR\n  A[Start] --> B[Done]";
  figure.innerHTML = `<div class="local-md-mermaid-output"><svg></svg></div>`;
  root.append(figure);

  restoreMermaidDiagrams(root);

  const code = root.querySelector("pre > code.language-mermaid");
  expect(code?.textContent).toBe("flowchart LR\n  A[Start] --> B[Done]");
  expect(root.querySelector(".local-md-mermaid")).toBeNull();
});
