import { bootstrapSelector, serializedBootstrapSelector } from "../constants";

export function loadMarkdown(doc: Document = document): string {
  const frontmatter = readPreludeFrontmatter(doc);
  const source = doc.querySelector<HTMLTextAreaElement>(
    `${bootstrapSelector}, ${serializedBootstrapSelector}`,
  );
  const body = source?.value.replace(/^\n/, "") ?? "";
  return `${frontmatter}${body}`;
}

export function isFallbackGuide(doc: Document = document): boolean {
  return (
    doc.querySelector('meta[name="local-md-source"]')?.getAttribute("data-source-kind") ===
    "no-markdown-guide"
  );
}

function readPreludeFrontmatter(doc: Document): string {
  const script = doc.querySelector<HTMLScriptElement>('script[src$="local-md.js"]');
  if (!script?.parentNode) return "";

  let text = "";
  for (const node of Array.from(script.parentNode.childNodes)) {
    if (node === script) break;
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
    }
  }

  const normalized = text.replace(/\r\n?/g, "\n").trimStart();
  if (!normalized.startsWith("---\n")) return "";

  const lines = normalized.split("\n");
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closingIndex === -1) return "";

  return `${lines.slice(0, closingIndex + 1).join("\n")}\n\n`;
}
