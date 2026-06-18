/**
 * Echo & Chronicle — JS wrapper for Watergate per-slide voiceover generation
 * Invokes generateVoiceover-watergate.py
 *
 * Usage: npm run voiceover:watergate
 */

const { spawn } = require("child_process");
const path = require("path");

const scriptPath = path.join(__dirname, "generateVoiceover-watergate.py");

const proc = spawn("python", [scriptPath], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});

proc.on("close", (code) => {
  if (code !== 0) {
    console.error(`generateVoiceover-watergate.py exited with code ${code}`);
    process.exit(code);
  }
});
