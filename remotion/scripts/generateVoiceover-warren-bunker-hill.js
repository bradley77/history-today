const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY_SCRIPT = path.join(__dirname, 'generateVoiceover-warren-bunker-hill.py');
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

console.log('Kokoro TTS — Warren Bunker Hill per-slide voiceovers starting...');
console.log('(First run downloads model files ~88 MB to scripts/models/ — cached after that)\n');

try {
  execSync(`python "${PY_SCRIPT}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} catch (err) {
  console.error('\nGeneration failed. See Python output above for details.');
  process.exit(1);
}

console.log('\nOutput files:');
for (let i = 1; i <= 8; i++) {
  const num = String(i).padStart(2, '0');
  const mp3 = path.join(AUDIO_DIR, `warren-bunker-hill-vo-${num}.mp3`);
  const wav = mp3.replace(/\.mp3$/, '.wav');
  const file = fs.existsSync(mp3) ? mp3 : fs.existsSync(wav) ? wav : null;
  if (file) {
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`  ${path.basename(file)}: ${kb} KB`);
  } else {
    console.log(`  warren-bunker-hill-vo-${num}: MISSING`);
  }
}
