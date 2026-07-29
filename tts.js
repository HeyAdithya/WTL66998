// /api/tts.js
// Vercel Serverless Function — Sarvam AI Text-to-Speech proxy.
//
// The Sarvam API key is read only from process.env.SARVAM_API_KEY
// (set in Vercel → Project → Settings → Environment Variables).
// It is never sent to, or readable by, the browser.

const LANG_CODE = {
  ta: 'ta-IN',
  en: 'en-IN',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server is missing SARVAM_API_KEY' });
  }

  try {
    const { text, lang } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing "text" in request body' });
    }

    const target_language_code = LANG_CODE[lang] || LANG_CODE.en;

    // bulbul:v3 max is 2500 characters — trimmed defensively, rules are short anyway.
    const safeText = text.slice(0, 2500);

    const sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text: safeText,           // bulbul:v3 expects a single string, not an "inputs" array
        target_language_code,
        speaker: 'shreya',
        model: 'bulbul:v3',
        pace: 1.0,
        speech_sample_rate: 22050,
        // Note: enable_preprocessing / pitch / loudness are bulbul:v2-only
        // parameters and are rejected (422) by bulbul:v3, so they are omitted.
      }),
    });

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text();
      return res.status(sarvamRes.status).json({ error: 'Sarvam API error', detail: errText });
    }

    const data = await sarvamRes.json();
    const audioB64 = Array.isArray(data.audios) ? data.audios[0] : null;
    if (!audioB64) {
      return res.status(502).json({ error: 'Sarvam API returned no audio' });
    }

    return res.status(200).json({ audio: audioB64, mime: 'audio/wav' });
  } catch (err) {
    return res.status(500).json({ error: 'TTS proxy failed', detail: String(err) });
  }
}
