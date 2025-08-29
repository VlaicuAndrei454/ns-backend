const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Assuming you have this
const {
  addBudget,
  getAllBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
  getCategorySpendingLast30Days // New controller function
} = require('../controllers/budgetController');

// Apply auth middleware to all budget routes
router.use(protect);

router.route('/')
  .post(addBudget)
  .get(getAllBudgets);

// New route for fetching category spending
router.route('/category-spending-last-30-days')
    .get(getCategorySpendingLast30Days);

router.route('/:id')
  .get(getBudgetById)
  .put(updateBudget)
  .delete(deleteBudget);

module.exports = router;