let bcaCache = {
  harga_beli: 0,
  harga_jual: 0,
  tanggal_jam: "-",
  last_updated: null
};

export async function onRequest(context) {
  const { request } = context;
  const corsHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  // Handle preflight request CORS
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. JIKA WEB TOOLS MENGIRIM DATA BARU (POST DARI INDEX.HTML)
  if (request.method === "POST") {
    try {
      const body = await request.json();
      
      // Simpan data ke cache
      bcaCache = {
        harga_beli: body.buy || body.harga_beli || 0,
        harga_jual: body.sell || body.harga_jual || 0,
        tanggal_jam: body.updatedAtText || body.tanggal_jam || new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
        last_updated: new Date().toISOString()
      };

      return new Response(JSON.stringify({ status: "success", message: "Data BCA berhasil disimpan ke API cache" }), {
        status: 200,
        headers: corsHeaders
      });
    } catch (err) {
      return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 400, headers: corsHeaders });
    }
  }

  // 2. JIKA GOOGLE SHEETS MEMANGGIL API (GET /api/erate)
  return new Response(
    JSON.stringify({
      status: "success",
      source: "web-tools-cache",
      data: {
        harga_beli: bcaCache.harga_beli,
        harga_jual: bcaCache.harga_jual,
        tanggal_jam: bcaCache.tanggal_jam
      }
    }, null, 2),
    {
      status: 200,
      headers: corsHeaders
    }
  );
}
