// functions/api/erate.js

export async function onRequest(context) {
  const corsHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin } = new URL(context.request.url);

    // 1. Memanggil ENGINE PROXY INTERNAL web tools Anda (functions/proxy.js)
    // Mengirimkan parameter URL target yang sesuai dengan ekspektasi proxy.js
    const targetUrl = "https://www.bca.co.id/id/informasi/kurs";
    const proxyResponse = await fetch(`${origin}/proxy?url=${encodeURIComponent(targetUrl)}`);

    if (!proxyResponse.ok) {
      throw new Error(`Proxy internal merespon status HTTP ${proxyResponse.status}`);
    }

    const htmlText = await proxyResponse.text();

    // 2. Parsing teks HTML (Persis seperti logika Regex di index.html Anda)
    const cleanText = htmlText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    const updateMatch = cleanText.match(/Terakhir diperbarui pada\s+(.+?)\s+Kurs jual/i) || 
                       cleanText.match(/Terakhir diperbarui pada\s+(.+?WIB)/i);

    const usdMatch = cleanText.match(/USD\s+E-Rate\s+Beli\s+([\d.,]+)\s+Jual\s+([\d.,]+)/i) || 
                     cleanText.match(/USD\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);

    if (!usdMatch) {
      throw new Error("Format USD e-Rate tidak ditemukan dari hasil tangkapan proxy internal.");
    }

    const buyPrice = parseLocaleNumber(usdMatch[1]);
    const sellPrice = parseLocaleNumber(usdMatch[2]);
    const updatedAt = updateMatch ? updateMatch[1].trim() : "BCA Live";

    // 3. Output JSON bersih untuk Google Sheets
    return new Response(
      JSON.stringify({
        status: "success",
        source: "web-tools-proxy",
        data: {
          harga_beli: buyPrice,
          harga_jual: sellPrice,
          tanggal_jam: updatedAt
        }
      }, null, 2),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message
      }, null, 2),
      { status: 500, headers: corsHeaders }
    );
  }
}

function parseLocaleNumber(v) {
  if (!v) return 0;
  const t = String(v).trim();
  if (t.includes(".") && t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (t.includes(",")) return Number(t.replace(/,/g, ""));
  return Number(t) || 0;
}
