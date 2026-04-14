const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// =========================
// ✅ MIDDLEWARES
// =========================
const allowedOrigins = [
  "https://prep-xpert-omega.vercel.app",
  "http://127.0.0.1:5500",
  "http://localhost:5500"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn("⚠️ CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ✅ FIXED: Changed from "/*" to "*" to prevent PathError
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// =========================
// 📦 MONGODB CONNECTION
// =========================
// ✅ FIXED: Properly use environment variable OR fallback to hardcoded URI
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin:Omi123@cluster0.1kyleiv.mongodb.net/prepxpert?retryWrites=true&w=majority";

if (!MONGODB_URI || MONGODB_URI.includes("undefined")) {
  console.error("❌ MONGODB_URI is not properly configured!");
  console.error("Current value:", MONGODB_URI);
  process.exit(1);
}

console.log("🔄 Attempting MongoDB connection...");
console.log("📍 Connection string preview:", MONGODB_URI.substring(0, 30) + "...");

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
    console.log("📦 Database:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    console.error("Full error:", err);
    process.exit(1);
  });

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.warn("⚠️ MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on('error', (err) => {
  console.error("❌ MongoDB error:", err.message);
});

// =========================
// 📋 SCHEMAS & MODELS
// =========================
const QuestionSchema = new mongoose.Schema({}, { strict: false });
const Question = mongoose.model("Question", QuestionSchema);

const resultSchema = new mongoose.Schema({
  name: String,
  score: Number,
  total: Number,
  type: String,
  date: String,
}, { timestamps: true });

const Result = mongoose.model("Result", resultSchema);

// =========================
// 🏠 HEALTH CHECK
// =========================
app.get("/", (req, res) => {
  res.json({ 
    message: "PrepXpert Backend API 🚀", 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// =========================
// 📚 QUESTIONS
// =========================
app.get("/questions", async (req, res) => {
  try {
    const data = await Question.find();
    console.log(`📖 Fetched ${data.length} questions`);
    res.json(data);
  } catch (error) {
    console.error("❌ Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions", message: error.message });
  }
});

app.post("/add-questions", async (req, res) => {
  try {
    if (!req.body || !Array.isArray(req.body)) {
      return res.status(400).json({ error: "Expected an array of questions." });
    }
    const result = await Question.insertMany(req.body);
    console.log(`✅ Added ${result.length} questions to database`);
    res.json({ success: true, count: result.length, message: `${result.length} questions added` });
  } catch (error) {
    console.error("❌ Error adding questions:", error);
    res.status(500).json({ error: "Failed to add questions", message: error.message });
  }
});

app.get("/clear-questions", async (req, res) => {
  try {
    const result = await Question.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} questions`);
    res.json({ success: true, message: "All questions deleted ✅", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("❌ Error clearing questions:", error);
    res.status(500).json({ error: "Failed to clear questions", message: error.message });
  }
});

// =========================
// 📊 RESULTS
// =========================
app.post("/save-result", async (req, res) => {
  try {
    const { name, score, total, type } = req.body;
    if (!name || score === undefined || total === undefined || !type) {
      return res.status(400).json({ error: "Missing required fields: name, score, total, type" });
    }
    const newResult = new Result({
      name: name.trim(),
      score: Number(score),
      total: Number(total),
      type: type.toUpperCase(),
      date: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    });
    await newResult.save();
    console.log(`✅ Saved result for ${name}: ${score}/${total} (${type})`);
    res.json({ success: true, message: "Result saved ✅", data: newResult });
  } catch (error) {
    console.error("❌ Error saving result:", error);
    res.status(500).json({ error: "Failed to save result", message: error.message });
  }
});

app.get("/results", async (req, res) => {
  try {
    const results = await Result.find().sort({ score: -1 });
    console.log(`📊 Fetched ${results.length} results (sorted by score)`);
    res.json(results);
  } catch (error) {
    console.error("❌ Error fetching results:", error);
    res.status(500).json({ error: "Failed to fetch results", message: error.message });
  }
});

app.get("/get-results", async (req, res) => {
  try {
    const results = await Result.find();
    console.log(`📊 Fetched ${results.length} results (unsorted)`);
    res.json(results);
  } catch (error) {
    console.error("❌ Error fetching results:", error);
    res.status(500).json({ error: "Failed to fetch results", message: error.message });
  }
});

app.get("/clear-results", async (req, res) => {
  try {
    const result = await Result.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} results`);
    res.json({ success: true, message: "All results deleted ✅", deletedCount: result.deletedCount });
  } catch (error) {
    console.error("❌ Error clearing results:", error);
    res.status(500).json({ error: "Failed to clear results", message: error.message });
  }
});

// =========================
// 📈 STATS
// =========================
app.get("/stats", async (req, res) => {
  try {
    const questionCount = await Question.countDocuments();
    const resultCount = await Result.countDocuments();
    console.log(`📊 Stats - Questions: ${questionCount}, Results: ${resultCount}`);
    res.json({ 
      questions: questionCount, 
      results: resultCount, 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    console.error("❌ Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats", message: error.message });
  }
});

// =========================
// ❌ 404 HANDLER
// =========================
app.use((req, res) => {
  console.warn(`⚠️ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: "Not Found", 
    message: `Route ${req.method} ${req.path} does not exist`,
    availableRoutes: [
      "GET /",
      "GET /health",
      "GET /questions",
      "POST /add-questions",
      "GET /clear-questions",
      "POST /save-result",
      "GET /results",
      "GET /get-results",
      "GET /clear-results",
      "GET /stats"
    ]
  });
});

// =========================
// 🚀 START SERVER
// =========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("════════════════════════════════════════════");
  console.log(`🚀 PrepXpert Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🌐 MongoDB: ${mongoose.connection.readyState === 1 ? "✅ Connected" : "⏳ Connecting..."}`);
  console.log("════════════════════════════════════════════");

  // ✅ Keep Render free-tier alive — ping every 14 minutes
  const https = require("https");
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || "https://prepxpert-backend.onrender.com";
  
  setInterval(() => {
    https.get(SELF_URL + "/health", (res) => {
      console.log(`🏓 Keep-alive ping: ${res.statusCode} at ${new Date().toISOString()}`);
    }).on("error", (err) => {
      console.warn("⚠️ Keep-alive ping failed:", err.message);
    });
  }, 14 * 60 * 1000); // 14 minutes
  
  console.log(`⏰ Keep-alive pings scheduled every 14 minutes to ${SELF_URL}`);
});