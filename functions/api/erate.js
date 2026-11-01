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

    // Memanggil ENGINE DATA INTERNAL web tools Anda (functions/proxy.js)
    // Tanpa menyebut atau menembak URL BCA sama sekali
    const response = await fetch(`${origin}/proxy?source=bca`);

    if (!response.ok) {
      throw new Error(`Engine internal web tools merespon HTTP ${response.status}`);
    }

    const internalData = await response.json();

    // Merapikan data keluaran engine web tools Anda menjadi format API
    const payload = {
      status: "success",
      source: "web-tools-engine",
      currency: "USD/IDR",
      data: {
        harga_beli: internalData.harga_beli || internalData.buy || 0,
        harga_jual: internalData.harga_jual || internalData.sell || 0,
        tanggal_jam: internalData.tanggal_jam || internalData.updatedAtText || internalData.timestamp || "BCA Live"
      }
    };

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message
      }, null, 2),
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
