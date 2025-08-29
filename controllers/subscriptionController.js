const Subscription = require("../models/Subscription");
const Expense      = require("../models/Expense"); // make sure this path is correct

// Create a new subscription
exports.addSubscription = async (req, res) => {
  try {
    const { name, amount, startDate, nextBillingDate, icon } = req.body; // Added icon
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Subscription name is required" });
    }
    if (amount == null || isNaN(amount) || amount <= 0) { // Amount should be > 0
      return res.status(400).json({ message: "A valid positive amount is required" });
    }
    
    const sd = new Date(startDate);
    const nb = new Date(nextBillingDate);

    // Check if dates are valid
    if (isNaN(sd.getTime())) { // .getTime() returns NaN for invalid dates
      return res.status(400).json({ message: "Invalid startDate provided." });
    }
    if (isNaN(nb.getTime())) {
      return res.status(400).json({ message: "Invalid nextBillingDate provided." });
    }

    const subscription = await Subscription.create({
      user:             req.user.id,
      name:             name.trim(),
      amount,
      startDate:        sd,
      nextBillingDate:  nb,
      icon:             icon || "", // Save icon if provided
    });

    res.status(201).json(subscription);
  } catch (err) {
    console.error("addSubscription error:", err);
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: "Server error adding subscription" });
  }
};

// Get all subscriptions for current user
exports.getSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.find({ user: req.user.id }).sort({ nextBillingDate: 1, name: 1 }); // Sort by next billing, then name
    res.json(subs);
  } catch (err) {
    console.error("getSubscriptions error:", err);
    res.status(500).json({ message: "Server error fetching subscriptions" });
  }
};

// Delete a subscription by ID
exports.deleteSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id,
    });
    if (!sub) {
      return res.status(404).json({ message: "Subscription not found" });
    }
    res.json({ message: "Subscription deleted", id: sub._id });
  } catch (err) {
    console.error("deleteSubscription error:", err);
    if (err.kind === 'ObjectId') {
        return res.status(400).json({ message: "Invalid subscription ID format." });
    }
    res.status(500).json({ message: "Server error deleting subscription" });
  }
};

// Mark a subscription as paid (create expense + roll date forward)
exports.paySubscription = async (req, res) => {
  try {
    // 1) Find the subscription
    const subscription = await Subscription.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    // 2) Create an Expense record
    // Use the subscription's nextBillingDate as the expense date
    const expenseDate = new Date(subscription.nextBillingDate); 

    const newExpense = new Expense({
      userId:   subscription.user,
      name:     subscription.name,
      category: "Subscription",
      amount:   subscription.amount,
      date:     expenseDate,
      icon:     subscription.icon || "",
    });
    await newExpense.save();

    // 3) Advance nextBillingDate by one month
    const currentNextBillingDate = new Date(subscription.nextBillingDate);
    currentNextBillingDate.setMonth(currentNextBillingDate.getMonth() + 1);
    // Handle cases where adding a month might skip a month if the day doesn't exist (e.g., Jan 31 + 1 month)
    // setMonth handles this by rolling over to the next month correctly.
    // If original day was 31 and next month has 30 days, it will be the 1st of the month after.
    // To ensure it's the last day of the intended month if the day is too high:
    // Example: If original was March 31, adding 1 month gives April 31, which becomes May 1.
    // If you want it to be April 30, more complex logic is needed.
    // For most subscription scenarios, setMonth's default behavior is acceptable.
    subscription.nextBillingDate = currentNextBillingDate;
    await subscription.save();

    // 4) Respond
    // Format date for the message without moment
    const updatedNextBillingDate = new Date(subscription.nextBillingDate);
    const year = updatedNextBillingDate.getFullYear();
    const month = String(updatedNextBillingDate.getMonth() + 1).padStart(2, '0'); // getMonth is 0-indexed
    const day = String(updatedNextBillingDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    res.json({ 
        message: `Subscription '${subscription.name}' paid and expense recorded. Next billing: ${formattedDate}`,
        subscription,
        expense: newExpense
    });

  } catch (err) {
    console.error("paySubscription error:", err);
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ message: messages.join(' ') });
    }
    res.status(500).json({ message: "Server error during payment processing" });
  }
};