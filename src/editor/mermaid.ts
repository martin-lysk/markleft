import mermaid from "mermaid";

let configured = false;
let renderCounter = 0;

export async function renderMermaidDiagrams(root: HTMLElement): Promise<void> {
  ensureMermaidConfigured();
  const codeBlocks = Array.from(root.querySelectorAll<HTMLElement>("pre > code.language-mermaid"));

  for (const [index, code] of codeBlocks.entries()) {
    const pre = code.parentElement;
    if (!(pre instanceof HTMLElement)) continue;

    const source = code.textContent ?? "";
    const figure = root.ownerDocument.createElement("figure");
    const output = root.ownerDocument.createElement("div");
    figure.className = "local-md-mermaid";
    figure.dataset.localMdMermaidSource = source;
    figure.dataset.localMdMermaidIndex = String(index);
    figure.contentEditable = "false";
    output.className = "local-md-mermaid-output";
    output.contentEditable = "false";
    figure.append(output);

    try {
      const id = `local-md-mermaid-${Date.now()}-${renderCounter}`;
      renderCounter += 1;
      const rendered = await mermaid.render(id, source);
      output.innerHTML = rendered.svg;
      rendered.bindFunctions?.(output);
      pre.replaceWith(figure);
    } catch (error) {
      pre.classList.add("local-md-mermaid-error");
      pre.dataset.localMdMermaidError = error instanceof Error ? error.message : "Could not render Mermaid diagram.";
    }
  }
}

export function restoreMermaidDiagrams(root: HTMLElement): void {
  for (const figure of root.querySelectorAll<HTMLElement>(".local-md-mermaid[data-local-md-mermaid-source]")) {
    const source = figure.dataset.localMdMermaidSource ?? "";
    const pre = root.ownerDocument.createElement("pre");
    const code = root.ownerDocument.createElement("code");
    code.className = "language-mermaid";
    code.textContent = source;
    pre.append(code);
    figure.replaceWith(pre);
  }
}

function ensureMermaidConfigured(): void {
  if (configured) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "default",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  });
  configured = true;
}
