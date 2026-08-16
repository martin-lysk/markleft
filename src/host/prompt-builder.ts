export interface AddressAnnotationsPromptInput {
  documentPath: string;
}

/**
 * Produces the portable instruction passed to an agent after a Markleft document is saved.
 * Hosts decide how to locate and invoke an agent; this module only describes the document task.
 */
export function buildAddressAnnotationsPrompt({ documentPath }: AddressAnnotationsPromptInput): string {
  return `Read this Markdown document and all local-md footnote annotations. Then address every actionable annotation by editing the Markdown file and appending local-md reply or suggestion footnote definitions.

This is an edit task, not a read-only review. You are authorized and expected to write replies or suggestions into the file. Do not stop after summarizing the annotations. Do not modify, replace, delete, or reorder any existing document body content; the only permitted Markdown edits are new reply or suggestion footnote definitions appended at the end of the document.

Markdown file:
${documentPath}

If the Markdown references images or SVG files with relative paths, treat those paths as files next to this Markdown document unless the path says otherwise. When a comment or suggestion concerns an image/SVG, inspect the referenced asset as part of the task. If you propose changing an image/SVG, create or edit a separate asset file next to the Markdown and make the suggestion footnote replace the Markdown image reference with the new relative path.

local-md comments use reserved footnote ids:
[^range-prev-N-chars-*] marks the N visible non-whitespace text characters before the footnote reference.
[^range-next-N-chars-*] marks the N visible non-whitespace text characters after the footnote reference.
[^block-*] marks the containing block.
[^image-X-Y-*] marks a point at normalized x/y coordinates in the preceding Markdown image, including SVG files rendered as images.
[^code-line-L-col-C-len-N-*] marks N code characters from 1-based line L, column C in the preceding fenced code block.
[^comment-*] is a child comment footnote. It starts with a Reply to [^parent-id] metadata line, followed by a blank line and the visible reply body.
When the document contains <!-- markleft:block id="b..." --> comments, those comments give stable ids to the real document blocks that follow them. Do not edit, remove, duplicate, or move those id comments.

For each annotation, first infer the human intent behind the comment. Decide whether it is a question, a request for a concrete content change, a request to inspect an image/code/table detail, a clarification request, or a general note. If the best response is an answer, explanation, or follow-up question, append a reply comment footnote. If the best response is a concrete document change, append a suggestion footnote. If both are needed, append both and keep them linked to the relevant annotation.

Treat every local-md annotation reference as review metadata, never as replacement content. Before writing replies or suggestions, inventory every actionable annotation and ensure each one is addressed by at least one appended reply or suggestion. When a source block contains annotation anchors such as [^range-prev-*], [^range-next-*], [^block-*], [^image-*], [^code-line-*], or [^comment-*], do not copy those anchors into the proposed replacement Markdown. The replacement must contain only the content that should remain after the suggestion is accepted.

To reply to an existing annotation or comment, append a new comment footnote definition only. Do not edit the parent footnote body. Use this shape:
[^comment-12345]: Reply to [^range-prev-20-chars-12345-abcd]
${"    "}
    Reply body Markdown.

Associate addressed annotations with a suggestion only through one final reference-only paragraph. After the replacement content, add one indented blank line followed by one indented paragraph containing only the existing annotation references addressed by that suggestion, separated by spaces. Do not put annotation references in headings, prose, tables, lists, code, image references, or any other part of the replacement. Do not invent or rename annotation references, and do not repeat the same reference within one suggestion.

Correct structure:
[^suggestion-s5-update-block-b55]:
    Replacement Markdown without local-md annotation anchors.
${"    "}
    [^range-prev-20-chars-12345-abcd] [^comment-67890-ef01]

For every actionable annotation, append a suggestion footnote definition at the end using one of these ids:
[^suggestion-s1-update-block-b55]: complete replacement Markdown for b55
[^suggestion-s2-insert-before-block-b55]: new Markdown inserted before b55
[^suggestion-s3-insert-after-block-b55]: new Markdown inserted after b55
[^suggestion-s4-delete-block-b55]: <!-- markleft:delete -->

Use a new unique s... suggestion id for every proposal and a new unique comment-NNNNN id for every reply. The final reference-only paragraph in a suggestion is association metadata and is not part of the proposed content. Every continuation line of a suggestion or reply footnote, including blank lines and relation metadata, must be indented by four spaces so it remains inside the footnote definition. For multiline block Markdown such as tables, put no content after the definition colon and indent every content line by four spaces. Emit a separate local suggestion for every affected block. Preserve every existing annotation definition and every original body anchor; excluding anchors from replacement content does not authorize removing them from the existing document. Finish only after the appended reply and suggestion definitions have been written to the Markdown file and all actionable annotations are addressed.`;
}
