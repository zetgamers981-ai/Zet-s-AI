
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Gunakan metode POST."
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "Backend belum dikonfigurasi."
    });
  }

  const message = req.body?.message;

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 4000
  ) {
    return res.status(400).json({
      error: "Pesan harus berisi 1–4000 karakter."
    });
  }

  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
        .slice(-8)
        .map(item => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content.slice(0, 1500) }]
        }))
    : [];

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      contents: [
        ...history,
        {
          role: "user",
          parts: [{ text: message.trim() }]
        }
      ],
      config: {
        systemInstruction:
          "Kamu adalah Zet's AI, asisten yang ramah, jelas, dan membantu.",
        maxOutputTokens: 600
      }
    });

    if (!result.text?.trim()) {
      return res.status(502).json({
        error: "AI belum memberikan jawaban."
      });
    }

    return res.status(200).json({
      reply: result.text.trim()
    });
  } catch (error) {
    console.error("Gemini API error:", error.status || "unknown");

    return res.status(502).json({
      error: "Layanan AI bermasalah. Coba lagi nanti."
    });
  }
}
