
# Markleft

Status: Draft specification Version: 0.1

## What is Markleft

Markleft is a footnote-based annotation format for Markdown. It allows comments, discussions, and proposed changes to travel with a document without requiring a separate review database or a particular editor.[^suggest-block-39452-3c37]

Markleft extends ordinary Markdown footnotes by assigning semantics to a reserved family of footnote identifiers. A Markleft annotation has two main parts:[^suggest-block-41712-1b41]

1. An inline footnote reference identifies the annotation's target in the document.
2. A matching footnote definition contains the comment, reply, or proposed replacement.

For example:

```markdown
This sentence needs work.[^range-prev-4-chars-48217-a1b2]

[^range-prev-4-chars-48217-a1b2]: Explain what “work” means here.
```

The identifier tells a Markleft-aware tool how to find the target. The footnote body carries the human- or machine-readable message. In a Markdown renderer that does not understand Markleft, the annotations remain readable as ordinary footnotes.

Markleft is a Markdown annotation extension, not an editor protocol. It specifies how review information is represented inside Markdown. Editors, command-line tools, AI assistants, and other applications may implement that representation independently.

## Why Markleft exists

Markdown is portable, readable, and easy for people and AI systems to edit, but it has no standard way to attach a discussion to an exact phrase, code range, image location, or document block. Review tools usually solve this by storing comments in a private database. Once the document leaves that tool, the review context is lost.

Markleft keeps the review state in the artifact itself.

This has several benefits:

- A document and its review context can be copied, versioned, emailed, or committed together.
- Comments survive handoffs between people, editors, and AI assistants.
- An AI can respond to a precise mark instead of rewriting the entire document.
- Suggestions can be accepted or rejected individually.
- Ordinary Markdown remains the source of truth.
- Review data stays inspectable and editable without a specialized application.

Markleft uses footnotes because footnotes already provide portable references and definitions in Markdown. Markleft adds an identifier grammar and relationship rules on top of that existing mechanism.

## Terminology

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

## General structure

A root comment uses standard Markdown footnote syntax:

```markdown
Target content[^markleft-id]

[^markleft-id]: Comment body
```

The anchor identifies the target. The matching definition contains Markdown and MAY span multiple indented lines according to normal footnote rules.

Markleft-aware tools MUST distinguish Markleft identifiers from ordinary footnote identifiers. Footnotes outside the identifier forms defined here MUST remain ordinary footnotes.

## Comment types

Each root comment type exists because different kinds of document content require different ways of identifying a target. A text range can be found by counting visible characters, while a code selection needs line and column coordinates and an image comment needs a two-dimensional location.

### Text-range comments

Identifier:

```text
range-(prev|next)-<length>-chars-<seed>-<hash>
```

Examples:

```markdown
This phrase[^range-prev-10-chars-48217-a1b2] is under review.

This [^range-next-6-chars-48218-b2c3]phrase is under review.
```

`prev` targets the preceding `<length>` logical characters. `next` targets the following `<length>` logical characters.

Logical characters represent visible, non-whitespace text. Markdown formatting, whitespace, and Markleft references do not count toward the target length. The hash is calculated from normalized rendered text and therefore includes normalized visible whitespace.

Use a text-range comment when feedback applies to an exact word, phrase, or sentence fragment.

Text-range comments differ from block comments because their scope is precise. They should not be used when the intended target is an entire paragraph, list item, heading, or other block.

### Block comments

Identifier:

```text
block-<seed>-<hash>
```

Example:

```markdown
This entire paragraph needs a clearer structure.[^block-48217-a1b2]

```

The target of a block comment is the Markdown block containing its anchor. Depending on context, that block may be a paragraph, heading, list item, block quote, table cell, or another block-level construct.

Use a block comment when the feedback concerns the meaning, organization, or presentation of the whole block.

Block comments differ from text-range comments because they intentionally avoid selecting a substring. A selection that contains no logical text, such as whitespace alone, MAY fall back to a block comment.

### Code-range comments

Identifier:

```text
code-line-<line>-col-<column>-len-<length>-<seed>-<hash>
```

Example:

````markdown
```ts
const greeting = "hello";
```
[^code-line-1-col-7-len-8-48217-a1b2]
````

The anchor appears after the fenced code block it addresses. Line and column numbers are one-based. `<length>` is the number of code characters in the selection.

Use a code-range comment for a precise location inside a fenced code block.

Code-range comments differ from ordinary text-range comments because rendered Markdown does not reliably preserve the source coordinates and whitespace that matter in code. Explicit line, column, and length values preserve that precision.

### Image-point comments

Identifier:

```text
image-<x>-<y>-<seed>-<hash>
```

Example:

```markdown
![Dashboard mockup](dashboard.png)
[^image-2500-7500-48217-a1b2]
```

The anchor appears after the Markdown image it addresses. `<x>` and `<y>` are normalized integer coordinates from `0` through `10000`. This makes the location independent of the image's displayed size. For example, `5000,5000` represents the center.

Use an image-point comment when feedback concerns a visual location in a bitmap image or an SVG included through Markdown image syntax.

Image-point comments differ from text and block comments because their target is spatial rather than textual. They identify a point, not a text span.

### Inline SVG element comments

Identifier:

```text
svg-xpath_<encoded-locator>_<seed>-<hash>
```

Example:

```markdown
<svg viewBox="0 0 10 10">
  <circle cx="5" cy="5" r="4"/>
</svg>
[^svg-xpath_svg.1-circle.1_48217-a1b2]
```

The encoded locator identifies an element inside an inline raw SVG. A locator such as `svg.1-g.2-circle.4` represents `/svg[1]/g[2]/circle[4]`. Characters outside the identifier's safe character set are percent-encoded.

Use an SVG element comment when feedback concerns a specific structural element in an inline SVG.

SVG element comments differ from image-point comments because they identify a semantic element rather than a coordinate. This is preferable when the SVG structure is available and stable.

## Discussions

Markleft represents a discussion as references from a parent comment definition to child comment definitions.

Child comment identifier:

```text
comment-<seed>-<hash>
```

Example:

```markdown
This sentence needs review.[^range-prev-4-chars-48217-a1b2]

```

A `comment-…` footnote does not identify a new document target. Its parent is the comment definition that references it. This makes it a reply rather than a separate root comment.

Child references MUST be interpreted in their source order. That order defines the display order of replies and suggestions in a discussion.

Child comments differ from root comments because they address an existing annotation rather than document content directly.

## Suggestions

Suggestion identifier:

```text
suggest-block-<seed>-<hash>
```

Example:

```markdown
This sentence needs review.[^range-prev-4-chars-48217-a1b2][^suggest-block-48219-c3d4]
```

A suggestion anchor identifies the Markdown block that the suggestion proposes to replace. The suggestion definition contains the complete replacement Markdown for that block.

When a root comment definition references the suggestion, the suggestion addresses that comment. The same suggestion MAY be referenced by multiple comments in the target block. This allows one replacement to resolve several related remarks.

A suggestion MAY also exist without a parent comment. In that case it is a standalone proposed change to its target block.

Suggestions differ from comments because their bodies are actionable replacement content, not observations or discussion messages. A tool SHOULD present them with accept and reject operations. Accepting a suggestion replaces the target block with the suggestion body; rejecting it leaves the target block unchanged.

An AI assistant proposing a change SHOULD add a suggestion rather than editing the existing document body directly. This preserves authorship and lets the reviewer decide whether to apply the change.

## Dangling comments

A Markleft definition without a corresponding document anchor is a dangling comment:

```markdown
```

Dangling comments do not identify a resolvable document location. A tool MAY retain and display them as unresolved review notes, but MUST NOT invent a target silently.

Dangling comments differ from child comments because a child is deliberately attached through a parent definition. A dangling comment has no recognized incoming reference.

## Identifier components

### Seeds

Seeds reduce the chance that two annotations with the same content receive the same identifier. A seed contains between one and five decimal digits.

Seeds are identifiers, not ordering guarantees. Consumers MUST NOT infer discussion order or creation time from them.

### Hashes and stale targets

Hashes are four hexadecimal digits. They provide a compact integrity check rather than cryptographic security.

For text and block targets, hashing uses normalized rendered text. Markdown formatting and Markleft syntax are excluded. Visible whitespace is normalized before hashing. Image hashes derive from the trimmed Markdown image source. Code hashes derive from the selected code text. Suggestion hashes derive from the replacement Markdown's logical text.

If the current target hash differs from the hash stored in the identifier, a tool SHOULD mark the annotation as stale. A stale annotation remains readable, but the tool SHOULD avoid presenting its location as unquestionably correct.

Hashes MUST NOT be treated as globally unique or security-sensitive.

## Relationship model

The location of a reference determines its role:

| Reference location        | Identifier kind                   | Meaning                                  |
| ------------------------- | --------------------------------- | ---------------------------------------- |
| Document body             | Range, block, code, image, or SVG | Root comment targeting document content  |
| Parent comment definition | `comment-…`                       | Reply in that comment's discussion       |
| Document block            | `suggest-block-…`                 | Block targeted by a proposed replacement |
| Parent comment definition | `suggest-block-…`                 | The suggestion addresses that comment    |

The anchor and definition have separate responsibilities:

- The anchor determines where an annotation applies.
- The definition contains what the annotation says or proposes.
- A child reference determines how annotations relate to one another.

## Conformance

A Markleft-aware consumer:

1. MUST preserve Markdown content it does not understand.
2. MUST leave ordinary footnotes distinct from Markleft annotations.
3. MUST resolve recognized anchors using the targeting rules for their identifier type.
4. MUST read annotation bodies from matching footnote definitions.
5. MUST preserve child-reference order in discussions.
6. SHOULD detect and expose stale or missing targets and definitions.
7. MUST NOT treat the four-digit hash as a security mechanism.

A Markleft-aware producer:

1. MUST emit a recognized identifier for each Markleft annotation.
2. MUST emit a matching footnote definition when the annotation has a body.
3. MUST place detached code, image, and SVG anchors after the content they address.
4. SHOULD generate a seed that avoids collisions within the document.
5. SHOULD preserve existing comments and discussions when adding suggestions.
6. SHOULD propose edits through suggestions instead of changing reviewed body text directly.

## Compatibility

Markleft deliberately uses valid Markdown footnote syntax. A non-Markleft renderer may display the annotations as ordinary footnotes. A Markleft-aware renderer may instead hide the generated footnote anchors, highlight their targets, and show the definitions as contextual comment threads.

The following legacy identifiers exist in the current implementation:

```text
rangecomment-<seed>-<hash>-<length>
blockcomment-<seed>-<hash>
svg-<locator>-<x>-<y>-<seed>-<hash>
```

Consumers MAY read these forms for backward compatibility. Producers SHOULD emit the current identifier forms defined by this specification.

## Complete example

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

This example contains three root comments, one reply, and one block suggestion. The suggestion targets the paragraph and is linked to its related range comment.

[^suggest-block-39452-3c37]: Markleft is a footnote-based annotation format for f. It allows comments, discussions, and proposed changes to travel with a document without requiring a separate review database or a particular editor.

[^suggest-block-41712-1b41]: Markleft extends ordinary Markdown footnotes by ee semantics to a reserved family of footnote identifiers. A Markleft annotation has two main parts:
