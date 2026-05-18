// ACAI v3 - Voice Recording Frontend Helper
// Drop this into your frontend to add a mic button.
//
// Browser permission required: microphone access.
// Tested on: Chrome, Edge, Firefox. Safari needs user gesture.

const BACKEND_URL = 'http://127.0.0.1:8000';

/**
 * Records audio from the user's microphone for `durationMs` milliseconds
 * (or until stopRecording() is called) and sends to /voice/transcribe.
 *
 * Returns: { text, metadata }
 */
class ACAIVoiceRecorder {
  constructor() {
    this.recorder = null;
    this.chunks = [];
    this.stream = null;
    this.isRecording = false;
  }

  async start() {
    if (this.isRecording) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error('Microphone access denied: ' + e.message);
    }

    // WebM/Opus is widely supported and Whisper handles it via ffmpeg
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.chunks = [];

    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    this.recorder.start();
    this.isRecording = true;
  }

  async stop() {
    if (!this.isRecording) return null;
    return new Promise((resolve) => {
      this.recorder.onstop = async () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        // Stop the mic stream
        this.stream.getTracks().forEach((t) => t.stop());
        this.isRecording = false;
        resolve(blob);
      };
      this.recorder.stop();
    });
  }

  async transcribe(blob, language = 'ar') {
    const fd = new FormData();
    fd.append('audio', blob, 'recording.webm');
    fd.append('language', language);

    const resp = await fetch(`${BACKEND_URL}/voice/transcribe`, {
      method: 'POST',
      body: fd,
    });

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${resp.status}`);
    }
    return resp.json();
  }

  /**
   * One-shot helper: start mic, wait until stop is called externally,
   * then transcribe and return text.
   */
  async startStopAndTranscribe(durationMs = 5000, language = 'ar') {
    await this.start();
    await new Promise((r) => setTimeout(r, durationMs));
    const blob = await this.stop();
    return this.transcribe(blob, language);
  }
}

// ===== Text-to-speech playback =====
async function acaiPlayTTS(text, opts = {}) {
  const fd = new FormData();
  fd.append('text', text);
  if (opts.backend) fd.append('backend', opts.backend);
  if (opts.voice) fd.append('voice', opts.voice);

  const resp = await fetch(`${BACKEND_URL}/voice/synthesize`, {
    method: 'POST',
    body: fd,
  });

  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}));
    throw new Error(e.error || `HTTP ${resp.status}`);
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();
  return audio;
}

// ===== Image upload helpers =====
async function acaiAnalyzeImage(file, prompt) {
  const fd = new FormData();
  fd.append('image', file);
  if (prompt) fd.append('prompt', prompt);
  const r = await fetch(`${BACKEND_URL}/vision/analyze`, { method: 'POST', body: fd });
  return r.json();
}

async function acaiOcrImage(file) {
  const fd = new FormData();
  fd.append('image', file);
  const r = await fetch(`${BACKEND_URL}/vision/ocr`, { method: 'POST', body: fd });
  return r.json();
}

// Export for module bundlers, or use globals for plain HTML
if (typeof window !== 'undefined') {
  window.ACAIVoiceRecorder = ACAIVoiceRecorder;
  window.acaiPlayTTS = acaiPlayTTS;
  window.acaiAnalyzeImage = acaiAnalyzeImage;
  window.acaiOcrImage = acaiOcrImage;
}
