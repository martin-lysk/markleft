export const formatNoteHtml = `<!--
local-md notes:
[^range-prev-9-chars-48217-a1b2] marks the 9 visible non-whitespace text characters before this footnote reference.
[^range-next-9-chars-48217-a1b2] marks the 9 visible non-whitespace text characters after this footnote reference.
[^block-48217-a1b2] marks the containing block.
[^image-5000-5000-48217-a1b2] marks a point at normalized x/y coordinates in the preceding Markdown image, including SVG files rendered as images.
[^svg-xpath_svg.1-g.2-circle.4_48217-a1b2] marks an element in an inline raw SVG; the locator decodes as /svg[1]/g[2]/circle[4].
[^code-line-2-col-4-len-8-48217-a1b2] marks 8 code characters from 1-based line 2, column 4 in the preceding fenced code block.
[^comment-48217] is a child comment footnote that starts with Reply to [^parent-id].
[^suggest-block-48217-a1b2] marks the block that a suggestion proposes to replace.
When referenced inside comment footnotes, a suggest-block footnote addresses those comments.
The suggest-block footnote body is replacement Markdown for the marked block.
Child comment definitions point to their parent with Reply to [^parent-id].
AI assistants may add suggestion anchors to document blocks, suggestion refs to related comment footnotes, and suggestion definitions.
AI assistants should not edit existing document body text directly when proposing suggestions.
Markdown formatting, whitespace, and local-md note references do not count as anchor characters.
Hashes use normalized rendered text, including visible whitespace.
-->`;

export const loaderHtml = `${formatNoteHtml}
<script src="local-md.js"></script><textarea>`;
export const bootstrapSelector = "textarea[data-testid='bootstrap-source']";
export const serializedBootstrapSelector = "body > textarea:first-of-type";

declare const __LOCAL_MD_DEV__: boolean;

export const isDevelopmentBuild =
  typeof __LOCAL_MD_DEV__ === "boolean" ? __LOCAL_MD_DEV__ : false;
