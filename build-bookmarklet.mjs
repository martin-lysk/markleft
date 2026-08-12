import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function buildBookmarkLoader({
  outfile,
  loaderUrl = process.env.LOCAL_MD_LOADER_URL,
} = {}) {
  const source = await readFile("bookmark.js", "utf8");
  const noMarkdownSource = (await readFile("no-markdown.md", "utf8")).replace(/\r\n?/g, "\n");
  let configuredSource = source.replace(
    /\/\* __MARKLEFT_NO_MARKDOWN_SOURCE__ \*\/ ""/,
    JSON.stringify(noMarkdownSource),
  );
  if (configuredSource === source) {
    throw new Error("Could not embed no-markdown.md in the bookmarklet loader.");
  }
  configuredSource = loaderUrl
    ? configuredSource.replace(
        /^  var loaderUrl = ".*";$/m,
        `  var loaderUrl = ${JSON.stringify(loaderUrl)};`,
      )
    : configuredSource;
  if (loaderUrl && !configuredSource.includes(`var loaderUrl = ${JSON.stringify(loaderUrl)};`)) {
    throw new Error("Could not configure the bookmarklet loader URL.");
  }
  if (outfile) {
    await mkdir(dirname(outfile), { recursive: true });
    await writeFile(outfile, configuredSource);
  }
  return configuredSource;
}

export async function buildBookmarklet() {
  const configuredSource = await buildBookmarkLoader();
  const encodedSource = Buffer.from(configuredSource, "utf8").toString("base64");
  const bookmarklet = `javascript:(()=>{const s=document.createElement("script");s.textContent=atob(${JSON.stringify(encodedSource)});document.documentElement.append(s)})()`;
  await writeFile("bookmarklet.txt", `${bookmarklet}\n`);
  await writeFile("bookmark.txt", `${bookmarklet}\n`);
  return bookmarklet.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const bytes = await buildBookmarklet();
  console.log(`bookmarklet.txt: ${bytes} bytes`);
  console.log(`bookmark.txt: ${bytes} bytes`);
}
