/**
 * Node.js production server for the built app.
 *
 * `vinext start` cannot be used here: its App Router server only serves
 * `/assets/*` from the literal request path, so with `basePath` configured
 * every `/workflow-intelligence/assets/*.js` request falls through to the RSC
 * handler and 404s. This server strips the basePath before the static lookup
 * and delegates everything else to the built worker entry (dist/server/index.js),
 * supplying the `ASSETS` binding it expects for file-backed responses.
 *
 * Env: PORT (default 3000), HOSTNAME (default 0.0.0.0),
 *      BASE_PATH (must match the value used at build time).
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDir, "..");
const distDir = path.join(projectRoot, "dist");
const clientDir = path.join(distDir, "client");
const workerEntry = path.join(distDir, "server", "index.js");

const basePath = (process.env.BASE_PATH ?? "/workflow-intelligence").replace(/\/+$/, "");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOSTNAME ?? "0.0.0.0";

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Strip the configured basePath from a pathname, or return null if absent. */
function stripBasePath(pathname) {
  if (!basePath) return pathname;
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length);
  return null;
}

/** Resolve a request pathname to a readable file inside dist/client. */
async function resolveStaticFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  const filePath = path.resolve(clientDir, `.${decoded.replaceAll("\\", "/")}`);
  if (filePath !== clientDir && !filePath.startsWith(clientDir + path.sep)) return null;

  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return null;
    return { filePath, size: stats.size, mtime: stats.mtimeMs };
  } catch {
    return null;
  }
}

function cacheControlFor(pathname) {
  // Build assets carry a content hash in the filename, so they are immutable.
  return pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "public, max-age=0, must-revalidate";
}

function sendFile(req, res, file, pathname, extraHeaders = {}) {
  const contentType = CONTENT_TYPES[path.extname(file.filePath).toLowerCase()] ?? "application/octet-stream";
  const etag = `W/"${file.size}-${Math.round(file.mtime)}"`;

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, { ETag: etag, "Cache-Control": cacheControlFor(pathname) });
    res.end();
    return;
  }

  res.writeHead(200, {
    ...extraHeaders,
    "Content-Type": contentType,
    "Content-Length": String(file.size),
    "Cache-Control": cacheControlFor(pathname),
    ETag: etag,
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(file.filePath).pipe(res);
}

/** ASSETS binding for the worker entry: file lookups relative to dist/client. */
const assets = {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    const lookupPath = stripBasePath(pathname) ?? pathname;
    const file = await resolveStaticFile(lookupPath);
    if (!file) return new Response("Not found", { status: 404 });

    const contentType = CONTENT_TYPES[path.extname(file.filePath).toLowerCase()] ?? "application/octet-stream";
    const body = Readable.toWeb(createReadStream(file.filePath));
    return new Response(body, {
      headers: { "Content-Type": contentType, "Content-Length": String(file.size) },
    });
  },
};

function toWebRequest(req) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    ...(hasBody ? { body: Readable.toWeb(req), duplex: "half" } : {}),
  });
}

async function sendWebResponse(res, response) {
  const headers = {};
  response.headers.forEach((value, key) => {
    if (key !== "set-cookie") headers[key] = value;
  });
  const setCookie = response.headers.getSetCookie?.() ?? [];
  if (setCookie.length > 0) headers["set-cookie"] = setCookie;

  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

const { default: worker } = await import(pathToFileURL(workerEntry).href);

const executionContext = {
  waitUntil(promise) {
    Promise.resolve(promise).catch(() => {});
  },
  passThroughOnException() {},
};

const server = createServer((req, res) => {
  void (async () => {
    try {
      const pathname = (req.url ?? "/").split("?")[0];
      const lookupPath = stripBasePath(pathname);

      // Static build output first — the worker entry does not serve /assets/.
      if (lookupPath) {
        const file = await resolveStaticFile(lookupPath);
        if (file) {
          sendFile(req, res, file, lookupPath);
          return;
        }
      }

      const response = await worker.fetch(toWebRequest(req), { ASSETS: assets }, executionContext);
      await sendWebResponse(res, response);
    } catch (error) {
      console.error("[server] Request failed:", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
    }
  })();
});

server.listen(port, host, () => {
  console.log(`\n  Manual-to-Flowchart Generator running at http://${host}:${port}${basePath || "/"}\n`);
});
