// backend/routes/stocksRoutes.js
const express = require("express");
const {
  getStockQuotes,
  getStockHistory,
} = require("../controllers/stocksController");
const router = express.Router();

router.get("/quotes", getStockQuotes);
router.get("/history/:symbol", getStockHistory);

module.exports = router;
