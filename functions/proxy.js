const allowedProxyHosts = new Set([
  "tokocrypto.asia",
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: corsHeaders()
  });
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const targetRaw = requestUrl.searchParams.get("url");

  if (!targetRaw) {
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }

  let target;
  try {
    target = new URL(targetRaw);
  } catch {
    return jsonResponse({ error: "Invalid url parameter" }, 400);
  }

  if (target.protocol !== "https:" || !allowedProxyHosts.has(target.hostname)) {
    return jsonResponse({ error: "Proxy host is not allowed" }, 403);
  }

  const BROWSERLESS_TOKEN = "2UgSAmpChJzCm9Sfbc672c6f839acf97057ba6a4d1c104f62";

  // ========================================================
  // 1. TOKOCRYPTO & INDODAX: Menggunakan Browserless Server (Bypass Bot/Cloudflare)
  // ========================================================
  if (
    target.hostname === "api.tokocrypto.com" || 
    target.hostname === "www.tokocrypto.site" ||
    target.hostname === "indodax.com"
  ) {
    const browserlessUrl = `https://chrome.browserless.io/content?token=${BROWSERLESS_TOKEN}`;

    try {
      const response = await fetch(browserlessUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: target.toString(),
          waitUntil: "networkidle0"
        })
      });

      if (!response.ok) {
        throw new Error(`Browserless status: ${response.status}`);
      }

      const htmlContent = await response.text();
      let rawText = htmlContent.trim().replace(/<[^>]*>/g, "");

      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch {
        parsedData = { error: "Gagal memparsing teks layar menjadi JSON", raw: rawText };
      }

      return jsonResponse(parsedData, 200);

    } catch (scrapeError) {
      return jsonResponse({ error: "Bypass Gagal: " + scrapeError.message }, 502);
    }
  }

  // ========================================================
  // 2. EXCHANGE LAINNYA & BCA: Fetch Standard via Server
  // ========================================================
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json,text/html,application/xhtml+xml,*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
      }
    });
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store",
        "Content-Type": upstream.headers.get("content-type") || "text/plain; charset=utf-8"
      }
    });
  } catch (error) {
    return jsonResponse(
      { error: error.name === "AbortError" ? "Proxy timeout" : "Upstream fetch failed" },
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept"
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
