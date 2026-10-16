
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 10000;

app.disable("x-powered-by");
app.use(express.json({ limit: "12kb" }));

// Masukkan origin website dan aplikasi yang benar
// ke FRONTEND_ORIGINS di Render, dipisahkan koma.
const allowedOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Permintaan tanpa Origin bisa berasal dari alat API.
    // CORS bukan pengganti autentikasi.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin tidak diizinkan"));
  },
  methods: ["POST", "GET"],
  allowedHeaders: ["Content-Type"]
}));

app.get("/", (req, res) => {
  res.json({ status: "Zet's AI backend aktif" });
});

app.use("/api/chat", rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
}));

app.post("/api/chat", async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
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
          role: item.role,
          content: item.content.slice(0, 1500)
        }))
    : [];

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25000,
      maxRetries: 1
    });

    const result = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      instructions:
        "Kamu adalah Zet's AI, asisten yang ramah, jelas, dan membantu. Jawab sesuai bahasa pengguna.",
      input: [
        ...history.map(item => ({
          role: item.role,
          content: item.content
        })),
        {
          role: "user",
          content: message.trim()
        }
      ],
      max_output_tokens: 600
    });

    const reply = result.output_text;

    if (!reply || !reply.trim()) {
      return res.status(502).json({
        error: "AI belum memberikan jawaban."
      });
    }

    return res.json({ reply: reply.trim() });
  } catch (error) {
    // Detail error dan API key tidak dikirim ke aplikasi.
    console.error("Permintaan AI gagal:", error.status || "unknown");
    return res.status(502).json({
      error: "Layanan AI sedang bermasalah. Coba lagi nanti."
    });
  }
});

app.use((err, req, res, next) => {
  if (err.message === "Origin tidak diizinkan") {
    return res.status(403).json({
      error: "Origin tidak diizinkan."
    });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "Format JSON tidak valid."
    });
  }

  console.error("Kesalahan server.");
  return res.status(500).json({
    error: "Terjadi kesalahan pada server."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Zet's AI backend berjalan di port ${PORT}`);
});
