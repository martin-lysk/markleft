const htmlCommentBlockSelector = "[data-local-md-html-comment]";

export function renderHtmlCommentBlocks(html: string): string {
  return html.replace(/<!--([\s\S]*?)-->/g, (_, body: string) => {
    const comment = `<!--${body}-->`;
    return `<div class="local-md-html-comment-block" data-local-md-html-comment="${encodeURIComponent(body)}" contenteditable="false"><span>HTML comment</span><code>${escapeHtml(comment)}</code></div>`;
  });
}

export function restoreRenderedHtmlCommentBlocks(html: string): string {
  return html.replace(
    /<div\b(?=[^>]*\bdata-local-md-html-comment="([^"]*)")[^>]*>[\s\S]*?<\/div>/gi,
    (_, encoded: string) => `\n\n<!--${decodeHtmlCommentBody(encoded)}-->\n\n`,
  );
}

export function restoreRenderedHtmlCommentElements(rendered: HTMLElement): void {
  const document = rendered.ownerDocument;
  for (const block of rendered.querySelectorAll<HTMLElement>(htmlCommentBlockSelector)) {
    const body = decodeHtmlCommentBody(block.dataset.localMdHtmlComment ?? "");
    block.replaceWith(
      document.createTextNode("\n\n"),
      document.createComment(body),
      document.createTextNode("\n\n"),
    );
  }
}

export function decodeHtmlCommentBody(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
