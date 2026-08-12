type NodeLike = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: NodeLike[];
  value?: string;
};

const blockedTags = new Set(["script", "iframe", "style", "object", "embed"]);
const wrapperClasses = new Set(["local-md-shell", "local-md-toolbar", "local-md-transient"]);
const semanticAttributes = new Set(["href", "src", "alt", "title", "checked"]);
const rawHtmlBlockSelector = "[data-local-md-raw-html]";

export function normalizeElement(root: Element): void {
  root.querySelectorAll("script, iframe, style, object, embed").forEach((node) => node.remove());
  root
    .querySelectorAll("[data-local-md-wrapper], [data-caret-marker], .local-md-transient")
    .forEach((node) => node.remove());

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const keep =
        semanticAttributes.has(attribute.name) ||
        attribute.name === "data-checked" ||
        attribute.name === "data-local-md-raw-html" ||
        attribute.name === "class";
      if (attribute.name.startsWith("on") || attribute.name === "style" || !keep) {
        element.removeAttribute(attribute.name);
      }
    }

    const className = element.getAttribute("class");
    if (className && className.split(/\s+/).some((name) => wrapperClasses.has(name))) {
      element.remove();
    } else if (className === "") {
      element.removeAttribute("class");
    }
  });

  root.querySelectorAll("p div").forEach((node) => {
    if (node.matches(rawHtmlBlockSelector)) return;
    const paragraph = node.parentElement;
    if (!paragraph) return;
    while (node.firstChild) paragraph.insertBefore(node.firstChild, node);
    node.remove();
  });

  root.querySelectorAll("div").forEach((node) => {
    if (node === root || node.matches(rawHtmlBlockSelector)) return;
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    node.remove();
  });

  root.querySelectorAll("br + br").forEach((node) => node.remove());
  root.querySelectorAll("p:empty, div:empty").forEach((node) => node.remove());
}

export function normalizedFragmentHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const wrapper = document.createElement("div");
  wrapper.append(template.content.cloneNode(true));
  normalizeElement(wrapper);
  return wrapper.innerHTML.replace(/\s+/g, " ").trim();
}

export function normalizeHtml(tree: unknown): unknown {
  visit(tree as NodeLike);
  return tree;
}

function visit(node: NodeLike): void {
  if (!node.children) return;
  node.children = node.children.filter((child) => {
    if (child.type === "element") {
      const tag = String(child.tagName ?? "").toLowerCase();
      if (blockedTags.has(tag) || isEditorWrapper(child)) return false;
      cleanProperties(child);
    }
    visit(child);
    return !isEmptyTransient(child);
  });
}

function isEditorWrapper(node: NodeLike): boolean {
  const properties = node.properties ?? {};
  return Object.keys(properties).some(
    (key) => key === "dataLocalMdWrapper" || key === "data-local-md-wrapper",
  );
}

function cleanProperties(node: NodeLike): void {
  const properties = node.properties ?? {};
  for (const key of Object.keys(properties)) {
    const lower = key.toLowerCase();
    if (
      lower === "style" ||
      lower.startsWith("on") ||
      lower === "contenteditable" ||
      lower === "data-testid" ||
      lower === "data-local-md-wrapper" ||
      lower === "data-caret-marker"
    ) {
      delete properties[key];
    }
  }
  node.properties = properties;
}

function isEmptyTransient(node: NodeLike): boolean {
  if (node.type !== "element") return false;
  const tag = String(node.tagName ?? "").toLowerCase();
  return (tag === "br" || tag === "div") && (node.children?.length ?? 0) === 0;
}
