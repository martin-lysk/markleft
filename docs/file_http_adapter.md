# Markleft document and HTTP adapters

## Purpose

Markleft must be able to open the same Markdown through several entry points without teaching the editor core where its document or image bytes came from:

- a local file opened by the installed PWA;
- a Markdown page already open in the browser, enhanced by the bookmarklet;
- a remote Markdown URL opened explicitly, for example `?httpPath=https%3A%2F%2Fraw.githubusercontent.com%2Fowner%2Frepo%2Fref%2Fdocs%2Freview.md`;
- later, a remote service that supports authenticated, conflict-aware saves.

The rendered document may use different mechanisms for an image in each case. The Markdown source must not be silently rewritten merely because its display source changes.

## Product rule

**The editor owns Markdown; an adapter owns document identity, persistence, asset resolution, and access prompts.**

The current `MarkleftDocumentHost` is the first version of this seam. Future work should evolve it carefully rather than put PWA-, URL-, or bookmarklet-specific checks into `src/ui.ts`.

```text
                 Markleft editor core
      Markdown, comments, suggestions, rendering, round-trip
                              |
                  document + asset adapter
       _________|___________|______________
      |                     |              |
 Local project          Browser page    Remote HTTP document
 File handles           file:/http(s)    fetch + URL base
 blob: image URLs       normal img URLs  normal img URLs / blobs
```

## Stable document identity

An opened document needs a source descriptor separate from its Markdown content. It is used for recents, conflict handling, source badges, and deciding how a relative asset is resolved.

```ts
type DocumentSource =
  | { kind: "local-file"; fileHandle: FileSystemFileHandle }
  | { kind: "browser-page"; url: string }
  | { kind: "http"; requestedUrl: string; canonicalUrl: string }
  | { kind: "remote-service"; provider: string; documentId: string };
```

`canonicalUrl` is the final `Response.url` after redirects. It, not the query parameter text, is the base URL for relative references in a remote Markdown document.

For GitHub documents, the adapter also accepts the normal repository URL (`https://github.com/<owner>/<repo>/blob/<ref>/<path>.md`). Before fetching, it translates that URL to `https://raw.githubusercontent.com/<owner>/<repo>/<ref>/<path>.md`; the original URL remains recorded as `requestedUrl`. This means links copied from GitHub work directly, while relative images resolve beside the actual Markdown source.

The source descriptor is local application state. It is never inserted into Markdown and it must never be sent to a remote service unless the user initiates that operation.

## Asset resolution is source-specific

Every rendered image keeps two values:

1. **source reference** — exactly what the Markdown contained, such as `../images/flow.svg`;
2. **display URL** — the safe URL the browser actually loads, such as a `blob:` URL or an absolute HTTPS URL.

Saving serializes only the source reference. Blob URLs, generated export paths, and resolved remote URLs must never leak into the Markdown unless the user explicitly approves a migration/rewrite operation.

| Source | Relative image behavior | Display URL | Save behavior |
| --- | --- | --- | --- |
| PWA local project | Resolve against a verified granted project tree | `blob:` URL from a `FileSystemFileHandle` | Direct file write; retain original relative reference |
| Bookmarklet on `file:` page | Browser already has the document URL as its base | Native relative `img` URL | Existing bookmarklet behavior; retain source |
| Bookmarklet on HTTP page | Browser resolves against the page’s final URL | Native relative/absolute `img` URL | Existing save flow, if available |
| Remote HTTP adapter | Resolve with `new URL(reference, canonicalUrl)` | Normally absolute HTTPS URL | Read-only until user chooses a save destination or remote provider |
| Remote writable adapter | Provider-specific resolution/authentication | Provider URL or short-lived blob URL | Conditional update with conflict detection |

The core should ask an adapter to resolve an asset instead of assuming every relative source needs a folder handle. A later return type can carry richer state than the current `string | null`, for example `ready`, `needs-project-access`, `not-found`, `blocked`, or `remote-error`.

## Local project access tree

The PWA starts with an exact Markdown `FileSystemFileHandle`, often without a folder handle. It must restore previously granted folders before asking for more access.

1. Restore remembered directory handles and their index entries from IndexedDB.
2. Try the indexed relative document path in each folder.
3. Confirm the result using `isSameEntry(openedFileHandle)`.
4. If an index entry is stale, rescan only that previously granted folder for candidate files with the same filename, again confirming identity.
5. The widest verified granted ancestor containing the document becomes the current project root.
6. Resolve `.` and `..` from the document’s verified relative location, rejecting only paths that escape the widest available root.
7. If no granted root contains the document, show the explicit folder-access prompt.

This is a virtual, permission-aware tree: it represents only folders the user explicitly selected. Browser APIs do not expose an absolute path or a parent handle, so Markleft proves containment by searching downward inside already granted or newly selected folders. A later selected parent folder can be promoted to the project root after it is proven to contain the same Markdown file.

The index is a performance hint, not authority. A failed indexed lookup triggers a bounded rescan and index update. File-handle identity remains authoritative.

## Opening remote Markdown

`httpPath` is an intentional fast entry for read-only review. It must not become an automatic fetch based on arbitrary Markdown content.

### Entry contract

- Accept only `https:` in production. `http:` is allowed only for local development with an explicit development flag.
- Parse and validate the parameter before fetching; display the origin and canonical URL in the PWA before or immediately after opening.
- Fetch without implicit credentials and do not put credentials or tokens in the URL.
- Require CORS access. A browser-only PWA cannot bypass a server’s CORS policy; a later proxy must be a deliberate product/security decision, never an accidental workaround.
- Use the final redirected response URL as the document base.
- Surface a useful failure for 401/403, CORS, redirects to non-HTTPS, oversized responses, and non-Markdown content.

`raw.githubusercontent.com` is the usual GitHub raw-content host. `raw.github.com` should not be treated as a stable API contract; the adapter should preserve the final URL after any redirect.

### Remote image behavior

For ordinary remote viewing, an image can retain its resolved absolute HTTPS URL in the DOM. Browsers can generally display a cross-origin image without CORS, though Markleft cannot read its bytes or inspect pixels without CORS permission.

Fetching the image into a blob is reserved for cases that require its bytes: offline use, local export, image inspection, or an adapter with authenticated access. A failed image fetch must not change the original Markdown path.

Remote images and Markdown may use query strings and fragments. URL resolution must use standard URL parsing rather than path string manipulation:

```ts
const resolved = new URL(markdownReference, canonicalDocumentUrl);
```

## Moving from remote review to a local project

Remote review and local ownership are separate actions. The first remote open is read-only; **Save** must not unexpectedly write elsewhere.

Offer an explicit action such as **Save local project copy…**:

1. The user selects a writable local project root.
2. Markleft downloads the Markdown and selected/needed referenced resources with progress, cancellation, size limits, and a final missing-resource report.
3. Markleft writes a local project layout and opens the saved Markdown using a local file and project-tree adapter.
4. The editor switches source badges and save semantics from `Remote read-only` to `Local project`.

There is no universal, safe way to preserve every relative remote path without knowing the remote project root. A GitHub-specific adapter can understand a repository/ref/path layout; generic HTTP cannot. Therefore export needs an explicit mapping plan:

- preserve original relative references when the selected local layout can represent them safely;
- otherwise present the proposed local paths and a Markdown rewrite as a reviewable, opt-in migration;
- never allow an export target containing `..` to escape the user-selected directory;
- write an export manifest mapping original remote URLs to local files, but do not add that manifest to the Markdown unless requested.

Do not automatically download all web links. Only local-style Markdown resources the user selected for export, with explicit origin, file-count, and total-size limits, belong in this workflow.

## Remote save adapters

A raw HTTP URL is normally read-only. It is not a generic upload endpoint.

Remote write support should be a separate adapter per service, for example a GitHub Contents API adapter. It must provide:

- explicit user authentication via the provider’s supported OAuth/device flow;
- a clear target repository, branch, and path;
- revision/ETag/SHA based conditional writes so remote changes create a conflict instead of being overwritten;
- a visible Save destination: **Save remotely**, **Save local copy**, or **Download**;
- provider-specific resource upload support if images are changed or localized.

Tokens must remain out of URLs, Markdown, exported documents, logs, and browser local storage unless a dedicated secure credential mechanism is intentionally introduced.

## Bookmarklet compatibility

The bookmarklet remains the best path for a Markdown page already loaded in a browser. It must retain browser-native handling of relative `file:` and HTTP(S) image references. It should not replace working image sources with PWA blob URLs.

The shared renderer may still retain the original source reference as metadata for comments and future adapters, but a bookmarklet host should return the browser-resolved URL or deliberately leave a working native `img` source untouched.

## UI and capability model

Avoid testing `window.location`, the current deployment domain, or PWA display mode inside editor UI. The mounted document host supplies capabilities and actions instead:

```ts
interface AssetAccessController {
  state(): "ready" | "needs-project-access" | "read-only-remote" | "unavailable";
  requestProjectAccess?(): Promise<void>;
  localizeRemoteProject?(): Promise<void>;
}
```

The renderer can then show the correct behavior:

- local PWA with no verified folder: placeholder plus **Grant folder access**;
- local PWA with a missing file: placeholder plus **Not found in this project**;
- remote read-only document: normal remote image or an actionable network/error placeholder;
- bookmarklet page: no permission prompt for a normally loadable native image.

## Implementation sequence

1. Build the PWA granted-project registry and relative-path resolver, including `..` support within a verified root.
2. Add source-reference/display-URL metadata and unavailable-image placeholders to the shared renderer.
3. Add the PWA folder-access prompt, remembered-root restoration, stale-index recovery, and asset re-rendering.
4. Define the richer asset-resolution result type while keeping bookmarklet behavior unchanged.
5. Add a read-only HTTP adapter behind an explicit `httpPath` entry contract.
6. Add explicit local-project export/import with an asset manifest and reviewable path mapping.
7. Add provider-specific remote-write adapters only after their authentication and conflict model is designed.

## Required test matrix

- direct-file PWA open resolved from a remembered parent/project folder;
- stale index, moved Markdown, and same-name-but-different-file identity rejection;
- nested and `../` image paths, including a path escaping the current root;
- folder permission revoked after a recent-document restore;
- blob URL lifecycle and unchanged Markdown round-trip;
- bookmarklet `file:` and HTTP(S) relative image behavior remains native;
- HTTP redirect base URL, CORS failure, malformed URL, oversized response, and remote image failure;
- local-project export path traversal prevention, cancellation, missing assets, and no implicit Markdown rewrite;
- remote conditional-write conflict behavior for every writable provider.
