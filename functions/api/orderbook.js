let cachedOrderBookData = null;

export async function onRequest(context) {
  const corsHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // METHOD POST: Menerima kiriman data matang dari Web Tools Anda di Browser
  if (context.request.method === "POST") {
    try {
      const body = await context.request.json();
      cachedOrderBookData = {
        status: "success",
        source: "web-tools-pushed-data",
        updatedAt: new Date().toISOString(),
        data: body.data
      };

      return new Response(JSON.stringify({ status: "success", message: "Data orderbook berhasil tersimpan di API" }), {
        status: 200,
        headers: corsHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 400, headers: corsHeaders });
    }
  }

  // METHOD GET: Menyajikan data matang ke Google Sheets (TIDAK ADA FETCH KELUAR SAMA SEKALI)
  if (context.request.method === "GET") {
    if (!cachedOrderBookData) {
      return new Response(
        JSON.stringify({
          status: "waiting",
          message: "Data Order Book belum dikirim dari Web Tools. Silakan buka Web Tools Anda terlebih dahulu.",
          data: { reku: { bids: [], asks: [] }, indodax: { bids: [], asks: [] }, tokocrypto: { bids: [], asks: [] }, pintu: { bids: [], asks: [] } }
        }, null, 2),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(JSON.stringify(cachedOrderBookData, null, 2), {
      status: 200,
      headers: corsHeaders
    });
  }
}
