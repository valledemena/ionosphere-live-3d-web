// ionosphere-live-3d — drop 313 TU: branch pins (near-earth init,
// deep-space dsinit periodics, synchronous irez==1, 12 h resonance irez==2).
// Oracle: python-sgp4 pure model (same SGP4.cpp family). Method 9c:
// every pin below was MEASURED on the drop machine, then written verbatim.
// Policy: integer/zero flags asserted exact (toBe); float fields measured
// bit-equal use 1e-13 relative (measured 0; margin for cross-V8 libm
// robustness); fields with a measured non-zero margin use 2x that margin
// as the literal bound (comment states the measurement).

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { twoline2rv } from "./sgpTle";

function readVer(): string[] {
  const buf = readFileSync(new URL("./SGP4-VER.TLE", import.meta.url));
  return Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength).toString("utf8").split("\n");
}

function verPair(satnum: string): [string, string] {
  const lines = readVer();
  for (let k = 0; k < lines.length; k++) {
    if (lines[k].startsWith("1 ") && lines[k].slice(2, 7).trim() === satnum) {
      return [lines[k], lines[k + 1]];
    }
  }
  throw new Error("tle not found: " + satnum);
}

function initSat(satnum: string) {
  const [l1, l2] = verPair(satnum);
  return twoline2rv(l1, l2, "wgs72", "a").satrec;
}

const REL_PIN = 1e-13;

function nearRel(actual: number, pin: number) {
  expect(Math.abs(actual - pin)).toBeLessThanOrEqual(REL_PIN * Math.abs(pin));
}

function near(actual: number, pin: number, bound: number) {
  expect(Math.abs(actual - pin)).toBeLessThanOrEqual(bound);
}

function field(s: unknown, name: string): number {
  return (s as Record<string, number>)[name];
}

describe("313 pins: 00005 near-earth init (reference: python-sgp4)", () => {
  const s = initSat("00005");

  it("method + flags", () => {
    expect(s.method).toBe("n");
    expect(s.isimp).toBe(0);
  });

  it("gravity + periodic factors", () => {
    nearRel(s.con41, 1.0488650879956589);
    nearRel(s.x1mth2, 0.31704497066811366);
    nearRel(s.x7thm1, 3.7806852053232047);
  });

  it("keps rates", () => {
    nearRel(s.argpdot, 5.429305256054411e-5);
    nearRel(s.nodedot, -3.7171353845372952e-5);
    nearRel(s.mdot, 0.047229443383208038);
  });

  it("secular drag + periodic coefficients", () => {
    nearRel(s.cc1, 9.5310932694231938e-12);
    nearRel(s.cc4, 5.2593607316167933e-7);
    nearRel(s.cc5, 1.6465152476785347e-5);
    nearRel(s.d2, 1.4398737902921817e-21);
    nearRel(s.d3, 3.217106892467983e-31);
    nearRel(s.d4, 8.358359772162507e-41);
    nearRel(s.t2cof, 1.4296639904134791e-11);
    nearRel(s.t3cof, 1.62155726811307e-21);
    nearRel(s.t4cof, 2.8461828382529684e-31);
    nearRel(s.t5cof, 6.0806613973410566e-41);
    nearRel(s.xmcof, -1.885936118348151e-11);
    nearRel(s.xlcof, 0.0012890577280388418);
    nearRel(s.aycof, 0.00066021623179585967);
    nearRel(s.nodecf, -1.1942211733132768e-15);
  });

  it("scaled kepler elements", () => {
    nearRel(s.eta, 0.73690954292802413);
    nearRel(s.delmo, 4.8730846591121253);
    nearRel(s.sinmao, 0.33094922987265429);
    nearRel(s.ecco, 0.1859667);
    nearRel(s.inclo, 0.5980929187319208);
    nearRel(s.bstar, 2.8098e-5);
  });
});

describe("313 pins: 23333 deep-space dsinit periodics (non-resonant)", () => {
  const s = initSat("23333");

  it("deep-space flags", () => {
    expect(s.method).toBe("d");
    expect(s.isimp).toBe(1);
    expect(s.irez).toBe(0);
  });

  it("non-resonant: all resonance/integrator fields are zero", () => {
    for (const f of [
      "atime",
      "xli",
      "xni",
      "xfact",
      "xlamo",
      "d2201",
      "d2211",
      "d3210",
      "d3222",
      "d4410",
      "d4422",
      "d5220",
      "d5232",
      "d5421",
      "d5433",
      "del1",
      "del2",
      "del3",
    ]) {
      expect(field(s, f)).toBe(0);
    }
  });

  it("secular + periodic rates (bounds = 2x measured)", () => {
    near(s.e3, 0.006618130467595364, 3e-16); // measured 1.01e-16
    near(s.ee2, -0.007503198877722854, 2e-16); // measured 8.93e-17
    near(s.dedt, 2.9681356032421368e-9, 3e-22); // measured 1.34e-22
    near(s.didt, -3.439044884764362e-7, 1.1e-21); // measured 5.29e-22
    near(s.dmdt, -3.438051105625226e-6, 6e-21); // measured 2.54e-21
    near(s.dnodt, -5.053925231473856e-7, 9e-22); // measured 4.24e-22
    near(s.domdt, 6.914571527622966e-7, 1.1e-21); // measured 5.29e-22
    near(s.zmol, 5.607868196209495, 8e-13); // measured 3.98e-13
    near(s.zmos, 5.196058843771105, 5e-14); // measured 2.13e-14
    near(s.gsto, 3.84921956856428, 1.3e-13); // measured 6.39e-14
  });
});

describe("313 pins: 08195 12 h resonance (irez==2, dsinit coeffs)", () => {
  const s = initSat("08195");

  it("flags", () => {
    expect(s.method).toBe("d");
    expect(s.irez).toBe(2);
  });

  it("exact zeros in the resonance branch", () => {
    for (const f of ["atime", "del1", "del2", "del3"]) {
      expect(field(s, f)).toBe(0);
    }
  });

  it("resonant coefficients + branch-only fields (measured bit-equal)", () => {
    nearRel(s.xni, 0.008748547019630239);
    nearRel(s.xfact, -0.008753597222053683);
    nearRel(s.d2201, -1.1973595516231104e-11);
    nearRel(s.d2211, 6.453213834121484e-11);
    nearRel(s.d3210, -3.893722738131047e-12);
    nearRel(s.d3222, -7.364857538023281e-12);
    nearRel(s.d4410, 2.5769601409463443e-12);
    nearRel(s.d4422, 4.361455592714352e-12);
    nearRel(s.d5220, -2.5287894659528444e-12);
    nearRel(s.d5232, 6.767712568551213e-13);
    nearRel(s.d5421, -2.280698046561967e-12);
    nearRel(s.d5433, -1.6595708214914194e-12);
    nearRel(s.dnodt, -6.124323489695265e-8);
  });

  it("integrator + periodic fields (bounds = 2x measured)", () => {
    near(s.xli, 2.6628995258087294, 4e-12); // measured 1.56e-12
    near(s.xlamo, 2.6628995258087294, 4e-12); // measured 1.56e-12
    near(s.e3, -0.0004408046133189363, 4e-18); // measured 1.46e-18
    near(s.ee2, -0.00010934280539374914, 1.5e-17); // measured 6.03e-18
    near(s.dedt, -2.8885476234610693e-8, 2e-23); // measured 6.62e-24
    near(s.didt, -9.78410826921414e-9, 4e-24); // measured 1.65e-24
    near(s.dmdt, 9.270786742526957e-8, 6e-23); // measured 2.65e-23
    near(s.domdt, -1.4155210733836934e-8, 2e-23); // measured 8.6e-24
    near(s.zmol, 1.703291771990898, 1.6e-12); // measured 3.98e-13
    near(s.zmos, 2.972158040325546, 1.5e-14); // measured 2.13e-14
    near(s.gsto, 0.574180126904011, 1.6e-12); // measured 7.82e-13
  });
});

describe("313 pins: 09880 12 h resonance (irez==2, dsinit coeffs)", () => {
  const s = initSat("09880");

  it("flags", () => {
    expect(s.method).toBe("d");
    expect(s.irez).toBe(2);
  });

  it("exact zeros in the resonance branch", () => {
    for (const f of ["atime", "del1", "del2", "del3"]) {
      expect(field(s, f)).toBe(0);
    }
  });

  it("resonant coefficients + branch-only fields (measured bit-equal)", () => {
    nearRel(s.xni, 0.008762667060363351);
    nearRel(s.xfact, -0.008754040087689473);
    nearRel(s.d2201, -1.2230660003395134e-11);
    nearRel(s.d2211, 7.174605316403472e-11);
    nearRel(s.d3210, -4.151751044682107e-12);
    nearRel(s.d3222, -8.877536621153812e-12);
    nearRel(s.d4410, 3.097256488149366e-12);
    nearRel(s.d4422, 5.5073675014217865e-12);
    nearRel(s.d5220, -3.2549115160322203e-12);
    nearRel(s.d5232, 7.951364509680308e-13);
    nearRel(s.d5421, -2.951741474263858e-12);
    nearRel(s.d5433, -2.267801942329212e-12);
    nearRel(s.dnodt, -8.61575009268081e-8);
  });

  it("integrator + periodic fields (bounds = 2x measured)", () => {
    near(s.xli, 2.15824144430918, 4e-12); // measured 1.56e-12
    near(s.xlamo, 2.15824144430918, 4e-12); // measured 1.56e-12
    near(s.e3, 0.00012494318395640518, 2e-17); // measured 8.92e-18
    near(s.ee2, 0.000647665259705538, 4e-18); // measured 1.84e-18
    near(s.dedt, -4.867357573014225e-9, 8e-24); // measured 3.31e-24
    near(s.didt, -1.740817385888356e-9, 1e-24); // measured 4.14e-25
    near(s.dmdt, 7.275290629300275e-9, 7e-23); // measured 3.09e-23
    near(s.dnodt, -8.61575009268081e-8, 3e-23); // measured 1.41e-23
    near(s.domdt, 2.3358159779494885e-8, 2e-23); // measured 9.9e-24
    near(s.zmol, 1.7556058272777406, 1.6e-12); // measured 3.98e-13
    near(s.zmos, 2.976104523219526, 1.5e-14); // measured 2.13e-14
    near(s.gsto, 2.0196171169817347, 1.6e-12); // measured 7.82e-13
  });
});

describe("313 pins: 28626 geosynchronous (irez==1, synchronous branch)", () => {
  const s = initSat("28626");

  it("flags", () => {
    expect(s.method).toBe("d");
    expect(s.irez).toBe(1);
    expect(s.isimp).toBe(1);
  });

  it("non-resonant zeros + synchronous nonzero fields (measured bit-equal)", () => {
    for (const f of [
      "atime",
      "dnodt",
      "d2201",
      "d2211",
      "d3210",
      "d3222",
      "d4410",
      "d4422",
      "d5220",
      "d5232",
      "d5421",
      "d5433",
    ]) {
      expect(field(s, f)).toBe(0);
    }
    nearRel(s.del1, -6.397199405204386e-13);
    nearRel(s.del2, 1.4103512638856627e-11);
    nearRel(s.del3, 1.9783840354489316e-12);
    nearRel(s.xfact, -0.004375014405569654);
    nearRel(s.xni, 0.004374949216285717);
    nearRel(s.didt, -2.9471771963940842e-8);
  });

  it("integrator + periodic fields (bounds = 2x measured)", () => {
    near(s.xli, 4.797386947629335, 1.6e-12); // measured 7.82e-13
    near(s.xlamo, 4.797386947629335, 1.6e-12); // measured 7.82e-13
    near(s.e3, 9.73028658447897e-8, 1.5e-22); // measured 6.62e-23
    near(s.ee2, 4.11664580708399e-9, 3e-21); // measured 1.41e-21
    near(s.dedt, -1.1633512183437053e-12, 2e-27); // measured 6.06e-28
    near(s.dmdt, -1.0450301245210244e-7, 3e-22); // measured 1.32e-22
    near(s.domdt, 3.403399555000861e-8, 6e-23); // measured 2.65e-23
    near(s.zmol, 1.7340023589123845, 1.6e-12); // measured 7.46e-13
    near(s.zmos, 2.9744747944997627, 1.5e-14); // measured 7.11e-15
    near(s.gsto, 1.4227134337369165, 1.6e-12); // measured 7.82e-13
  });
});
