import { gzipSync } from "node:zlib";
import { build, context } from "esbuild";
import { buildBookmarklet } from "./build-bookmarklet.mjs";

const args = new Set(process.argv.slice(2));
const development = args.has("--development") || args.has("--watch");
const watch = args.has("--watch");

const options = {
  entryPoints: ["src/local-md.ts"],
  outfile: "local-md.js",
  bundle: true,
  format: "iife",
  globalName: "LocalMdBundle",
  platform: "browser",
  target: "es2022",
  sourcemap: development ? "external" : false,
  minify: !development,
  splitting: false,
  banner: {
    js: development
      ? "/* local-md development build: source maps enabled */"
      : "/* local-md production build */",
  },
  define: {
    __LOCAL_MD_DEV__: JSON.stringify(development),
  },
};

if (watch) {
  const ctx = await context(options);
  const bookmarkletBytes = await buildBookmarklet();
  await ctx.watch();
  console.log(`bookmarklet.txt: ${bookmarkletBytes} bytes`);
  console.log("Watching src/local-md.ts -> local-md.js");
} else {
  const result = await build({ ...options, metafile: true });
  const output = result.outputFiles?.[0];
  const fs = await import("node:fs/promises");
  if (!development) {
    await fs.rm("local-md.js.map", { force: true });
  }
  const bytes = (await fs.stat("local-md.js")).size;
  const gzipBytes = gzipSync(await fs.readFile("local-md.js")).byteLength;
  if (!development) {
    console.log(`local-md.js: ${bytes} bytes, ${gzipBytes} bytes gzip`);
  } else {
    console.log(`development build written: ${bytes} bytes`);
  }
  const bookmarkletBytes = await buildBookmarklet();
  console.log(`bookmarklet.txt: ${bookmarkletBytes} bytes`);
  void output;
}
