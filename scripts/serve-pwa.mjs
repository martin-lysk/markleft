import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";

const outputDirectory = resolve("dist/pwa");
const port = Number(process.env.PORT ?? 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  if (!request.url || request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  } catch {
    response.writeHead(400).end("Invalid URL");
    return;
  }

  const candidate = resolve(outputDirectory, `.${pathname === "/" ? "/index.html" : pathname}`);
  if (candidate !== outputDirectory && !candidate.startsWith(`${outputDirectory}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const file = await stat(candidate);
    if (!file.isFile()) throw new Error("Not a file");
    const extension = candidate.slice(candidate.lastIndexOf("."));
    response.writeHead(200, {
      "Cache-Control": "no-cache",
      "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
    });
    createReadStream(candidate).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Markleft PWA: http://localhost:${port}`);
});
