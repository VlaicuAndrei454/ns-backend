const mongoose = require("mongoose");

// Ensure this list is consistent with PREDEFINED_EXPENSE_CATEGORIES in your Expense.js model
const PREDEFINED_BUDGET_CATEGORIES = [
  "Groceries", "Restaurants", "Transport", "Services",
  "Cashback", "Credit", "Subscription", "Entertainment", "Gift", "Rent" , "Other"
];

// Sub-schema for individual category allocations within a budget period
const CategoryAllocationSchema = new mongoose.Schema({
  category: {
    type: String,
    required: [true, "Category is required for allocation."],
    enum: {
        values: PREDEFINED_BUDGET_CATEGORIES,
        message: '{VALUE} is not a supported budget category.'
    }
  },
  amount: {
    type: Number,
    required: [true, "Amount is required for category allocation."],
    min: [0.01, "Category budget amount must be positive."],
  }
}, { _id: true }); // _id: true allows for easier updates/deletions of specific allocations

const BudgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { // Name for this budget setup, e.g., "Monthly Household Budget"
      type: String,
      required: [true, "Budget name is required."],
      trim: true,
      default: "My Budget",
      maxlength: [100, "Budget name cannot exceed 100 characters."]
    },
    overallAmount: { // The total amount for the entire budget period
      type: Number,
      required: [true, "Overall budget amount is required."],
      min: [0.01, "Overall budget amount must be positive."],
    },
    cycleType: {
      type: String,
      enum: ["monthly", "weekly", "custom"],
      required: [true, "Budget cycle type is required."],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required."],
    },
    endDate: { // For 'custom' cycle, user sets this. For 'monthly'/'weekly', it's auto-calculated.
      type: Date,
      required: [true, "End date is required."],
    },
    // Array for optional category-specific budget allocations
    categoryAllocations: [CategoryAllocationSchema],
  },
  { timestamps: true }
);

// Pre-save hook to calculate endDate for 'monthly' and 'weekly' cycles
BudgetSchema.pre('save', function(next) {
  // Only recalculate endDate if startDate or cycleType has changed, or if it's a new document
  if (this.isNew || this.isModified('startDate') || this.isModified('cycleType')) {
    if (this.cycleType === 'monthly') {
      const date = new Date(this.startDate);
      date.setMonth(date.getMonth() + 1);
      date.setDate(date.getDate() - 1); // Sets endDate to one day less than a month from startDate
      this.endDate = date;
    } else if (this.cycleType === 'weekly') {
      const date = new Date(this.startDate);
      date.setDate(date.getDate() + 6); // 7-day period (0-6)
      this.endDate = date;
    }
    // For 'custom' cycle, endDate is expected to be set by the user.
  }

  if (this.endDate < this.startDate) {
    return next(new Error('End date cannot be before start date.'));
  }
  next();
});

// Custom validator: Sum of categoryAllocations.amount should not exceed overallAmount
BudgetSchema.path('categoryAllocations').validate(function(allocations) {
  if (allocations && allocations.length > 0) {
    const totalCategoryAllocation = allocations.reduce((sum, item) => sum + item.amount, 0);
    // Using a small epsilon for float comparison to avoid precision issues
    const epsilon = 0.001; 
    if (totalCategoryAllocation > this.overallAmount + epsilon) {
      return false;
    }
  }
  return true;
}, 'Total amount for category budgets cannot exceed the overall budget amount.');

// Ensure unique category within a single budget's categoryAllocations array
BudgetSchema.path('categoryAllocations').validate(function(allocations) {
    if (allocations && allocations.length > 0) {
        const categories = allocations.map(alloc => alloc.category);
        const uniqueCategories = new Set(categories);
        if (categories.length !== uniqueCategories.size) {
            return false; // Duplicate categories found
        }
    }
    return true;
}, 'Categories within a budget must be unique.');


module.exports = mongoose.model("Budget", BudgetSchema);