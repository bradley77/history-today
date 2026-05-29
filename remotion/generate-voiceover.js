// ─── Voiceover script — edit this block for each new article ─────────────────
const VOICEOVER_TEXT = `
Paste your article voiceover script here.
Each paragraph will be read naturally by the narrator.
Replace this entire string with your article text.
`.trim();
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const https = require('https');

// Voice: Adam — authoritative American male narrator (ElevenLabs built-in)
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB';
const MODEL_ID = 'eleven_multilingual_v2';

const OUTPUT_DIR = path.join(__dirname, 'public', 'audio');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'voiceover.mp3');
const ENV_FILE = path.join(__dirname, '.env');

// ── Read API key from remotion/.env ──────────────────────────────────────────
if (!fs.existsSync(ENV_FILE)) {
  console.error('Missing remotion/.env — create it with ELEVENLABS_API_KEY=your_key');
  process.exit(1);
}

const envContent = fs.readFileSync(ENV_FILE, 'utf8');
const apiKeyMatch = envContent.match(/^ELEVENLABS_API_KEY=(.+)$/m);
const apiKey = apiKeyMatch?.[1]?.trim();

if (!apiKey || apiKey === 'your_key_here') {
  console.error('Set a real ELEVENLABS_API_KEY value in remotion/.env');
  process.exit(1);
}

if (!VOICEOVER_TEXT) {
  console.error('VOICEOVER_TEXT is empty — add your script at the top of this file');
  process.exit(1);
}

// ── Ensure output directory exists ───────────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Call ElevenLabs TTS API ───────────────────────────────────────────────────
const requestBody = JSON.stringify({
  text: VOICEOVER_TEXT,
  model_id: MODEL_ID,
  voice_settings: {
    stability: 0.5,
    similarity_boost: 0.75,
  },
});

const options = {
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${VOICE_ID}`,
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody),
    Accept: 'audio/mpeg',
  },
};

console.log(`Generating voiceover (${VOICEOVER_TEXT.split(/\s+/).length} words)...`);

const req = https.request(options, (res) => {
  if (res.statusCode !== 200) {
    let errorBody = '';
    res.on('data', (chunk) => { errorBody += chunk; });
    res.on('end', () => {
      console.error(`ElevenLabs API error ${res.statusCode}:`, errorBody);
      process.exit(1);
    });
    return;
  }

  const fileStream = fs.createWriteStream(OUTPUT_FILE);
  res.pipe(fileStream);

  fileStream.on('finish', () => {
    const sizeKb = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
    console.log(`Done — ${OUTPUT_FILE} (${sizeKb} KB)`);
  });

  fileStream.on('error', (err) => {
    console.error('Failed to write file:', err.message);
    process.exit(1);
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err.message);
  process.exit(1);
});

req.write(requestBody);
req.end();
