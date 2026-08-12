<!-- markleft:block id="b19149d2" -->
# Markleft Editor

<!-- markleft:block id="b0b91cc8" -->
**Suggestion mode for Markdown—built for human review and AI-assisted revision.**

<!-- markleft:block id="b74b1665" -->
Markleft keeps comments, discussions, and proposed changes *in the Markdown file itself*. Open a local document, leave precise feedback on text, blocks, code, images, SVGs, tables, and Mermaid diagrams, then review AI suggestions in context before accepting them.

<!-- markleft:block id="bd7cf28d" -->
![Markleft editor with anchored review comments](docs/assets/markleft-editor.png)

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

<!-- markleft:block id="b2a27b9e" -->
<!-- markleft:block id="be8f9913" -->
## The Format

<!-- markleft:block id="b5ba69ba" -->
Markleft encodes review data in Markdown footnotes. A range comment, for example, is both readable Markdown and a precise instruction for a Markleft-aware editor or AI:

<!-- markleft:block id="b0acbfae" -->
```markdown
This sentence needs less ceremony.[^range-prev-12-chars-14824]

[^range-prev-12-chars-14824]: Make this more direct.
```

<!-- markleft:block id="b8523562" -->
It supports range, block, code, image-point, inline-SVG, reply, and suggestion annotations. Stable block identifiers make structural suggestions addressable.

<!-- markleft:block id="b8523562" -->
TODO describe markleft schema

<!-- markleft:block id="bcc3bd2c" -->
## The Editor

<!-- markleft:block id="bd9a77df" -->
The editor currently starts as a Bookmarklet in chrome. 
1. Drag this link to the bookmarks
2. Open a local Markdown file in the browser
3. Click on the bookmarklet - and edit the file
4. To save the file the app will ask for permission to read and write the parent folder

<!-- markleft:block id="b766a788" -->
## Status

<!-- markleft:block id="bb87f35c" -->
This is an active prototype of the Markleft editor and format. the format remains intentionally open for iteration. The editor is a side project to get a POC

