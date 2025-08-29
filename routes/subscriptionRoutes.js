// backend/routes/subscriptionRoutes.js
const express = require("express");
const {
  addSubscription,
  getSubscriptions,
  deleteSubscription,
  paySubscription,
} = require("../controllers/subscriptionController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

router
  .route("/")
  .get(getSubscriptions)    // list current user’s subscriptions
  .post(addSubscription);   // create new subscription

router.delete("/:id", deleteSubscription); // delete own subscription

// below your delete…
router.post("/:id/pay", paySubscription);


module.exports = router;
