import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

// An intentionally strict static server: no SPA fallback, dev transform or root assets.
const root = resolve(
  process.env.PRODUCTION_DIST ??
    fileURLToPath(new URL("../dist", import.meta.url)),
);
const prefix = "/magical-athlete/";
const port = Number(process.env.PRODUCTION_PORT ?? 4178);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};
await stat(resolve(root, "index.html")).catch(() => {
  throw new Error(
    "Production dist/index.html is missing. Run npm run build first.",
  );
});
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method ?? "")) {
      response.writeHead(405);
      response.end();
      return;
    }
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === prefix.slice(0, -1)) {
      response.writeHead(308, { Location: prefix + url.search });
      response.end();
      return;
    }
    if (!url.pathname.startsWith(prefix)) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    const relative =
      decodeURIComponent(url.pathname.slice(prefix.length)) || "index.html";
    const path = resolve(root, relative);
    if (!path.startsWith(root + sep) || relative.includes("\0")) {
      response.writeHead(403);
      response.end();
      return;
    }
    const file = await stat(path);
    if (!file.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }
    const content = await readFile(path);
    response.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
      "Content-Length": content.byteLength,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404);
    response.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  process.stdout.write(
    `Production subpath: http://127.0.0.1:${port}${prefix}\n`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
