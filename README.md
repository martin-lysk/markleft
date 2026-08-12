<!-- markleft:block id="b19149d2" -->
# Markleft Editor

<!-- markleft:block id="b0b91cc8" -->
**Suggestion mode for Markdown—built for human review and AI-assisted revision.**

<!-- markleft:block id="b74b1665" -->
Markleft keeps comments, discussions, and proposed changes *in the Markdown file itself*. Open a local document, leave precise feedback on text, blocks, code, images, SVGs, tables, and Mermaid diagrams, then review AI suggestions in context before accepting them.

<!-- markleft:block id="bd7cf28d" -->
<https://github.com/user-attachments/assets/c96a810b-c156-453e-979f-2f7b2b715249>

<!-- markleft:block id="b91ca2c4" -->
Read the full story [on blog.lysk.tech](https://blog.lysk.tech/markleft-ai-markdown-review)

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
## Installation

<!-- markleft:block id="bd9a77df" -->
The editor starts as a Bookmarklet in chrome. 

<!-- markleft:block id="b766f9e8" -->
### Using the hosted script

<!-- markleft:block id="b55a642a" -->
1. Show the bookmarks bar (`⌘⇧B` on macOS or `Ctrl+Shift+B` on Windows/Linux), right-click it, and choose **Add page**.
2. Name the bookmark **Markleft**.
3. Paste this complete script into the bookmark’s **URL** or **Address** field:

<!-- markleft:block id="bb222555" -->
```text
javascript:(()=>{const s=document.createElement("script");s.src="https://martin-lysk.github.io/markleft/bookmark.js?"+Date.now();document.documentElement.append(s)})()
```

<!-- markleft:block id="b5b34924" -->
1. Open a local Markdown file in Chrome and click the **Markleft** bookmark to start annotating it.

<!-- markleft:block id="b766f9e8" -->
### Running it from a local script

<!-- markleft:block id="be6781ee" -->
1. Clone this repository and run `pnpm install` followed by `pnpm build`.
2. In `bookmark.js`, set `loaderUrl` to the absolute file URL of the bundle you just built, for example `file:///Users/you/code/markleft/local-md.js`.
3. Run `pnpm build:bookmarklet`, then open `bookmarklet.txt` and copy its complete contents.
4. In Chrome, show the bookmarks bar (`⌘⇧B` on macOS or `Ctrl+Shift+B` on Windows/Linux), right-click it, and choose **Add page**. Name the bookmark **Markleft** and paste the copied text into its **URL** or **Address** field.
5. Open a local Markdown file in Chrome and click the **Markleft** bookmark to start annotating it.

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
