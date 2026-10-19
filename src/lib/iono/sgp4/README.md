# SGP4 port — boundary notice (drop 313, F2b #10)

This directory contains a TypeScript translation of the SGP4 propagator
from the Vallado C++ reference package (AIAA-2006-6753 bundle, `sgp4`
Archer release), for **research, academic, and non-profit purposes
only**. Any commercial use is prohibited.

- Reference mirror pinned at the celestrak.org AIAA-2006-6753 bundle;
  `SGP4.cpp` sha256
  `2ee7ad0e8f201e8251894083fe21e33a7aace2f43c871bf04357eb44a891b06e`
  (measured at acquisition; the same value is carried in the
  `sgp4.ts` header).
- The Vallado originals carry no separate license text; their
  authorship/provenance notices (1980/1986 spacetrack reports; 2006
  AIAA paper by Vallado, Crawford, Hujsak and Kelso) are mirrored in
  each translated file header (patrón 300 §Q1.2).
- Own new code in this directory is GPL-3.0-or-later (see `LICENSE` at
  the repository root). The official verification fixtures
  (`SGP4-VER.TLE`, `tle/*.e`) are test-only, fenced here byte-exact,
  and NOT GPL.
- Dual source of the official verification set: the same bundle is
  re-generated/checked via python-sgp4 (pure-python model of the same
  SGP4.cpp family, MIT) in the L4 pipeline; the license position rests
  on both.
- satellite.js (MIT) fallback is pre-authorized by the 312 ruling: NOT
  used in 313. If ever needed it requires an adapter + the same oracle
  + this notice + documented cause.
- Web egress citizenship (landed in the shell data layer, drop 317 —
  see `../satellites/README.md`): CelesTrak queries use TTL caching, an
  own User-Agent and honor rate limits; SatNOGS responses carry
  attribution.

Files:

| File | Source | Status |
| --- | --- | --- |
| `sgp4.ts` | `SGP4.cpp` (initl/sgp4init/dsinit/dpper/gstime/sgp4 core) | 313 translated |
| `sgpTle.ts` | `SGP4.cpp` twoline2rv front-end (TLE parse; checksum strict by default) | 313 translated |
| `sgpCoord.ts` | first-party (GMST-only TEME→ECEF + WGS-84 Hirvonen geodetic; no transcribed source) | 313 new code (GPL-3.0 own) |
| `sgpVer.test.ts` | official verification harness | 313 test-only |
| `sgpErr.test.ts` | exact return codes (special cases) | 313 test-only |
| `sgpPin.test.ts` | branch pins vs python-sgp4 | 313 test-only |
| `SGP4-VER.TLE` | official verification TLEs (8616 B) | test-only fixture, byte-exact |
| `tle/*.e` | official verification ephemerides (32 files) | test-only fixtures, byte-exact |

Numerics: binding oracle = the official verification set with the 312
Q3 dual criterion (per component: abs ≤ 1e-6 km OR rel ≤ 1e-6;
velocity 1e-9 km/s abs; return codes exact, dmissing-style).
`SGP4-VER.TLE` lists 33 pairs / 32 unique satellites (20413 appears
twice: the second entry is a second tsince range without an official
`.e`, deduped by satnum in the harness). Measured on the drop machine
after the 313 fixes: worstAbsPos 2.67e-8 km, worstAbsVel 5.0e-10 km/s,
worstRelPos 3.3e-9, worstRelVel 3.9e-8 — circa 40x–300x inside the
gate; the residual is libm rounding, not physics. Branch pins vs
python-sgp4 (method 9c): coefficients measured bit-equal are pinned at
1e-13 rel (margin for cross-V8 libm robustness); periodics carry 2x
their measured margin as literal bounds (see `sgpPin.test.ts`).
Constant set: wgs72, opsmode `'a'`. Fixtures are CRLF (test-only;
patches ship them as binary so the source tree stays LF-pure).

The official-set self-contradiction for 23599 (`.e` vs `tcppver.out`,
0.96 km at t >= 420 min) and its bit-exact mechanism (low-inclination
`dpper` node wrap under opsmode `'a'`, verdict 314 §L4) are documented
in `../satellites/README.md` §23599.
