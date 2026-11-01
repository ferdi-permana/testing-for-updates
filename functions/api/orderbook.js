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

  const { origin } = new URL(context.request.url);

  if (context.request.method === "POST") {
    try {
      let payloadData = null;
      const contentType = context.request.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const body = await context.request.json();
        payloadData = body.data;
      }

      if (!payloadData) {
        payloadData = await fetchOrderBookFromInternalProxy(origin);
      }

      const cachePayload = {
        status: "success",
        source: "web-tools-kv-storage",
        updatedAt: new Date().toISOString(),
        data: payloadData
      };

      if (context.env && context.env.ORDERBOOK_KV) {
        await context.env.ORDERBOOK_KV.put("LATEST_ORDERBOOK", JSON.stringify(cachePayload));
      }

      return new Response(JSON.stringify({ status: "success", message: "Data orderbook tersimpan di KV Storage 24/7" }), {
        status: 200,
        headers: corsHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  if (context.request.method === "GET") {
    try {
      let cachedData = null;

      if (context.env && context.env.ORDERBOOK_KV) {
        const rawKv = await context.env.ORDERBOOK_KV.get("LATEST_ORDERBOOK");
        if (rawKv) {
          cachedData = JSON.parse(rawKv);
        }
      }

      if (!cachedData) {
        const freshData = await fetchOrderBookFromInternalProxy(origin);
        cachedData = {
          status: "success",
          source: "web-tools-auto-fallback",
          updatedAt: new Date().toISOString(),
          data: freshData
        };

        if (context.env && context.env.ORDERBOOK_KV) {
          await context.env.ORDERBOOK_KV.put("LATEST_ORDERBOOK", JSON.stringify(cachedData));
        }
      }

      return new Response(JSON.stringify(cachedData, null, 2), {
        status: 200,
        headers: corsHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 500, headers: corsHeaders });
    }
  }
}

async function fetchOrderBookFromInternalProxy(origin) {
  const customHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
  };

  const [rekuRes, indodaxRes, tokoRes, pintuRes] = await Promise.allSettled([
    // Reku: Tambahkan headers User-Agent agar tidak diblokir
    fetch("https://api.reku.id/v2/orderbook?symbol=USDT_IDR", { headers: customHeaders }),
    
    // Indodax via Proxy
    fetch(`${origin}/proxy?url=${encodeURIComponent("https://indodax.com/api/depth/usdtidr")}`),
    
    // Tokocrypto: Lewatkan via Proxy Internal dan limit 20
    fetch(`${origin}/proxy?url=${encodeURIComponent("https://data-api.binance.vision/api/v3/depth?symbol=USDTIDR&limit=20")}`),
    
    // Pintu Pro via Proxy
    fetch(`${origin}/proxy?url=${encodeURIComponent("https://api.pintu.pro/v1/public/get-book?symbol=USDT-IDR&depth=20")}`)
  ]);

  const parseSide = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
      let price = 0, qty = 0;
      if (Array.isArray(item)) {
        price = parseFloat(item[0]) || 0;
        qty = parseFloat(item[1]) || 0;
      } else if (typeof item === 'object' && item !== null) {
        price = parseFloat(item.price || item.p) || 0;
        qty = parseFloat(item.volume || item.qty || item.v) || 0;
      }
      return { price, qty, notional: price * qty };
    }).filter(row => row.price > 0 && row.qty > 0);
  };

  const cleanBook = (bidsRaw, asksRaw) => ({
    bids: parseSide(bidsRaw).sort((a, b) => b.price - a.price).slice(0, 10),
    asks: parseSide(asksRaw).sort((a, b) => a.price - b.price).slice(0, 10)
  });

  let reku = { bids: [], asks: [] };
  if (rekuRes.status === "fulfilled" && rekuRes.value.ok) {
    const j = await rekuRes.value.json();
    reku = cleanBook(j.bids || j.b || [], j.asks || j.s || []);
  }

  let indodax = { bids: [], asks: [] };
  if (indodaxRes.status === "fulfilled" && indodaxRes.value.ok) {
    const j = await indodaxRes.value.json();
    indodax = cleanBook(j.buy || j.bids || [], j.sell || j.asks || []);
  }

  let tokocrypto = { bids: [], asks: [] };
  if (tokoRes.status === "fulfilled" && tokoRes.value.ok) {
    const j = await tokoRes.value.json();
    tokocrypto = cleanBook(j.bids || [], j.asks || []);
  }

  let pintu = { bids: [], asks: [] };
  if (pintuRes.status === "fulfilled" && pintuRes.value.ok) {
    const j = await pintuRes.value.json();
    const payload = j.data || j;
    pintu = cleanBook(payload.bids || [], payload.asks || []);
  }

  return { reku, indodax, tokocrypto, pintu };
}
