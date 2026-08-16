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
}

export interface MarkleftDocumentHost {
  id: string;
  displayName: string;
  capabilities: MarkleftDocumentHostCapabilities;
  read(): Promise<MarkleftDocumentSnapshot>;
  write(
    markdown: string,
    options?: { expectedRevision?: string },
  ): Promise<MarkleftDocumentSnapshot>;
  watch?(listener: (snapshot: MarkleftDocumentSnapshot) => void): () => void;
  resolveAsset?(relativePath: string): Promise<string | null>;
}
