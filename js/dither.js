/* ================================================================
   DITHER HERO  —  Vanilla WebGL2 port of ReactBits Dither component
   Single-pass: Perlin FBM wave  +  Bayer 8×8 ordered dither
   ================================================================ */
(function mountDitherHero() {
  const canvas = document.getElementById('dither-canvas');
  if (!canvas) return;
  const gl = canvas.getContext('webgl2');
  if (!gl) return; // hero keeps background:#0a0a0a as CSS fallback

  /* ── params (from user props) ── */
  const WAVE_COLOR     = [0.8, 0.7, 0.3];
  const WAVE_SPEED     = 0.03;
  const WAVE_FREQUENCY = 3.5;
  const WAVE_AMPLITUDE = 0.22;
  const COLOR_NUM      = 3.9;
  const PIXEL_SIZE     = 2.0;

  /* ── vertex shader ── */
  const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

  /* ── fragment shader: Perlin FBM → wave → Bayer dither ── */
  const FRAG = `#version 300 es
precision highp float;

uniform vec2  resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3  waveColor;
uniform float colorNum;
uniform float pixelSize;

out vec4 fragColor;

/* --- Perlin noise (ported from ReactBits Dither source) --- */
vec4 mod289v(vec4 x)       { return x - floor(x*(1./289.))*289.; }
vec4 permute(vec4 x)       { return mod289v(((x*34.)+1.)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314*r; }
vec2 fade(vec2 t)          { return t*t*t*(t*(t*6.-15.)+10.); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0,0,1,1);
  vec4 Pf = fract(P.xyxy) - vec4(0,0,1,1);
  Pi = mod289v(Pi);
  vec4 ix=Pi.xzxz, iy=Pi.yyww, fx=Pf.xzxz, fy=Pf.yyww;
  vec4 i  = permute(permute(ix)+iy);
  vec4 gx = fract(i*(1./41.))*2.-1.;
  vec4 gy = abs(gx)-.5;
  vec4 tx = floor(gx+.5);
  gx -= tx;
  vec2 g00=vec2(gx.x,gy.x), g10=vec2(gx.y,gy.y),
       g01=vec2(gx.z,gy.z), g11=vec2(gx.w,gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00),dot(g01,g01),dot(g10,g10),dot(g11,g11)));
  g00*=norm.x; g01*=norm.y; g10*=norm.z; g11*=norm.w;
  float n00=dot(g00,vec2(fx.x,fy.x)), n10=dot(g10,vec2(fx.y,fy.y)),
        n01=dot(g01,vec2(fx.z,fy.z)), n11=dot(g11,vec2(fx.w,fy.w));
  vec2 f = fade(Pf.xy);
  vec2 nx = mix(vec2(n00,n01), vec2(n10,n11), f.x);
  return 2.3*mix(nx.x, nx.y, f.y);
}

/* --- Fractional Brownian Motion --- */
float fbm(vec2 p) {
  float val=0., amp=1., freq=waveFrequency;
  for (int i=0; i<4; i++) {
    val += amp * abs(cnoise(p));
    p   *= freq;
    amp *= waveAmplitude;
  }
  return val;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

/* --- Bayer 8×8 ordered dither matrix --- */
const float bayer[64] = float[64](
   0./64., 48./64., 12./64., 60./64.,  3./64., 51./64., 15./64., 63./64.,
  32./64., 16./64., 44./64., 28./64., 35./64., 19./64., 47./64., 31./64.,
   8./64., 56./64.,  4./64., 52./64., 11./64., 59./64.,  7./64., 55./64.,
  40./64., 24./64., 36./64., 20./64., 43./64., 27./64., 39./64., 23./64.,
   2./64., 50./64., 14./64., 62./64.,  1./64., 49./64., 13./64., 61./64.,
  34./64., 18./64., 46./64., 30./64., 33./64., 17./64., 45./64., 29./64.,
  10./64., 58./64.,  6./64., 54./64.,  9./64., 57./64.,  5./64., 53./64.,
  42./64., 26./64., 38./64., 22./64., 41./64., 25./64., 37./64., 21./64.
);

vec3 dither(vec2 fc, vec3 color) {
  vec2 sc = floor(fc / pixelSize);
  int x   = int(mod(sc.x, 8.));
  int y   = int(mod(sc.y, 8.));
  float threshold = bayer[y*8+x] - 0.25;
  float step = 1. / (colorNum - 1.);
  color += threshold * step;
  color  = clamp(color - 0.2, 0., 1.);
  return floor(color*(colorNum-1.)+.5) / (colorNum-1.);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= .5;
  uv.x *= resolution.x / resolution.y;
  float f  = pattern(uv);
  vec3  col = mix(vec3(0.), waveColor, f);
  col = dither(gl_FragCoord.xy, col);
  fragColor = vec4(col, 1.);
}`;

  /* ── compile helpers ── */
  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      console.error('[Dither] shader error:', gl.getShaderInfoLog(s));
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, mkShader(gl.VERTEX_SHADER,   VERT));
  gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    console.error('[Dither] link error:', gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  /* ── full-screen quad ── */
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  /* ── uniforms ── */
  const uRes      = gl.getUniformLocation(prog, 'resolution');
  const uTime     = gl.getUniformLocation(prog, 'time');
  const uSpeed    = gl.getUniformLocation(prog, 'waveSpeed');
  const uFreq     = gl.getUniformLocation(prog, 'waveFrequency');
  const uAmp      = gl.getUniformLocation(prog, 'waveAmplitude');
  const uColor    = gl.getUniformLocation(prog, 'waveColor');
  const uColorNum = gl.getUniformLocation(prog, 'colorNum');
  const uPixel    = gl.getUniformLocation(prog, 'pixelSize');

  gl.uniform1f(uSpeed,    WAVE_SPEED);
  gl.uniform1f(uFreq,     WAVE_FREQUENCY);
  gl.uniform1f(uAmp,      WAVE_AMPLITUDE);
  gl.uniform3fv(uColor,   WAVE_COLOR);
  gl.uniform1f(uColorNum, COLOR_NUM);
  gl.uniform1f(uPixel,    PIXEL_SIZE);

  /* ── resize ── */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = canvas.parentElement;
    const w = parent ? parent.clientWidth  : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  }

  resize();
  new ResizeObserver(resize).observe(canvas.parentElement || document.body);

  /* ── animation loop ── */
  const t0 = performance.now();
  (function tick() {
    requestAnimationFrame(tick);
    gl.uniform1f(uTime, (performance.now() - t0) * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  })();
})();
