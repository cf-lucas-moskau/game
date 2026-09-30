// Deterministic math for the simulation. JavaScript only guarantees bit-identical results for + - * / and sqrt;
// Math.sin, cos, atan2, hypot and ** are "implementation-approximated" and differ between engines (V8, SpiderMonkey,
// JavaScriptCore). Online play runs the same sim on every player's machine from one command stream, so the sim uses
// these instead: ports of the fdlibm kernels built from basic operations only, identical on every engine.
// Accuracy is about 1e-15 relative for the angles the game uses (|x| < 1e5), far below anything gameplay can see.

const PI = 3.141592653589793, HALF_PI = 1.5707963267948966;
// Cody-Waite range reduction constants: pi/2 split into a 33-bit head and its tail
const INV_PIO2 = 6.36619772367581382433e-01, PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11;
// fdlibm __kernel_sin / __kernel_cos
const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
  S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
  C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;

function ksin(x) { const z = x * x; return x + x * z * (S1 + z * (S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))))); }
function kcos(x) {
  const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  const hz = 0.5 * z, w = 1 - hz;
  return w + (((1 - w) - hz) + z * r); // fdlibm's compensated 1 - z/2 + z^2 r
}
/** Quadrant and reduced argument: x = n * pi/2 + r, |r| <= pi/4. */
let _n = 0;
function reduce(x) { const k = Math.round(x * INV_PIO2); _n = k & 3; return (x - k * PIO2_1) - k * PIO2_1T; }

export function sin(x) {
  const r = reduce(x);
  switch (_n) { case 0: return ksin(r); case 1: return kcos(r); case 2: return -ksin(r); default: return -kcos(r); }
}
export function cos(x) {
  const r = reduce(x);
  switch (_n) { case 0: return kcos(r); case 1: return -ksin(r); case 2: return -kcos(r); default: return ksin(r); }
}

// fdlibm s_atan.c
const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const T0 = 3.33333333333329318027e-01, T1 = -1.99999999998764832476e-01, T2 = 1.42857142725034663711e-01, T3 = -1.11111104054623557880e-01,
  T4 = 9.09088713343650656196e-02, T5 = -7.69187620504482999495e-02, T6 = 6.66107313738753120669e-02, T7 = -5.83357013379057348645e-02,
  T8 = 4.97687799461593236017e-02, T9 = -3.65315727442169155270e-02, T10 = 1.62858201153657823623e-02;

export function atan(v) {
  if (v !== v) return v;
  const neg = v < 0; let x = neg ? -v : v, id;
  if (x > 1e17) return neg ? -HALF_PI : HALF_PI;
  if (x < 0.4375) id = -1;
  else if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x); }
  else if (x < 1.1875) { id = 1; x = (x - 1) / (x + 1); }
  else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); }
  else { id = 3; x = -1 / x; }
  const z = x * x, w = z * z;
  const s1 = z * (T0 + w * (T2 + w * (T4 + w * (T6 + w * (T8 + w * T10)))));
  const s2 = w * (T1 + w * (T3 + w * (T5 + w * (T7 + w * T9))));
  const r = id < 0 ? x - x * (s1 + s2) : ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
  return neg ? -r : r;
}
/** atan2 with Math.atan2's quadrant conventions (atan2(0, 0) = 0, atan2(+0, -x) = pi). */
export function atan2(y, x) {
  if (x > 0) return atan(y / x);
  if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
  return y > 0 ? HALF_PI : y < 0 ? -HALF_PI : 0;
}
/** sqrt(x*x + y*y): sqrt is correctly rounded on every engine, Math.hypot is not. */
export const hypot = (x, y) => Math.sqrt(x * x + y * y);
/** x squared (** is implementation-approximated). */
export const sq = (x) => x * x;
