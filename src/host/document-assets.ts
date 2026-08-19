import type { MarkleftDocumentHost } from "./document-host";

/** Resolve local Markdown image sources only when the active host owns that capability. */
export async function resolveDocumentAssets(
  root: HTMLElement,
  host: MarkleftDocumentHost | undefined,
): Promise<void> {
  if (!host?.resolveAsset) return;
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(async (image) => {
      const source = image.getAttribute("src");
      if (!source || !isRelativeAssetSource(source)) return;
      const resolved = await host.resolveAsset?.(source);
      if (resolved) image.src = resolved;
    }),
  );
}

function isRelativeAssetSource(value: string): boolean {
  return !value.startsWith("#") && !value.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(value);
}
