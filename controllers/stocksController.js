// backend/controllers/stocksController.js
const axios = require("axios");
const API_KEY = process.env.FINNHUB_API_KEY;
if (!API_KEY) {
  console.error("Missing FINNHUB_API_KEY in your environment!");
}

// GET /api/v1/stocks/quotes?symbols=AAPL,MSFT,...
exports.getStockQuotes = async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ message: "symbols query parameter is required" });
    }
    const syms = symbols.split(",").map((s) => s.trim());
    // Fire all quote requests in parallel
    const calls = syms.map((symbol) => {
      const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
      return axios.get(url).then((resp) => {
        // resp.data.c = current price
        return { symbol, price: resp.data.c || 0 };
      });
    });

    const result = {};
    (await Promise.all(calls)).forEach(({ symbol, price }) => {
      result[symbol] = price;
    });
    return res.json(result);
  } catch (err) {
    console.error("getStockQuotes error:", err.response?.data || err.message);
    return res.status(502).json({ message: "Failed to fetch quotes", details: err.response?.data });
  }
};

// GET /api/v1/stocks/history/:symbol
exports.getStockHistory = async (req, res) => {
  try {
    const symbol = req.params.symbol;
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60; // 30 days ago
    const url = `https://finnhub.io/api/v1/stock/candle` +
                `?symbol=${symbol}` +
                `&resolution=D` +
                `&from=${from}&to=${now}` +
                `&token=${API_KEY}`;

    const resp = await axios.get(url);
    if (resp.data.s !== "ok" || !resp.data.t) {
      console.warn(`No history for ${symbol}`, resp.data);
      return res.json([]);
    }

    const data = resp.data.t.map((ts, i) => ({
      date: new Date(ts * 1000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      price: resp.data.c[i], // closing price
    }));

    return res.json(data);
  } catch (err) {
    console.error("getStockHistory error:", err.response?.data || err.message);
    return res.status(502).json({ message: "Failed to fetch history", details: err.response?.data });
  }
};
