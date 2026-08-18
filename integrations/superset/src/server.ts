import { readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import type { PluginActionContext, SupersetPluginApi } from "@superset/plugin-sdk";

interface DocumentParams {
  path?: unknown;
  markdown?: unknown;
}

function documentPath(params: unknown): string {
  const value = (params as DocumentParams | null)?.path;
  if (typeof value !== "string" || !value.trim()) throw new Error("A Markdown path is required.");
  return value;
}

async function workspacePath(api: SupersetPluginApi, context: PluginActionContext): Promise<string> {
  if (!context.workspaceId) throw new Error("Markleft must be opened from a workspace.");
  const workspace = (await api.workspaces.list()).find(({ id }) => id === context.workspaceId);
  if (!workspace) throw new Error("The current workspace is no longer available.");
  return workspace.worktreePath;
}

async function resolveWorkspaceFile(
  api: SupersetPluginApi,
  context: PluginActionContext,
  requestedPath: string,
): Promise<string> {
  const worktreePath = await workspacePath(api, context);
  const target = resolve(worktreePath, requestedPath);
  const fromWorkspace = relative(worktreePath, target);
  if (fromWorkspace === "" || fromWorkspace === ".." || fromWorkspace.startsWith(`..${sep}`)) {
    throw new Error("The document must stay inside the current workspace.");
  }
  if (!/\.mdx?$/i.test(target)) throw new Error("Markleft only opens Markdown files.");
  return target;
}

async function snapshot(path: string) {
  const [markdown, file] = await Promise.all([readFile(path, "utf8"), stat(path)]);
  return { markdown, revision: `${file.mtimeMs}:${file.size}` };
}

export default async function plugin(api: SupersetPluginApi) {
  api.log("Markleft Superset adapter loaded");

  api.actions.register("read-document", async (params, context) => {
    return snapshot(await resolveWorkspaceFile(api, context, documentPath(params)));
  });

  api.actions.register("write-document", async (params, context) => {
    const requestedPath = documentPath(params);
    const markdown = (params as DocumentParams | null)?.markdown;
    if (typeof markdown !== "string") throw new Error("Markdown contents are required.");
    const target = await resolveWorkspaceFile(api, context, requestedPath);
    await writeFile(target, markdown, "utf8");
    return snapshot(target);
  });

  // The proposed SDK does not yet expose an agent-message or agent-launch API.
  // Keeping this action explicit gives us a stable seam when that API arrives.
  api.actions.register("address-annotations", async (params, context) => {
    const prompt = (params as { prompt?: unknown } | null)?.prompt;
    if (typeof prompt !== "string") throw new Error("A review prompt is required.");
    api.realtime.publish({ type: "markleft.agent-handoff", prompt, workspaceId: context.workspaceId });
    return { delivered: false, reason: "Superset does not yet expose agent messaging to plugins." };
  });

  api.actions.register("status", async () => ({ ok: true, plugin: "markleft.editor" }));
}
