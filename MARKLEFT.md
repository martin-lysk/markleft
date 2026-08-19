
<!-- markleft:block id="b7024b84" -->
# Markleft

<!-- markleft:block id="b6145575" -->
Status: Draft specification Version: 0.1

<!-- markleft:block id="b0fed846" -->
## What is Markleft

<!-- markleft:block id="b1bf3927" -->
Markleft is a footnote-based annotation format for Markdown. It allows comments, discussions, and proposed changes to travel with a document without requiring a separate review database or a particular editor.[^suggest-block-39452-3c37]

<!-- markleft:block id="be8a122c" -->
Markleft extends ordinary Markdown footnotes by assigning semantics to a reserved family of footnote identifiers. A Markleft annotation has two main parts:[^suggest-block-41712-1b41]

<!-- markleft:block id="b5fb2864" -->
1. An inline footnote reference identifies the annotation's target in the document.
2. A matching footnote definition contains the comment, reply, or proposed replacement.

<!-- markleft:block id="b5513f9e" -->
For example:

<!-- markleft:block id="bdc3eb08" -->
```markdown
This sentence needs work.[^range-prev-4-chars-48217-a1b2]

[^range-prev-4-chars-48217-a1b2]: Explain what “work” means here.
```

<!-- markleft:block id="baff4831" -->
The identifier tells a Markleft-aware tool how to find the target. The footnote body carries the human- or machine-readable message. In a Markdown renderer that does not understand Markleft, the annotations remain readable as ordinary footnotes.

<!-- markleft:block id="b2f5beac" -->
Markleft is a Markdown annotation extension, not an editor protocol. It specifies how review information is represented inside Markdown. Editors, command-line tools, AI assistants, and other applications may implement that representation independently.

<!-- markleft:block id="b629c6ae" -->
## Why Markleft exists

<!-- markleft:block id="b761849f" -->
Markdown is portable, readable, and easy for people and AI systems to edit, but it has no standard way to attach a discussion to an exact phrase, code range, image location, or document block. Review tools usually solve this by storing comments in a private database. Once the document leaves that tool, the review context is lost.

<!-- markleft:block id="befe132c" -->
Markleft keeps the review state in the artifact itself.

<!-- markleft:block id="b769db82" -->
This has several benefits:

<!-- markleft:block id="b1e14a65" -->
- A document and its review context can be copied, versioned, emailed, or committed together.
- Comments survive handoffs between people, editors, and AI assistants.
- An AI can respond to a precise mark instead of rewriting the entire document.
- Suggestions can be accepted or rejected individually.
- Ordinary Markdown remains the source of truth.
- Review data stays inspectable and editable without a specialized application.

<!-- markleft:block id="ba8b0941" -->
Markleft uses footnotes because footnotes already provide portable references and definitions in Markdown. Markleft adds an identifier grammar and relationship rules on top of that existing mechanism.

<!-- markleft:block id="bc3a77ae" -->
## Terminology

<!-- markleft:block id="be67d7ca" -->
- **Annotation:** A Markleft reference together with its matching footnote definition.
- **Target:** The text, block, code range, image position, or SVG element addressed by an annotation.
- **Anchor:** A footnote reference such as `[^range-prev-4-chars-48217-a1b2]` that connects an annotation to its target.
- **Definition:** The matching footnote definition containing the annotation body.
- **Root comment:** A comment whose target is part of the document.
- **Child comment:** A reply referenced from the definition of another comment.
- **Suggestion:** A proposed replacement for a Markdown block.
- **Seed:** A one-to-five-digit value used to help distinguish annotations. The current implementation derives it from the final five digits of a timestamp.
- **Hash:** A four-digit hexadecimal fingerprint used to detect whether a target or suggestion has changed.
- **Stale annotation:** An annotation whose stored hash no longer matches its current target.

<!-- markleft:block id="babad159" -->
## General structure

<!-- markleft:block id="b516397b" -->
A root comment uses standard Markdown footnote syntax:

<!-- markleft:block id="b9d8f726" -->
```markdown
Target content[^markleft-id]

[^markleft-id]: Comment body
```

<!-- markleft:block id="b2f2fdce" -->
The anchor identifies the target. The matching definition contains Markdown and MAY span multiple indented lines according to normal footnote rules.

<!-- markleft:block id="b5c8264f" -->
Markleft-aware tools MUST distinguish Markleft identifiers from ordinary footnote identifiers. Footnotes outside the identifier forms defined here MUST remain ordinary footnotes.

<!-- markleft:block id="b036636b" -->
## Comment types

<!-- markleft:block id="b87f90fd" -->
Each root comment type exists because different kinds of document content require different ways of identifying a target. A text range can be found by counting visible characters, while a code selection needs line and column coordinates and an image comment needs a two-dimensional location.

<!-- markleft:block id="b56cd7cc" -->
### Text-range comments

<!-- markleft:block id="be8d8dd6" -->
Identifier:

<!-- markleft:block id="b1d97338" -->
```text
range-(prev|next)-<length>-chars-<seed>-<hash>
```

<!-- markleft:block id="b2c12f13" -->
Examples:

<!-- markleft:block id="b075818d" -->
```markdown
This phrase[^range-prev-10-chars-48217-a1b2] is under review.

This [^range-next-6-chars-48218-b2c3]phrase is under review.
```

<!-- markleft:block id="baf3dd57" -->
`prev` targets the preceding `<length>` logical characters. `next` targets the following `<length>` logical characters.

<!-- markleft:block id="bcd6bc36" -->
Logical characters represent visible, non-whitespace text. Markdown formatting, whitespace, and Markleft references do not count toward the target length. The hash is calculated from normalized rendered text and therefore includes normalized visible whitespace.

<!-- markleft:block id="b0edb9b9" -->
Use a text-range comment when feedback applies to an exact word, phrase, or sentence fragment.

<!-- markleft:block id="bb27bc39" -->
Text-range comments differ from block comments because their scope is precise. They should not be used when the intended target is an entire paragraph, list item, heading, or other block.

<!-- markleft:block id="bc1a8a8b" -->
### Block comments

<!-- markleft:block id="bc83e545" -->
Identifier:

<!-- markleft:block id="b4d99828" -->
```text
block-<seed>-<hash>
```

<!-- markleft:block id="b07b42d6" -->
Example:

<!-- markleft:block id="b930ab47" -->
```markdown
This entire paragraph needs a clearer structure.[^block-48217-a1b2]

```

<!-- markleft:block id="bca6f25a" -->
The target of a block comment is the Markdown block containing its anchor. Depending on context, that block may be a paragraph, heading, list item, block quote, table cell, or another block-level construct.

<!-- markleft:block id="bf9fecda" -->
Use a block comment when the feedback concerns the meaning, organization, or presentation of the whole block.

<!-- markleft:block id="bdaf6b5c" -->
Block comments differ from text-range comments because they intentionally avoid selecting a substring. A selection that contains no logical text, such as whitespace alone, MAY fall back to a block comment.

<!-- markleft:block id="bc53ff2a" -->
### Code-range comments

<!-- markleft:block id="b781d5bf" -->
Identifier:

<!-- markleft:block id="ba6f1e2e" -->
```text
code-line-<line>-col-<column>-len-<length>-<seed>-<hash>
```

<!-- markleft:block id="bd2d2881" -->
Example:

<!-- markleft:block id="b85bf1c6" -->
````markdown
```ts
const greeting = "hello";
```
[^code-line-1-col-7-len-8-48217-a1b2]
````

<!-- markleft:block id="b11ea291" -->
The anchor appears after the fenced code block it addresses. Line and column numbers are one-based. `<length>` is the number of code characters in the selection.

<!-- markleft:block id="bbc165c3" -->
Use a code-range comment for a precise location inside a fenced code block.

<!-- markleft:block id="bda8a38d" -->
Code-range comments differ from ordinary text-range comments because rendered Markdown does not reliably preserve the source coordinates and whitespace that matter in code. Explicit line, column, and length values preserve that precision.

<!-- markleft:block id="b39ef5a9" -->
### Image-point comments

<!-- markleft:block id="bb455af6" -->
Identifier:

<!-- markleft:block id="bcf0b929" -->
```text
image-<x>-<y>-<seed>-<hash>
```

<!-- markleft:block id="b5341147" -->
Example:

<!-- markleft:block id="b4bd1454" -->
```markdown
![Dashboard mockup](dashboard.png)
[^image-2500-7500-48217-a1b2]
```

<!-- markleft:block id="bf2a31eb" -->
The anchor appears after the Markdown image it addresses. `<x>` and `<y>` are normalized integer coordinates from `0` through `10000`. This makes the location independent of the image's displayed size. For example, `5000,5000` represents the center.

<!-- markleft:block id="b22eb890" -->
Use an image-point comment when feedback concerns a visual location in a bitmap image or an SVG included through Markdown image syntax.

<!-- markleft:block id="b783ed20" -->
Image-point comments differ from text and block comments because their target is spatial rather than textual. They identify a point, not a text span.

<!-- markleft:block id="b3034fb2" -->
### Inline SVG element comments

<!-- markleft:block id="b96efe8d" -->
Identifier:

<!-- markleft:block id="b55826ca" -->
```text
svg-xpath_<encoded-locator>_<seed>-<hash>
```

<!-- markleft:block id="bb668c69" -->
Example:

<!-- markleft:block id="b02fea53" -->
```markdown
<svg viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4"/>
</svg>
[^svg-xpath_svg.1-circle.1_48217-a1b2]
```

<!-- markleft:block id="bef65136" -->
The encoded locator identifies an element inside an inline raw SVG. A locator such as `svg.1-g.2-circle.4` represents `/svg[1]/g[2]/circle[4]`. Characters outside the identifier's safe character set are percent-encoded.

<!-- markleft:block id="bd8cca10" -->
Use an SVG element comment when feedback concerns a specific structural element in an inline SVG.

<!-- markleft:block id="b5b62ecb" -->
SVG element comments differ from image-point comments because they identify a semantic element rather than a coordinate. This is preferable when the SVG structure is available and stable.

<!-- markleft:block id="be2ddf6a" -->
## Discussions

<!-- markleft:block id="b9f9e5d8" -->
Markleft represents a discussion as references from a parent comment definition to child comment definitions.

<!-- markleft:block id="bbbd3486" -->
Child comment identifier:

<!-- markleft:block id="b48ef477" -->
```text
comment-<seed>-<hash>
```

<!-- markleft:block id="bbf419ca" -->
Example:

<!-- markleft:block id="b4a3e897" -->
```markdown
This sentence needs review.[^range-prev-4-chars-48217-a1b2]

```

<!-- markleft:block id="bdc45606" -->
A `comment-…` footnote does not identify a new document target. Its parent is the comment definition that references it. This makes it a reply rather than a separate root comment.

<!-- markleft:block id="ba0498d7" -->
Child references MUST be interpreted in their source order. That order defines the display order of replies and suggestions in a discussion.

<!-- markleft:block id="bdd83c2d" -->
Child comments differ from root comments because they address an existing annotation rather than document content directly.

<!-- markleft:block id="b672f472" -->
## Suggestions

<!-- markleft:block id="b8b87265" -->
Suggestion identifier:

<!-- markleft:block id="b086c383" -->
```text
suggest-block-<seed>-<hash>
```

<!-- markleft:block id="b1ef0e6a" -->
Example:

<!-- markleft:block id="ba573f89" -->
```markdown
This sentence needs review.[^range-prev-4-chars-48217-a1b2][^suggest-block-48219-c3d4]
```

<!-- markleft:block id="b1ffef90" -->
A suggestion anchor identifies the Markdown block that the suggestion proposes to replace. The suggestion definition contains the complete replacement Markdown for that block.

<!-- markleft:block id="b411f0ee" -->
When a root comment definition references the suggestion, the suggestion addresses that comment. The same suggestion MAY be referenced by multiple comments in the target block. This allows one replacement to resolve several related remarks.

<!-- markleft:block id="b1a33f17" -->
A suggestion MAY also exist without a parent comment. In that case it is a standalone proposed change to its target block.

<!-- markleft:block id="b2e4e0b8" -->
Suggestions differ from comments because their bodies are actionable replacement content, not observations or discussion messages. A tool SHOULD present them with accept and reject operations. Accepting a suggestion replaces the target block with the suggestion body; rejecting it leaves the target block unchanged.

<!-- markleft:block id="b47982ac" -->
An AI assistant proposing a change SHOULD add a suggestion rather than editing the existing document body directly. This preserves authorship and lets the reviewer decide whether to apply the change.

<!-- markleft:block id="b7af53b1" -->
## Dangling comments

<!-- markleft:block id="bfb509f0" -->
A Markleft definition without a corresponding document anchor is a dangling comment:

<!-- markleft:block id="b940cb10" -->
```markdown
```

<!-- markleft:block id="b9733ef0" -->
Dangling comments do not identify a resolvable document location. A tool MAY retain and display them as unresolved review notes, but MUST NOT invent a target silently.

<!-- markleft:block id="ba46c3be" -->
Dangling comments differ from child comments because a child is deliberately attached through a parent definition. A dangling comment has no recognized incoming reference.

<!-- markleft:block id="bcabf59f" -->
## Identifier components

<!-- markleft:block id="b2ff3e43" -->
### Seeds

<!-- markleft:block id="b0a0dbfb" -->
Seeds reduce the chance that two annotations with the same content receive the same identifier. A seed contains between one and five decimal digits.

<!-- markleft:block id="bcbcb366" -->
Seeds are identifiers, not ordering guarantees. Consumers MUST NOT infer discussion order or creation time from them.

<!-- markleft:block id="b417954b" -->
### Hashes and stale targets

<!-- markleft:block id="b7e46feb" -->
Hashes are four hexadecimal digits. They provide a compact integrity check rather than cryptographic security.

<!-- markleft:block id="b7d3ea18" -->
For text and block targets, hashing uses normalized rendered text. Markdown formatting and Markleft syntax are excluded. Visible whitespace is normalized before hashing. Image hashes derive from the trimmed Markdown image source. Code hashes derive from the selected code text. Suggestion hashes derive from the replacement Markdown's logical text.

<!-- markleft:block id="b6de2bcc" -->
If the current target hash differs from the hash stored in the identifier, a tool SHOULD mark the annotation as stale. A stale annotation remains readable, but the tool SHOULD avoid presenting its location as unquestionably correct.

<!-- markleft:block id="bd4388d4" -->
Hashes MUST NOT be treated as globally unique or security-sensitive.

<!-- markleft:block id="b3ba2b72" -->
## Relationship model

<!-- markleft:block id="bf2f6378" -->
The location of a reference determines its role:

<!-- markleft:block id="b486b03b" -->
| Reference location        | Identifier kind                   | Meaning                                  |
| ------------------------- | --------------------------------- | ---------------------------------------- |
| Document body             | Range, block, code, image, or SVG | Root comment targeting document content  |
| Parent comment definition | `comment-…`                       | Reply in that comment's discussion       |
| Document block            | `suggest-block-…`                 | Block targeted by a proposed replacement |
| Parent comment definition | `suggest-block-…`                 | The suggestion addresses that comment    |

<!-- markleft:block id="b13e6264" -->
The anchor and definition have separate responsibilities:

<!-- markleft:block id="b133a0c5" -->
- The anchor determines where an annotation applies.
- The definition contains what the annotation says or proposes.
- A child reference determines how annotations relate to one another.

<!-- markleft:block id="b2e1fc41" -->
## Conformance

<!-- markleft:block id="b4630a5e" -->
A Markleft-aware consumer:

<!-- markleft:block id="bb63c688" -->
1. MUST preserve Markdown content it does not understand.
2. MUST leave ordinary footnotes distinct from Markleft annotations.
3. MUST resolve recognized anchors using the targeting rules for their identifier type.
4. MUST read annotation bodies from matching footnote definitions.
5. MUST preserve child-reference order in discussions.
6. SHOULD detect and expose stale or missing targets and definitions.
7. MUST NOT treat the four-digit hash as a security mechanism.

<!-- markleft:block id="b9aa2907" -->
A Markleft-aware producer:

<!-- markleft:block id="b49bacc9" -->
1. MUST emit a recognized identifier for each Markleft annotation.
2. MUST emit a matching footnote definition when the annotation has a body.
3. MUST place detached code, image, and SVG anchors after the content they address.
4. SHOULD generate a seed that avoids collisions within the document.
5. SHOULD preserve existing comments and discussions when adding suggestions.
6. SHOULD propose edits through suggestions instead of changing reviewed body text directly.

<!-- markleft:block id="b78fb88e" -->
## Compatibility

<!-- markleft:block id="b99f9106" -->
Markleft deliberately uses valid Markdown footnote syntax. A non-Markleft renderer may display the annotations as ordinary footnotes. A Markleft-aware renderer may instead hide the generated footnote anchors, highlight their targets, and show the definitions as contextual comment threads.

<!-- markleft:block id="bc2a4838" -->
The following legacy identifiers exist in the current implementation:

<!-- markleft:block id="b1970388" -->
```text
rangecomment-<seed>-<hash>-<length>
blockcomment-<seed>-<hash>
svg-<locator>-<x>-<y>-<seed>-<hash>
```

<!-- markleft:block id="b9132d1b" -->
Consumers MAY read these forms for backward compatibility. Producers SHOULD emit the current identifier forms defined by this specification.

<!-- markleft:block id="bb10a093" -->
## Complete example

<!-- markleft:block id="b46ea63d" -->
````markdown
# Release notes

The new workflow is fast and easy.[^range-prev-11-chars-48217-a1b2]

![Workflow diagram](workflow.png)
[^image-6400-3100-48218-b2c3]

```ts
const mode = "automatic";
```
[^code-line-1-col-7-len-4-48219-c3d4]
````

<!-- markleft:block id="b9311c7a" -->
This example contains three root comments, one reply, and one block suggestion. The suggestion targets the paragraph and is linked to its related range comment.

[^suggest-block-39452-3c37]: Markleft is a footnote-based annotation format for f. It allows comments, discussions, and proposed changes to travel with a document without requiring a separate review database or a particular editor.

[^suggest-block-41712-1b41]: Markleft extends ordinary Markdown footnotes by ee semantics to a reserved family of footnote identifiers. A Markleft annotation has two main parts:
