require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const stocksRoutes = require("./routes/stocksRoutes");
const budgetRoutes = require("./routes/budgetRoutes"); // Add this line

const app = express();

// Middleware to handle CORS
const allowedOrigins = [
  process.env.CLIENT_URL,      // e.g. http://localhost:3000
  'http://localhost:5173'      // Vite's default dev server port
];


app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser requests like CURL/Postman with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true            // if you ever send cookies/auth headers
}));

app.use(express.json());

connectDB();

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/stocks", stocksRoutes);
app.use("/api/v1/budgets", budgetRoutes); // Add this line

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
