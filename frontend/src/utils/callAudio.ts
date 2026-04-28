import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

type ToneHandle = {
  stop: () => void;
};

let activeTone: ToneHandle | null = null;

const toBase64 = (bytes: Uint8Array) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = bytes[i + 1] ?? 0;
    const byte3 = bytes[i + 2] ?? 0;
    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;

    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : '=';
  }

  return output;
};

const createWebTone = (frequency: number, cadenceMs: number): ToneHandle | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

  const AudioContextImpl = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextImpl) return null;

  const context = new AudioContextImpl();
  const gain = context.createGain();
  const oscillator = context.createOscillator();
  let isAudible = true;

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.16;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();

  const interval = window.setInterval(() => {
    isAudible = !isAudible;
    gain.gain.setValueAtTime(isAudible ? 0.16 : 0, context.currentTime);
  }, cadenceMs);

  return {
    stop: () => {
      window.clearInterval(interval);
      try {
        oscillator.stop();
        oscillator.disconnect();
        gain.disconnect();
        context.close?.();
      } catch (error) {
        console.warn('Failed to stop web call tone:', error);
      }
    },
  };
};

const createNativeTone = (frequency: number, cadenceMs: number): ToneHandle => {
  const sampleRate = 44100;
  const seconds = 0.35;
  const sampleCount = Math.floor(sampleRate * seconds);
  const bytesPerSample = 2;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + sampleCount * bytesPerSample);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, sampleCount * bytesPerSample, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const envelope = Math.min(i / 600, (sampleCount - i) / 600, 1);
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.24 * envelope;
    view.setInt16(headerSize + i * bytesPerSample, sample * 32767, true);
  }

  const bytes = new Uint8Array(buffer);

  const player = createAudioPlayer(`data:audio/wav;base64,${toBase64(bytes)}`, {
    keepAudioSessionActive: true,
  });
  player.volume = 0.9;
  player.loop = true;
  player.play();

  const interval = setInterval(() => {
    if (player.playing) {
      player.pause();
    } else {
      player.seekTo(0).catch(() => null);
      player.play();
    }
  }, cadenceMs);

  return {
    stop: () => {
      clearInterval(interval);
      try {
        player.pause();
        player.remove();
      } catch (error) {
        console.warn('Failed to stop native call tone:', error);
      }
    },
  };
};

export const startCallTone = (type: 'ringtone' | 'ringback') => {
  stopCallTone();

  const frequency = type === 'ringtone' ? 880 : 440;
  const cadenceMs = type === 'ringtone' ? 850 : 1200;
  const tone = createWebTone(frequency, cadenceMs) || createNativeTone(frequency, cadenceMs);

  activeTone = tone;
};

export const stopCallTone = () => {
  activeTone?.stop();
  activeTone = null;
};

export const configureCallAudioMode = async (isVideoCall: boolean) => {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: !isVideoCall,
  });
};

export const restoreDefaultAudioMode = async () => {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
};
