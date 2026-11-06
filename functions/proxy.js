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

  // ========================================================
  // JALUR KHUSUS TOKOCRYPTO: Menembak via HTTP API Browserless (Tanpa Modul Puppeteer)
  // ========================================================
  if (target.hostname === "api.tokocrypto.com" || target.hostname === "www.tokocrypto.site") {
    const BROWSERLESS_TOKEN = "2UgSAmpChJzCm9Sfbc672c6f839acf97057ba6a4d1c104f62";
    
    // Menggunakan Endpoint Kinerja Tinggi dari Browserless untuk langsung mengambil konten JSON
    const browserlessUrl = `https://chrome.browserless.io/content?token=${BROWSERLESS_TOKEN}`;

    try {
      // Menyuruh Browserless membuka web Tokocrypto dari server mereka
      const response = await fetch(browserlessUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: target.toString(),
          // Menunggu hingga jaringan tenang (data order book sudah dimuat lengkap)
          waitUntil: "networkidle0"
        })
      });

      if (!response.ok) {
        throw new Error(`Browserless membalas status: ${response.status}`);
      }

      // Browserless mengembalikan struktur HTML penuh dari halaman target
const htmlContent = await response.text();

// Menggunakan let agar variabelnya sah untuk diubah-ubah nilainya
let rawText = htmlContent.trim();

// Bersihkan sisa elemen pre-wrap HTML jika ada di layar browser
rawText = rawText.replace(/<[^>]*>/g, "");

let parsedData;
try {
  parsedData = JSON.parse(rawText);
} catch {
  parsedData = { error: "Gagal memparsing teks layar menjadi JSON asli", raw: rawText };
}

return jsonResponse(parsedData, 200);

    } catch (scrapeError) {
      return jsonResponse({ error: "Bypass Tokocrypto Gagal: " + scrapeError.message }, 502);
    }
  }

  // ========================================================
  // JALUR ORIGINAL: Bursa/Bank lainnya tetap menggunakan fetch bawaan Anda
  // ========================================================
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json,text/html,application/xhtml+xml,*/*",
        "User-Agent": "TreasuryDashboard/1.0"
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
