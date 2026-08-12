import { createRoundtripReportCase, reportFileName } from "../src/roundtrip/report";

test("creates a downloadable roundtrip fixture from the current markdown", () => {
  const report = createRoundtripReportCase({
    markdown: "# Title\n\n<!-- truncate -->\n\n- One\n- Two\n",
    description: "Comment after HTML comment attaches to the wrong block",
    context: {
      location: "file:///tmp/readme.md",
      mode: "review",
      activeCommentId: "suggest-block-12345-abcd",
      selection: {
        text: "One",
        start: 24,
        end: 27,
      },
    },
    createdAt: new Date("2026-07-31T10:20:30.000Z"),
  });

  expect(report.name).toBe("Comment after HTML comment attaches to the wrong block");
  expect(report.blocks.map((block) => block.kind)).toEqual(["heading", "html-comment", "list"]);
  expect(report.editorContext.mode).toBe("review");
  expect(report.createdAt).toBe("2026-07-31T10:20:30.000Z");
});

test("creates stable report file names", () => {
  expect(
    reportFileName({
      name: "Comment after HTML comment attaches to the wrong block",
      createdAt: "2026-07-31T10:20:30.000Z",
    }),
  ).toBe("2026-07-31-comment-after-html-comment-attaches-to-the-wrong-block.roundtrip-case.json");
});
