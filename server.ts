import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Lazy initialization of Gemini to prevent crashes on startup if key is missing as per guidelines.
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in the environment.");
    }
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Suggesting topics if client requests them
  app.get("/api/topics", (req, res) => {
    res.json([
      {
        id: "daily_routines",
        title: "Daily Life & Routines",
        description: "Talk about your typical day, habits, and work-life balance.",
        questions: [
          "What is your morning routine?",
          "How do you usually handle stress during a busy workday?",
          "What hobbies or practices help you wind down in the evening?"
        ]
      },
      {
        id: "future_ai",
        title: "The Future of Artificial Intelligence",
        description: "Express your opinions on how AI is shaping careers, education, and society.",
        questions: [
          "Do you think AI will replace major human jobs in the next ten years?",
          "How have you started utilizing AI tools in your standard learning or work?",
          "What are the ethical concerns of AI that alarm you the most?"
        ]
      },
      {
        id: "travel_experience",
        title: "Memorable Travel or Culture",
        description: "Share details of a vacation, local custom, or places you dream of visiting.",
        questions: [
          "Where was the most memorable place you have ever traveled to?",
          "What is an unusual cultural habit from your hometown or country?",
          "What is your ultimate dream destination and why?"
        ]
      },
      {
        id: "challenging_situation",
        title: "Describing a Challenging Situation",
        description: "Explain a difficult time in your career, academics, or life and how you solved it.",
        questions: [
          "Can you describe a major setback you faced recently?",
          "What steps did you take to manage the obstacle?",
          "What was the single most valuable lesson you learned from that period?"
        ]
      },
      {
        id: "role_play_interview",
        title: "Job Interview Simulation",
        description: "Practice answering typical behavioral career interview questions.",
        questions: [
          "Why do you believe you are the best fit for your dream career field?",
          "Tell me about a time when you disagreed with a colleague or classmate.",
          "What are your absolute greatest strengths and how do you leverage them?"
        ]
      }
    ]);
  });

  // Evaluation and conversational endpoint using Gemini
  app.post("/api/coach", async (req, res) => {
    try {
      const { topic, voiceGender, messages, currentUtterance } = req.body;

      if (!currentUtterance || typeof currentUtterance !== "string") {
        return res.status(400).json({ error: "currentUtterance is required and must be a string." });
      }

      const client = getGenAI();

      // Format previous messages into structured format
      const historyContext = (messages || [])
        .map((m: any) => `${m.role === "user" ? "Client" : "Coach"}: "${m.text}"`)
        .join("\n");

      const systemInstruction = `You are "Coach Avery", a world-class supportive English communication coach and friendly dialogue partner. 
Your goal is to help non-native speakers express their thoughts eloquently, accurately, and naturally in English.
The client chose the topic: "${topic || "Free English Talk"}".
The coach's voice style requested is: "${voiceGender === "female" ? "polished and warm female coach" : "supportive and clear male coach"}".

Your task when the user inputs a statement ("currentUtterance") is two-fold:
1. FORMULATE a natural, concise, and highly encouraging conversational reply (up to 3-4 sentences maximum) that keeps the topic alive and asks a brief, relevant follow-up question. Be warm and patient. Do not sound robotic.
2. ANALYZE the user's latest statement ("currentUtterance") with extreme care. Detect any grammatical mistakes, poor word choices (e.g., prepositions, collocations), incorrect sentence spelling, or structural problems.
3. PROVIDE explicit correction details in your evaluation. For each mistake:
   - Identify the inaccurate text segment.
   - Show the corrected standard version.
   - Give a succinct, friendly grammatical explanation of the change so they learn *why* the correction was made.
4. PROVIDE a "fluencyTip" showing how a native speaker would express that exact same idea or emotion more idiomatically, politely, or naturally (e.g. replacing dry phrasing with native expressions).
5. PROVIDE an encouraging general comment about their development and accuracy.

Always response in strict JSON format conforming to the provided schema. If there are no mistakes, set hasMistakes to false and leave mistakes list empty, but still supply a great general comment and a fluency tip for an even higher-level alternative phrasing.`;

      const userPrompt = `
Conversation history so far:
${historyContext}

Latest user expression to respond to and evaluate:
"${currentUtterance}"
`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              conversationalResponse: {
                type: Type.STRING,
                description: "Your conversational response as Coach Avery, keeping the chat flowing naturally with a follow-up action or question."
              },
              evaluation: {
                type: Type.OBJECT,
                properties: {
                  hasMistakes: {
                    type: Type.BOOLEAN,
                    description: "True if the currentUtterance has grammatical, spelling, or structural errors."
                  },
                  mistakes: {
                    type: Type.ARRAY,
                    description: "An array of mistakes identified in the currentUtterance.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        original: {
                          type: Type.STRING,
                          description: "The faulty word, phrase, or sentence fragment the user said."
                        },
                        corrected: {
                          type: Type.STRING,
                          description: "The perfectly formulated grammatically correct version."
                        },
                        explanation: {
                          type: Type.STRING,
                          description: "A short, crystal-clear explanation of the rule, error, or logic."
                        },
                        category: {
                          type: Type.STRING,
                          description: "One of: 'grammar', 'vocabulary', 'structural', 'spelling'."
                        }
                      },
                      required: ["original", "corrected", "explanation", "category"]
                    }
                  },
                  fluencyTip: {
                    type: Type.STRING,
                    description: "An instruction or alternative native expression to express the exact same idea more elegantly or idiomatically."
                  },
                  generalComment: {
                    type: Type.STRING,
                    description: "A polite, constructive summary praising their effort and highlighting key areas of progress."
                  }
                },
                required: ["hasMistakes", "mistakes", "fluencyTip", "generalComment"]
              }
            },
            required: ["conversationalResponse", "evaluation"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Empty response received from Gemini.");
      }

      const parsedResult = JSON.parse(responseText.trim());
      res.json(parsedResult);
    } catch (error: any) {
      console.error("Gemini Coach API Error:", error);
      res.status(500).json({
        error: "Failed to process English coaching session turn.",
        details: error?.message || String(error)
      });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`English Coach Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
