/* ================================================================
   FAULTY TERMINAL  — vanilla WebGL port of the ReactBits component
   Props tuned to the desert/sand palette of this site
   ================================================================ */
(function initFaultyTerminal() {
  const canvas = document.getElementById('faulty-canvas');
  if (!canvas) return;

  // ---- config (mirroring the ReactBits props, desert palette) ----
  const CFG = {
    timeScale:          0.45,
    gridMul:            [2.2, 1.0],
    digitSize:          1.15,
    scanlineIntensity:  0.30,
    glitchAmount:       0.40,
    flickerAmount:      0.25,
    noiseAmp:           0.07,
    chromaticAberration:0.0,
    curvature:          0.08,
    tint:               [0.882, 0.808, 0.478],   // #e1ce7a  sand
    tint2:              [0.925, 0.451, 0.341],   // #ec7357  coral accent
    mouseStrength:      0.45,
    brightness:         0.52,
  };

  // ---- WebGL setup ----
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return;

  const VS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  const FS = `
    precision mediump float;
    varying vec2 v_uv;

    uniform vec2  uRes;
    uniform float uTime;
    uniform vec2  uMouse;
    uniform float uTimeScale;
    uniform vec2  uGridMul;
    uniform float uDigitSize;
    uniform float uScanlines;
    uniform float uGlitch;
    uniform float uFlicker;
    uniform float uNoise;
    uniform float uCurvature;
    uniform vec3  uTint;
    uniform vec3  uTint2;
    uniform float uMouseStr;
    uniform float uBrightness;

    /* ---- hash / noise ---- */
    float h(vec2 p) {
      p = fract(p * vec2(127.1, 311.7));
      p += dot(p, p + 74.2);
      return fract(p.x * p.y);
    }
    float h1(float v) { return h(vec2(v, v * 1.3)); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(h(i), h(i+vec2(1,0)), u.x),
                 mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y);
    }

    /* ---- barrel distortion ---- */
    vec2 barrel(vec2 uv, float k) {
      vec2 cc = uv - 0.5;
      float r2 = dot(cc, cc);
      return uv + cc * (k * r2);
    }

    /* ---- terminal rain column ---- */
    float rain(vec2 uv, float t) {
      vec2 cell = uv * uGridMul * uDigitSize;
      cell.x *= uRes.x / uRes.y;           // aspect correct
      vec2 id  = floor(cell);
      vec2 fuv = fract(cell);

      float colSeed = h(vec2(id.x, 0.0));
      float speed   = 0.4 + colSeed * 1.8;
      float phase   = colSeed * 12.0;

      // head position (wrapping)
      float head = fract(t * speed * 0.28 + phase);
      float rows = uGridMul.y * uDigitSize * (uRes.y / 12.0) * 0.04;
      float headRow = head * rows;
      float distFromHead = id.y - headRow;

      // trail brightness
      float trail = exp(-max(0.0, distFromHead) * 0.18)
                  * (1.0 - exp(-max(0.0, -distFromHead) * 4.0));
      trail = clamp(trail, 0.0, 1.0);

      // head flash
      if (abs(distFromHead) < 1.0) trail = mix(trail, 1.5, 0.6);

      // character shape: hash-driven stroke pattern
      float cHash  = h(id + vec2(floor(t * speed * 3.0 + phase * 0.7), 2.3));
      float cHash2 = h(id + vec2(1.7, floor(t * speed + phase)));
      vec2  f2     = fuv - 0.5;

      float ch = 0.0;
      // horizontal bars
      ch = max(ch, step(abs(f2.y - (cHash - 0.5) * 0.5), 0.05) * step(abs(f2.x), 0.38));
      ch = max(ch, step(abs(f2.y - (cHash2 - 0.5) * 0.3), 0.04) * step(abs(f2.x), 0.30));
      // vertical bar
      ch = max(ch, step(abs(f2.x - (cHash - 0.5) * 0.4), 0.04) * step(abs(f2.y), 0.40));
      // dot
      ch = max(ch, step(length(f2 - vec2((cHash2-0.5)*0.3,(cHash-0.5)*0.3)), 0.07));

      return ch * trail;
    }

    void main() {
      float t = uTime * uTimeScale;

      /* ---- mouse warp ---- */
      vec2 uv = v_uv;
      vec2 mOff = (uMouse - 0.5) * uMouseStr * 0.04;
      uv += mOff * (1.0 - length(uv - uMouse));

      /* ---- barrel distortion ---- */
      uv = barrel(uv, uCurvature);

      /* ---- glitch: random horizontal shifts ---- */
      float glitchLine  = floor(uv.y * 80.0);
      float glitchPhase = floor(t * 8.0);
      float glitchHash  = h(vec2(glitchLine, glitchPhase));
      float glitchStr   = step(0.92, glitchHash) * uGlitch;
      float glitchShift = (h(vec2(glitchLine * 2.3, glitchPhase)) - 0.5) * 0.03 * glitchStr;
      uv.x += glitchShift;

      /* ---- clamp / vignette ---- */
      vec2 vig = uv * (1.0 - uv);
      float vignette = pow(vig.x * vig.y * 15.0, 0.5);

      /* ---- terminal rain ---- */
      float rain0 = rain(uv, t);
      float rain1 = rain(uv * 1.7 + 0.13, t * 0.7);   // second layer, different scale
      float rain2 = rain(uv * 0.6 - 0.07, t * 1.3);
      float rainVal = rain0 * 0.6 + rain1 * 0.25 + rain2 * 0.15;

      /* ---- tint: mix sand and coral based on brightness ---- */
      vec3 color = mix(uTint * rainVal, uTint2 * rainVal, clamp(rain0 - 0.3, 0.0, 1.0));

      /* ---- scanlines ---- */
      float sl = sin(uv.y * uRes.y * 3.14159) * 0.5 + 0.5;
      color *= 1.0 - uScanlines * (1.0 - sl * sl);

      /* ---- noise grain ---- */
      float grain = h(uv * uRes + t * 40.0) - 0.5;
      color += grain * uNoise;

      /* ---- flicker ---- */
      float flicker = 1.0 + (h1(t * 7.3) - 0.5) * uFlicker * 0.3;
      color *= flicker;

      /* ---- vignette + brightness ---- */
      color *= vignette * uBrightness;

      /* ---- edge fade (CRT border) ---- */
      float border = smoothstep(0.0, 0.05, uv.x) * smoothstep(0.0, 0.05, uv.y)
                   * smoothstep(0.0, 0.05, 1.0 - uv.x) * smoothstep(0.0, 0.05, 1.0 - uv.y);
      color *= border;

      gl_FragColor = vec4(color, 1.0);
    }`;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // Full-screen quad
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  const U = {};
  ['uRes','uTime','uMouse','uTimeScale','uGridMul','uDigitSize',
   'uScanlines','uGlitch','uFlicker','uNoise','uCurvature',
   'uTint','uTint2','uMouseStr','uBrightness'
  ].forEach(n => U[n] = gl.getUniformLocation(prog, n));

  let mouse = [0.5, 0.5];

  function resize() {
    const hero = document.getElementById('skills-hero');
    if (!hero) return;
    const w = hero.offsetWidth, h = hero.offsetHeight;
    canvas.width  = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  function tick(ts) {
    requestAnimationFrame(tick);
    const t = ts * 0.001;

    gl.uniform2f(U.uRes,       canvas.width, canvas.height);
    gl.uniform1f(U.uTime,      t);
    gl.uniform2fv(U.uMouse,    mouse);
    gl.uniform1f(U.uTimeScale, CFG.timeScale);
    gl.uniform2fv(U.uGridMul,  CFG.gridMul);
    gl.uniform1f(U.uDigitSize, CFG.digitSize);
    gl.uniform1f(U.uScanlines, CFG.scanlineIntensity);
    gl.uniform1f(U.uGlitch,    CFG.glitchAmount);
    gl.uniform1f(U.uFlicker,   CFG.flickerAmount);
    gl.uniform1f(U.uNoise,     CFG.noiseAmp);
    gl.uniform1f(U.uCurvature, CFG.curvature);
    gl.uniform3fv(U.uTint,     CFG.tint);
    gl.uniform3fv(U.uTint2,    CFG.tint2);
    gl.uniform1f(U.uMouseStr,  CFG.mouseStrength);
    gl.uniform1f(U.uBrightness,CFG.brightness);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const hero = document.getElementById('skills-hero');
  if (hero) {
    hero.addEventListener('mousemove', e => {
      const r = hero.getBoundingClientRect();
      mouse = [(e.clientX - r.left) / r.width, 1.0 - (e.clientY - r.top) / r.height];
    });
    hero.addEventListener('mouseleave', () => { mouse = [0.5, 0.5]; });
  }

  // Init when section becomes visible
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      io.disconnect();
      resize();
      window.addEventListener('resize', resize);
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.05 });
  const sect = document.getElementById('skills');
  if (sect) io.observe(sect);
})();
