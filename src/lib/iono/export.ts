/**
 * Export W-2 (ruling 150, spec del veredicto 152): evidencia exportable web.
 * Logica pura, sin DOM ni red: el hilo de render aporta el grid y el canvas.
 * Formato espejo del Exporter C++ (drop 131, golden CSV como oraculo,
 * norma 144): cabecera documentada, timestamp DEL DATO por fila, valores
 * con %.9g, grid invalido -> "# empty", nombres UTC iono-YYYYMMDD-HHMMSSZ.
 * Layout web: values[j*W+i] con fila 0 = lat 90 (NORTE), col 0 = lon -180;
 * se vuelca a lat_idx con fila 0 = lat -90 (sur), como el C++.
 */

export interface WebGrid {
  w: number;
  h: number;
  values: Float32Array;
  valid: boolean;
}

/** Nombre determinista UTC: "iono-YYYYMMDD-HHMMSSZ.<ext>". */
export function buildPngName(utcEpochSec: number, ext = "png"): string {
  const d = new Date(utcEpochSec * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `iono-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z.${ext}`
  );
}

/**
 * %.9g de C (9 digitos significativos; %e si exp < -4 o >= 9; NaN -> "nan"
 * como glibc, Infinity -> "inf"/"-inf"). Los grids nunca traen infinitos;
 * NaN = sin dato en web (el C++ no tiene el concepto: usa flag valid).
 */
export function fmtG9(v: number): string {
  if (Number.isNaN(v)) return "nan";
  if (!isFinite(v)) return v < 0 ? "-inf" : "inf";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e < -4 || e >= 9) {
    const m = v / Math.pow(10, e);
    let ms = m.toFixed(8).replace(/0+$/, "");
    if (ms.endsWith(".")) ms = ms.slice(0, -1);
    const es = e >= 0 ? "+" + e : "" + e;
    const ep = es.length < 3 ? es[0] + "0" + es.slice(1) : es;
    return ms + "e" + ep;
  }
  return String(parseFloat(v.toPrecision(9)));
}

/** CSV de la capa activa. Ver layout en cabecera del fichero. */
export function gridCsv(varName: string, grid: WebGrid, tovEpochSec: number): string {
  let s = `# var=${varName} width=${grid.w} height=${grid.h}\n`;
  s += "# layout: values[lat_idx*width+lon_idx], row0=lat-90 south, col0=lon-180\n";
  s += "lat_idx,lon_idx,value,tov_epoch\n";
  const tov = Math.floor(tovEpochSec);
  if (!grid.valid || grid.w <= 0 || grid.h <= 0 || grid.values.length !== grid.w * grid.h) {
    s += "# empty\n";
    return s;
  }
  for (let la = 0; la < grid.h; la++) {
    const j = grid.h - 1 - la; // fila web 0 = norte -> lat_idx 0 = sur
    for (let lo = 0; lo < grid.w; lo++) {
      s += `${la},${lo},${fmtG9(grid.values[j * grid.w + lo])},${tov}\n`;
    }
  }
  return s;
}
