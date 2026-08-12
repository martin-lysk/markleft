# Roundtrip Regression Cases

Each `.json` file in this folder is loaded by `test/roundtrip-cases.test.ts`.

Use this when an editor bug is easiest to describe with the Markdown that came out of the tool:

```sh
pnpm case:roundtrip -- --name "short case name" --markdown path/to/problem.md --description "What went wrong"
pnpm test -- test/roundtrip-cases.test.ts
```

Fixture fields:

- `name`: readable test name.
- `description`: short explanation of the editor bug or expectation.
- `markdown`: the Markdown source from the report.
- `blocks`: optional source-block snapshots expected from the shared block parser.
- `renderRoundtrip.expectedMarkdown`: optional Markdown expected after Markdown -> HTML -> Markdown conversion.

Start with only `name`, `description`, and `markdown` when capturing a fresh bug. Add `blocks` or `renderRoundtrip` once the failing behavior is understood.
