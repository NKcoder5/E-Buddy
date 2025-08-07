const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// Cache to store recent quizzes for topics
const quizCache = new Map();
const CACHE_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours

// Helper function to generate a unique and more complex seed
const generateQuizSeed = (topic, numberOfQuestions) => {
  const timestamp = new Date().getTime();
  return `${topic.toLowerCase().replace(/\s+/g, '_')}_${numberOfQuestions}_${timestamp}_${Math.random().toString(36).substring(7)}`;
};

// Helper function to validate and parse Gemini response
const parseQuizResponse = (responseText, requestedQuestions) => {
  try {
    // Remove any markdown or code block markers
    responseText = responseText.replace(/```(json)?|```/g, '').trim();
    
    // Parse the JSON, with additional validation
    const quizData = JSON.parse(responseText);
    
    if (!quizData.questions || !Array.isArray(quizData.questions)) {
      throw new Error('Invalid quiz format');
    }
    
    // Validate each question
    const validatedQuestions = quizData.questions.map(q => {
      if (!q.question || 
          !q.options || 
          !Array.isArray(q.options) || 
          q.options.length !== 4 || 
          !q.correctAnswer || 
          !q.options.includes(q.correctAnswer)) {
        throw new Error('Invalid question structure');
      }
      return q;
    });
    
    // Ensure we have the requested number of questions or fewer
    const limitedQuestions = validatedQuestions.slice(0, requestedQuestions);
    
    return { questions: limitedQuestions };
  } catch (error) {
    console.error('Quiz parsing error:', error);
    throw new Error('Failed to parse quiz response');
  }
};

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NIM_MODEL = "meta/llama-4-maverick-17b-128e-instruct";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

router.post('/quiz', protect, async (req, res) => {
  const { topic, numberOfQuestions = 5 } = req.body;

  // Validate inputs
  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Valid topic is required' });
  }

  // Validate number of questions
  const parsedNumberOfQuestions = Math.min(Math.max(1, Number(numberOfQuestions)), 10);

  try {
    // Create a unique cache key that includes the number of questions
    const cacheKey = `${topic.toLowerCase()}_${parsedNumberOfQuestions}`;
    
    // Check cache first
    const cachedQuiz = quizCache.get(cacheKey);
    if (cachedQuiz && (Date.now() - cachedQuiz.timestamp) < CACHE_EXPIRY) {
      return res.json(cachedQuiz.quiz);
    }

    const quizSeed = generateQuizSeed(topic, parsedNumberOfQuestions);

    const prompt = `Generate a unique and challenging multiple-choice quiz about ${topic}. \nEnsure the following requirements:\n- Generate exactly ${parsedNumberOfQuestions} questions\n- Each question should test a unique concept or knowledge area\n- Avoid trivial or overly simple questions\n- Provide 4 plausible but distinct answer options\n- Clearly mark the correct answer\nUse this randomization seed: ${quizSeed}\n\nFormat strictly as JSON:\n{\n  "questions": [\n    {\n      "question": "Detailed question text",\n      "options": ["option1", "option2", "option3", "option4"],\n      "correctAnswer": "correct option"\n    }\n  ]\n}`;
    const payload = {
      model: NIM_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
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
    let responseText = response.data?.choices?.[0]?.message?.content || "No response received.";
    const quizData = parseQuizResponse(responseText, parsedNumberOfQuestions);

    // Cache the quiz with the specific number of questions
    quizCache.set(cacheKey, {
      quiz: quizData,
      timestamp: Date.now()
    });

    return res.json(quizData);
  } catch (error) {
    console.error('Quiz generation error:', {
      message: error.message,
      stack: error.stack,
      responseData: error.response?.data
    });

    return res.status(500).json({
      error: 'Failed to generate quiz',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

router.post('/quiz/submit', protect, async (req, res) => {
  const { userAnswers, topic, numberOfQuestions = 5 } = req.body;
  const userId = req.user.id;

  // Validate inputs
  if (!userAnswers || typeof userAnswers !== 'object') {
    return res.status(400).json({ error: 'Invalid answers format' });
  }

  if (!topic || typeof topic !== 'string') {
    return res.status(400).json({ error: 'Topic is required' });
  }

  // Validate number of questions
  const parsedNumberOfQuestions = Math.min(Math.max(1, Number(numberOfQuestions)), 10);

  try {
    // Retrieve the cached quiz
    const cacheKey = `${topic.toLowerCase()}_${parsedNumberOfQuestions}`;
    const cachedQuiz = quizCache.get(cacheKey);
    
    if (!cachedQuiz) {
      return res.status(400).json({ error: 'Quiz not found or expired' });
    }

    const questions = cachedQuiz.quiz.questions;
    
    // Carefully calculate score
    let score = 0;
    questions.forEach((question, index) => {
      // Ensure answer exists and exactly matches the correct answer
      if (userAnswers[index] && userAnswers[index] === question.correctAnswer) {
        score++;
      }
    });

    // Ensure score is calculated precisely
    const calculatedScore = Math.max(0, Math.min(score, questions.length));

    // Convert to percentage
    const scorePercentage = Math.round((calculatedScore / questions.length) * 100);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $inc: { exp: scorePercentage },
        $push: {
          quizHistory: {
            topic,
            score: calculatedScore,
            totalQuestions: questions.length,
            date: new Date()
          }
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      score: calculatedScore,
      totalQuestions: questions.length,
      expEarned: scorePercentage
    });
  } catch (error) {
    console.error('Quiz submission error:', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Failed to submit quiz',
      details: error.message
    });
  }
});

module.exports = router;