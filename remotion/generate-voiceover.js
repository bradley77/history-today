require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

// ─── VOICEOVER SCRIPT — edit this block for each new article ─────────────────
const VOICEOVER_TEXT = `Most people walk past this wall without stopping.
It has four thousand, forty-eight gold stars on it. Each one represents 100 Americans killed in World War II. That is 400,000 dead, sitting in plain sight on the National Mall in Washington.
The inscription beneath the stars reads: Here we mark the price of freedom.
The memorial that contains that wall was dedicated on May 29, 2004. By the time it opened, the men it was built to honor were dying at a rate of more than 1,000 every single day.
It did not have to take that long.
The story starts in 1987. A World War II veteran named Roger Durbin walked into a town hall meeting in Ohio and asked his congresswoman a single question. Why was there no memorial on the National Mall for the Americans who fought in World War II?
She did not have a good answer. She introduced a bill that year. It never came to a vote. She introduced it again in 1989. Nothing. Again in 1991. Nothing.
It took six years just to get the law signed. Then came the fights over where to put it, what it should look like, and who should pay for it. Critics called the design overbearing. Legal challenges had to be dismissed by Congress. The location between the Lincoln Memorial and the Washington Monument, the most prominent spot on the entire Mall, was contested for years.
Congress eventually passed a law exempting the memorial from further review. The reason they gave was simple. Veterans were dying faster than the process was moving.
Ground was broken in November 2000. Fifty five years after the war ended.
Sixteen million Americans served in World War II. By the time the memorial opened in 2004, fewer than four million were still alive. The men who stormed Normandy, who fought at Iwo Jima, who survived the Battle of the Bulge, were in their late seventies and eighties. Many came to the dedication in wheelchairs.
Roger Durbin, the veteran who asked the question that started all of it, died in 2000. He never saw it open.
Today fewer than 100,000 of those 16 million veterans remain.
The wall has 4,048 stars. Most people walk right past them.
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

// ── Read API key loaded by dotenv from remotion/.env ─────────────────────────
const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY — add it to remotion/.env');
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
