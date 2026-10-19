// Harness equivalente al TU vitest (misma logica, mismos valores).
// Motivo: el binario vitest no arranca en este sandbox Windows (el mirror
// npm sirve vite sin './module-runner'; evidencia en vitest_error.log).
// GLM corre `npm test` (vitest) en Linux.
import assert from "node:assert";
import { buildPngName, fmtG9, gridCsv } from "./export.js";

assert.strictEqual(buildPngName(1790855100), "iono-20261001-114500Z.png");
assert.strictEqual(buildPngName(0), "iono-19700101-000000Z.png");
assert.strictEqual(fmtG9(1.5), "1.5");
assert.strictEqual(fmtG9(-2.25), "-2.25");
assert.strictEqual(fmtG9(0), "0");
assert.strictEqual(fmtG9(100.125), "100.125");
assert.strictEqual(fmtG9(1e17), "1e+17");
assert.strictEqual(fmtG9(1.23456789e-5), "1.23456789e-05");
assert.strictEqual(fmtG9(NaN), "nan");
const g = { w: 2, h: 2, values: new Float32Array([10, 11, 20, 21]), valid: true };
const want =
  "# var=foF2 width=2 height=2\n" +
  "# layout: values[lat_idx*width+lon_idx], row0=lat-90 south, col0=lon-180\n" +
  "lat_idx,lon_idx,value,tov_epoch\n" +
  "0,0,20,1790855100\n0,1,21,1790855100\n1,0,10,1790855100\n1,1,11,1790855100\n";
assert.strictEqual(gridCsv("foF2", g, 1790855100), want);
const e = { w: 0, h: 0, values: new Float32Array(0), valid: false };
assert.ok(gridCsv("foF2", e, 1790855100).includes("# empty\n"));
console.log("harness: TODOS OK (11 checks)");
