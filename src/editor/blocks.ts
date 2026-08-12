export function makeEditable(root: HTMLElement): void {
  root.contentEditable = "true";
  root.spellcheck = true;
  root.querySelectorAll("pre code").forEach((code) => {
    code.parentElement?.setAttribute("contenteditable", "true");
  });
}

export function currentBlockId(root: HTMLElement): string | null {
  const selection = root.ownerDocument.getSelection();
  const anchor = selection?.anchorNode;
  if (!anchor) return null;
  const element =
    anchor.nodeType === Node.ELEMENT_NODE
      ? (anchor as Element)
      : (anchor.parentElement as Element | null);
  return element?.closest<HTMLElement>("[data-block-id]")?.dataset.blockId ?? null;
}

const sourceBlockSelector =
  "h1,h2,h3,h4,h5,h6,p,ul,ol,pre,table,blockquote,figure.local-md-mermaid";

export function stampBlocks(root: HTMLElement, persistentIds: Array<string | null> = []): void {
  let index = 0;
  root
    .querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,ul,ol,li,pre,table,td,th,blockquote,figure.local-md-mermaid",
    )
    .forEach((block) => {
      block.dataset.blockId = `block-${index}`;
      index += 1;
    });
  topLevelSourceBlocks(root).forEach((block, blockIndex) => {
    const persistentId = persistentIds[blockIndex];
    if (persistentId) block.dataset.blockId = persistentId;
  });
}

export function injectPersistentBlockIdComments(root: HTMLElement): void {
  for (const block of topLevelSourceBlocks(root)) {
    const id = block.dataset.blockId;
    if (!id || !/^b[a-zA-Z0-9]+$/.test(id)) continue;
    const target = block.closest<HTMLElement>("[data-local-md-raw-html]") ?? block;
    target.before(root.ownerDocument.createComment(` markleft:block id="${id}" `));
  }
}

export function topLevelSourceBlocks(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(sourceBlockSelector)).filter((block) => {
    if (block.closest("section[data-footnotes], .local-md-review-suggestion")) return false;
    return !block.parentElement?.closest(sourceBlockSelector);
  });
}
