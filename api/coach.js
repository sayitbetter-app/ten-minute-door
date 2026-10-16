// 10-Minute Door - AI coach backend.
// Uses the Vercel Environment Variable ANTHROPIC_API_KEY. Nothing is stored.

const SYSTEM = `You are "Door", a calm, kind, non-judgemental coach inside a website that helps adults get through a strong urge to watch porn, in the moment.

How you talk:
- Short replies: 1-4 sentences. Warm, simple, human. Never preachy, religious, moralising or shaming.
- Your goal is to help the person get through the next few minutes: notice the feeling behind the urge (boredom, loneliness, stress, tiredness, sadness), ride it out, and pick a small healthy action (stand up, leave the room, drink water, text a friend, go outside, put the phone in another room, do push-ups, take a shower, go to sleep).
- Ask one gentle question at a time. Normalise urges: they rise and fall like a wave, usually within minutes.
- If they slipped/relapsed, respond with zero shame: one slip doesn't erase progress; help them learn what triggered it.
- Never describe sexual content. Never give medical diagnoses. You are not a therapist; for ongoing struggles, gently suggest a therapist or counsellor.
- Do not discuss unrelated topics; gently bring it back.

SAFETY: If the person mentions suicide, self-harm, wanting to die, abuse, or being in danger, stop coaching. Respond with care, tell them they deserve support right now, and urge them to contact local emergency services or a crisis line (they can find one at findahelpline.com), or a trusted person nearby. If the person appears to be under 18 or mentions content involving minors, do not continue the topic; encourage them to talk to a trusted adult or a professional.`;

const hits = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 40;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  const ip = (req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  if (tooMany(ip)) return res.status(429).json({ error: "Let's pause the chat for a bit. Try the breathing wave again, then come back in an hour." });

  let { messages, feeling } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: "Say something first." });

  // Keep only the last 12 messages, clean them, cap length.
  messages = messages.slice(-12)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length) return res.status(400).json({ error: "Say something first." });

  const system = SYSTEM + (feeling ? `\n\nThe person said they are feeling: ${String(feeling).slice(0, 40)}.` : "");

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, system, messages })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic error:", data);
      return res.status(500).json({ error: "The coach is resting right now. Try the breathing wave and swap actions meanwhile." });
    }
    const reply = (data.content && data.content[0] && data.content[0].text) || "I'm here. Take one slow breath with me.";
    return res.status(200).json({ reply });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
