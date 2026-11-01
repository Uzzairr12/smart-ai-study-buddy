require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) console.warn("WARNING: JWT_SECRET is not set. Add it to your environment variables.");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(",") : true,
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPG, JPEG, and WEBP images are allowed."));
  }
});

let User, QuizAttempt;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection error:", err.message));

  const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  });
  const attemptSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    topic: String, score: Number, total: Number, answers: Array,
    createdAt: { type: Date, default: Date.now }
  });
  User = mongoose.model("User", userSchema);
  QuizAttempt = mongoose.model("QuizAttempt", attemptSchema);
}

const quizBank = [
  { id: 1, subject: "Mathematics", topic: "Algebra", difficulty: "Easy", question: "Solve: 2x + 6 = 14", options: ["x = 2", "x = 4", "x = 6", "x = 8"], answer: 1, explanation: "Subtract 6 from both sides: 2x = 8. Divide by 2: x = 4." },
  { id: 2, subject: "Mathematics", topic: "Algebra", difficulty: "Easy", question: "What is the value of 5²?", options: ["10", "15", "20", "25"], answer: 3, explanation: "5² means 5 multiplied by itself: 5 × 5 = 25." },
  { id: 3, subject: "Computer Science", topic: "Programming", difficulty: "Medium", question: "Which keyword declares a block-scoped variable in JavaScript?", options: ["var", "let", "define", "int"], answer: 1, explanation: "let declares a block-scoped variable in JavaScript." },
  { id: 4, subject: "Computer Science", topic: "Web", difficulty: "Easy", question: "What does HTML stand for?", options: ["HyperText Markup Language", "HighText Machine Language", "Hyper Tool Multi Language", "Home Text Markup Language"], answer: 0, explanation: "HTML stands for HyperText Markup Language." },
  { id: 5, subject: "General Science", topic: "Physics", difficulty: "Medium", question: "What is the SI unit of force?", options: ["Joule", "Watt", "Newton", "Pascal"], answer: 2, explanation: "Force is measured in newtons (N)." },
  { id: 6, subject: "Mathematics", topic: "Geometry", difficulty: "Medium", question: "How many degrees are in a triangle's interior angles?", options: ["90°", "180°", "270°", "360°"], answer: 1, explanation: "The interior angles of every Euclidean triangle add up to 180°." },
  { id: 7, subject: "Computer Science", topic: "Programming", difficulty: "Hard", question: "What is the time complexity of binary search on a sorted array?", options: ["O(n)", "O(n²)", "O(log n)", "O(1)"], answer: 2, explanation: "Binary search halves the remaining search space at each step, giving O(log n)." },
  { id: 8, subject: "Mathematics", topic: "Arithmetic", difficulty: "Easy", question: "What is 15% of 200?", options: ["15", "20", "30", "45"], answer: 2, explanation: "15% of 200 = 0.15 × 200 = 30." }
];

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please log in to continue." });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Your session has expired. Please log in again." }); }
}
function aiModel() {
  if (!process.env.GEMINI_API_KEY) throw new Error("AI is not configured yet. Add GEMINI_API_KEY to the environment variables.");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.0-flash" });
}
async function askAI(prompt, imagePart) {
  const model = aiModel();
  const parts = imagePart ? [prompt, imagePart] : [prompt];
  const result = await model.generateContent(parts);
  return result.response.text();
}

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "not connected",
  aiConfigured: Boolean(process.env.GEMINI_API_KEY)
}));

app.post("/api/auth/register", async (req, res) => {
  try {
    if (!User) return res.status(503).json({ error: "Database is not configured. Add MONGODB_URI first." });
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 8)
      return res.status(400).json({ error: "Enter your name, email, and a password of at least 8 characters." });
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });
    const user = await User.create({ name, email, password: await bcrypt.hash(password, 12) });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { name: user.name, email: user.email } });
  } catch (e) { res.status(500).json({ error: "Could not create account. Please try again." }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    if (!User) return res.status(503).json({ error: "Database is not configured. Add MONGODB_URI first." });
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password)))
      return res.status(401).json({ error: "Incorrect email or password." });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { name: user.name, email: user.email } });
  } catch { res.status(500).json({ error: "Login failed. Please try again." }); }
});

app.get("/api/me", auth, (req, res) => res.json({ user: { name: req.user.name, email: req.user.email } }));

app.get("/api/quizzes", (req, res) => {
  const { subject, difficulty } = req.query;
  let questions = quizBank.filter(q =>
    (!subject || subject === "All" || q.subject === subject) &&
    (!difficulty || difficulty === "All" || q.difficulty === difficulty)
  );
  res.json(questions.map(({ answer, ...q }) => q));
});

app.post("/api/quizzes/submit", auth, async (req, res) => {
  const { answers = [], topic = "General Quiz" } = req.body;
  const results = answers.map(item => {
    const q = quizBank.find(x => x.id === Number(item.id));
    return q ? { id: q.id, selected: Number(item.selected), correct: q.answer, isCorrect: Number(item.selected) === q.answer, explanation: q.explanation } : null;
  }).filter(Boolean);
  const score = results.filter(r => r.isCorrect).length;
  if (QuizAttempt) {
    try { await QuizAttempt.create({ userId: req.user.id, topic, score, total: results.length, answers: results }); } catch (e) { console.error(e.message); }
  }
  res.json({ score, total: results.length, percentage: results.length ? Math.round(score / results.length * 100) : 0, results });
});

app.get("/api/progress", auth, async (req, res) => {
  if (!QuizAttempt) return res.json({ attempts: [], average: 0, totalQuizzes: 0 });
  const attempts = await QuizAttempt.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20).lean();
  const average = attempts.length ? Math.round(attempts.reduce((a, b) => a + (b.total ? b.score / b.total * 100 : 0), 0) / attempts.length) : 0;
  res.json({ attempts, average, totalQuizzes: attempts.length });
});

app.post("/api/ai/chat", auth, async (req, res) => {
  try {
    const { message, language = "English" } = req.body;
    if (!message || message.length > 5000) return res.status(400).json({ error: "Enter a question (maximum 5,000 characters)." });
    const prompt = `You are Smart AI Study Buddy, a patient and encouraging academic tutor. Reply in ${language}. Explain clearly at the student's level. Use examples and steps where useful. If asked to solve homework, teach the method rather than only giving an answer. Be accurate and admit uncertainty.\n\nStudent question: ${message}`;
    res.json({ reply: await askAI(prompt) });
  } catch (e) { res.status(503).json({ error: e.message || "The AI assistant is temporarily unavailable." }); }
});

app.post("/api/ai/math", auth, upload.single("image"), async (req, res) => {
  try {
    const question = req.body.question || "Please solve the mathematics problem shown in the image.";
    let imagePart;
    if (req.file) imagePart = { inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype } };
    if (!question.trim() && !imagePart) return res.status(400).json({ error: "Enter a question or upload an image." });
    const prompt = `Act as a patient mathematics teacher. Solve this problem step by step. State the relevant formula, show each calculation, explain why each step is taken, and clearly mark the final answer. If the question is unclear, say what needs clarification. Use simple language.\n\nProblem: ${question}`;
    res.json({ reply: await askAI(prompt, imagePart) });
  } catch (e) { res.status(503).json({ error: e.message || "Could not solve this problem." }); }
});

app.post("/api/ai/language", auth, async (req, res) => {
  try {
    const { text: input, source = "English", target = "Urdu", level = "Beginner", mode = "Translate" } = req.body;
    if (!input || input.length > 3000) return res.status(400).json({ error: "Enter text (maximum 3,000 characters)." });
    const prompt = `You are a friendly ${target} language teacher. Student level: ${level}. Task: ${mode}. Source language: ${source}. Target language: ${target}. Provide the result, a simple explanation, useful vocabulary, and one short practice sentence when appropriate. For Urdu or Sindhi, use the correct native script and do not replace it with Roman script unless requested.\n\nText: ${input}`;
    res.json({ reply: await askAI(prompt) });
  } catch (e) { res.status(503).json({ error: e.message || "Language tool is unavailable." }); }
});

app.post("/api/ai/evaluate", auth, async (req, res) => {
  try {
    const { question, answer, subject = "General" } = req.body;
    if (!question || !answer) return res.status(400).json({ error: "Provide both the question and your answer." });
    const prompt = `Act as a fair, supportive ${subject} teacher. Evaluate the student's answer to the question below. Return: estimated score out of 10, what is correct, mistakes or missing points, and a model improved answer. Be constructive. Do not claim this is an official grade.\n\nQuestion: ${question}\nStudent answer: ${answer}`;
    res.json({ reply: await askAI(prompt) });
  } catch (e) { res.status(503).json({ error: e.message || "Answer evaluation is unavailable." }); }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(400).json({ error: err.message || "Something went wrong." });
});

app.listen(PORT, () => console.log(`Smart AI Study Buddy running on port ${PORT}`));
