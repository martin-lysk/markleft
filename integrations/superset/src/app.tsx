import { useCallback, useEffect, useState } from "react";
import type { PluginSlotProps } from "@superset/plugin-sdk/ui";
import { mountMarkleft } from "../../../src/embedded";
import type { MarkleftDocumentHost } from "../../../src/host/document-host";

type Snapshot = { markdown: string; revision?: string };

function isSnapshot(value: unknown): value is Snapshot {
  return Boolean(value) && typeof (value as Snapshot).markdown === "string";
}

function documentHost(ctx: PluginSlotProps["ctx"], path: string): MarkleftDocumentHost {
  return {
    id: `superset:${ctx.workspaceId}:${path}`,
    displayName: path,
    capabilities: { canWatch: false, canResolveAssets: false, canInvokeAgent: false },
    async read() {
      const result = await ctx.invokeAction("read-document", { path });
      if (!isSnapshot(result)) throw new Error("Superset returned an invalid Markdown document.");
      return result;
    },
    async write(markdown) {
      const result = await ctx.invokeAction("write-document", { path, markdown });
      if (!isSnapshot(result)) throw new Error("Superset did not confirm the save.");
      return result;
    },
  };
}

function MarkleftSurface({ ctx }: PluginSlotProps) {
  const [path, setPath] = useState("README.md");
  const [error, setError] = useState<string | null>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  const open = useCallback(async () => {
    if (!root) return;
    try {
      setError(null);
      const host = documentHost(ctx, path);
      const document = await host.read();
      await mountMarkleft(root, document.markdown, {
        documentHost: host,
        documentPath: path,
        addressAnnotations: async (prompt) => {
          const result = await ctx.invokeAction("address-annotations", { prompt });
          if ((result as { delivered?: boolean } | null)?.delivered !== true) {
            throw new Error("Agent handoff will be enabled when Superset exposes its agent messaging API.");
          }
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the Markdown document.");
    }
  }, [ctx, path, root]);

  useEffect(() => {
    if (root) void open();
    // Open README once when the pane is first mounted. Subsequent path changes
    // are deliberate form submissions, not editor reloads on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, flexDirection: "column" }}>
      <form
        onSubmit={(event) => { event.preventDefault(); void open(); }}
        style={{ display: "flex", gap: 8, padding: 8, borderBottom: "1px solid var(--border, #8884)" }}
      >
        <input aria-label="Markdown path" value={path} onChange={(event) => setPath(event.target.value)} style={{ flex: 1 }} />
        <button type="submit">Open</button>
      </form>
      {error && <div role="alert" style={{ padding: 8, color: "var(--destructive, #c33)" }}>{error}</div>}
      <div ref={setRoot} style={{ minHeight: 0, flex: 1, overflow: "auto" }} />
    </div>
  );
}

export function MarkleftPane(props: PluginSlotProps) {
  return <MarkleftSurface {...props} />;
}

export function MarkleftTab(props: PluginSlotProps) {
  return <MarkleftSurface {...props} />;
}
