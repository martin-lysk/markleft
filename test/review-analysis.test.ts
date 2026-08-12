import { describe, expect, it, vi } from "vitest";
import { createReviewAnalysisCache } from "../src/editor/review-analysis";
import { parseBlockSuggestions, parseComments } from "../src/markdown/comments";

describe("review analysis cache", () => {
  it("parses once per Markdown revision regardless of repeated layout passes", () => {
    const parseCommentsSpy = vi.fn(parseComments);
    const parseSuggestionsSpy = vi.fn(parseBlockSuggestions);
    const analyze = createReviewAnalysisCache(parseCommentsSpy, parseSuggestionsSpy);
    const markdown = Array.from(
      { length: 20 },
      (_, index) => `Paragraph ${index}[^block-12345-c${index}]\n\n[^block-12345-c${index}]: Comment ${index}`,
    ).join("\n\n");

    for (let layoutPass = 0; layoutPass < 50; layoutPass += 1) analyze(markdown);

    expect(parseCommentsSpy).toHaveBeenCalledTimes(1);
    expect(parseSuggestionsSpy).toHaveBeenCalledTimes(1);

    analyze(`${markdown}\n`);
    expect(parseCommentsSpy).toHaveBeenCalledTimes(2);
    expect(parseSuggestionsSpy).toHaveBeenCalledTimes(2);
  });
});
