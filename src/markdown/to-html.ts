import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { renderHtmlCommentBlocks } from "../roundtrip/artifacts/html-comment";
import { preserveRawHtmlBlocks } from "../roundtrip/artifacts/raw-html";

export async function markdownToHtml(markdown: string): Promise<string> {
  const markdownHtml = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(preserveRawHtmlBlocks, markdown)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  const parsedHtml = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeStringify)
    .process(String(markdownHtml));

  return renderHtmlCommentBlocks(String(parsedHtml));
}
