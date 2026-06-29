const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY_SCRIPT = path.join(__dirname, 'generateVoiceover-khe-sanh-quick-strike.py');
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

console.log('Kokoro TTS — khe-sanh-quick-strike voiceovers\n');

try {
  execSync(`python "${PY_SCRIPT}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
} catch (err) {
  console.error('\nGeneration failed. See Python output above for details.');
  process.exit(1);
}

const slides = ['01', '02', '03', '04'];
console.log('\nOutput files:');
for (const num of slides) {
  const mp3 = path.join(AUDIO_DIR, `khe-sanh-quick-strike-vo-${num}.mp3`);
  const wav = mp3.replace(/\.mp3$/, '.wav');
  const file = fs.existsSync(mp3) ? mp3 : fs.existsSync(wav) ? wav : null;
  if (file) {
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`  vo-${num}: ${path.basename(file)}  (${kb} KB)`);
  }
}
