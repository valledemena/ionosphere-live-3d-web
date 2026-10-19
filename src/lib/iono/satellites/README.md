# Shell data layer — live TLE catalog (drop 317, F2b #10)

This directory is the **shell data layer** of the West Ford feature (verdicts
312 §Q1/§Q3, 316 §4): it acquires the 2026 object catalog that the "eco 2026"
mode will render (engine shareable with #23 — catalogue §E of 251). UI /
rendering / the 1963 ring land in later drops; this drop is the live-fetch
wiring plus the honest degradation chain.

Route: `GET /api/satellites` (route logic in `src/app/api/satellites/route.ts`,
pure chain in `catalog.ts` + TU in `catalog.test.ts`).

Payload: `{ source, sourceLabel, attribution, fetchedAt, count, dropped, records[] }`
with `records = { noradId, name, line1, line2 }` (verbatim TLE lines).

## Sources and per-origin chain (adjudicated 316 §4)

Order: **celestrak (live) -> satnogs (live) -> snapshot (dated) -> unavailable**.

- **CelesTrak** GP `GROUP=active` (TLE): primary live source of the full
  active catalog (15,927 objects at snapshot time). Egress is per-environment
  (312 §1): measured **RED from the published platform deploy** (20 s abort,
  both 2026-10-17 shots incl. GLM's parallel corroboration) and GREEN from the
  MUSE sandbox. The live route is **kept per-origin** and re-activates on its
  own when the platform egress changes (failure window 30 min, payload TTL 6 h).
- **SatNOGS** DB `/api/tle/` (TLE full dump): live source measured **GREEN in
  4/4 environments** (MUSE sandbox, GLM local, GLM gateway, deploy x2) — the
  reliable live path in the deploy (~1.7k records; measured 2026-10-17:
  1,733 records / 536,547 B / 0.68 s). Attribution per its API.
- **Snapshot** `active-2026-10-17.tle`: frozen CelesTrak capture, labeled with
  its date and `(no live)`, **never** "live" (316 §4.2). Serves when no live
  source is reachable (offline, egress cut).
- **unavailable**: honest null state (`records: []`), never a fabricated curve
  (312 Q3-4). Not cached (a transient outage must not freeze — voyager rule).

## Citizenship (312 Q4 / 316 §4.3)

- CelesTrak: group query <= 1 per 2 h honored via 6 h payload TTL + 30 min
  failure window; own User-Agent (`IonosphereLive3D-Web/1.0`); one request per
  TTL; no hammering. Public US-gov GP data, attribution in payload.
  Measured 2026-10-17: a repeated `GROUP=active` query from the same IP within
  the 2 h window returns **HTTP 403** (single-TLE queries still 200). That is
  the design, not a bug: CelesTrak goes red, SatNOGS serves live, labeled.
- SatNOGS: attribution line in the payload (`SatNOGS DB (satnogs.org)`; TLE
  provenance per record, Space-Track.org); one request per TTL.
- Timeouts: CelesTrak 25 s (bulk fetch measured 24.1 s from sandbox),
  SatNOGS 15 s (measured 0.68 s). Aborted fetches count as source failure.
  Red-CelesTrak environments pay the **first cold miss once per 6 h TTL**:
  **~10.5 s where the egress connect is blackholed** (undici's 10 s connect
  timeout fires before the route's 25 s abort; measured in the GLM sandbox —
  same class as the deploy — verdict 322 §6.3) and **~26 s where the
  connection opens slowly** (bulk 24.1 s from sandbox; verdict 318 obs-1).
  The timeout is calibrated for the green case; the wait is paid once per
  TTL, not per request.

## Honesty rules (adjudicated 312 Q3-4 / 316 §4)

- Never fake live: snapshot label carries its date + `(no live)`.
- An empty fetch counts as source failure (never cache emptiness as good).
- Checksum-strict parsing (sgpTle `tleChecksumOk`): invalid TLE lines are
  **dropped and counted** (`dropped` field) — reject and report, never
  auto-correct (dmissing style).

## Snapshot provenance (custody)

- URL: `https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=TLE`
- Captured 2026-10-17T10:53:13Z from the MUSE sandbox (green egress that day).
- Raw capture: 2,675,736 B (CRLF), sha256
  `b029af6be5b7052a8b235e7c71b447b9d7e124397f82538f35ff9bfc058c5497`.
- This file: LF-normalized (content byte-identical modulo CRLF->LF),
  2,627,955 B, sha256
  `40b7e35a2492f73ddb72114ed5671d8bd8644b166066f5de2ece272eabcb7ec9`,
  15,927 records / 47,781 lines, checksums intact, no duplicate satnums
  (asserted by `catalog.test.ts`).

## 23599 note (from verdict 314 §L4; documented here per 316 §4.5)

The official SGP4 verification corpus contradicts itself for satellite 23599:
the `.e` ephemeris and the C++ driver's `tcppver.out` diverge 0.96 km at
t >= 420 min (the driver flags that range `xx`). Mechanism, adjudicated
bit-exact: the low-inclination branch of `dpper` wraps the AFSPC node when
`nodep < 0` under opsmode `'a'`, triggered as `nodem` crosses zero at
t ~ 419.5 min (incl 6.93 deg). python-sgp4 with opsmode `'a'` reproduces the
`.e` to the digit; opsmode `'i'` reproduces tcppver. Our engine runs opsmode
`'a'` (the binding oracle) — faithful to the set, not a transcription defect.
Engine boundary notice: `../sgp4/README.md`.

## Files

| File | Role |
| --- | --- |
| `catalog.ts` | pure data layer (parsers, chain, labels, cache/window factories) — GPL-3.0 |
| `catalog.test.ts` | TU (parsers, honesty labels, chain, caches, real snapshot sanity) |
| `sky.ts` | W-4 F2b #10 (drop 321): per-sat sgp4 -> scene conversion + chunked init (ruling 320) |
| `scheduler.ts` | sweep scheduler (adaptive slices, floor 256, cadence >=0.5 s; injected clock) |
| `ring1963.ts` | declared West Ford 1963 particle band (3600x3680 km, i 87.4, seeded LCG) |
| `panel.ts` | eco-2026 panel state contract (byte-exact label, "sin datos", client-error state) |
| `active-2026-10-17.tle` | frozen CelesTrak active catalog (data, not code) |
| `README.md` | this notice |
