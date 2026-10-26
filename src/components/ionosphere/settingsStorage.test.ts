import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./types";
import {
  parseSceneSettings,
  sanitizeSceneSettings,
  serializeSceneSettings,
} from "./settingsStorage";

describe("sanitizeSceneSettings", () => {
  it("sin datos o con basura devuelve los defaults", () => {
    expect(DEFAULT_SETTINGS.showStars).toBe(true);
    expect(sanitizeSceneSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSceneSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSceneSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it("conserva booleanos validos y descarta tipos incorrectos", () => {
    const s = sanitizeSceneSettings({
      clouds: false,
      showStars: false,
      showAurora: "si",
    });
    expect(s.clouds).toBe(false);
    expect(s.showStars).toBe(false);
    expect(s.showAurora).toBe(DEFAULT_SETTINGS.showAurora);
  });

  it("clampea numeros y valida enums", () => {
    const s = sanitizeSceneSettings({
      exaggeration: 99,
      shellOpacity: -1,
      pointSize: 0,
      replaySpeed: 100,
      volumeMode: "otro",
      sliceSrc: "manual",
      atmoQuality: "ultra",
    });
    expect(s.exaggeration).toBe(5);
    expect(s.shellOpacity).toBe(0);
    expect(s.pointSize).toBe(3);
    expect(s.replaySpeed).toBe(8);
    expect(s.volumeMode).toBe(DEFAULT_SETTINGS.volumeMode);
    expect(s.sliceSrc).toBe("manual");
    expect(s.atmoQuality).toBe(DEFAULT_SETTINGS.atmoQuality);
  });

  it("conserva opciones visuales y resetea estado transitorio de replay", () => {
    const s = sanitizeSceneSettings({
      cinema: false,
      timeMode: "replay",
      replayMinutes: 720,
      replayPlaying: true,
      replaySpeed: 4,
      replayLoop: false,
    });
    expect(s.cinema).toBe(false);
    expect(s.timeMode).toBe("live");
    expect(s.replayMinutes).toBe(0);
    expect(s.replayPlaying).toBe(false);
    expect(s.replaySpeed).toBe(4);
    expect(s.replayLoop).toBe(false);
  });
});

describe("parseSceneSettings", () => {
  it("null o JSON invalido caen a defaults sin lanzar", () => {
    expect(parseSceneSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSceneSettings("{roto")).toEqual(DEFAULT_SETTINGS);
  });

  it("acepta un payload guardado y mantiene showStars", () => {
    const s = parseSceneSettings(JSON.stringify({ showStars: false, clouds: false }));
    expect(s.showStars).toBe(false);
    expect(s.clouds).toBe(false);
    expect(s.showAurora).toBe(DEFAULT_SETTINGS.showAurora);
  });
});

describe("serializeSceneSettings", () => {
  it("omite estado transitorio y conserva las opciones visuales", () => {
    const json = JSON.parse(
      serializeSceneSettings({
        ...DEFAULT_SETTINGS,
        showStars: false,
        cinema: false,
        timeMode: "replay",
        replayMinutes: 120,
        replayPlaying: true,
      }),
    ) as Record<string, unknown>;
    expect(json.showStars).toBe(false);
    expect(json.cinema).toBe(false);
    expect(json).not.toHaveProperty("timeMode");
    expect(json).not.toHaveProperty("replayMinutes");
    expect(json).not.toHaveProperty("replayPlaying");
  });
});
