const express = require("express");
const router = express.Router();
const axios = require("axios");
const dotenv = require("dotenv");
const LearningPathHistory = require("../models/LearningPathHistory");
const User = require("../models/User");

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Error: Missing GEMINI_API_KEY in environment variables.");
}

// ✅ Route: Generate Learning Path             
router.post("/learning-path", async (req, res) => {
  try {
    let { userId, topic, level, duration } = req.body;

    if (!userId || !topic || !level || !duration) {
      return res.status(400).json({ error: "User ID, topic, level, and duration are required." });
    }

    // 🔹 Ensure the user exists in the database
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found. Please sign up first." });
    }

    const prompt = `Give a detailed learning path for ${topic} at a ${level} level for a duration of ${duration}.`;

    console.log("📚 Learning Path Request:", prompt);

    // 🔹 Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("✅ Gemini API Response:", response.data);

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

    // 🔹 Store in database
    const historyEntry = new LearningPathHistory({
      userId,
      topic,
      level,
      duration,
      requestText: prompt,
      responseText,
    });

    await historyEntry.save();

    res.json({ response: responseText, userId });
  } catch (error) {
    console.error("🔴 Gemini API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate learning path." });
  }
});

// ✅ Route: Chatbot response
router.post("/chatbot", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    console.log("💬 Chatbot Message Request:", message);

    // 🔹 Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: message }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("✅ Gemini API Response:", JSON.stringify(response.data, null, 2));

    // 🔹 Extract text response properly
    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

    res.json({ response: responseText });
  } catch (error) {
    console.error("🔴 Chatbot API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate chatbot response." });
  }
});

// ✅ Route: Fetch Learning Path history for a specific user
router.get("/learning-path/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    // 🔹 Ensure the user exists in the database
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const history = await LearningPathHistory.find({ userId }).sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error("🔴 Error fetching history:", error.message);
    res.status(500).json({ error: "Failed to fetch learning path history." });
  }
});

module.exports = router;
