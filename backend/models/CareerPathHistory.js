const mongoose = require("mongoose");

const CareerPathHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    skills: {
      type: [String], // Array of skills
      required: true,
    },
    interests: {
      type: [String], // Array of interests
      required: true,
    },
    certifications: {
      type: [String], // Array of certifications
      default: [], // Optional field
    },
    requestText: {
      type: String,
      required: true,
    },
    responseText: {
      type: String,
      required: true,
    },
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

module.exports = mongoose.model("CareerPathHistory", CareerPathHistorySchema);
