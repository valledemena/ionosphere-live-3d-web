import { describe, expect, it } from "vitest";
import {
  VIDEO_4K_PX,
  buildVideoName,
  is4K,
  isRecordingSupported,
  pickVideoFormat,
  videoBitsPerSecond,
} from "./videoExport";

describe("pickVideoFormat", () => {
  it("devuelve el primer soportado del orden de preferencia (VP9 > VP8)", () => {
    const supported = new Set([
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ]);
    const r = pickVideoFormat((m) => supported.has(m));
    expect(r).toEqual({ mimeType: "video/webm;codecs=vp8", ext: "webm" });
  });

  it("prefiere VP9 cuando ambos VP9/VP8 estan soportados", () => {
    const supported = new Set([
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
    ]);
    const r = pickVideoFormat((m) => supported.has(m));
    expect(r?.mimeType).toBe("video/webm;codecs=vp9");
  });

  it("con preferVp8 (4K) elige VP8 antes que VP9", () => {
    const supported = new Set([
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
    ]);
    const r = pickVideoFormat((m) => supported.has(m), true);
    expect(r?.mimeType).toBe("video/webm;codecs=vp8");
    expect(r?.ext).toBe("webm");
  });

  it("fake selectivo: no elige lo que no esta en el set (no tautologico)", () => {
    const supported = new Set(["video/mp4;codecs=avc1.42E01E"]);
    const r = pickVideoFormat((m) => supported.has(m));
    expect(r).toEqual({ mimeType: "video/mp4;codecs=avc1.42E01E", ext: "mp4" });
  });

  it("ext coherente con el contenedor: webm* -> webm, mp4* -> mp4", () => {
    const webm = pickVideoFormat((m) => m === "video/webm");
    expect(webm?.ext).toBe("webm");
    const mp4 = pickVideoFormat((m) => m === "video/mp4");
    expect(mp4?.ext).toBe("mp4");
  });

  it("devuelve null si ningun formato es soportado", () => {
    expect(pickVideoFormat(() => false)).toBeNull();
    expect(pickVideoFormat(() => false, true)).toBeNull();
  });

  it("no muta la lista de entrada (los candidates son internos e inmutables)", () => {
    const calls: string[] = [];
    pickVideoFormat((m) => {
      calls.push(m);
      return m === "video/webm";
    });
    expect(calls).toEqual([
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ]);
  });
});

describe("videoBitsPerSecond", () => {
  it("4K30 ≈ 19.9 Mbps (dentro del clamp)", () => {
    const b = videoBitsPerSecond(3840, 2160, 30);
    expect(b).toBe(Math.round(3840 * 2160 * 30 * 0.08));
    expect(b).toBe(19_906_560);
  });

  it("1080p30 ≈ 4.98 Mbps y 4K30 > 1080p30", () => {
    expect(videoBitsPerSecond(1920, 1080, 30)).toBe(
      Math.round(1920 * 1080 * 30 * 0.08)
    );
    expect(videoBitsPerSecond(3840, 2160, 30)).toBeGreaterThan(
      videoBitsPerSecond(1920, 1080, 30)
    );
  });

  it("clamp inferior: area pequeña -> 4 Mbps", () => {
    expect(videoBitsPerSecond(320, 240, 30)).toBe(4_000_000);
    expect(videoBitsPerSecond(0, 0, 30)).toBe(4_000_000);
  });

  it("clamp superior: area enorme -> 25 Mbps", () => {
    expect(videoBitsPerSecond(16000, 9000, 60)).toBe(25_000_000);
  });
});

describe("is4K", () => {
  it("3840x2160 y superiores son 4K", () => {
    expect(is4K(3840, 2160)).toBe(true);
    expect(is4K(4096, 2160)).toBe(true);
    expect(VIDEO_4K_PX).toBe(3840 * 2160);
  });

  it("1080p no es 4K", () => {
    expect(is4K(1920, 1080)).toBe(false);
  });
});

describe("isRecordingSupported", () => {
  it("true solo si MediaRecorder Y captureStream existen", () => {
    expect(isRecordingSupported({ hasMediaRecorder: true, hasCaptureStream: true })).toBe(true);
    expect(isRecordingSupported({ hasMediaRecorder: true, hasCaptureStream: false })).toBe(false);
    expect(isRecordingSupported({ hasMediaRecorder: false, hasCaptureStream: true })).toBe(false);
    expect(isRecordingSupported({ hasMediaRecorder: false, hasCaptureStream: false })).toBe(false);
  });
});

describe("buildVideoName", () => {
  it("nombre UTC iono-YYYYMMDD-HHMMSSZ con la extension dada", () => {
    const epoch = Date.UTC(2026, 9, 21, 18, 30, 45) / 1000;
    expect(buildVideoName(epoch, "webm")).toBe("iono-20261021-183045Z.webm");
    expect(buildVideoName(epoch, "mp4")).toBe("iono-20261021-183045Z.mp4");
  });

  it("epoch de replay (pasado) genera nombre coherente con PNG/CSV", () => {
    const replay = Date.UTC(2026, 0, 1, 0, 0, 0) / 1000;
    expect(buildVideoName(replay, "webm")).toBe("iono-20260101-000000Z.webm");
  });
});
