import { styles } from "./styles";
import { mountApp, type MarkleftMountOptions } from "./ui";

/** Mount Markleft inside a DOM element owned by another product. */
export async function mountMarkleft(
  root: HTMLElement,
  markdown: string,
  options: Omit<MarkleftMountOptions, "root"> = {},
): Promise<void> {
  const ownerDocument = root.ownerDocument;
  if (!ownerDocument.head.querySelector("style[data-markleft-embedded]")) {
    const style = ownerDocument.createElement("style");
    style.dataset.markleftEmbedded = "true";
    style.textContent = styles;
    ownerDocument.head.append(style);
  }
  await mountApp(markdown, false, { ...options, root });
}

export type { MarkleftMountOptions } from "./ui";
