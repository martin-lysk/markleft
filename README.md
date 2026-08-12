<!-- markleft:block id="b19149d2" -->
# Markleft Editor

<!-- markleft:block id="b0b91cc8" -->
**Suggestion mode for Markdown—built for human review and AI-assisted revision.**

<!-- markleft:block id="b74b1665" -->
Markleft keeps comments, discussions, and proposed changes *in the Markdown file itself*. Open a local document, leave precise feedback on text, blocks, code, images, SVGs, tables, and Mermaid diagrams, then review AI suggestions in context before accepting them.

<!-- markleft:block id="bd7cf28d" -->
<https://github.com/user-attachments/assets/c96a810b-c156-453e-979f-2f7b2b715249>

<!-- markleft:block id="b66c9860" -->
## Why Markleft

<!-- markleft:block id="b5c93645" -->
AI drafts improve through iteration, but ordinary chat workflows lose the context that makes feedback useful: the exact phrase, block, visual detail, or intent behind a requested change. Markleft turns that feedback into durable, portable document data.

<!-- markleft:block id="bf99e774" -->
- **Point, don’t describe.** Anchor feedback to the exact content under review.
- **Keep intent beside the work.** Comments and replies travel with the `.md` file.
- **Review before applying.** AI changes arrive as individual suggestions, not an opaque rewrite.
- **Stay compatible.** Markleft annotations are standard Markdown footnotes with reserved identifiers; unaware renderers still show readable footnotes.
- **Work locally.** The editor runs in the browser against local Markdown files.

<!-- markleft:block id="bcc3bd2c" -->
## The Editor

<!-- markleft:block id="bd9a77df" -->
The editor currently starts as a Bookmarklet in chrome. 

<!-- markleft:block id="b55a642a" -->
1. In Chrome, show the bookmarks bar (`⌘⇧B` on macOS or `Ctrl+Shift+B` on Windows/Linux), right-click it, and choose **Add page**.
2. Name the bookmark **Markleft**.
3. Paste this complete script into the bookmark’s **URL** or **Address** field:

<!-- markleft:block id="bb222555" -->
```text
javascript:(()=>{const s=document.createElement("script");s.src="https://martin-lysk.github.io/markleft/bookmark.js?"+Date.now();document.documentElement.append(s)})()
```
<!-- markleft:block id="b1f44074" -->
<!-- markleft:block id="b5b34924" -->
4. Open a local Markdown file in Chrome and click the **Markleft** bookmark to start annotating it.

<!-- markleft:block id="b766f9e8" -->
### Using a local Bookmark

<!-- markleft:block id="be6781ee" -->
1. Clone this repository and run `pnpm install` followed by `pnpm build`.
2. In `bookmark.js`, set `loaderUrl` to the absolute file URL of the bundle you just built, for example `file:///Users/you/code/markleft/local-md.js`.
3. Run `pnpm build:bookmarklet`, then open `bookmarklet.txt` and copy its complete contents.
4. In Chrome, show the bookmarks bar (`⌘⇧B` on macOS or `Ctrl+Shift+B` on Windows/Linux), right-click it, and choose **Add page**. Name the bookmark **Markleft** and paste the copied text into its **URL** or **Address** field.
5. Open a local Markdown file in Chrome and click the **Markleft** bookmark to start annotating it.

<!-- markleft:block id="b51892e8" -->
## Markleft - the spec

<!-- markleft:block id="b7001fd2" -->
### Annotations are just Markdown footnotes

<!-- markleft:block id="b2a89e2a" -->
An annotation—like a comment—consists of two parts: an anchor that identifies what it comments on and the comment itself. Markdown has a concept of footnotes that most Markdown renderers support. An anchor uses the format `[^id-of-the-footnote]`, while its definition appears on a separate line in the format `[^id-of-the-footnote]: body of the footnote`. To encode additional information—such as selected words or x/y coordinates inside an image—we use a schema in the footnote ID itself.

<!-- markleft:block id="b6e11423" -->
For a text range:

<!-- markleft:block id="b6d8980b" -->
```markdown
This sentence needs less ceremony.[^range-prev-12-chars-14824-a1b2]

[^range-prev-12-chars-14824-a1b2]: Make this more direct.
```

<!-- markleft:block id="b0d7505a" -->
`range-prev-12-chars` says that the annotation covers the previous twelve visible, non-whitespace characters. The remaining components provide identity and a content fingerprint so Markleft can detect when an anchor has become stale.

<!-- markleft:block id="bf48d44f" -->
Other IDs encode other kinds of anchors:

<!-- markleft:block id="b1645058" -->
- `image-X-Y-*` stores normalized image coordinates.
- `code-line-L-col-C-len-N-*` identifies a code range.
- `block-*` addresses the containing block.
- `comment-*` represents a reply to another comment.

<!-- markleft:block id="bfd3d4a8" -->
Because the comment is a footnote, Markdown tools preserve it even when they do not understand Markleft. To a normal renderer such as GitHub, it is just a footnote. To the AI and the Markleft editor, it identifies a point on an image or a highlighted sentence inside a text block.

<!-- markleft:block id="bb3bd506" -->
#### Stable block IDs make structural changes addressable

<!-- markleft:block id="b4c3e843" -->
To allow suggestions to target blocks reliably, we need stable identifiers. Markleft injects an HTML comment immediately before each real document block:

<!-- markleft:block id="be8a647d" -->
```markdown
<!- - markleft:block id="babf825b" -->
```

<!-- markleft:block id="be4673d4" -->
#### Suggestions are unreferenced, append-only footnotes

<!-- markleft:block id="b378717c" -->
A suggestion is a footnote definition with a reserved ID and intentionally no inline footnote anchor in the original body.

<!-- markleft:block id="b69927ae" -->
```markdown
[^suggestion-s2-update-block-babf825b]: replacement Markdown
```

<!-- markleft:block id="b234ca4b" -->
The ID says:

<!-- markleft:block id="bfe28ed1" -->
- this is suggestion `s2`;
- the operation is `update`;
- the target is block `babf825b`. 

<!-- markleft:block id="b72e0eed" -->
Insert-before, insert-after, and delete operations use the same pattern. The last line of a suggestion body contains footnote anchors for the comments the suggestion addresses; that line is metadata, not part of the proposed content.

<!-- markleft:block id="b2e87a88" -->
This is the crucial append-only property: an AI can add a proposal without receiving permission to alter the document it is reviewing.

<!-- markleft:block id="bb87f35c" -->
## Status

<!-- markleft:block id="b90f5d13" -->
This is an active prototype of the Markleft editor and format. the format remains intentionally open for iteration. The editor is a side project to get a POC

[^comment-52718]: Reply to 

    Yes—load the hosted `bookmark.js`, rather than `local-md.js` directly. `bookmark.js` first captures the open Markdown document and creates the editor bootstrap textarea; loading `local-md.js` alone would skip that step. The compact bookmark URL would be:

    ```text
    javascript:(()=>{const s=document.createElement("script");s.src="https://martin-lysk.github.io/markleft/bookmark.js";document.documentElement.append(s)})()
    ```

    This needs the Pages deployment to publish `bookmark.js`, and that script must derive its `local-md.js` URL from its own hosted location instead of using the current local-file URL.

