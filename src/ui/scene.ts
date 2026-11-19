/**
 * The night scene, shared by the app's window backdrop (NightScene.tsx) and the website's hero, which runs it with
 * WebGPU. It reads nsh.size (points), nsh.time (seconds) and four colour uniforms: sky, glow, gold and base.
 *
 * A rainy night city lit from behind a rooftop figure, with a few bats crossing on paths of their
 * own. Everything is drawn in a 1120×720 "frame" anchored to the window's right edge and scaled by its
 * height, so the light, the figure and the flock keep their place as the window resizes. The left side is darkened
 * so the sidebar and the package table stay readable over it.
 */
export const SCENE = /* wgsl */ `
struct Uniforms { sky: vec4f, glow: vec4f, gold: vec4f, base: vec4f }

const PI: f32 = 3.14159265;
const BATS: i32 = 16;

fn hash(n: f32) -> f32 { return fract(sin(n * 127.1 + 11.7) * 43758.5453); }

// A point of the frame (1120 × 720 design units) in window points.
fn frame(p: vec2f, k: f32) -> vec2f { return vec2f(nsh.size.x - (1120.0 - p.x) * k, p.y * k); }

fn cubic(a: vec2f, b: vec2f, c: vec2f, d: vec2f, t: f32) -> vec2f {
  let u = 1.0 - t;
  return u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d;
}
fn cubicTangent(a: vec2f, b: vec2f, c: vec2f, d: vec2f, t: f32) -> vec2f {
  let u = 1.0 - t;
  return 3.0 * u * u * (b - a) + 6.0 * u * t * (c - b) + 3.0 * t * t * (d - c);
}

// A bat seen from below, head along +y, wingspan 1. f is the wing beat, -1 (down) .. 1 (up).
fn bat(q: vec2f, f: f32, aa: f32) -> f32 {
  let ax = abs(q.x);
  let body = (length(vec2f(q.x / 0.05, (q.y + 0.02) / 0.12)) - 1.0) * 0.05;
  let head = length(q - vec2f(0.0, 0.12)) - 0.04;
  var m = 1.0 - smoothstep(-aa, aa, min(body, head));
  let span = 0.5 * (1.0 - 0.2 * abs(f));
  let u = clamp(ax / span, 0.0, 1.0);
  let top = 0.03 + f * 0.34 * ax + 0.035 * sin(u * PI) * (1.0 - u);
  let bottom = top - mix(0.17, 0.02, u) + 0.05 * abs(sin(u * PI * 3.0));
  let wing = min(min(top - q.y, q.y - bottom), span - ax);
  m = max(m, smoothstep(-aa, aa, wing));
  return m;
}

// The height of a skyline above its base at x, in frame units; spires on some blocks.
fn skyline(x: f32, w: f32, seed: f32, low: f32, high: f32) -> f32 {
  let id = floor(x / w);
  let fx = fract(x / w);
  var h = mix(low, high, hash(id + seed));
  if (hash(id * 1.7 + seed) > 0.78) { h = h + 46.0 * max(0.0, 1.0 - abs(fx - 0.5) / 0.1); }
  if (hash(id * 3.1 + seed) > 0.7) { h = h - 10.0 * abs(fx - 0.5); }
  if (fx < 0.03) { h = h * 0.92; }
  return h;
}

fn windows(x: f32, depth: f32, seed: f32) -> f32 {
  let c = vec2f(floor(x / 5.0), floor(depth / 7.0));
  let inside = step(fract(x / 5.0), 0.45) * step(fract(depth / 7.0), 0.5);
  return inside * step(0.86, hash(c.x * 13.1 + c.y * 7.7 + seed)) * (0.4 + 0.6 * hash(c.x + c.y * 3.3));
}

fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
fn rot(p: vec2f, a: f32) -> vec2f { let c = cos(a); let s = sin(a); return vec2f(c * p.x + s * p.y, -s * p.x + c * p.y); }
fn segment(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let pa = p - a; let ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// Signed distance to a triangle a, b, c.
fn tri(p: vec2f, a: vec2f, b: vec2f, c: vec2f) -> f32 {
  let e0 = b - a; let e1 = c - b; let e2 = a - c;
  let v0 = p - a; let v1 = p - b; let v2 = p - c;
  let pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  let pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  let pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  let sg = sign(e0.x * e2.y - e0.y * e2.x);
  let d = min(min(vec2f(dot(pq0, pq0), sg * (v0.x * e0.y - v0.y * e0.x)),
                  vec2f(dot(pq1, pq1), sg * (v1.x * e1.y - v1.y * e1.x))),
                  vec2f(dot(pq2, pq2), sg * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}
fn box(p: vec2f, c: vec2f, half: vec2f) -> f32 {
  let d = abs(p - c) - half;
  return length(max(d, vec2f(0.0))) + min(max(d.x, d.y), 0.0);
}

// Signed distance to a polygon of up to 32 points (n of them, in order).
fn poly32(p: vec2f, pts: array<vec2f, 32>, n: i32) -> f32 {
  var v = pts;
  var d = dot(p - v[0], p - v[0]);
  var s = 1.0;
  var j = n - 1;
  for (var i = 0; i < n; i = i + 1) {
    let e = v[j] - v[i];
    let w = p - v[i];
    let b = w - e * clamp(dot(w, e) / max(dot(e, e), 1e-6), 0.0, 1.0);
    d = min(d, dot(b, b));
    let c0 = p.y >= v[i].y;
    let c1 = v[j].y > p.y;
    let c2 = e.x * w.y > e.y * w.x;
    if ((c0 && c1 && c2) || (!c0 && !c1 && !c2)) { s = -s; }
    j = i;
  }
  return s * sqrt(d);
}

// The watcher, Brewman's own: a broad, armored figure standing on the roof, facing out of the frame as if walking
// toward it through the rain; a hood with two pointed ears, the logo's lens eyes, a cape blown out to the left by the
// wind that slants the rain. Drawn in frame units around its feet (FEET, y up is negative, 392 tall).
const FEET: vec2f = vec2f(965.0, 598.0);
const FIG_SCALE: f32 = 0.8;   // drawn at 0.8 of its own units, feet fixed

fn hood(q: vec2f) -> f32 {
  let head = length((q - vec2f(0.0, -356.0)) / vec2f(1.0, 1.2)) - 27.5;
  let ears = tri(vec2f(abs(q.x), q.y), vec2f(7.0, -380.0), vec2f(24.0, -371.0), vec2f(27.0, -416.0));
  return smin(head, ears, 4.0);
}

// A high collar: a stiff panel rising from each shoulder beside the jaw to a point below the eyes, flaring out.
fn collar(q: vec2f) -> f32 {
  let x = abs(q.x);
  let p = vec2f(x, q.y);
  return min(tri(p, vec2f(18.0, -326.0), vec2f(58.0, -320.0), vec2f(44.0, -372.0)),
             tri(p, vec2f(18.0, -326.0), vec2f(44.0, -372.0), vec2f(30.0, -360.0)));
}

// Neck, the trapezius sloping into armored shoulders, a deep chest over a narrow waist.
fn torso(q: vec2f) -> f32 {
  return poly32(q, array<vec2f, 32>(
    vec2f(-20.0, -340.0), vec2f(20.0, -340.0), vec2f(26.0, -327.0), vec2f(60.0, -319.0), vec2f(76.0, -306.0),
    vec2f(80.0, -290.0), vec2f(70.0, -262.0), vec2f(52.0, -240.0), vec2f(42.0, -206.0), vec2f(46.0, -176.0),
    vec2f(-46.0, -176.0), vec2f(-42.0, -206.0), vec2f(-52.0, -240.0), vec2f(-70.0, -262.0), vec2f(-80.0, -290.0),
    vec2f(-76.0, -306.0), vec2f(-60.0, -319.0), vec2f(-26.0, -327.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0),
    vec2f(0.0, 0.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0),
    vec2f(0.0, 0.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0), vec2f(0.0, 0.0),
    vec2f(0.0, 0.0), vec2f(0.0, 0.0)), 18);
}

// Arms hang at the sides, the fists closed.
fn arms(q: vec2f) -> f32 {
  let r = smin(smin(segment(q, vec2f(70.0, -296.0), vec2f(84.0, -236.0)) - 15.0,
                    segment(q, vec2f(84.0, -236.0), vec2f(90.0, -176.0)) - 13.0, 5.0), length(q - vec2f(91.0, -165.0)) - 13.5, 4.0);
  let l = smin(smin(segment(q, vec2f(-70.0, -296.0), vec2f(-82.0, -238.0)) - 15.0,
                    segment(q, vec2f(-82.0, -238.0), vec2f(-86.0, -178.0)) - 13.0, 5.0), length(q - vec2f(-87.0, -167.0)) - 13.0, 4.0);
  return min(r, l);
}

// The cape, a long coat-like drape from shoulder to roof, its left side thrown out by the wind in slow waves.
fn cape(q: vec2f) -> f32 {
  let t = nsh.time;
  let wa = sin(t * 1.2) * 5.0;
  let wb = sin(t * 1.2 - 0.8) * 8.0;
  let wc = sin(t * 1.2 - 1.6) * 11.0;
  // It wraps the figure from the shoulders to the roof, hiding the legs; the wind throws the left side out.
  return poly32(q, array<vec2f, 32>(
    vec2f(-60.0, -322.0), vec2f(-84.0, -306.0), vec2f(-106.0, -268.0), vec2f(-130.0, -214.0), vec2f(-158.0 + wa, -156.0),
    vec2f(-190.0 + wb, -98.0), vec2f(-220.0 + wc, -40.0), vec2f(-238.0 + wc, -8.0), vec2f(-200.0, -2.0), vec2f(-150.0, -10.0),
    vec2f(-104.0, -2.0), vec2f(-50.0, -6.0), vec2f(10.0, -2.0), vec2f(62.0, -6.0), vec2f(100.0, -2.0),
    vec2f(106.0 + wa * 0.4, -70.0), vec2f(104.0, -160.0), vec2f(100.0, -240.0), vec2f(84.0, -300.0), vec2f(60.0, -322.0),
    vec2f(0.0, -332.0), vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0),
    vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0), vec2f(0.0),
    vec2f(0.0), vec2f(0.0)), 21);
}

fn armor(q: vec2f) -> f32 { return smin(torso(q), arms(q), 4.0); }
fn walker(q: vec2f) -> f32 { return min(min(min(cape(q), armor(q)), smin(hood(q), torso(q), 4.0)), collar(q)); }

// The bare lower face, below the mask's edge, which dips toward the cheeks.
fn bareFace(q: vec2f) -> f32 {
  let face = length((q - vec2f(0.0, -343.0)) / vec2f(1.0, 1.2)) - 19.5;
  return max(face, (-354.0 + 0.009 * q.x * q.x) - q.y);
}

// One of the logo's lens eyes (side -1 left, 1 right): a straight upper lid slanting down to the inner corner, a
// rounded lower lid; both blink every few seconds.
fn eyeLens(q: vec2f, side: f32) -> f32 {
  let open = 1.0 - step(0.965, fract(nsh.time / 5.3));
  let e = vec2f((q.x - side * 9.8) * side, q.y + 363.0);
  let lid = (-0.6 - 0.30 * e.x) - e.y;
  let lower = length((e - vec2f(0.0, -1.5)) / vec2f(1.0, mix(0.08, 0.54, open))) - 7.2;
  return max(lid, lower);
}

// Armor seams and cape folds, drawn as faint lit lines: the plates of the chest, the abdomen's segments, the belt,
// shoulder plates, gauntlets and knee guards, and the cape's long folds.
fn seams(q: vec2f) -> f32 {
  var d = segment(q, vec2f(0.0, -318.0), vec2f(0.0, -200.0));
  d = min(d, segment(vec2f(abs(q.x), q.y), vec2f(28.0, -330.0), vec2f(42.0, -366.0)));   // the collar's fold
  d = min(d, segment(q, vec2f(4.0, -288.0), vec2f(44.0, -280.0)));
  d = min(d, segment(q, vec2f(44.0, -280.0), vec2f(62.0, -300.0)));
  d = min(d, segment(q, vec2f(-4.0, -288.0), vec2f(-44.0, -280.0)));
  d = min(d, segment(q, vec2f(-44.0, -280.0), vec2f(-62.0, -300.0)));
  for (var i = 0; i < 3; i = i + 1) {
    let y = -262.0 + f32(i) * 19.0;
    d = min(d, segment(q, vec2f(5.0, y), vec2f(30.0 - f32(i) * 3.0, y + 2.0)));
    d = min(d, segment(q, vec2f(-5.0, y), vec2f(-30.0 + f32(i) * 3.0, y + 2.0)));
  }
  d = min(d, segment(q, vec2f(-44.0, -196.0), vec2f(44.0, -196.0)));
  d = min(d, segment(q, vec2f(-44.0, -185.0), vec2f(44.0, -185.0)));
  d = min(d, segment(q, vec2f(54.0, -318.0), vec2f(80.0, -292.0)));
  d = min(d, segment(q, vec2f(-54.0, -318.0), vec2f(-80.0, -292.0)));
  d = min(d, segment(q, vec2f(77.0, -206.0), vec2f(98.0, -202.0)));
  d = min(d, segment(q, vec2f(-76.0, -208.0), vec2f(-96.0, -204.0)));
  d = min(d, segment(q, vec2f(-6.0, -176.0), vec2f(-14.0, -6.0)));    // where the cape's two sides meet in front
  d = min(d, segment(q, vec2f(40.0, -176.0), vec2f(54.0, -8.0)));
  d = min(d, segment(q, vec2f(-50.0, -176.0), vec2f(-70.0, -8.0)));
  d = min(d, segment(q, vec2f(-100.0, -262.0), vec2f(-176.0, -40.0)));
  d = min(d, segment(q, vec2f(-90.0, -230.0), vec2f(-120.0, -20.0)));
  d = min(d, segment(q, vec2f(100.0, -230.0), vec2f(104.0, -40.0)));
  return d;
}

// Signed distance (frame units) to the watcher, the roof and its parapet.
fn figure(p: vec2f) -> f32 {
  let roof = max(752.0 - p.x, 590.0 - p.y);
  let parapet = max(max(744.0 - p.x, p.x - 770.0), 578.0 - p.y);
  return min(walker((p - FEET) / FIG_SCALE) * FIG_SCALE, min(roof, parapet));
}

// Slanted rain, falling from the upper right toward the lower left: three layers, far to near, each thinner, fainter
// and slower the farther it is. Each column of a layer carries drops of its own length, spacing and phase.
fn rain(p: vec2f, t: f32, k: f32, first: i32, last: i32) -> f32 {
  var total = 0.0;
  for (var l = first; l <= last; l = l + 1) {
    let fl = f32(l);
    let w = mix(5.0, 11.0, fl / 2.0);              // column spacing
    let speed = mix(240.0, 460.0, fl / 2.0);
    let len = mix(10.0, 24.0, fl / 2.0);
    let alpha = mix(0.08, 0.22, fl / 2.0);
    let q = rot(p, 0.3) * vec2f(1.0, 1.0);          // streaks are vertical in this space
    let column = floor(q.x / w);
    let jitter = (hash(column * 1.3 + fl * 17.0) - 0.5) * 0.6;
    let gap = mix(70.0, 160.0, hash(column * 2.7 + fl * 5.0));
    let y = q.y - t * speed * mix(0.85, 1.15, hash(column + fl * 3.0)) + hash(column * 9.1 + fl) * 900.0;   // falls: y grows down
    let cell = floor(y / gap);
    let v = y - cell * gap;
    let id = cell * 3.7 + column * 1.9 + fl * 11.0;
    let present = step(0.28, hash(id));
    // Each drop has its own size and opacity: its length, its thickness and how much light it catches.
    let size = mix(0.5, 1.5, hash(id + 0.31));
    let dropLen = len * size;
    let opacity = mix(0.35, 1.0, hash(id + 0.77));
    // Brightest at its leading (lower) end, fading up its tail.
    let streak = smoothstep(0.0, dropLen * 0.85, v) * (1.0 - smoothstep(dropLen * 0.9, dropLen, v));
    let across = abs(q.x - (column + 0.5 + jitter) * w);
    let thin = 1.0 - smoothstep(0.05, (0.3 + 0.12 * fl) * mix(0.7, 1.5, size - 0.5) + 0.45 / k, across);
    total = total + present * streak * thin * alpha * opacity;
  }
  return total;
}

// Where rain falling straight down at x first meets something: the figure, the parapet, the roof, or the near
// skyline's roofs to the left. Traced down the column with the figure's distance field.
fn surfaceAt(x: f32) -> f32 {
  if (x < 740.0) { return 650.0 - skyline(x + 80.0, 62.0, 9.0, 20.0, 90.0); }
  var y = 200.0;
  for (var i = 0; i < 64; i = i + 1) {
    let d = figure(vec2f(x, y));
    if (d < 0.35) { break; }
    y = y + max(d, 0.4);
  }
  return y;
}

// Splashes where drops land: each 6-unit cell along a surface is hit now and then; a hit throws two droplets up and
// out on a parabola and leaves a small ring. Only points near a surface pay for the trace.
fn splashes(p: vec2f, t: f32) -> f32 {
  let w = 6.0;
  let cell = floor(p.x / w);
  var glow = 0.0;
  for (var n = -1.0; n <= 1.0; n = n + 1.0) {
    let c = cell + n;
    let x = (c + 0.5 + (hash(c * 3.1) - 0.5) * 0.6) * w;
    let y = surfaceAt(x);
    if (abs(p.y - y) > 14.0) { continue; }
    let rate = mix(0.7, 1.6, hash(c * 7.7));
    let phase = fract(t * rate + hash(c * 1.9));
    let life = 0.22;
    if (phase > life) { continue; }
    let tau = phase / life;
    let fade = 1.0 - tau;
    for (var s = -1.0; s <= 1.0; s = s + 2.0) {
      let vx = mix(2.5, 5.0, hash(c * 5.3 + s));
      let vy = mix(6.0, 11.0, hash(c * 2.3 + s));
      let drop = vec2f(x + s * vx * tau * 1.4, y - (vy * tau - 0.5 * 14.0 * tau * tau) * 1.2);
      glow = glow + exp(-length(p - drop) / 0.45) * fade;
    }
    let ring = abs(length((p - vec2f(x, y)) / vec2f(1.0, 0.35)) - tau * 4.0);
    glow = glow + exp(-ring / 0.35) * fade * 0.6 * step(p.y, y + 1.0);
  }
  return glow;
}

// The near roof is seen at a low angle: its flat top is the thin band from the parapet line (590) to its front lip
// (606); below the lip is the building's wall.
const ROOF_TOP: f32 = 590.0;
const ROOF_LIP: f32 = 606.0;

// Puddle ripples, only on the roof's flat top: rings spreading and fading, squashed flat by the low view, smaller
// toward the back edge.
fn ripples(p: vec2f, t: f32) -> f32 {
  if (p.x < 752.0 || p.y < ROOF_TOP + 0.5 || p.y > ROOF_LIP - 0.5) { return 0.0; }
  let depth = (p.y - ROOF_TOP) / (ROOF_LIP - ROOF_TOP);   // 0 at the back edge, 1 at the lip
  let g = vec2f(13.0, 4.0);
  let cell = floor(p / g);
  var total = 0.0;
  for (var j = -1.0; j <= 1.0; j = j + 1.0) {
    for (var i = -1.0; i <= 1.0; i = i + 1.0) {
      let c = cell + vec2f(i, j);
      let h = hash(c.x * 7.1 + c.y * 31.7);
      let phase = fract(t * mix(0.5, 1.1, h) + hash(c.x * 2.9 + c.y * 5.3));
      let centre = (c + vec2f(0.5) + (vec2f(hash(c.x + c.y * 3.0), hash(c.y + c.x * 5.0)) - 0.5) * 0.6) * g;
      let r = phase * mix(4.0, 7.0, depth);
      let d = abs(length((p - centre) / vec2f(1.0, mix(0.14, 0.24, depth))) - r);
      total = total + exp(-d / 0.4) * (1.0 - phase);
    }
  }
  return total;
}

// Rain running down the wall below the roof's lip: thin wet streaks sliding down, fading as they go.
fn runoff(p: vec2f, t: f32) -> f32 {
  if (p.x < 752.0 || p.y < ROOF_LIP + 1.0) { return 0.0; }
  let w = 9.0;
  let col = floor(p.x / w);
  let x = (col + 0.5 + (hash(col * 4.3) - 0.5) * 0.5) * w;
  let speed = mix(18.0, 40.0, hash(col * 1.7));
  let len = mix(10.0, 26.0, hash(col * 2.9));
  let y = p.y - ROOF_LIP - fract(t * speed / 120.0 + hash(col * 8.1)) * 120.0;
  let streak = smoothstep(-len, 0.0, y) * (1.0 - smoothstep(0.0, 1.5, y));
  let fade = 1.0 - smoothstep(0.0, 110.0, p.y - ROOF_LIP);
  return streak * fade * exp(-abs(p.x - x) / 0.35) * step(0.4, hash(col * 6.7));
}

fn shade(uv: vec2f) -> vec4f {
  let k = nsh.size.y / 720.0;
  let p = uv * nsh.size;
  let fp = vec2f((p.x - (nsh.size.x - 1120.0 * k)) / k, p.y / k);   // this point in frame units
  let t = nsh.time;

  // Sky, and the light behind the figure.
  var col = mix(uniforms.sky.rgb * 1.25, uniforms.sky.rgb * 0.3, smoothstep(0.0, 1.0, uv.y));
  // Distant lightning: some 11-second spans begin with a double flicker that lights the clouds from above.
  let span = floor(t / 11.0);
  let since = t - span * 11.0;
  let strike = step(0.55, hash(span * 4.1 + 2.0)) * (exp(-since * 9.0) + 0.7 * exp(-abs(since - 0.22) * 16.0));
  col = col + uniforms.glow.rgb * strike * 0.22 * (1.0 - smoothstep(0.0, 0.75, uv.y));
  let d = length(fp - vec2f(905.0, 430.0));
  let breathe = 0.92 + 0.08 * sin(t * 0.8);
  col = col + uniforms.glow.rgb * (0.9 * exp(-d / 46.0) + 0.5 * exp(-d / 190.0) + 0.16 * exp(-d / 480.0)) * breathe;

  // Far skyline in haze, then the middle city with lit windows.
  let far = skyline(fp.x + 37.0, 34.0, 3.0, 60.0, 190.0);
  col = mix(col, mix(uniforms.sky.rgb * 1.7, uniforms.glow.rgb * 0.2, 0.3), (1.0 - smoothstep(-1.5, 1.5, 560.0 - far - fp.y)) * 0.75);
  let mid = skyline(fp.x, 46.0, 5.0, 40.0, 150.0);
  let inMid = 1.0 - smoothstep(-0.8, 0.8, 600.0 - mid - fp.y);
  col = mix(col, uniforms.base.rgb * 1.6, inMid);
  col = col + uniforms.gold.rgb * windows(fp.x, 600.0 - fp.y, 5.0) * inMid * 0.9;

  // Drifting mist low over the city.
  let mist = exp(-pow((fp.y - 540.0) / 60.0, 2.0)) * (0.5 + 0.5 * sin(fp.x * 0.006 + t * 0.15));
  col = col + uniforms.glow.rgb * mist * 0.08;

  // Bats: a few at a time, each on a path of its own. Every flight picks a new side to enter from, a heading, a
  // curve, a speed and a size; some flights are skipped, so the sky goes from empty to a small flock and back.
  for (var i = 0; i < BATS; i = i + 1) {
    let fi = f32(i);
    let duration = mix(7.0, 16.0, hash(fi * 2.1));
    let clock = t / duration + hash(fi * 9.7);
    let flight = floor(clock);
    let s = fract(clock);
    let seed = fi * 13.7 + flight * 7.31;
    let busy = 0.5 + 0.5 * sin(t * 0.07 + 1.3);           // the sky's density drifts over a minute or so
    if (hash(seed) > mix(0.35, 0.85, busy)) { continue; }
    let fromLeft = step(0.5, hash(seed + 1.0));
    let y0 = mix(60.0, 470.0, hash(seed + 2.0));
    let y1 = mix(-60.0, 420.0, hash(seed + 3.0));
    let a = vec2f(mix(1220.0, -120.0, fromLeft), y0);
    let e = vec2f(mix(-160.0, 1260.0, fromLeft), y1);
    let b = mix(a, e, 0.33) + vec2f(0.0, (hash(seed + 4.0) - 0.5) * 260.0);
    let c = mix(a, e, 0.66) + vec2f(0.0, (hash(seed + 5.0) - 0.5) * 260.0);
    let near = step(0.8, hash(seed + 6.0));
    let tangent = normalize(cubicTangent(a, b, c, e, s));
    let side = vec2f(-tangent.y, tangent.x);
    let pos = cubic(a, b, c, e, s) + side * sin(t * mix(1.2, 2.4, hash(seed + 7.0)) + fi) * 8.0;
    let span = mix(14.0, 26.0, hash(seed + 8.0)) * (1.0 + near * 1.4);
    let rel = (fp - pos) / span;
    if (abs(rel.x) > 0.7 || abs(rel.y) > 0.7) { continue; }
    let q = vec2f(dot(rel, side), dot(rel, tangent));
    let beat = sin(t * mix(14.0, 22.0, hash(seed + 9.0)) + fi * 1.9);
    let aa = (1.2 + near * 2.5) / (span * k);
    let fade = smoothstep(0.0, 0.05, s) * (1.0 - smoothstep(0.95, 1.0, s));
    let rim = exp(-length(pos - vec2f(905.0, 430.0)) / 260.0) * 0.25;
    col = mix(col, uniforms.base.rgb * 0.4 + uniforms.glow.rgb * rim * 0.4, bat(q, beat, aa) * fade);
  }

  // The far rain falls behind the near roofs and the figure.
  let lit0 = exp(-length(fp - vec2f(905.0, 430.0)) / 220.0);
  col = col + mix(uniforms.glow.rgb * 0.8, vec3f(1.0), 0.3) * rain(fp, t, k, 0, 1) * (0.6 + 1.6 * lit0 + strike * 2.0);

  // Near rooftops, the figure on its ledge, and the rim light the backlight puts around it.
  let near = skyline(fp.x + 80.0, 62.0, 9.0, 20.0, 90.0);
  col = mix(col, uniforms.base.rgb * 0.5, 1.0 - smoothstep(-0.8, 0.8, 650.0 - near - fp.y));
  col = col + uniforms.gold.rgb * windows(fp.x + 3.0, 650.0 - fp.y, 9.0) * (1.0 - smoothstep(-0.8, 0.8, 650.0 - near - fp.y)) * 0.5;
  let fd = figure(fp);
  let lit = exp(-length(fp - vec2f(905.0, 430.0)) / 220.0);
  let inside = 1.0 - smoothstep(-0.8 / k, 0.8 / k, fd);
  col = mix(col, uniforms.base.rgb * 0.3, inside);
  col = col + uniforms.glow.rgb * exp(-abs(fd) / 2.2) * lit * 0.6 * step(fd, 4.0);
  // The armor seams catch the light. Two narrow lenses glow above the pale lower face.
  if (inside > 0.001) {
    let q = (fp - FEET) / FIG_SCALE;
    let px = 1.0 / (k * FIG_SCALE);
    let ink = mix(uniforms.glow.rgb, vec3f(1.0), 0.4);
    let body = 1.0 - smoothstep(-px, px, armor(q));
    col = mix(col, uniforms.base.rgb * 0.62 + uniforms.glow.rgb * 0.05, body * inside);
    let seam = 1.0 - smoothstep(0.3 * px, 1.4 * px, seams(q));
    col = col + ink * seam * mix(0.1, 0.2, body) * inside;
    let bare = (1.0 - smoothstep(-px, px, bareFace(q))) * inside;
    let mouth = exp(-segment(vec2f(abs(q.x), q.y), vec2f(0.0, -334.0), vec2f(7.2, -332.8)) / (1.2 * px));
    col = mix(col, ink * 0.3 * (1.0 - mouth * 0.85), bare);
    let el = min(eyeLens(q, -1.0), eyeLens(q, 1.0));
    let eye = 1.0 - smoothstep(-px, px, el);
    col = col + mix(uniforms.gold.rgb, vec3f(1.0), 0.6) * eye * 1.2 + uniforms.gold.rgb * exp(-max(el, 0.0) / 1.6) * 0.22 * inside;
    let haze = smoothstep(-190.0, 0.0, q.y) * 0.35 * inside;
    col = mix(col, uniforms.sky.rgb * 1.3 + uniforms.glow.rgb * 0.12, haze);
  }

  // The rain, in front of the city and the figure, catching the backlight more where it is brighter.
  // The near rain stops where it meets the figure and the roof; where it lands it splashes, and the roof's puddles
  // ripple and catch the backlight.
  let solid = 1.0 - smoothstep(-0.5, 0.5, fd);
  let rainLight = mix(uniforms.glow.rgb * 0.8, vec3f(1.0), 0.3);
  col = col + rainLight * rain(fp, t, k, 2, 2) * (0.6 + 1.6 * lit + strike * 2.0) * (1.0 - solid);
  if ((fd > -2.0 && fd < 16.0) || fp.y > 560.0) {
    col = col + rainLight * splashes(fp, t) * (0.35 + 1.2 * lit) * 0.55;
  }
  // The wet roof top reflects the backlight; its front lip catches a thin line of light; the wall below is darker
  // and streaked with run-off.
  let top = step(752.0, fp.x) * step(ROOF_TOP, fp.y) * step(fp.y, ROOF_LIP);
  let sheen = top * exp(-abs(fp.x - 905.0) / 90.0);
  col = col + uniforms.glow.rgb * (sheen * 0.14 + ripples(fp, t) * 0.22 * (0.35 + sheen * 3.0));
  col = col + uniforms.glow.rgb * exp(-abs(fp.y - ROOF_LIP) / 0.6) * step(752.0, fp.x) * (0.08 + 0.25 * exp(-abs(fp.x - 905.0) / 120.0));
  let wall = step(752.0, fp.x) * step(ROOF_LIP, fp.y);
  col = col * (1.0 - wall * 0.25) + uniforms.glow.rgb * runoff(fp, t) * 0.12;
  col = mix(col, uniforms.sky.rgb * 1.6, 0.06);                   // the haze rain leaves in the air

  // Readability: darken the left where the sidebar and table sit, and the edges.
  col = col * mix(0.22, 1.0, smoothstep(0.08, 0.8, uv.x));
  let v = length((uv - vec2f(0.62, 0.48)) * vec2f(1.0, 1.25));
  col = col * (1.0 - 0.5 * smoothstep(0.45, 1.0, v));
  return vec4f(col, 1.0);
}`;
