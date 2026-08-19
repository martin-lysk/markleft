import type { MarkleftDocumentHost } from "./document-host";

export interface DocumentAssetResolution {
  unresolvedRelativeSources: string[];
}

/** Resolve local Markdown image sources only when the active host owns that capability. */
export async function resolveDocumentAssets(
  root: HTMLElement,
  host: MarkleftDocumentHost | undefined,
  options: { showUnavailablePlaceholders?: boolean } = {},
): Promise<DocumentAssetResolution> {
  if (!host?.resolveAsset) return { unresolvedRelativeSources: [] };
  const unresolved = new Set<string>();
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(async (image) => {
      const source = image.getAttribute("src");
      if (!source || !isRelativeAssetSource(source)) return;
      const resolved = await host.resolveAsset?.(source);
      if (resolved) {
        image.src = resolved;
        return;
      }
      unresolved.add(source);
      if (options.showUnavailablePlaceholders) installUnavailableAssetPlaceholder(image, source);
    }),
  );
  return { unresolvedRelativeSources: [...unresolved] };
}

function isRelativeAssetSource(value: string): boolean {
  return (
    !value.startsWith("#") &&
    !value.startsWith("/") &&
    !value.startsWith("//") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

function installUnavailableAssetPlaceholder(image: HTMLImageElement, source: string): void {
  const alt = image.getAttribute("alt")?.trim() || "Local image";
  image.dataset.markleftAssetPlaceholder = "true";
  image.dataset.markleftAssetSource = source;
  image.src = unavailableAssetSvg(alt, source);
  image.alt = `Markleft needs project-folder access to load: ${alt}`;
  image.title = `Grant project-folder access to load ${source}`;
}

function unavailableAssetSvg(alt: string, source: string): string {
  const truncate = (value: string, length: number) =>
    value.length > length ? `${value.slice(0, Math.max(0, length - 1))}…` : value;
  const title = escapeSvg(truncate(alt, 72));
  const path = escapeSvg(truncate(source, 92));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 240" role="img" aria-label="Local image needs project access"><rect width="960" height="240" rx="18" fill="#f4f1e8"/><rect x="1" y="1" width="958" height="238" rx="17" fill="none" stroke="#d9d1c2" stroke-width="2"/><path d="M90 77h72v58H90zM101 122l18-20 15 17 10-10 18 22" fill="none" stroke="#7b5535" stroke-width="8" stroke-linejoin="round"/><text x="202" y="104" fill="#19202a" font-family="system-ui, sans-serif" font-size="28" font-weight="700">Can’t load local image resources yet</text><text x="202" y="143" fill="#5f5b55" font-family="system-ui, sans-serif" font-size="22">Grant Markleft read access to this project folder.</text><text x="90" y="198" fill="#7b5535" font-family="ui-monospace, monospace" font-size="18">${title} · ${path}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function escapeSvg(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}
