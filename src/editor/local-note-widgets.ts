const localNoteRef =
  /\[\^((?:range-(?:prev|next)-\d+-chars-\d{1,5}-[0-9a-fA-F]{4})|(?:block-\d{1,5}-[0-9a-fA-F]{4})|(?:image-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})|(?:svg-xpath_[A-Za-z0-9.~%-]+_\d{1,5}-[0-9a-fA-F]{4})|(?:svg-[A-Za-z0-9._~-]+-\d{1,5}-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})|(?:code-line-\d{1,5}-col-\d{1,5}-len-\d{1,5}-\d{1,5}-[0-9a-fA-F]{4})|(?:comment-\d{1,5}-[0-9a-fA-F]{4}))\]/g;

export function renderLocalNoteReferenceWidgets(root: HTMLElement): void {
  const document = root.ownerDocument;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        parent?.closest(
          "code,pre,.local-md-comment-anchor,.local-md-image-comment-anchor,section[data-footnotes],[data-local-md-wrapper='true']",
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }
      localNoteRef.lastIndex = 0;
      return localNoteRef.test(node.textContent ?? "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text);

  for (const node of nodes) {
    const text = node.textContent ?? "";
    localNoteRef.lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(localNoteRef)) {
      const start = match.index ?? 0;
      const id = match[1];
      if (!id) continue;
      if (start > cursor) fragment.append(document.createTextNode(text.slice(cursor, start)));
      fragment.append(localNoteReferenceWidget(document, id));
      cursor = start + match[0].length;
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }
}

export function restoreLocalNoteReferenceWidgets(root: HTMLElement): void {
  const document = root.ownerDocument;
  for (const marker of root.querySelectorAll<HTMLElement>(
    ".local-md-comment-anchor[data-comment-id]",
  )) {
    const id = marker.dataset.commentId;
    if (!id) continue;
    marker.replaceWith(document.createTextNode(`[^${id}]`));
  }
}

function localNoteReferenceWidget(document: Document, id: string): HTMLElement {
  const sup = document.createElement("sup");
  sup.className = "local-md-comment-anchor";
  sup.dataset.commentId = id;
  sup.contentEditable = "false";
  sup.textContent = "•";
  return sup;
}
