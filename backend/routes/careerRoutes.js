const express = require("express");
const router = express.Router();
const axios = require("axios");
const dotenv = require("dotenv");
const { protect } = require('../middleware/authMiddleware');
const CareerPathHistory = require("../models/CareerPathHistory");
const User = require("../models/User");

dotenv.config();
const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NIM_MODEL = "meta/llama-4-maverick-17b-128e-instruct";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

if (!NVIDIA_NIM_API_KEY) {
  console.error("❌ Error: Missing NVIDIA_NIM_API_KEY in environment variables.");
}

// Apply authentication to all career routes
router.use(protect);

router.post("/generate", async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const skills = user.skills?.length ? user.skills.join(", ") : "Not specified";
    const interests = user.interests?.length ? user.interests.join(", ") : "Not specified";
    const achievements = user.achievements?.length ? user.achievements.join(", ") : "None";

    const prompt = `Generate a career path based on:\n  Skills - ${skills},\n  Interests - ${interests},\n  Achievements - ${achievements}.\n  Provide a detailed career path with future Trends.`;

    const payload = {
      model: NIM_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 1.0,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      stream: false
    };
    const headers = {
      "Authorization": `Bearer ${NVIDIA_NIM_API_KEY}`,
      "Accept": "application/json"
    };
    const response = await axios.post(NIM_URL, payload, { headers });

    const responseText = response.data?.choices?.[0]?.message?.content || "No response received.";
    
    // Add personalized greeting
    const userName = user.name || 'there';
    const personalizedResponse = `Hi ${userName}! Here's your personalized career path:\n\n${responseText}`;

    const historyEntry = new CareerPathHistory({
      userId: req.user._id,
      skills: user.skills,
      interests: user.interests,
      achievements: user.achievements,
      requestText: prompt,
      responseText: personalizedResponse, // Store personalized response
    });

    await historyEntry.save();
    res.json({ response: personalizedResponse });
  } catch (error) {
    console.error("🔴 Career Path Error:", error);
    res.status(500).json({ error: "Failed to generate career path." });
  }
});

router.get("/history", async (req, res) => {
  try {
    const history = await CareerPathHistory.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error("🔴 Career History Error:", error);
    res.status(500).json({ error: "Failed to fetch career history." });
  }
});

module.exports = router;