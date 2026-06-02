const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PY_SCRIPT   = path.join(__dirname, 'generateVoiceover-madison.py');
const OUTPUT_FILE = path.join(__dirname, '..', 'public', 'audio', 'madison-voiceover.mp3');

console.log('Madison voiceover — starting generation...');
console.log('(First run downloads model files ~88 MB to scripts/models/ — cached after that)\n');

try {
  execSync(`python "${PY_SCRIPT}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
} catch (err) {
  console.error('\nGeneration failed. See Python output above for details.');
  process.exit(1);
}

// Report final file size (MP3 or WAV fallback)
const mp3Exists = fs.existsSync(OUTPUT_FILE);
const wavFallback = OUTPUT_FILE.replace(/\.mp3$/, '.wav');
const wavExists = fs.existsSync(wavFallback);

if (mp3Exists) {
  const kb = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
  console.log(`\nOutput : ${OUTPUT_FILE}`);
  console.log(`Size   : ${kb} KB`);
} else if (wavExists) {
  const kb = Math.round(fs.statSync(wavFallback).size / 1024);
  console.log(`\nOutput : ${wavFallback} (WAV — ffmpeg not found)`);
  console.log(`Size   : ${kb} KB`);
}
