// routes/expenseRoutes.js
const express = require('express');
const {
  addExpense,
  getAllExpenses,
  deleteExpense,
  downloadExpenseExcel,
  forecastExpenses,        // ← import it
} = require('../controllers/expenseController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/add',          protect, addExpense);
router.get('/get',           protect, getAllExpenses);
router.get('/downloadexcel', protect, downloadExpenseExcel);
router.get('/forecast',      protect, forecastExpenses);  // ← new

router.delete('/:id',        protect, deleteExpense);

module.exports = router;
