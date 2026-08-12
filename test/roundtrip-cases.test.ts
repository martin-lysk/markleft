import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { markdownBlockRanges, type MarkdownBlockKind } from "../src/roundtrip/blocks";
import { htmlToMarkdown } from "../src/markdown/from-html";
import { markdownToHtml } from "../src/markdown/to-html";

interface RoundtripCase {
  name: string;
  description: string;
  markdown: string;
  blocks?: Array<{
    kind: MarkdownBlockKind;
    markdown: string;
  }>;
  renderRoundtrip?: {
    expectedMarkdown: string;
  };
}

const casesDir = join(import.meta.dirname, "fixtures", "roundtrip-cases");

describe("roundtrip fixtures", () => {
  for (const fileName of readdirSync(casesDir).filter((file) => file.endsWith(".json")).sort()) {
    const fixture = JSON.parse(readFileSync(join(casesDir, fileName), "utf8")) as RoundtripCase;

    test(`${fixture.name}: source block ranges`, () => {
      if (!fixture.blocks) return;

      expect(markdownBlockRanges(fixture.markdown, { includeHtmlComments: true }).map(pickBlockSnapshot)).toEqual(fixture.blocks);
    });

    test(`${fixture.name}: render roundtrip`, async () => {
      if (!fixture.renderRoundtrip) return;

      const html = await markdownToHtml(fixture.markdown);
      const markdown = await htmlToMarkdown(html);

      expect(normalizeMarkdown(markdown)).toBe(normalizeMarkdown(fixture.renderRoundtrip.expectedMarkdown));
    });
  }
});

function pickBlockSnapshot(block: { kind: MarkdownBlockKind; markdown: string }) {
  return {
    kind: block.kind,
    markdown: block.markdown,
  };
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
