import { useCallback, useRef, useState } from "react";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import i18n from "../i18n";

export type RecordingStatus = "idle" | "recording" | "transcribing";

type Options = {
  gatewayHttpUrl: string;
  onTranscript?: (text: string) => void;
  onError?: (error: string) => void;
};

export const useVoiceRecorder = ({ gatewayHttpUrl, onTranscript, onError }: Options) => {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      if (!granted) {
        onError?.(i18n.t("voice.micPermissionDenied"));
        return;
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();

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
  }, [onError, recorder]);

  const stopAndTranscribe = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      setStatus("transcribing");
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;

      if (!uri) {
        onError?.(i18n.t("voice.noRecordingUri"));
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
        onError?.(text || i18n.t("voice.transcriptionFailed", { status: res.status }));
        setStatus("idle");
        return;
      }

      const data = await res.json();
      const transcript = typeof data.text === "string" ? data.text.trim() : "";

      if (transcript) {
        onTranscript?.(transcript);
      } else {
        onError?.(i18n.t("voice.noSpeechDetected"));
      }
    } catch (err) {
      onError?.((err as Error).message);
    } finally {
      setStatus("idle");
      setDurationMs(0);
    }
  }, [gatewayHttpUrl, onTranscript, onError, recorder]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch { /* already stopped */ }

    setStatus("idle");
    setDurationMs(0);
  }, [recorder]);

  return {
    status,
    durationMs,
    startRecording,
    stopAndTranscribe,
    cancelRecording,
  };
};
