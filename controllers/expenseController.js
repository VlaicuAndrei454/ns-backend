const xlsx = require('xlsx');
const Expense = require("../models/Expense");

const PREDEFINED_EXPENSE_CATEGORIES = [
  "Groceries", "Restaurants", "Transport", "Services",
  "Cashback", "Credit", "Subscription", "Entertainment", "Gift", "Other" 
];

// Add Expense
exports.addExpense = async (req, res) => {
  const userId = req.user.id;

  try {
    const { name, icon, category, amount, date } = req.body; // Added name

    if (!name || !category || !amount || !date) { // Added name to check
      return res.status(400).json({ message: "Name, category, amount, and date are required." });
    }

    if (!PREDEFINED_EXPENSE_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `Invalid category: ${category}. Supported categories are: ${PREDEFINED_EXPENSE_CATEGORIES.join(', ')}` });
    }

    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number." });
    }

    const newExpense = new Expense({
      userId,
      name, // Added name
      icon,
      category,
      amount: parseFloat(amount),
      date: new Date(date),
    });

    await newExpense.save();
    res.status(201).json(newExpense);
  } catch (error) {
    console.error("Error in addExpense:", error);
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: "Server Error adding expense." });
  }
};

// Get All Expenses (For Logged-in User)
exports.getAllExpenses = async (req, res) => {
  const userId = req.user.id;
  try {
    const expenses = await Expense.find({ userId }).sort({ date: -1, createdAt: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    console.error("Error in getAllExpenses:", error);
    res.status(500).json({ message: "Server Error fetching expenses." });
  }
};

// Delete Expense
exports.deleteExpense = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    const expense = await Expense.findOneAndDelete({ _id: id, userId: userId });
    if (!expense) {
        return res.status(404).json({ message: "Expense not found or user not authorized." });
    }
    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Error in deleteExpense:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: "Invalid expense ID format." });
    }
    res.status(500).json({ message: "Server Error deleting expense." });
  }
};

// Download Expense Details in Excel
exports.downloadExpenseExcel = async (req, res) => {
  const userId = req.user.id;
  try {
    const expenses = await Expense.find({ userId }).sort({ date: -1 });

    const data = expenses.map((item) => ({
      Name: item.name, // Added Name
      Category: item.category,
      Amount: item.amount,
      Date: item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
      Icon: item.icon || 'N/A',
      CreatedAt: new Date(item.createdAt).toLocaleString(),
    }));
    
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "Expenses");
    
    res.setHeader('Content-Disposition', 'attachment; filename="expense_details.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    const buf = xlsx.write(wb, { type: 'buffer', bookType: "xlsx" });
    res.send(buf);

  } catch (error) {
    console.error("Error in downloadExpenseExcel:", error);
    res.status(500).json({ message: "Server Error downloading expenses." });
  }
};

// Forecast Expenses
exports.forecastExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysSoFar = now.getDate();
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const expensesThisMonth = await Expense.find({
      userId,
      date: { $gte: startOfMonth, $lte: now },
    });

    const totalSpentThisMonth = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);
    const averageDailySpending = daysSoFar > 0 ? totalSpentThisMonth / daysSoFar : 0;
    const projectedMonthlySpending = averageDailySpending * totalDaysInMonth;

    res.status(200).json({
      totalSpent: totalSpentThisMonth,
      averageDaily: +averageDailySpending.toFixed(2),
      daysSoFar,
      totalDaysInMonth,
      forecast: +projectedMonthlySpending.toFixed(2),
    });
  } catch (err) {
    console.error("Error in forecastExpenses:", err);
    res.status(500).json({ message: 'Server Error forecasting expenses.', error: err.message });
  }
};