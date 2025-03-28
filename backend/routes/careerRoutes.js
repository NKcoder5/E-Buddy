const express = require("express");
const router = express.Router();
const axios = require("axios");
const dotenv = require("dotenv");
const CareerPathHistory = require("../models/CareerPathHistory");
const User = require("../models/User");

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ Error: Missing GEMINI_API_KEY in environment variables.");
}

// ✅ Route: Generate Career Path
router.post("/generate", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    console.log("🔍 Searching for user with ID:", userId);

    // ✅ FIXED: Correctly query userId as an object
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // 🔹 Extract and format data
    const skills = user.skills.length ? user.skills.join(", ") : "Not specified";
    const interests = user.interests.length ? user.interests.join(", ") : "Not specified";
    const achievements = user.achievements.length ? user.achievements.join(", ") : "None";

    // 🔹 Construct the prompt for AI model
    const prompt = `Generate a career path based on the following details: 
      Skills - ${skills}, 
      Interests - ${interests}, 
      Achievements - ${achievements}. 
      Provide a summarized yet full-scope career path suggestion.`;

    console.log("📂 Career Path Request:", prompt);

    // 🔹 Call Gemini API
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro-002:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { "Content-Type": "application/json" } }
    );

    console.log("✅ Gemini API Response:", response.data);

    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received.";

    // 🔹 Store in database
    const historyEntry = new CareerPathHistory({
      userId,
      skills: user.skills,
      interests: user.interests,
      achievements: user.achievements,
      requestText: prompt,
      responseText,
    });

    await historyEntry.save();

    res.json({ response: responseText, userId });
  } catch (error) {
    console.error("🔴 Gemini API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to generate career path." });
  }
});

// ✅ Route: Fetch Career Path history for a specific user
router.get("/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    console.log("🔍 Fetching career history for user:", userId);

    // ✅ FIXED: Correctly query userId as an object
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const history = await CareerPathHistory.find({ userId }).sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error("🔴 Error fetching history:", error.message);
    res.status(500).json({ error: "Failed to fetch career path history." });
  }
});

module.exports = router;
