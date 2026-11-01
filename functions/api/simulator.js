const FeesBuy = {
  reku: { makerFee: 0.0010555, takerFee: 0.0010555 },
  pintu: { makerFee: 0.0012555, takerFee: 0.0017555 },
  indodax: {
    regular: { makerFee: 0.0010555, takerFee: 0.0020555 },
    vip:     { makerFee: 0.0000555, takerFee: 0.0010555 }
  },
  tokocrypto: {
    regular: { makerFee: 0.001222, takerFee: 0.002222 },
    vip1:    { makerFee: 0.001197, takerFee: 0.002166 },
    vip2:    { makerFee: 0.001172, takerFee: 0.002122 },
    vip3:    { makerFee: 0.001122, takerFee: 0.002022 },
    vip4:    { makerFee: 0.001022, takerFee: 0.001822 },
    vip5:    { makerFee: 0.000922, takerFee: 0.001622 },
    vip6:    { makerFee: 0.000722, takerFee: 0.001242 },
    vip7:    { makerFee: 0.000682, takerFee: 0.001172 },
    vip8:    { makerFee: 0.000642, takerFee: 0.001122 },
    vip9:    { makerFee: 0.000582, takerFee: 0.001002 }
  }
};

const FeesSell = {
  reku: { makerFee: 0.0031555, takerFee: 0.0031555 },
  pintu: { makerFee: 0.0033555, takerFee: 0.0038555 },
  indodax: {
    regular: { makerFee: 0.0031555, takerFee: 0.0041555 },
    vip:     { makerFee: 0.0021555, takerFee: 0.0031555 }
  },
  tokocrypto: {
    regular: { makerFee: 0.003322, takerFee: 0.004322 },
    vip1:    { makerFee: 0.003297, takerFee: 0.004266 },
    vip2:    { makerFee: 0.003272, takerFee: 0.004222 },
    vip3:    { makerFee: 0.003222, takerFee: 0.004122 },
    vip4:    { makerFee: 0.003122, takerFee: 0.003922 },
    vip5:    { makerFee: 0.003022, takerFee: 0.003722 },
    vip6:    { makerFee: 0.002822, takerFee: 0.003342 },
    vip7:    { makerFee: 0.002782, takerFee: 0.003272 },
    vip8:    { makerFee: 0.002742, takerFee: 0.003222 },
    vip9:    { makerFee: 0.002682, takerFee: 0.003102 }
  }
};

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
    const url = new URL(context.request.url);
    
    const mode = (url.searchParams.get("mode") || "buy").toLowerCase();

    let amount = parseFloat(url.searchParams.get("amount"));
    if (isNaN(amount) || amount <= 0) {
      amount = 100;
    }

    const indodaxLvl = (url.searchParams.get("indodax_lvl") || "regular").toLowerCase();
    const tokoLvl = (url.searchParams.get("toko_lvl") || "regular").toLowerCase();

    let orderBookData = null;
    if (context.env && context.env.ORDERBOOK_KV) {
      const rawKv = await context.env.ORDERBOOK_KV.get("LATEST_ORDERBOOK");
      if (rawKv) {
        const parsed = JSON.parse(rawKv);
        orderBookData = parsed.data || parsed;
      }
    }

    if (!orderBookData) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Data Order Book belum tersedia di KV Storage."
      }, null, 2), { status: 400, headers: corsHeaders });
    }

    const activeFees = mode === "sell" ? FeesSell : FeesBuy;

    const ratesConfig = {
      reku: activeFees.reku,
      indodax: activeFees.indodax[indodaxLvl] || activeFees.indodax.regular,
      tokocrypto: activeFees.tokocrypto[tokoLvl] || activeFees.tokocrypto.regular,
      pintu: activeFees.pintu
    };

    const processRounding = (val) => {
      if (!val || isNaN(val) || val <= 0) return 0;
      return mode === "buy" ? Math.ceil(val - 1e-9) : Math.floor(val + 1e-9);
    };

    const normalizeOrders = (arr) => {
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
        return { price, qty };
      }).filter(x => x.price > 0 && x.qty > 0);
    };

    const results = {};

    Object.keys(ratesConfig).forEach((key) => {
      const data = orderBookData[key];
      const config = ratesConfig[key];

      if (!data || !config) {
        results[key] = { maker: 0, taker: 0 };
        return;
      }

      let makerPrice = 0;
      let takerPrice = 0;

      const bids = normalizeOrders(data.bids);
      const asks = normalizeOrders(data.asks);

      if (mode === "buy") {
        // MAKER BUY
        const bestBid = bids.length > 0 ? bids[0].price : 0;
        if (bestBid > 0) {
          makerPrice = processRounding(bestBid * (1 + config.makerFee));
        }

        // TAKER BUY (VWAP Asks)
        let remainingSize = amount;
        let totalCostIdr = 0;
        let totalFilledQty = 0;
        const sortedAsks = [...asks].sort((a, b) => a.price - b.price);

        for (const order of sortedAsks) {
          const fillQty = Math.min(remainingSize, order.qty);
          totalCostIdr += fillQty * order.price;
          totalFilledQty += fillQty;
          remainingSize -= fillQty;

          if (remainingSize <= 1e-8) break;
        }

        if (totalFilledQty > 0) {
          const vwapPrice = totalCostIdr / totalFilledQty;
          takerPrice = processRounding(vwapPrice * (1 + config.takerFee));
        }

      } else {
        // MAKER SELL
        const bestAsk = asks.length > 0 ? asks[0].price : 0;
        if (bestAsk > 0) {
          makerPrice = processRounding(bestAsk * (1 - config.makerFee));
        }

        // TAKER SELL (VWAP Bids)
        let remainingSize = amount;
        let totalRevenueIdr = 0;
        let totalFilledQty = 0;
        const sortedBids = [...bids].sort((a, b) => b.price - a.price);

        for (const order of sortedBids) {
          const fillQty = Math.min(remainingSize, order.qty);
          totalRevenueIdr += fillQty * order.price;
          totalFilledQty += fillQty;
          remainingSize -= fillQty;

          if (remainingSize <= 1e-8) break;
        }

        if (totalFilledQty > 0) {
          const vwapPrice = totalRevenueIdr / totalFilledQty;
          takerPrice = processRounding(vwapPrice * (1 - config.takerFee));
        }
      }

      results[key] = {
        maker: makerPrice,
        taker: takerPrice
      };
    });

    return new Response(JSON.stringify({
      status: "success",
      timestamp: new Date().toISOString(),
      params: { mode, amount, levels: { indodax: indodaxLvl, tokocrypto: tokoLvl } },
      data: results
    }, null, 2), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    return new Response(JSON.stringify({ status: "error", message: err.message }), { status: 500, headers: corsHeaders });
  }
}
