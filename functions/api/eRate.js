export async function onRequest(context) {
  try {
    // 1. Ambil data BCA E-Rate dari fungsi proxy internal web tools Anda
    const response = await fetch("https://testing-for-updates.pages.dev/functions/proxy?source=bca");
    
    if (!response.ok) {
      throw new Error(`Gagal mengambil data dari proxy: ${response.statusText}`);
    }

    const bcaData = await response.json();

    // 2. Format struktur JSON khusus modul BCA E-Rate USD
    const payload = {
      status: "success",
      currency: "USD/IDR",
      data: {
        harga_beli: bcaData.harga_beli || bcaData.buy || 0,   // Nilai Rp 18.075
        harga_jual: bcaData.harga_jual || bcaData.sell || 0,  // Nilai Rp 18.185
        tanggal_jam: bcaData.timestamp || bcaData.last_update || new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      }
    };

    // 3. Return JSON Response dengan CORS Header agar bisa dipanggil Google Sheets
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
