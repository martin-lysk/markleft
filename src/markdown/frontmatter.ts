export interface MarkdownParts {
  frontmatter: string;
  body: string;
}

const frontmatterFence = "---";

export function splitFrontmatter(markdown: string): MarkdownParts {
  const cleanMarkdown = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!cleanMarkdown.startsWith(`${frontmatterFence}\n`)) {
    return { frontmatter: "", body: cleanMarkdown };
  }

  const lines = cleanMarkdown.split("\n");
  const closingIndex = lines.findIndex((line, index) => index > 0 && line.trim() === frontmatterFence);
  if (closingIndex === -1) {
    return { frontmatter: "", body: cleanMarkdown };
  }

  const frontmatter = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n").replace(/^\n/, "");
  return { frontmatter, body };
}

export function composeMarkdown(parts: MarkdownParts): string {
  const frontmatter = parts.frontmatter.trim();
  if (!frontmatter) return parts.body;
  return `${frontmatterFence}\n${frontmatter}\n${frontmatterFence}\n\n${parts.body}`;
}

