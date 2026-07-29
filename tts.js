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

// Safely get a parsed JSON body regardless of whether the runtime
// already parsed it (normal on Vercel Node functions) or handed us a
// raw string/stream (can happen depending on config/runtime).
async function getJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) {
      console.error('[TTS API] Failed to JSON.parse string body:', e);
      return {};
    }
  }
  // Fallback: read the raw stream ourselves.
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('[TTS API] Failed to read/parse raw request stream:', e);
    return {};
  }
}

export default async function handler(req, res) {
  console.log('[TTS API] Incoming request:', req.method, req.url);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    console.error('[TTS API] Rejected non-POST method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    console.error('[TTS API] SARVAM_API_KEY is not set in the environment');
    return res.status(500).json({ error: 'Server is missing SARVAM_API_KEY' });
  }

  try {
    const body = await getJsonBody(req);
    const { text, lang } = body || {};
    if (!text || typeof text !== 'string') {
      console.error('[TTS API] Missing/invalid "text" in body:', body);
      return res.status(400).json({ error: 'Missing "text" in request body' });
    }

    const target_language_code = LANG_CODE[lang] || LANG_CODE.en;

    // bulbul:v3 max is 2500 characters — trimmed defensively, rules are short anyway.
    const safeText = text.slice(0, 2500);

    console.log(`[TTS API] Sending Request to Sarvam — lang=${lang} chars=${safeText.length}`);

    let sarvamRes;
    try {
      sarvamRes = await fetch('https://api.sarvam.ai/text-to-speech', {
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
    } catch (networkErr) {
      // The outbound fetch to Sarvam itself failed (DNS/TLS/network).
      console.error('[TTS API] Network error calling Sarvam:', networkErr);
      return res.status(502).json({ error: 'Could not reach Sarvam API', detail: String(networkErr) });
    }

    console.log('[TTS API] Sarvam responded with status', sarvamRes.status);

    if (!sarvamRes.ok) {
      const errText = await sarvamRes.text().catch(() => '');
      console.error('[TTS API] Sarvam API error response:', sarvamRes.status, errText);
      return res.status(sarvamRes.status).json({ error: 'Sarvam API error', detail: errText });
    }

    let data;
    try {
      data = await sarvamRes.json();
    } catch (parseErr) {
      const raw = await sarvamRes.text().catch(() => '');
      console.error('[TTS API] Sarvam response was not valid JSON. Raw body:', raw, parseErr);
      return res.status(502).json({ error: 'Sarvam API returned non-JSON response', detail: raw });
    }

    // Adaptive parsing: Sarvam's documented shape is { audios: ["<base64>"] },
    // but we defensively accept a few alternate shapes too, in case the
    // API version changes the field name.
    const audioB64 =
      (Array.isArray(data.audios) ? data.audios[0] : null) ||
      data.audio ||
      data.audio_base64 ||
      (data.output && data.output.audio) ||
      null;

    if (!audioB64) {
      console.error('[TTS API] Sarvam response contained no recognizable audio field:', data);
      return res.status(502).json({ error: 'Sarvam API returned no audio', detail: JSON.stringify(data).slice(0, 500) });
    }

    console.log('[TTS API] Audio Generated — returning base64 payload, length', audioB64.length);
    return res.status(200).json({ audio: audioB64, mime: 'audio/wav' });
  } catch (err) {
    console.error('[TTS API] Unhandled error in TTS proxy:', err);
    return res.status(500).json({ error: 'TTS proxy failed', detail: String(err) });
  }
}
