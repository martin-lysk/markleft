# Markleft for Superset — parked spike

This is the native Superset plugin adapter. It reuses Markleft's browser editor
through `src/embedded.ts`, while `src/server.ts` provides a workspace-bounded
`MarkleftDocumentHost` over Superset plugin actions.

## Current scope

- Opens a Markdown path inside a Superset pane or sidebar tab.
- Reads and writes the workspace file directly; no browser file picker or
  download fallback is involved.
- Preserves Markleft annotations and block ids because the editor core and its
  serialization are shared with the bookmarklet.
- Provisions a Markleft review skill to every enabled agent.

The upstream plugin API is currently in [Superset PR #6526](https://github.com/superset-sh/superset/pull/6526), not released. The adapter is intentionally kept here as source until that API lands.

## Resume checklist

1. Confirm that PR #6526 has merged and identify the first Superset release
   that includes its plugin SDK. Update the plugin manifest with that real
   `minSupersetVersion`.
2. Run the development commands below against that release. Confirm that the
   pane, sidebar tab, command-palette entry, plugin skill, and `superset x
   markleft-status` action all register successfully.
3. Exercise direct save on a Markdown document in a real worktree, including
   a document with Markleft comments, suggestions, images, and block IDs.
   Verify the resulting file has no metadata loss and cannot escape the active
   workspace through a relative or absolute path.
4. Replace the temporary path field with the best released file-context hook.
   The desired end state is for opening a Markdown file to offer Markleft
   naturally; PR #6526 currently documents panes and commands, but not a
   replacement for Superset's default file editor.
5. When Superset publishes an agent launch/message API for plugins, implement
   the existing `address-annotations` seam in `src/server.ts`. The finished
   flow is: **Save → Address annotations → selected workspace agent receives
   the prompt**. Do not present that action as delivered until the host API
   confirms it.
6. Add an end-to-end Superset plugin test, then publish this adapter as its own
   `superset-plugin` repository or decide to keep it in the Markleft monorepo.

## Development once the API lands

```sh
pnpm build
cd integrations/superset
superset plugin build .
superset plugin link .
```

Then open `Markleft: Open Markdown review` from Superset's command palette.

## Agent handoff

The proposed SDK currently has no public plugin API to launch an agent or send it
a message. The editor's `addressAnnotations` callback and the backend
`address-annotations` action are the deliberate seam for that future capability.
Until Superset exposes it, direct save works, but the plugin must not claim that
it has sent the prompt to an agent.
