
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Gunakan metode POST."
    });
  }

  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
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
    const upstream = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
          messages: [
            {
              role: "system",
              content:
                "Kamu adalah Zet's AI, asisten yang ramah, jelas, dan membantu. Jawab sesuai bahasa pengguna."
            },
            ...history,
            {
              role: "user",
              content: message.trim()
            }
          ],
          max_tokens: 600
        })
      },
    );

    if (!upstream.ok) {
      // Jangan kirim detail internal provider ke aplikasi.
      console.error("Groq API status:", upstream.status);
      return res.status(502).json({
        error: upstream.status === 429
          ? "Batas penggunaan AI tercapai. Coba lagi nanti."
          : "Layanan AI sedang bermasalah."
      });
    }

    const result = await upstream.json();
    const reply = result.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "AI belum memberikan jawaban."
      });
    }

    return res.status(200).json({
      reply: reply.trim()
    });
  } catch {
    return res.status(502).json({
      error: "Tidak dapat terhubung ke layanan AI."
    });
  }
}
