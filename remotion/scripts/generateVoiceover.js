require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Script text ──────────────────────────────────────────────────────────────
const VOICEOVER_TEXT = `
He was 23. Born in Oakland. An American.

And the U.S. government put him in a prison camp.

His name was Fred Korematsu. And he said no.

In 1942, President Roosevelt signed Executive Order 9066. One hundred twenty thousand Japanese Americans — ordered out of their homes. Ordered into camps.

Fred refused. He was arrested. Convicted.

He took it to the Supreme Court. And lost.

Here's what the government didn't tell the Court. Their own military intelligence had already concluded there was no threat. Japanese Americans were not a security risk. The report existed. They buried it.

The Supreme Court ruled against Fred Korematsu based on a lie.

For forty years, nobody knew.

Then in 1983, a legal researcher found that buried report in the National Archives. A federal court vacated Fred's conviction. The government had submitted false evidence to the highest court in the country.

In 2018, the Supreme Court officially declared their own ruling wrong.

Fred didn't live to see that. He died in 2005.

But before he died he said this —

If you have the feeling that something is wrong, don't be afraid to speak up.

He did. It cost him everything. Then it changed everything.

Follow for more history they didn't teach you.
`.trim();
// ─────────────────────────────────────────────────────────────────────────────

const VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const MODEL_ID = 'eleven_multilingual_v2';

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'audio');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'korematsu-voiceover.mp3');

const apiKey = process.env.ELEVENLABS_API_KEY;

if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY — add it to remotion/.env');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const requestBody = JSON.stringify({
  text: VOICEOVER_TEXT,
  model_id: MODEL_ID,
  voice_settings: {
    stability: 0.35,
    similarity_boost: 0.75,
    style: 0.25,
    use_speaker_boost: true,
  },
});

const options = {
  hostname: 'api.elevenlabs.io',
  path: `/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody),
    Accept: 'audio/mpeg',
  },
};

console.log(`Generating Korematsu voiceover (${VOICEOVER_TEXT.split(/\s+/).length} words)...`);

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
