import soundfile as sf
from chatterbox.tts import ChatterboxTTS

TEXT = (
    "On the third day at Gettysburg, Pickett's men stepped off into open "
    "ground beneath a brutal July sun, marching toward a stone wall a mile away."
)

print("Loading Chatterbox Turbo model (this may download weights on first run)...")
model = ChatterboxTTS.from_pretrained(device="cuda")
print("Model loaded.")

print("Generating audio...")
wav = model.generate(TEXT)
print("Generation complete.")

sf.write("test_output.wav", wav.squeeze(0).cpu().numpy(), model.sr)
print("Saved output to test_output.wav")
