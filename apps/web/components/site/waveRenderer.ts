import { createWaveGeometry } from './waveGeometry'

// The supplied reference uses a folded sheet, three spatial twists and slow
// noise displacement. Keep those mechanics in a small, isolated WebGL pass.
const vertexSource = `#version 300 es
precision highp float;
in vec3 a_position;
in vec2 a_uv;
uniform float u_time;
uniform vec2 u_size;
uniform vec3 u_rotation;
uniform vec2 u_position;
out vec2 v_uv;

vec2 gradient(vec2 p) {
  float angle = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453) * 6.2831853;
  return vec2(cos(angle), sin(angle));
}
// Simplex lattice, following Stefan Gustavson's Simplex Noise Demystified.
float noise(vec2 p) {
  vec2 cell = floor(p + (p.x + p.y) * 0.366025404);
  vec2 a = p - cell + (cell.x + cell.y) * 0.211324865;
  vec2 corner = a.x > a.y ? vec2(1, 0) : vec2(0, 1);
  vec2 b = a - corner + 0.211324865;
  vec2 c = a - 0.57735027;
  vec3 falloff = max(0.5 - vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
  return dot(falloff * falloff * falloff, vec3(dot(a,gradient(cell)), dot(b,gradient(cell+corner)), dot(c,gradient(cell+1.0)))) * 32.99;
}
vec3 rotateAround(vec3 p, vec3 axis, float angle) {
  axis = normalize(axis);
  return p * cos(angle) + cross(axis, p) * sin(angle) + axis * dot(axis, p) * (1.0 - cos(angle));
}
float falloff(float position, float power) {
  return exp2(-exp2(power) * pow(position, power));
}
void main() {
  v_uv = a_uv;
  vec3 p = a_position;
  float phase = (17500.0 + u_time) * 0.00004;
  p.y -= 7.821 * noise(vec2(p.x * 0.005831 + phase, p.z * 0.016001 + phase));
  p = rotateAround(p, vec3(0.5,0,0.5), 0.41 * falloff(a_uv.x,0.7));
  p = rotateAround(p, vec3(0,0.5,0.5), -0.65 * falloff(a_uv.y,3.63));
  p = rotateAround(p, vec3(0.5,0,0.5), -0.58 * falloff(a_uv.y,3.95));
  p *= vec3(9,8,5);
  p = rotateAround(p, vec3(0,0,1), u_rotation.z);
  p = rotateAround(p, vec3(0,1,0), u_rotation.y);
  p = rotateAround(p, vec3(1,0,0), u_rotation.x);
  p.xy += u_position;
  // Orthographic camera, with the reference's slight horizontal perspective.
  p.x -= p.z * 0.02;
  gl_Position = vec4(p.xy / (u_size * 0.5), -p.z / 10000.0, 1.0);
}`

const fragmentSource = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec3 u_primary;
uniform vec2 u_size;
out vec4 outColor;
float grain(vec2 p) { return fract(sin(dot(p,vec2(12.9898,78.233))) * 43758.5453); }
void main() {
  // A two-dimensional blue palette lets the front and reverse of the fold
  // catch different colours, rather than painting a flat gradient on screen.
  vec3 ice = mix(u_primary, vec3(0.80,0.96,1.0), 0.83);
  vec3 blue = mix(u_primary, vec3(0.42,0.71,1.0), 0.38);
  vec3 violet = mix(u_primary, vec3(0.67,0.57,0.96), 0.76);
  vec3 color = mix(ice,blue,smoothstep(0.06,0.48,v_uv.x));
  color = mix(color,violet,smoothstep(0.48,0.85,v_uv.x));
  color = mix(color,ice,smoothstep(0.84,1.0,v_uv.x));
  color = mix(color,vec3(1.0),0.12 + smoothstep(0.25,0.96,v_uv.y) * 0.25);
  float slope = clamp(0.5 + dFdy(v_uv.y) * u_size.y * 0.99,0.0,1.0);
  float glow = smoothstep(0.0,0.834,pow(slope,0.806));
  float fibers = sin(v_uv.x * 3400.0 + sin(v_uv.y * 19.0) * 2.0) * 0.5 + 0.5;
  float fineFibers = grain(vec2(floor(v_uv.x * 2200.0),floor(v_uv.y * 16.0)));
  color += (1.0 - glow) * 0.25;
  color += (fibers * 0.025 + fineFibers * 0.028) * glow;
  color += (grain(gl_FragCoord.xy) - 0.5) * 0.012;
  outColor = vec4(clamp(color,0.0,1.0),1.0);
}`

export interface WaveRenderer {
  draw: (time: number) => void
  resize: () => void
  dispose: () => void
}

export function createWaveRenderer(canvas: HTMLCanvasElement): WaveRenderer | null {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  if (!gl) return null
  const shaders: WebGLShader[] = []
  const buffers: WebGLBuffer[] = []
  const program = gl.createProgram()
  const vao = gl.createVertexArray()
  const dispose = () => {
    buffers.forEach((buffer) => gl.deleteBuffer(buffer))
    shaders.forEach((shader) => gl.deleteShader(shader))
    gl.deleteVertexArray(vao)
    gl.deleteProgram(program)
  }
  if (!program || !vao) {
    dispose()
    return null
  }
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) {
      dispose()
      return null
    }
    shaders.push(shader)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      dispose()
      return null
    }
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose()
    return null
  }
  gl.useProgram(program)
  gl.bindVertexArray(vao)
  const geometry = createWaveGeometry()
  const vertices = gl.createBuffer()
  const indices = gl.createBuffer()
  if (!vertices || !indices) {
    if (vertices) gl.deleteBuffer(vertices)
    if (indices) gl.deleteBuffer(indices)
    dispose()
    return null
  }
  buffers.push(vertices, indices)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'a_position')
  const uv = gl.getAttribLocation(program, 'a_uv')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0)
  gl.enableVertexAttribArray(uv)
  gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12)
  const uniforms = Object.fromEntries(
    ['u_time', 'u_size', 'u_primary', 'u_rotation', 'u_position'].map((key) => [
      key,
      gl.getUniformLocation(program, key),
    ]),
  )
  const primary = getComputedStyle(canvas).getPropertyValue('--seal').trim().replace('#', '')
  const rgb = [0, 2, 4].map((offset) => parseInt(primary.slice(offset, offset + 2), 16) / 255)
  gl.uniform3f(uniforms.u_primary, rgb[0], rgb[1], rgb[2])
  gl.enable(gl.DEPTH_TEST)
  gl.clearColor(0, 0, 0, 0)
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.uniform2f(uniforms.u_size, width, height)
    const small = window.innerWidth < 640
    const medium = window.innerWidth < 1264
    gl.uniform3f(
      uniforms.u_rotation,
      small ? -0.5 : medium ? -0.64 : -0.44959265,
      -0.11759265,
      small ? 1.64 : medium ? 1.68 : 1.87440735,
    )
    gl.uniform2f(uniforms.u_position, small ? 320 : medium ? 525 : 380, small ? -315 : -301.7)
  }
  resize()
  return {
    resize,
    draw(time) {
      gl.uniform1f(uniforms.u_time, time)
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0)
    },
    dispose,
  }
}
