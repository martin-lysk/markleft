/**
 * The portable document boundary used by every Markleft surface.
 *
 * Browser files, Superset documents, and desktop-app workspaces expose their
 * own persistence APIs behind this small contract. The editor core only needs
 * Markdown snapshots and optional change notifications.
 */
export interface MarkleftDocumentSnapshot {
  markdown: string;
  revision?: string;
}

export interface MarkleftDocumentHostCapabilities {
  canWatch: boolean;
  canResolveAssets: boolean;
  canInvokeAgent: boolean;
  /** Omitted by older adapters; treated as writable for backward compatibility. */
  canWrite?: boolean;
}

export type MarkleftDocumentSource =
  | { kind: "local-project" }
  | { kind: "browser-page"; url: string }
  | { kind: "http"; requestedUrl: string; canonicalUrl: string }
  | { kind: "remote-service"; provider: string; documentId: string };

export interface MarkleftDocumentHost {
  id: string;
  displayName: string;
  capabilities: MarkleftDocumentHostCapabilities;
  source?: MarkleftDocumentSource;
  read(): Promise<MarkleftDocumentSnapshot>;
  write(
    markdown: string,
    options?: { expectedRevision?: string },
  ): Promise<MarkleftDocumentSnapshot>;
  watch?(listener: (snapshot: MarkleftDocumentSnapshot) => void): () => void;
  resolveAsset?(relativePath: string): Promise<string | null>;
}
