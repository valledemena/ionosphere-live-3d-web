"use client";
/**
 * Drop 355: hook de export de video del canvas 3D (clip 15 s, MediaRecorder
 * + captureStream). Decisiones vinculantes del scout MINIMAX:
 * - D4/D5: chunks acumulados en ondataavailable; Blob en onstop con
 *   type: recorder.mimeType (nunca Blob([e.data]): duraria ~1 s).
 * - D6/D8: bitrate adaptativo videoBitsPerSecond(w,h,fps); VP8 preferido a 4K.
 * - D10: el padre bloquea el resize mientras recording=true (prop a escena).
 * - D12/D13: auto-stop con elapsed real (250 ms) ademas del timeout; guard
 *   de visibilityState; timers limpios en unmount y en stop manual.
 * - D14: track.stop() en onstop, despues de construir el Blob.
 * - D15: revokeObjectURL a 5 s (patron downloadText existente). D16:
 *   showSaveFilePicker queda fuera de alcance del 355 (residual).
 * - D17: nombre con epoch de DATOS (effSec), no Date.now().
 * - Sin audio, sin HUD (solo el canvas); "30 fps" es techo, no promesa.
 */

import * as React from "react";
import { toast as showToast } from "@/hooks/use-toast";
import {
  VIDEO_CLIP_MS,
  VIDEO_FPS,
  buildVideoName,
  is4K,
  isRecordingSupported,
  pickVideoFormat,
  videoBitsPerSecond,
} from "@/lib/iono/videoExport";

export interface VideoExportController {
  /** MediaRecorder + captureStream disponibles (ademas de canvas != null). */
  supported: boolean;
  recording: boolean;
  /** Segundos restantes del clip (15..1); solo durante recording. */
  secondsLeft: number;
  /** Construyendo/descargando el Blob tras stop(). */
  busy: boolean;
  error: string | null;
  /** Arranca si puede; devuelve false y toast si hay guard que lo impide. */
  start: (epochSec: number) => boolean;
  /** Para la grabacion actual (manual o aborto). No-op si no graba. */
  stop: () => void;
}

export function useVideoExport(canvas: HTMLCanvasElement | null): VideoExportController {
  const [recording, setRecording] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  // FIX1 (MUSE): tras onerror, MediaRecorder aun emite onstop; hay que
  // ignorarlo para NO descargar un clip parcial truncado.
  const erroredRef = React.useRef(false);
  const autoStopTimerRef = React.useRef<number | null>(null);
  const elapsedTimerRef = React.useRef<number | null>(null);
  const startedAtRef = React.useRef(0);
  const epochSecRef = React.useRef(0);
  const extRef = React.useRef<string>("webm");

  const supported = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    return isRecordingSupported({
      hasMediaRecorder: typeof window.MediaRecorder !== "undefined",
      hasCaptureStream: typeof canvas?.captureStream === "function",
    });
  }, [canvas]);

  const clearTimers = React.useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (elapsedTimerRef.current !== null) {
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const downloadBlob = React.useCallback((blob: Blob, ext: string, epochSec: number) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildVideoName(epochSec, ext);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Patron downloadText (IonosphereScene): revoke a 5 s, no en el mismo
    // tick (en Chrome cancelaria la descarga).
    window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }, []);

  const resetRecordingState = React.useCallback(() => {
    clearTimers();
    setRecording(false);
    setSecondsLeft(0);
  }, [clearTimers]);

  const start = React.useCallback(
    (epochSec: number): boolean => {
      if (recording || busy) return false;
      // FIX1 (MUSE): guard de reentrada — doble click antes del re-render
      // (recording/busy aun no re-renderizados). recorderRef != null significa
      // "grabacion en curso o finalizando"; se nullifica en onstop/onerror.
      if (recorderRef.current !== null) return false;
      if (!canvas) {
        showToast({ title: "Scene ready shortly", description: "The 3D canvas is not mounted yet." });
        return false;
      }
      if (!supported) {
        showToast({
          title: "Recording not supported",
          description: "This browser does not offer MediaRecorder/captureStream over canvas.",
        });
        return false;
      }
      if (document.visibilityState !== "visible") {
        showToast({ title: "Tab in the background", description: "Come back to the tab to record the clip." });
        return false;
      }

      let stream: MediaStream;
      let format: ReturnType<typeof pickVideoFormat>;
      try {
        stream = canvas.captureStream(VIDEO_FPS);
        format = pickVideoFormat(
          (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
          is4K(canvas.width, canvas.height)
        );
      } catch {
        showToast({ title: "Could not open the capture", description: "captureStream failed on this canvas." });
        return false;
      }
      if (!format) {
        stream.getTracks().forEach((t) => t.stop());
        setError("No supported video format");
        showToast({ title: "No supported format", description: "MediaRecorder does not accept any MIME type in this browser." });
        return false;
      }

      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: format.mimeType,
          videoBitsPerSecond: videoBitsPerSecond(canvas.width, canvas.height, VIDEO_FPS),
        });
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        setError("MediaRecorder could not start with the chosen format");
        showToast({ title: "Recording unavailable", description: `MIME rejected: ${format.mimeType}` });
        return false;
      }

      chunksRef.current = chunks;
      streamRef.current = stream;
      recorderRef.current = recorder;
      epochSecRef.current = epochSec;
      extRef.current = format.ext;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = () => {
        // FIX1: marcar para que onstop posterior NO descargue el parcial.
        erroredRef.current = true;
        resetRecordingState();
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        streamRef.current = null;
        setError("Encoder error during recording");
        showToast({ title: "Recording interrupted", description: "The encoder reported an error; the clip is discarded." });
      };
      recorder.onstop = () => {
        // FIX1: si vino de onerror, no descargar el clip parcial.
        const discard = erroredRef.current;
        erroredRef.current = false;
        // Orden D14: blob con todos los chunks -> descargar -> parar tracks.
        let blob: Blob | null = null;
        if (!discard) {
          try {
            blob = chunks.length > 0 ? new Blob(chunks, { type: recorder.mimeType || format.mimeType }) : null;
          } catch {
            blob = null;
          }
        }
        const ext = extRef.current;
        const epoch = epochSecRef.current;
        resetRecordingState();
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        streamRef.current = null;
        chunksRef.current = [];
        if (blob && blob.size > 0) {
          setBusy(true);
          try {
            downloadBlob(blob, ext, epoch);
            showToast({
              title: "Clip ready",
              description: `${buildVideoName(epoch, ext)} · ${(blob.size / 1e6).toFixed(1)} MB · canvas only (no HUD, no audio).`,
            });
          } catch {
            showToast({ title: "Download blocked", description: "The browser rejected the automatic download; use a recent click." });
          } finally {
            setBusy(false);
          }
        } else if (!discard) {
          showToast({ title: "Empty clip", description: "No frames were captured; try again with the tab visible." });
        }
        // Si discard: el toast de error ya se emitio en onerror; nada mas.
      };

      recorder.start(1_000);
      startedAtRef.current = Date.now();
      setError(null);
      setRecording(true);
      setSecondsLeft(Math.ceil(VIDEO_CLIP_MS / 1_000));

      autoStopTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, VIDEO_CLIP_MS);
      // Elapsed real (D12): no confiar solo en el timeout (throttle en bg).
      elapsedTimerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        const left = VIDEO_CLIP_MS - elapsed;
        if (left <= 0) {
          if (recorderRef.current?.state === "recording") recorderRef.current.stop();
          return;
        }
        setSecondsLeft(Math.ceil(left / 1_000));
      }, 250);
      return true;
    },
    [busy, canvas, downloadBlob, recording, resetRecordingState, supported]
  );

  const stop = React.useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === "recording") r.stop();
  }, []);

  // Guard de visibilidad (D12): si la pestaña se oculta a mitad, avisar y
  // abortar con el clip parcial (los chunks ya emitidos se conservan).
  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible" && recorderRef.current?.state === "recording") {
        showToast({ title: "Tab hidden", description: "Recording stopped to avoid a frozen clip." });
        recorderRef.current.stop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Unmount (D13): parar grabacion y timers sin pasar por setState.
  React.useEffect(() => {
    return () => {
      clearTimers();
      const r = recorderRef.current;
      if (r && r.state === "recording") {
        try {
          r.stop();
        } catch {
          /* estado ya cerrado */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
    };
  }, [clearTimers]);

  return { supported, recording, secondsLeft, busy, error, start, stop };
}
