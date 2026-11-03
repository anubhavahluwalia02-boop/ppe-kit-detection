let audioCtx: AudioContext | null = null;
let isMuted = false;

export function setAlarmMuted(muted: boolean) {
  isMuted = muted;
}

export function isAlarmMuted(): boolean {
  return isMuted;
}

export function playViolationAlarm() {
  if (isMuted) return;

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === 'suspended') {
      audioCtx = new AudioContextClass();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    // Two-tone warning beep
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.setValueAtTime(660, audioCtx.currentTime + 0.15); // E5

    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (err) {
    console.warn('Audio alarm playback suppressed:', err);
  }
}
