// src/services/gemini.service.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ Missing GEMINI_API_KEY in environment variables");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const moderateText = async (text) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `
Check the following text for harassment, hate, abuse, or unsafe content.
Reply ONLY with SAFE or UNSAFE.

Text:
"""${text}"""
`;

  const result = await model.generateContent(prompt);
  const response = result.response.text().trim();

  return response === "SAFE";
};

module.exports = {
  moderateText,
};
