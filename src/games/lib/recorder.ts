/**
 * Microphone recorder.
 *
 * Captures raw audio from getUserMedia and returns a mono AudioBuffer, which is
 * the format the DDSP model expects. We record into a MediaRecorder blob and
 * decode it afterwards — simple and robust across browsers.
 */
export class MicRecorder {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  /** Ask for mic permission up front so the count-in isn't interrupted. */
  async arm(): Promise<void> {
    if (this.stream) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }

  start(): void {
    if (!this.stream) throw new Error("recorder not armed — call arm() first");
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  /** Stop recording and decode the result into a mono AudioBuffer. */
  async stop(audioCtx: AudioContext): Promise<AudioBuffer> {
    const recorder = this.mediaRecorder;
    if (!recorder) throw new Error("not recording");

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () =>
        resolve(new Blob(this.chunks, { type: recorder.mimeType }));
      recorder.stop();
    });

    const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    return toMono(decoded, audioCtx);
  }

  /** Release the mic so the browser indicator turns off. */
  release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}

/** Down-mix any buffer to a single channel. */
function toMono(buffer: AudioBuffer, ctx: AudioContext): AudioBuffer {
  if (buffer.numberOfChannels === 1) return buffer;
  const mono = ctx.createBuffer(1, buffer.length, buffer.sampleRate);
  const out = mono.getChannelData(0);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return mono;
}
