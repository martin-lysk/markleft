import { readFile, writeFile } from "node:fs/promises";

export async function buildBookmarklet() {
  const source = await readFile("bookmark.js", "utf8");
  const loaderUrl = process.env.LOCAL_MD_LOADER_URL;
  const configuredSource = loaderUrl
    ? source.replace(
        /^  var loaderUrl = ".*";$/m,
        `  var loaderUrl = ${JSON.stringify(loaderUrl)};`,
      )
    : source;
  if (loaderUrl && configuredSource === source) {
    throw new Error("Could not configure the bookmarklet loader URL.");
  }
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
