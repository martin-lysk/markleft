import { isFallbackGuide, loadMarkdown } from "./file/load";
import { styles } from "./styles";
import { mountApp } from "./ui";

export async function start(development: boolean): Promise<void> {
  const style = document.createElement("style");
  style.textContent = styles;
  document.head.append(style);
  await mountApp(loadMarkdown(document), development, {
    isFallbackGuide: isFallbackGuide(document),
  });
  window.dispatchEvent(new Event("markleft:ready"));
}
