/**
 * Drop 355: logica pura del export de video del canvas 3D (clip 15 s).
 * Decisiones vinculantes del scout MINIMAX (98_scout_355_minimax.md):
 * - pickVideoFormat: preferencia VP9→VP8→WebM→MP4/AVC1→MP4; con preferVp8
 *   (4K) VP8 antes de VP9 (encoder software mas barato, D8).
 * - videoBitsPerSecond: bitrate adaptativo por area 0.08 bit/px/frame con
 *   clamp 4–25 Mbps (D6): 4K30 ≈ 19.9 Mbps, 1080p30 ≈ 4.98 Mbps.
 * - isRecordingSupported inyectable (D-scout §10): testeable sin DOM.
 * - buildVideoName reutiliza buildPngName (epoch de DATOS, D17); no se
 *   renombra buildPngName (test export.test.ts lo fija).
 */

import { buildPngName } from "./export";

export const VIDEO_CLIP_MS = 15_000;
export const VIDEO_FPS = 30;
/** Umbral 4K (UHD): area del buffer >= 3840×2160 px. */
export const VIDEO_4K_PX = 3840 * 2160;

export interface VideoFormat {
  mimeType: string;
  ext: "webm" | "mp4";
}

interface FormatCandidate {
  mime: string;
  ext: "webm" | "mp4";
}

/** Orden de preferencia base (Chromium desktop 2026; §2 del scout). */
const FORMAT_CANDIDATES: readonly FormatCandidate[] = [
  { mime: "video/webm;codecs=vp9", ext: "webm" },
  { mime: "video/webm;codecs=vp8", ext: "webm" },
  { mime: "video/webm", ext: "webm" },
  { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
  { mime: "video/mp4", ext: "mp4" },
];

/**
 * Primer formato soportado segun el orden de preferencia. Con preferVp8
 * (buffer >= 4K) se intercambia VP9/VP8: VP8 es varias veces mas barato de
 * codificar por software a UHD (D8). No muta la lista de entrada.
 */
export function pickVideoFormat(
  isSupported: (mime: string) => boolean,
  preferVp8 = false
): VideoFormat | null {
  const order = preferVp8
    ? [
        FORMAT_CANDIDATES[1],
        FORMAT_CANDIDATES[0],
        ...FORMAT_CANDIDATES.slice(2),
      ]
    : FORMAT_CANDIDATES;
  for (const c of order) {
    if (isSupported(c.mime)) return { mimeType: c.mime, ext: c.ext };
  }
  return null;
}

/** Bitrate adaptativo por area (D6). 4K30 ≈ 19.9 Mbps; clamp 4–25 Mbps. */
export function videoBitsPerSecond(w: number, h: number, fps: number): number {
  const raw = w * h * fps * 0.08;
  return Math.round(Math.min(25_000_000, Math.max(4_000_000, raw)));
}

/** Buffer >= UHD 4K (preferir VP8 en la eleccion de codec). */
export function is4K(w: number, h: number): boolean {
  return w * h >= VIDEO_4K_PX;
}

/** Deteccion de soporte inyectable (testeable sin navegador). */
export function isRecordingSupported(env: {
  hasMediaRecorder: boolean;
  hasCaptureStream: boolean;
}): boolean {
  return env.hasMediaRecorder && env.hasCaptureStream;
}

/** Nombre del clip: epoch de DATOS (effSec), misma norma UTC que PNG/CSV. */
export function buildVideoName(utcEpochSec: number, ext: string): string {
  return buildPngName(utcEpochSec, ext);
}
