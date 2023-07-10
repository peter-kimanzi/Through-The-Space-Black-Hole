/*********
 * made by Matthias Hurrle (@atzedent)
 */

/** @type {HTMLCanvasElement} */
const canvas = window.canvas
const gl = canvas.getContext("webgl2")
const dpr = Math.max(1, .5*window.devicePixelRatio)
/** @type {Map<string,PointerEvent>} */
const touches = new Map()

const vertexSource = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

in vec2 position;

void main(void) {
    gl_Position = vec4(position, 0., 1.);
}
`
const fragmentSource = `#version 300 es
/*********
* made by Matthias Hurrle (@atzedent)
*/

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform float time;
uniform vec2 resolution;
uniform vec2 touch;
uniform int pointerCount;

out vec4 fragColor;

#define P pointerCount
#define T mod(time,180.)
#define S smoothstep
#define mouse (touch/resolution)
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define noise(p) (.5+.5*sin(p.x*1.5)*sin(p.y*1.5))
#define tint vec3(1,3,2)

float rnd(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

float fbm(vec2 p) {
  float f = .0;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

  f += .500000*noise(p); p *= m;
  f += .250000*noise(p); p *= m;
  f += .125000*noise(p); p *= m;
  f += .062500*noise(p); p *= m;
  f += .015625*noise(p);

  return f;
}

float oct(vec3 p, float s) {
  p = abs(p);

  return (p.x+p.y+p.z-s)*(1./sqrt(3.));
}

float cave(vec3 p) {
  vec3 q = p+vec3(0, 0, T*7.5);
  float rock = fbm(q.xz*.25);

  float way = pow(abs(q.x) * 38., 2.)*125e-6;
  rock *= way;

  return max(q.y-rock, .0);
}

float mat = .0;
float map(vec3 p) {
  vec3 q = p;
  q.xz *= rot(-T*.5);
  q.yz *= rot(T*.25);
  float d = 5e5,
  walls = cave(p+vec3(0, 8, 0))*.5,
  end = oct(q, 1.8);

  d = min(d, walls);
  d = min(d, end);

  if (d == end) mat = 1.;
  else mat = .0;

  return d;
}

vec3 norm(vec3 p) {
  vec2 e = vec2(1e-3, 0);
  float d = map(p);
  vec3 n = d-vec3(
    map(p-e.xyy),
    map(p-e.yxy),
    map(p-e.yyx)
  );

  return normalize(n);
}


void cam(inout vec3 p) {
  if (P > 0) {

    p.yz *= rot(-mouse.y*acos(-1.)+acos(.0));
    p.xz *= rot(acos(-1.)-mouse.x*acos(-1.)*2.);

  } else {

    p.yz *= rot(sin(T*.5)*.25+.25);
    p.xz *= rot(T*.25);
    p.xy *= rot(sin(T*.5)*.25+.25);

  }
}

void light(inout vec3 col, in vec3 p, in vec3 rd, float fog, float side) {
  vec3 n = norm(p),
  lp = vec3(0, -2, 3.*side-side*(S(.0, 1.,sin(T*.5)*.5+.5)*2.-1.)),
  l = normalize(lp-p),
  r = reflect(rd, n);

  float
  diff = clamp(dot(l, n),.0, 1.)*.5+.5,
  fres = pow(S(.0, 1.,max(.0, dot(r, n))), 4.),
  fade = (1./dot(p-lp, p-lp));

  col += fog*tint*diff*fres*fade;
}

void main(void) {
  vec2 uv = (
    gl_FragCoord.xy-.5*resolution
  )/min(resolution.x, resolution.y);

  vec3 col = vec3(0),
  ro = vec3(0, 0, (P > 0?.0: 2.*exp(-cos(T*.25))-2.)-6.5),
  rd = normalize(vec3(uv, 1));

  cam(ro);
  cam(rd);

  vec3 p = ro;

  const float steps = 400., maxd = 400.;
  float dd = .0,
  ii = .0,
  at = .0;

  for (float i = .0; i < steps; i++, ii = i) {
    float d = map(p);

    if (d < 1e-3) {
      break;
    }
    if (dd > maxd) {
      dd = maxd;
      break;
    }

    p += rd*d;
    dd += d;
    at += .075*(.075/dd);
  }

  if (mat == 1.) {

    float fog = pow(S(1.,.0, dd/maxd), 4.);

    light(col, p, rd, fog, 1.);
    light(col, p, rd, fog, -1.);

  } else {

    col += ii/400.;
    col += pow(5.*at, 2.);
    col += pow(col, vec3(3))*(S(.0, 1.,sin(T*.5)*.5+.5)*75.);

    float c = S(1.,.0, S(.95,.9, (col.x+col.y+col.z)*.3));

    col = mix(col, tint*.95, c);
  }
  
  col += rnd(uv*T)*.25-(.2 * S(.0,1.,cos(ro.x*.5)*.5+.5));

  fragColor = vec4(col, 1);
}
`
let time
let buffer
let program
let touch
let resolution
let pointerCount
let vertices = []
let touching = false

function resize() {
    const { innerWidth: width, innerHeight: height } = window

    canvas.width = width * dpr
    canvas.height = height * dpr

    gl.viewport(0, 0, width * dpr, height * dpr)
}

function compile(shader, source) {
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader))
    }
}

function setup() {
    const vs = gl.createShader(gl.VERTEX_SHADER)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)

    program = gl.createProgram()

    compile(vs, vertexSource)
    compile(fs, fragmentSource)

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program))
    }

    vertices = [-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]

    buffer = gl.createBuffer()

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)

    const position = gl.getAttribLocation(program, "position")

    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    time = gl.getUniformLocation(program, "time")
    touch = gl.getUniformLocation(program, "touch")
    pointerCount = gl.getUniformLocation(program, "pointerCount")
    resolution = gl.getUniformLocation(program, "resolution")
}

function draw(now) {
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)

    gl.uniform1f(time, now * 0.001)
    gl.uniform2f(touch, ...getTouches())
    gl.uniform1i(pointerCount, touches.size)
    gl.uniform2f(resolution, canvas.width, canvas.height)
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length * 0.5)
}

function getTouches() {
    if (!touches.size) {
        return [0, 0]
    }

    for (let [id, t] of touches) {
        const result = [dpr * t.clientX, dpr * (innerHeight - t.clientY)]

        return result
    }
}

function loop(now) {
    draw(now)
    requestAnimationFrame(loop)
}

function init() {
    setup()
    resize()
    loop(0)
}

document.body.onload = init
window.onresize = resize
canvas.onpointerdown = e => {
    touching = true
    touches.set(e.pointerId, e)
}
canvas.onpointermove = e => {
    if (!touching) return
    touches.set(e.pointerId, e)
}
canvas.onpointerup = e => {
    touching = false
    touches.clear()
}
canvas.onpointerout = e => {
    touching = false
    touches.clear()
}