import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import puppeteer from "puppeteer-core"; // Menggunakan core yang super ringan untuk Cloudflare

const port = Number.parseInt(process.env.PORT || "8000", 10);
const host = "127.0.0.1";
const root = resolve(".");

const BROWSERLESS_TOKEN = "2UgSAmpChJzCm9Sfbc672c6f839acf97057ba6a4d1c104f62";

const allowedProxyHosts = new Set([
  "api.reku.id",
  "www.tokocrypto.site",
  "cloudme-toko.2meta.app",
  "api.tokocrypto.com", 
  "indodax.com",
  "api.pintu.pro",
  "api.pintupro.com",
  "api.uat.pintupro.com",
  "www.bca.co.id"
]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${host}:${port}`);

    if (url.pathname === "/proxy") {
      await proxyRequest(url, res);
      return;
    }

    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const filePath = resolve(join(root, relativePath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = types[ext] || "application/octet-stream";

    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`Server berjalan di http://${host}:${port}/`);
});

async function proxyRequest(url, res) {
  const targetRaw = url.searchParams.get("url");
  if (!targetRaw) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Missing url parameter" }));
    return;
  }

  const target = new URL(targetRaw);

  // MENGGOCEKK TOKOCRYPTO VIA REMOTE BROWSERLESS DI CLOUDFLARE PAGES
  if (target.hostname === "api.tokocrypto.com" || target.hostname === "www.tokocrypto.site") {
    let browser = null;
    try {
      // Menyambungkan server Cloudflare Pages Anda ke browser gaib di cloud Browserless
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
      });

      const page = await browser.newPage();
      await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

      // Menembak endpoint asli Tokocrypto
      await page.goto(target.toString(), { waitUntil: "networkidle0", timeout: 15000 });
      const plainText = await page.evaluate(() => document.body.innerText);

      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(plainText);
      return;

    } catch (scrapeError) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Cloudflare Pages gagal scrape: " + scrapeError.message }));
      return;
    } finally {
      if (browser) await browser.close();
    }
  }

  // JALUR BURSA LAIN: Tetap menggunakan fetch biasa bawaan Cloudflare Pages yang super cepat
  if (!allowedProxyHosts.has(target.hostname)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Proxy host is not allowed" }));
    return;
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const body = await response.text();
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(body);
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Upstream fetch failed" }));
  }
}
