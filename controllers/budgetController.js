const Budget = require('../models/Budget');
const Expense = require('../models/Expense'); // Needed to calculate spending

// --- Helper function to calculate end date based on cycle ---
function calculateEndDate(startDate, cycleType, customEndDate) {
  const sDate = new Date(startDate);
  if (isNaN(sDate.getTime())) {
    throw new Error("Invalid start date provided.");
  }

  let eDate;
  if (cycleType === 'monthly') {
    eDate = new Date(sDate);
    eDate.setMonth(eDate.getMonth() + 1);
    eDate.setDate(eDate.getDate() - 1);
  } else if (cycleType === 'weekly') {
    eDate = new Date(sDate);
    eDate.setDate(eDate.getDate() + 6);
  } else if (cycleType === 'custom' && customEndDate) {
    eDate = new Date(customEndDate);
    if (isNaN(eDate.getTime())) {
      throw new Error("Invalid custom end date provided.");
    }
  } else if (cycleType === 'custom' && !customEndDate) {
    throw new Error("Custom end date is required for 'custom' cycle type.");
  } else {
    throw new Error("Invalid cycle type.");
  }
  return eDate;
}


// --- CRUD Operations for Budgets ---

// Create a new budget period
exports.addBudget = async (req, res) => {
  try {
    const { name, overallAmount, cycleType, startDate, endDate: customEndDate, categoryAllocations } = req.body;
    const userId = req.user.id;

    if (!name || !overallAmount || !cycleType || !startDate) {
      return res.status(400).json({ message: "Name, overallAmount, cycleType, and startDate are required." });
    }

    let calculatedEndDate;
    try {
      calculatedEndDate = calculateEndDate(startDate, cycleType, customEndDate);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }
    
    if (new Date(calculatedEndDate) < new Date(startDate)) {
        return res.status(400).json({ message: "End date cannot be before start date." });
    }

    const newBudget = new Budget({
      user: userId,
      name,
      overallAmount: parseFloat(overallAmount),
      cycleType,
      startDate: new Date(startDate),
      endDate: calculatedEndDate,
      categoryAllocations: categoryAllocations || [], // Ensure it's an array
    });

    await newBudget.save(); // Mongoose schema validators will run here
    res.status(201).json(newBudget);
  } catch (error) {
    console.error("Error adding budget:", error);
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: 'Server error adding budget.' });
  }
};

// Get all budget periods for the logged-in user
exports.getAllBudgets = async (req, res) => {
  try {
    const userId = req.user.id;
    // Populate with expenses to calculate spent amounts later if needed, or do it on demand.
    // For now, just fetching budgets.
    const budgets = await Budget.find({ user: userId }).sort({ startDate: -1, name: 1 });
    res.status(200).json(budgets);
  } catch (error) {
    console.error("Error fetching budgets:", error);
    res.status(500).json({ message: 'Server error fetching budgets.' });
  }
};

// Get a single budget period by ID, including calculated spent amounts
exports.getBudgetById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const budget = await Budget.findOne({ _id: id, user: userId });

    if (!budget) {
      return res.status(404).json({ message: 'Budget not found or user not authorized.' });
    }

    // Calculate total spent for the overall budget period
    const expensesInPeriod = await Expense.find({
      userId,
      date: { $gte: budget.startDate, $lte: budget.endDate },
    });
    const totalSpentOverall = expensesInPeriod.reduce((sum, exp) => sum + exp.amount, 0);

    // Calculate spent amounts for each category allocation
    const categoryAllocationsWithSpent = await Promise.all(
      budget.categoryAllocations.map(async (alloc) => {
        const expensesInCategory = await Expense.find({
          userId,
          category: alloc.category,
          date: { $gte: budget.startDate, $lte: budget.endDate },
        });
        const spentInCategory = expensesInCategory.reduce((sum, exp) => sum + exp.amount, 0);
        return {
          ...alloc.toObject(), // Convert Mongoose subdocument to plain object
          spent: spentInCategory,
          remaining: alloc.amount - spentInCategory,
        };
      })
    );

    res.status(200).json({
      ...budget.toObject(),
      totalSpentOverall,
      categoryAllocations: categoryAllocationsWithSpent,
    });

  } catch (error) {
    console.error("Error fetching budget by ID:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: "Invalid budget ID format." });
    }
    res.status(500).json({ message: 'Server error fetching budget.' });
  }
};


// Update a budget period
exports.updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, overallAmount, cycleType, startDate, endDate: customEndDate, categoryAllocations } = req.body;

    const budgetToUpdate = await Budget.findOne({ _id: id, user: userId });
    if (!budgetToUpdate) {
      return res.status(404).json({ message: 'Budget not found or user not authorized.' });
    }

    // Update fields if provided
    if (name) budgetToUpdate.name = name;
    if (overallAmount) budgetToUpdate.overallAmount = parseFloat(overallAmount);
    
    let finalStartDate = budgetToUpdate.startDate;
    if (startDate) finalStartDate = new Date(startDate);

    let finalCycleType = budgetToUpdate.cycleType;
    if (cycleType) finalCycleType = cycleType;
    
    // Recalculate endDate if startDate or cycleType is changing, or if it's a custom cycle with a new customEndDate
    if (startDate || cycleType || (finalCycleType === 'custom' && customEndDate)) {
        try {
            budgetToUpdate.endDate = calculateEndDate(finalStartDate, finalCycleType, customEndDate || budgetToUpdate.endDate);
        } catch(e) {
            return res.status(400).json({ message: e.message });
        }
    }
    if (startDate) budgetToUpdate.startDate = finalStartDate; // Assign after endDate calculation if it changed
    if (cycleType) budgetToUpdate.cycleType = finalCycleType;


    if (categoryAllocations !== undefined) { // Allows sending an empty array to clear allocations
        budgetToUpdate.categoryAllocations = categoryAllocations;
    }
    
    const updatedBudget = await budgetToUpdate.save(); // This will run validators

    res.status(200).json(updatedBudget);
  } catch (error) {
    console.error("Error updating budget:", error);
     if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: 'Server error updating budget.' });
  }
};

// Delete a budget period
exports.deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const budget = await Budget.findOneAndDelete({ _id: id, user: userId });

    if (!budget) {
      return res.status(404).json({ message: 'Budget not found or user not authorized.' });
    }
    res.status(200).json({ message: 'Budget deleted successfully.' });
  } catch (error) {
    console.error("Error deleting budget:", error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: "Invalid budget ID format." });
    }
    res.status(500).json({ message: 'Server error deleting budget.' });
  }
};

// --- Endpoint to get spending for categories in the last 30 days ---
exports.getCategorySpendingLast30Days = async (req, res) => {
    try {
        const userId = req.user.id;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0); // Start of the 30th day ago

        const expenses = await Expense.find({
            user: userId,
            date: { $gte: thirtyDaysAgo }
        });

        const spendingByCategory = expenses.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {});
        
        // If you want to ensure all predefined categories are present, even with 0 spending:
        // const PREDEFINED_BUDGET_CATEGORIES = Budget.schema.path('categoryAllocations.0.category').caster.enumValues; // Get from schema
        // PREDEFINED_BUDGET_CATEGORIES.forEach(cat => {
        //     if (!spendingByCategory[cat]) {
        //         spendingByCategory[cat] = 0;
        //     }
        // });

        res.status(200).json(spendingByCategory);

    } catch (error) {
        console.error("Error fetching category spending for last 30 days:", error);
        res.status(500).json({ message: "Server error fetching category spending." });
    }
};