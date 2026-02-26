import { useCallback, useRef, useState } from "react";
import { Audio } from "expo-av";

export type RecordingStatus = "idle" | "recording" | "transcribing";

type Options = {
  gatewayHttpUrl: string;
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
};

export const useVoiceRecorder = ({ gatewayHttpUrl, onTranscript, onError }: Options) => {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        onError?.("Microphone permission denied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );

      recordingRef.current = recording;
      setStatus("recording");
      setDurationMs(0);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTime);
      }, 200);
    } catch (err) {
      onError?.((err as Error).message);
      setStatus("idle");
    }
  }, [onError]);

  const stopAndTranscribe = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recording = recordingRef.current;
    if (!recording) {
      setStatus("idle");
      return;
    }

    try {
      setStatus("transcribing");
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        onError?.("No recording URI");
        setStatus("idle");
        return;
      }

      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as any);

      const res = await fetch(`${gatewayHttpUrl}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        onError?.(text || `Transcription failed (${res.status})`);
        setStatus("idle");
        return;
      }

      const data = await res.json();
      const transcript = typeof data.text === "string" ? data.text.trim() : "";

      if (transcript) {
        onTranscript?.(transcript);
      } else {
        onError?.("No speech detected");
      }
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setStatus("idle");
      setDurationMs(0);
    }
  }, [gatewayHttpUrl, onTranscript, onError]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recording = recordingRef.current;
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch { /* already stopped */ }
      recordingRef.current = null;
    }

    setStatus("idle");
    setDurationMs(0);
  }, []);

  return {
    status,
    durationMs,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
  };
};
