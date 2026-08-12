import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import { normalizeHtml } from "../editor/normalize-dom";
import { restoreRenderedHtmlCommentBlocks } from "../roundtrip/artifacts/html-comment";
import {
  extractPreservedRawHtmlBlocks,
  restorePreservedRawHtmlTokens,
} from "../roundtrip/artifacts/raw-html";

export async function htmlToMarkdown(html: string): Promise<string> {
  const rawHtmlSources: string[] = [];
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(extractPreservedRawHtmlBlocks, rawHtmlSources)
    .use(() => (tree) => {
      normalizeHtml(tree);
    })
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: "-",
      fences: true,
      rule: "-",
      emphasis: "*",
      strong: "*",
    })
    .process(restoreRenderedHtmlCommentBlocks(html));

  return restorePreservedRawHtmlTokens(String(file), rawHtmlSources);
}
