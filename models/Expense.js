const mongoose = require("mongoose");

const PREDEFINED_EXPENSE_CATEGORIES = [
  "Groceries", "Restaurants", "Transport", "Services",
  "Cashback", "Credit", "Subscription", "Entertainment", "Gift", "Rent", "Other"
];

const ExpenseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { // Added name field
    type: String, 
    trim: true, 
    required: [true, "Expense name/description is required."],
    maxlength: [100, "Expense name cannot exceed 100 characters."] // Optional: add a max length
  },
  icon: { type: String },
  category: {
    type: String,
    required: [true, "Category is required."],
    enum: {
        values: PREDEFINED_EXPENSE_CATEGORIES,
        message: '{VALUE} is not a supported category.'
    },
  },
  amount: { type: Number, required: [true, "Amount is required."], min: [0.01, 'Amount must be positive.'] },
  date: { type: Date, default: Date.now, required: [true, "Date is required."] },
}, { timestamps: true });

module.exports = mongoose.model("Expense", ExpenseSchema);