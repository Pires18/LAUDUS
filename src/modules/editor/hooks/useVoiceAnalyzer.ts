import { useState, useEffect } from 'react';
import { logger } from '../../../utils/logger';

export function useVoiceAnalyzer(isListening: boolean) {
  const [voiceVolume, setVoiceVolume] = useState(0);

  useEffect(() => {
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animationId: number | null = null;
    let cancelled = false;

    const getVolume = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          if (!analyser || cancelled) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setVoiceVolume(Math.min(100, Math.round(average * 2.5)));
          animationId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        logger.warn('[Voice Analyser] Microfone não acessível ou permissão negada:', err);
        let mockInterval = setInterval(() => {
          if (cancelled) { clearInterval(mockInterval); return; }
          setVoiceVolume(Math.random() * 100);
        }, 100);
        return () => clearInterval(mockInterval);
      }
    };

    if (isListening) {
      getVolume();
    } else {
      setVoiceVolume(0);
    }

    return () => {
      cancelled = true;
      if (animationId) cancelAnimationFrame(animationId);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [isListening]);

  return { voiceVolume };
}
