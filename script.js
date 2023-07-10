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
 

