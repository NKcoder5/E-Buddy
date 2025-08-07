const express = require("express");
const router = express.Router();
const axios = require("axios");
const dotenv = require("dotenv");
const { protect } = require('../middleware/authMiddleware');
const LearningPathHistory = require("../models/LearningPathHistory");
const User = require("../models/User");

dotenv.config();
const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NIM_MODEL = "meta/llama-4-maverick-17b-128e-instruct";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

if (!NVIDIA_NIM_API_KEY) {
  console.error("❌ Error: Missing NVIDIA_NIM_API_KEY in environment variables.");
}

async function callNvidiaNimAPI(userPrompt) {
  try {
    const payload = {
      model: NIM_MODEL,
      messages: [{ role: "user", content: userPrompt }],
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
    // NIM returns response.data.choices[0].message.content
    return response.data?.choices?.[0]?.message?.content || "No response received.";
  } catch (error) {
    console.error("🔴 NVIDIA NIM API Error:", error.response?.data || error.message);
    throw error;
  }
}

// Apply authentication to all AI routes
router.use(protect);
router.post("/learning-path", async (req, res) => {
  try {
    const { topic, level, duration } = req.body;
    if (!topic || !level || !duration) {
      return res.status(400).json({ error: "Topic, level, and duration are required." });
    }

    // Get user's name
    const user = await User.findById(req.user._id);
    const userName = user?.name || 'there';

    const prompt = `Give a detailed learning path for ${topic} at a ${level} level for a duration of ${duration} give in structured paragraph(for example if the duration is one hour split it into minute wise) and alsogive the para as topic and content where..topic is time period and topic and content what to do in that topic.Dont use special characters on response for specifying topics and contents`;
    
    const responseText = await callNvidiaNimAPI(prompt);
    const personalizedResponse = `Hi ${userName}! Here's your learning path:\n\n${responseText}`;

    const historyEntry = new LearningPathHistory({
      userId: req.user._id,
      topic,
      level,
      duration,
      requestText: prompt,
      responseText: personalizedResponse, // Store personalized response
    });

    await historyEntry.save();
    res.json({ response: personalizedResponse });
  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ error: "Failed to generate learning path." });
  }
});

router.post("/summarize", async (req, res) => {
  try {
    const { topic, bullets } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required." });
    }

    const prompt = `Provide ${bullets || 5} concise bullet points summarizing ${topic}.`;
    const response = await callNvidiaNimAPI(prompt);
    
    res.json({ summary: response });
  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ error: "Failed to generate summary." });
  }
});

router.post("/flashcards", async (req, res) => {
  try {
    const { topic, count } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required." });
    }

    const prompt = `Create ${count || 5} flashcards about ${topic}. Format as: Q: question\nA: answer\n\n`;
    const response = await callNvidiaNimAPI(prompt);
    
    res.json({ flashcards: response });
  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ error: "Failed to generate flashcards." });
  }
});

router.post("/quiz", async (req, res) => {
  try {
    const { topic, questions } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required." });
    }

    const prompt = `Generate ${questions || 5} multiple-choice questions about ${topic}. Format each as: Q: [question]\nA) [option1]\nB) [option2]\nC) [option3]\nD) [option4]\nAnswer: [correct letter]\n\n`;
    const response = await callNvidiaNimAPI(prompt);
    
    res.json({ quiz: response });
  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ error: "Failed to generate quiz." });
  }
});

router.post("/chatbot", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const user = await User.findById(req.user._id);
    const userName = user?.name || 'there';
    
    let aiResponse = await callNvidiaNimAPI(message);
    
    // Check if response already contains a greeting
    const hasGreeting = /^(hi|hello|hey|greetings)[,!]?/i.test(aiResponse);
    const response = hasGreeting 
      ? aiResponse.replace(/^(hi|hello|hey|greetings)[,!]?\s*/i, `$& ${userName}, `)
      : `Hi ${userName}! ${aiResponse}`;
    
    res.json({ response });
  } catch (error) {
    console.error("🔴 Chatbot Error:", error);
    res.status(500).json({ error: "Failed to generate chatbot response." });
  }
});

router.get("/learning-path/history", async (req, res) => {
  try {
    const history = await LearningPathHistory.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

// Additional endpoint for getting user-specific history by type
router.get("/history/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['learning-path', 'summarize', 'flashcards', 'quiz', 'chatbot'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "Invalid history type." });
    }

    let history;
    if (type === 'learning-path') {
      history = await LearningPathHistory.find({ userId: req.user._id }).sort({ createdAt: -1 });
    } else {
      // Add other history types here if you have separate collections
      history = []; // Placeholder for other history types
    }

    res.json(history);
  } catch (error) {
    console.error("🔴 Error:", error);
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

module.exports = router;