import React, { useState, useEffect } from "react";
import axios from "axios";
import Chatbot from "../components/Chatbot";

const CareerPath = () => {
  const [response, setResponse] = useState("");
  const [history, setHistory] = useState([]); // ✅ Ensure history is initialized as an array
  const [showHistory, setShowHistory] = useState(false);

  // 🔹 Get userId from sessionStorage (authentication)
  const userId = sessionStorage.getItem("userId");

  // 🔹 Handle Career Path request
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userId) {
      console.error("❌ Error: No authenticated user.");
      return;
    }

    try {
      const { data } = await axios.post("http://localhost:5000/api/career/generate", { userId });

      setResponse(data.response);
    } catch (error) {
      console.error("❌ Error fetching career path:", error);
    }
  };

  // 🔹 Fetch Career Path history (only for the authenticated user)
  const fetchHistory = async () => {
    if (!userId) {
      console.error("❌ Error: No authenticated user.");
      return;
    }

    try {
      const { data } = await axios.get(`http://localhost:5000/api/career/history/${userId}`);
      setHistory(data || []); // ✅ Ensure history is set to an array even if API fails
      setShowHistory(true);
    } catch (error) {
      console.error("❌ Error fetching history:", error);
      setHistory([]); // ✅ Set empty array to avoid undefined errors
    }
  };

  return (
    <div className="career-path-container">
      <div className="content">
        <h2>Career Path Generator</h2>
        <form onSubmit={handleSubmit} className="career-form">
          <button type="submit">Generate Career Path</button>
        </form>

        {response && (
          <div className="response-box">
            <h3>Generated Career Path:</h3>
            <p>{response}</p>
          </div>
        )}

        <button onClick={fetchHistory} className="history-btn">
          Search History
        </button>

        {showHistory && (
          <div className="history-section">
            <h3>Past Career Path Requests:</h3>
            {history.length > 0 ? ( // ✅ Ensure history is not empty before mapping
              <ul className="history-list">
                {history.map((entry, index) => (
                  <li key={index} className="history-item">
                    <strong>Skills:</strong> {entry.skills?.join(", ") || "Not specified"} <br />
                    <strong>Interests:</strong> {entry.interests?.join(", ") || "Not specified"} <br />
                    <strong>Achievements:</strong> {entry.achievements?.length ? entry.achievements.join(", ") : "None"} <br />
                    <strong>Generated Path:</strong> {entry.responseText || "No data available"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No career history available.</p> // ✅ Handle empty history
            )}
          </div>
        )}

        <Chatbot />
      </div>
    </div>
  );
};

export default CareerPath;
