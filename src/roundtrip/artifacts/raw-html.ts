type NodeLike = {
  type?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: NodeLike[];
  position?:
    | {
        start?: { offset?: number | undefined } | undefined;
        end?: { offset?: number | undefined } | undefined;
      }
    | undefined;
};

const rawHtmlPropertyNames = ["dataLocalMdRawHtml", "data-local-md-raw-html"];
const tokenPrefix = "LOCALMDRAWHTMLARTIFACT";

export function preserveRawHtmlBlocks(sourceMarkdown = "") {
  return (tree: NodeLike): void => {
    visitMarkdown(tree, null, sourceMarkdown);
  };
}

export function extractPreservedRawHtmlBlocks(sources: string[]) {
  return (tree: NodeLike): void => {
    visitHtml(tree, sources);
  };
}

export function restorePreservedRawHtmlTokens(markdown: string, sources: string[]): string {
  return sources.reduce(
    (result, source, index) => result.replaceAll(rawHtmlToken(index), source),
    markdown,
  );
}

function visitMarkdown(node: NodeLike, parent: NodeLike | null, sourceMarkdown: string): void {
  preserveSplitRawHtmlBlocks(node, sourceMarkdown);

  if (
    node.type === "html" &&
    typeof node.value === "string" &&
    shouldPreserve(node.value, parent)
  ) {
    const source = node.value;
    node.value = `${rawHtmlWrapperStart(source)}${source}</div>`;
    return;
  }

  for (const child of node.children ?? []) visitMarkdown(child, node, sourceMarkdown);
}

function preserveSplitRawHtmlBlocks(node: NodeLike, sourceMarkdown: string): void {
  const children = node.children;
  if (!children || sourceMarkdown.length === 0 || node.type === "paragraph") return;

  for (let startIndex = 0; startIndex < children.length; startIndex += 1) {
    const first = children[startIndex];
    if (first?.type !== "html" || typeof first.value !== "string" || /^\s*<!--/.test(first.value))
      continue;
    const tag = /^\s*<([A-Za-z][\w:-]*)(?:\s[^>]*)?>/i.exec(first.value)?.[1];
    if (!tag) continue;

    let depth = tagDepth(first.value, tag);
    if (depth <= 0) continue;

    for (let endIndex = startIndex + 1; endIndex < children.length; endIndex += 1) {
      const last = children[endIndex];
      if (last?.type !== "html" || typeof last.value !== "string") continue;
      depth += tagDepth(last.value, tag);
      if (depth > 0) continue;

      const start = first.position?.start?.offset;
      const end = last.position?.end?.offset;
      if (start === undefined || end === undefined || end <= start) break;
      const source = sourceMarkdown.slice(start, end);
      first.value = `${rawHtmlWrapperStart(source)}${first.value}`;
      last.value = `${last.value}</div>`;
      startIndex = endIndex;
      break;
    }
  }
}

function visitHtml(node: NodeLike, sources: string[]): void {
  if (!node.children) return;

  node.children = node.children.map((child) => {
    if (child.type === "element") {
      const encoded = rawHtmlPropertyNames
        .map((name) => child.properties?.[name])
        .find((value): value is string => typeof value === "string");
      if (encoded !== undefined) {
        const index = sources.push(decodeRawHtml(encoded)) - 1;
        return { type: "text", value: rawHtmlToken(index) };
      }
    }

    visitHtml(child, sources);
    return child;
  });
}

function shouldPreserve(source: string, parent: NodeLike | null): boolean {
  if (parent?.type === "paragraph" || /^\s*<!--/.test(source)) return false;
  const outerElement = /^\s*<([A-Za-z][\w:-]*)(?:\s[^>]*)?>[\s\S]*<\/\1>\s*$/i.exec(source);
  return Boolean(outerElement);
}

function rawHtmlWrapperStart(source: string): string {
  return `<div class="local-md-raw-html-block" data-local-md-raw-html="${encodeURIComponent(source)}" contenteditable="false">`;
}

function tagDepth(source: string, tag: string): number {
  const escapedTag = escapeRegExp(tag);
  const opening = source.match(new RegExp(`<${escapedTag}(?=[\\s>])`, "gi"))?.length ?? 0;
  const closing = source.match(new RegExp(`</${escapedTag}\\s*>`, "gi"))?.length ?? 0;
  return opening - closing;
}

function rawHtmlToken(index: number): string {
  return `${tokenPrefix}${index}TOKEN`;
}

function decodeRawHtml(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
