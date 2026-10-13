// WebGL2 renderer for the chart diorama. The painted 2D chart layer is
// draped over a displaced terrain mesh, the sea animates in place, and
// vessels, harbors, and lighthouses are instanced low-poly meshes lit in the
// same palette as the old 2D art. A final composite pass reapplies the
// exploration fog, night atmosphere, scene light washes, and vignette so the
// 3D view keeps the hand-painted presentation of the flat chart.

const VERTEX_STRIDE = 10; // pos(3) normal(3) color(3) sway(1)
const TERRAIN_STRIDE = 6; // pos(3) uv(2) landness(1)

const TERRAIN_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in float a_land;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform float u_offsetX;
uniform float u_time;
uniform float u_waveAmp;
out vec2 v_uv;
out float v_land;
out vec3 v_world;
void main() {
  float sea = 1.0 - a_land;
  float wave =
    sin(a_pos.x * 0.045 + u_time * 1.5 + a_pos.y * 0.021) * 0.6 +
    sin(a_pos.y * 0.062 + u_time * 1.05 + a_pos.x * 0.016) * 0.4;
  vec3 world = vec3(a_pos.x + u_offsetX, a_pos.y, a_pos.z + wave * u_waveAmp * sea);
  v_world = world;
  v_uv = a_uv;
  v_land = a_land;
  gl_Position = u_proj * u_view * vec4(world, 1.0);
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in float v_land;
in vec3 v_world;
uniform sampler2D u_map;
uniform sampler2D u_explored;
uniform vec3 u_lightDir;
uniform vec2 u_windDir;
uniform vec2 u_worldSize;
uniform vec2 u_shipPos;
uniform float u_time;
uniform float u_daylight;
uniform float u_storm;
uniform float u_ice;
uniform float u_relief;
uniform float u_sightRadius;
uniform vec3 u_fogColor;
uniform float u_hasFog;
out vec4 frag;
void main() {
  vec3 color = texture(u_map, v_uv).rgb;
  if (v_land < 0.5) {
    // Painted water gains a shallow wash near shores and slow light bands
    // that travel downwind, echoing the old sea surface renderer.
    float shallow = smoothstep(0.42, 0.02, v_land);
    color = mix(color, color * vec3(0.93, 1.0, 0.99), shallow * 0.3);
    float stripe = sin(dot(v_world.xy, u_windDir) * 0.055 - u_time * 0.4);
    float crest = smoothstep(0.72, 1.0, stripe);
    color += crest * 0.055 * u_daylight * (1.0 - u_storm * 0.7);
    color = mix(color, color * vec3(0.96, 0.99, 1.0), crest * 0.15);
  } else {
    // Relief lighting straight from the displaced geometry, softened so the
    // painted pigments keep their watercolor character.
    vec3 normal = normalize(cross(dFdx(v_world), dFdy(v_world)));
    if (normal.z < 0.0) normal = -normal;
    float diffuse = max(0.0, dot(normal, u_lightDir));
    float shade = mix(1.0, 0.62 + diffuse * 0.55, u_relief * smoothstep(0.5, 0.95, v_land));
    color *= shade;
    // Sea cliffs read darker just above the waterline.
    float cliff = (1.0 - smoothstep(0.0, 9.0, v_world.z)) * smoothstep(0.5, 0.8, v_land);
    color *= mix(1.0, 0.78, cliff);
  }
  // Winter sea ice: cold latitudes whiten the water and the shore shelf.
  float iceMask = u_ice * (0.4 + 0.45 * (1.0 - v_land));
  color = mix(color, vec3(0.9, 0.92, 0.9) * (color.g + 0.32), iceMask);
  // Exploration fog in world space: surveyed water fades back in through the
  // explored mask, and the sight radius lifts the fog around the vessel.
  if (u_hasFog > 0.5) {
    vec2 worldUv = vec2(v_world.x / u_worldSize.x, -v_world.y / u_worldSize.y);
    float surveyed = texture(u_explored, worldUv).a;
    float sight = 1.0 - smoothstep(u_sightRadius * 0.6, u_sightRadius, distance(v_world.xy, u_shipPos));
    float reveal = clamp(max(surveyed, sight), 0.0, 1.0);
    float grain = texture(u_explored, worldUv * 7.0).r;
    vec3 fogged = u_fogColor + (grain - 0.5) * 0.05;
    color = mix(color, fogged, (1.0 - reveal) * 0.88);
  }
  frag = vec4(color, 1.0);
}`;

const VESSEL_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec3 a_pos;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec3 a_color;
layout(location = 3) in float a_sway;
layout(location = 4) in mat4 i_model;
layout(location = 8) in vec3 i_tint;
layout(location = 9) in vec2 i_motion;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform float u_flutter;
uniform float u_time;
uniform float u_outline;
out vec3 v_normal;
out vec3 v_color;
void main() {
  vec3 pos = a_pos;
  if (u_outline > 0.0) {
    pos += a_normal * u_outline;
  }
  pos.x -= a_sway * u_flutter * sin(u_time * 6.5 + i_motion.x) * 0.55;
  vec4 world = i_model * vec4(pos, 1.0);
  v_normal = normalize(mat3(i_model) * a_normal);
  v_color = a_color * i_tint;
  gl_Position = u_proj * u_view * world;
}`;

const VESSEL_FS = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_color;
uniform vec3 u_lightDir;
uniform vec3 u_lightTint;
uniform float u_outline;
uniform vec3 u_outlineColor;
uniform float u_ambient;
out vec4 frag;
void main() {
  if (u_outline > 0.0) {
    frag = vec4(u_outlineColor, 1.0);
    return;
  }
  vec3 normal = normalize(v_normal);
  float diffuse = max(0.0, dot(normal, u_lightDir));
  float light = u_ambient + diffuse * 0.62;
  frag = vec4(v_color * light * u_lightTint, 1.0);
}`;

const BILLBOARD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec3 i_pos;
layout(location = 2) in vec4 i_shape;  // width, height, rotation, flat
layout(location = 3) in vec4 i_uv;     // u0, v0, cellW, cellH
layout(location = 4) in vec4 i_color;
uniform mat4 u_view;
uniform mat4 u_proj;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
out vec2 v_uv;
out vec4 v_color;
out vec3 v_world;
void main() {
  float c = cos(i_shape.z);
  float s = sin(i_shape.z);
  vec2 rotated = vec2(a_corner.x * c - a_corner.y * s, a_corner.x * s + a_corner.y * c);
  vec2 size = vec2(i_shape.x, i_shape.y) * (a_corner - 0.5);
  vec3 world;
  if (i_shape.w > 0.5) {
    world = vec3(i_pos.x + rotated.x * i_shape.x, i_pos.y + rotated.y * i_shape.y, i_pos.z);
  } else {
    world = i_pos + u_camRight * size.x * 2.0 + u_camUp * size.y * 2.0;
  }
  v_world = world;
  v_uv = i_uv.xy + a_corner * i_uv.zw;
  v_color = i_color;
  gl_Position = u_proj * u_view * vec4(world, 1.0);
}`;

const BILLBOARD_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
in vec3 v_world;
uniform sampler2D u_atlas;
uniform sampler2D u_fogMask;
uniform sampler2D u_explored;
uniform vec2 u_fogResolution;
uniform float u_fogHide;
uniform float u_fogInvert;
uniform float u_hasFog;
uniform vec2 u_worldSize;
uniform vec2 u_shipPos;
uniform float u_sightRadius;
out vec4 frag;
void main() {
  vec4 texel = texture(u_atlas, v_uv);
  float alpha = texel.a * v_color.a;
  if (u_fogHide > 0.0 && u_fogResolution.x > 0.0) {
    float reveal = texture(u_fogMask, gl_FragCoord.xy / u_fogResolution).r;
    alpha *= mix(1.0, reveal, u_fogHide);
  }
  if (u_hasFog > 0.5 && u_fogInvert > 0.0 && u_worldSize.x > 0.0) {
    // Fog banks drift only over unsurveyed water.
    vec2 worldUv = vec2(v_world.x / u_worldSize.x, -v_world.y / u_worldSize.y);
    float surveyed = texture(u_explored, worldUv).a;
    float sight = 1.0 - smoothstep(u_sightRadius * 0.6, u_sightRadius, distance(v_world.xy, u_shipPos));
    alpha *= 1.0 - clamp(max(surveyed, sight), 0.0, 1.0);
  }
  if (alpha < 0.004) discard;
  frag = vec4(texel.rgb * v_color.rgb, alpha);
}`;

const SCREEN_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 i_rect;
layout(location = 2) in vec4 i_color;
layout(location = 3) in vec4 i_uvSpan;
uniform vec2 u_viewport;
out vec2 v_uv;
out vec4 v_color;
void main() {
  vec2 pixels = i_rect.xy + a_corner * i_rect.zw;
  vec2 ndc = vec2(pixels.x / u_viewport.x * 2.0 - 1.0, 1.0 - pixels.y / u_viewport.y * 2.0);
  v_uv = vec2(a_corner.x * i_uvSpan.x, a_corner.y * i_uvSpan.y);
  v_color = i_color;
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const SCREEN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec4 v_color;
uniform sampler2D u_atlas;
uniform vec4 u_uvRect;
out vec4 frag;
void main() {
  vec4 texel = texture(u_atlas, u_uvRect.xy + v_uv * u_uvRect.zw);
  float alpha = texel.a * v_color.a;
  if (alpha < 0.004) discard;
  frag = vec4(texel.rgb * v_color.rgb, alpha);
}`;

const PRESENT_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_corner;
out vec2 v_uv;
void main() {
  v_uv = a_corner * 0.5 + 0.5;
  gl_Position = vec4(a_corner, 0.0, 1.0);
}`;

const PRESENT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_fogMask;
uniform sampler2D u_grain;
uniform float u_hasFog;
uniform vec3 u_fogTop;
uniform vec3 u_fogMid;
uniform vec3 u_fogBottom;
uniform float u_fogAlpha;
uniform float u_grainAlpha;
uniform float u_daylight;
uniform float u_dusk;
uniform float u_storm;
uniform float u_night;
uniform float u_moon;
uniform vec2 u_moonUv;
uniform vec2 u_shipUv;
uniform vec2 u_shipPx;
uniform float u_sharpRadius;
uniform float u_washRadius;
uniform float u_starAlpha;
uniform float u_time;
out vec4 frag;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec3 color = texture(u_scene, v_uv).rgb;

  // Chart-clarity falloff: the water near the ship stays crisp while the
  // horizon softens, echoing the old sight-radius washes.
  float distancePx = length(v_uv * u_shipPx * 2.0 - u_shipUv * u_shipPx * 2.0);
  float sharp = 1.0 - smoothstep(u_sharpRadius * 0.55, u_sharpRadius, distancePx);
  float wash = smoothstep(u_sharpRadius, u_washRadius, distancePx);
  color = mix(color, color * 0.94 + vec3(0.045, 0.04, 0.028), sharp * 0.5);
  color = mix(color, color * vec3(0.94, 0.95, 0.96), wash * (0.16 + u_storm * 0.12));

  // Stars wheel out over the unexplored night.
  if (u_starAlpha > 0.01) {
    vec2 grid = v_uv * vec2(150.0, 84.0);
    vec2 cell = floor(grid);
    float h = hash21(cell);
    if (h > 0.968) {
      vec2 within = fract(grid) - vec2(fract(h * 13.7), fract(h * 7.3));
      float twinkle = 0.5 + 0.5 * sin(u_time * (1.0 + h * 2.4) + h * 40.0);
      color += vec3(0.82, 0.88, 1.0) * smoothstep(0.09, 0.0, length(within)) * twinkle * u_starAlpha;
    }
  }

  // Exploration fog: unexplored water reads as hazy chart paper.
  if (u_hasFog > 0.5) {
    float reveal = texture(u_fogMask, v_uv).r;
    float hidden = 1.0 - reveal;
    if (hidden > 0.001) {
      vec3 fogColor = v_uv.y < 0.55
        ? mix(u_fogMid, u_fogTop, smoothstep(0.55, 0.0, v_uv.y))
        : mix(u_fogMid, u_fogBottom, smoothstep(0.55, 1.0, v_uv.y));
      fogColor += (texture(u_grain, v_uv * 7.0).r - 0.5) * 0.06;
      color = mix(color, fogColor, hidden * u_fogAlpha);
    }
  }

  // Scene light washes, replicating the 2D pass formulas.
  color += vec3(0.749, 0.886, 0.965) * (u_daylight * (1.0 - u_storm) * 0.075);
  color += vec3(0.882, 0.455, 0.227) * (u_dusk * 0.16);
  color = mix(color, color * vec3(0.71, 0.82, 0.95) + vec3(0.03, 0.06, 0.1), u_storm * 0.11);

  // Night settles deep blue over the scene; the ship's surroundings keep
  // their warm readability and the moon lifts the middle distance.
  if (u_night > 0.01) {
    float near = 1.0 - smoothstep(140.0, 470.0, distancePx);
    float darkness = mix(1.0, 0.4 + u_moon * 0.16, (1.0 - near * 0.8) * u_night);
    vec3 nightTint = vec3(0.62 + near * 0.12, 0.71, 0.96);
    color = mix(color, color * darkness * nightTint + vec3(0.012, 0.02, 0.045), u_night);
  }
  if (u_moon > 0.01) {
    vec2 toMoon = (v_uv - u_moonUv) * vec2(u_shipPx.x / max(1.0, u_shipPx.y), 1.0);
    float moonDist = length(toMoon);
    color += vec3(0.93, 0.91, 0.82) * (smoothstep(0.035, 0.028, moonDist) * 0.85 + exp(-moonDist * 16.0) * 0.3) * u_moon;
  }

  // Vignette from the old radial gradient.
  float radius = length((v_uv - 0.5) * vec2(1.35, 1.0));
  color *= 1.0 - smoothstep(0.32, 0.85, radius) * 0.32;

  if (u_grainAlpha > 0.0) {
    color += (texture(u_grain, v_uv * 5.0).g - 0.5) * u_grainAlpha;
  }
  frag = vec4(color, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

function program(gl, vsSource, fsSource) {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
  const handle = gl.createProgram();
  gl.attachShader(handle, vs);
  gl.attachShader(handle, fs);
  gl.linkProgram(handle);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(handle);
    gl.deleteProgram(handle);
    throw new Error(`program link failed: ${log}`);
  }
  const uniforms = new Map();
  const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(handle, i);
    const name = info.name.replace(/\[0\]$/, "");
    uniforms.set(name, gl.getUniformLocation(handle, name));
  }
  return {
    handle,
    uniform(name) {
      return uniforms.get(name) ?? null;
    },
  };
}

function buffer(gl, target, data, usage = gl.STATIC_DRAW) {
  const handle = gl.createBuffer();
  gl.bindBuffer(target, handle);
  gl.bufferData(target, data, usage);
  return handle;
}

function textureFromCanvas(gl, source, { wrapS, wrapT, mipmap = true } = {}) {
  const handle = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, handle);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS ?? gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT ?? gl.CLAMP_TO_EDGE);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  return handle;
}

function radialSprite(size, stops) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  const gradient = c.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.02,
    size / 2,
    size / 2,
    size / 2,
  );
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  return canvas;
}

function streakSprite(width, height, color, blur) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d");
  c.filter = `blur(${blur}px)`;
  c.strokeStyle = color;
  c.lineWidth = width * 0.16;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(width / 2, height * 0.08);
  c.lineTo(width / 2, height * 0.92);
  c.stroke();
  return canvas;
}

function foamCrestSprite(size) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d");
  c.strokeStyle = "rgba(240, 246, 240, 0.85)";
  c.lineWidth = size * 0.05;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(size * 0.12, size * 0.6);
  c.quadraticCurveTo(size * 0.34, size * 0.3, size * 0.52, size * 0.56);
  c.quadraticCurveTo(size * 0.7, size * 0.78, size * 0.9, size * 0.5);
  c.stroke();
  c.strokeStyle = "rgba(64, 88, 88, 0.5)";
  c.lineWidth = size * 0.035;
  c.beginPath();
  c.moveTo(size * 0.16, size * 0.72);
  c.quadraticCurveTo(size * 0.42, size * 0.46, size * 0.62, size * 0.68);
  c.stroke();
  return canvas;
}

// Lighthouse beam: a bright core feathering toward its far end.
function beamSprite(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext("2d");
  const gradient = c.createLinearGradient(0, 0, size, 0);
  gradient.addColorStop(0, "rgba(255, 236, 190, 0.9)");
  gradient.addColorStop(0.3, "rgba(255, 230, 170, 0.5)");
  gradient.addColorStop(1, "rgba(255, 224, 150, 0)");
  c.fillStyle = gradient;
  c.fillRect(0, size * 0.34, size, size * 0.32);
  // Vertical feathering.
  const feather = c.createLinearGradient(0, size * 0.34, 0, size * 0.66);
  feather.addColorStop(0, "rgba(0,0,0,1)");
  feather.addColorStop(0.5, "rgba(0,0,0,0)");
  feather.addColorStop(1, "rgba(0,0,0,1)");
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = feather;
  c.fillRect(0, size * 0.3, size, size * 0.4);
  return canvas;
}

const ATLAS_CELLS = {
  cloudLight: [0, 0],
  cloudDark: [1, 0],
  mist: [2, 0],
  glow: [3, 0],
  crest: [0, 1],
  streak: [1, 1],
  moon: [2, 1],
  foam: [3, 1],
  beam: [0, 2],
};
const CELL = 1 / 4; // 4x4 atlas grid

function buildAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d");
  const stamp = (cell, source, alpha = 1) => {
    c.globalAlpha = alpha;
    c.drawImage(source, cell[0] * 128, cell[1] * 128);
    c.globalAlpha = 1;
  };
  stamp(
    ATLAS_CELLS.cloudLight,
    radialSprite(128, [
      [0, "rgba(246, 240, 220, 0.95)"],
      [0.55, "rgba(238, 230, 208, 0.55)"],
      [1, "rgba(236, 228, 205, 0)"],
    ]),
  );
  stamp(
    ATLAS_CELLS.cloudDark,
    radialSprite(128, [
      [0, "rgba(128, 130, 130, 0.95)"],
      [0.55, "rgba(120, 124, 124, 0.5)"],
      [1, "rgba(112, 116, 116, 0)"],
    ]),
  );
  stamp(
    ATLAS_CELLS.mist,
    radialSprite(128, [
      [0, "rgba(229, 228, 201, 0.55)"],
      [0.45, "rgba(204, 215, 194, 0.26)"],
      [1, "rgba(189, 206, 188, 0)"],
    ]),
  );
  stamp(
    ATLAS_CELLS.glow,
    radialSprite(128, [
      [0, "rgba(255, 226, 158, 1)"],
      [0.18, "rgba(255, 219, 140, 0.62)"],
      [0.5, "rgba(255, 208, 118, 0.2)"],
      [1, "rgba(255, 198, 96, 0)"],
    ]),
  );
  stamp(ATLAS_CELLS.crest, foamCrestSprite(128));
  stamp(
    ATLAS_CELLS.streak,
    streakSprite(128, 128, "rgba(228, 238, 240, 0.8)", 1.5),
  );
  stamp(
    ATLAS_CELLS.moon,
    radialSprite(128, [
      [0, "rgba(240, 234, 214, 1)"],
      [0.3, "rgba(238, 232, 210, 0.95)"],
      [0.34, "rgba(238, 232, 210, 0.5)"],
      [1, "rgba(238, 232, 210, 0)"],
    ]),
  );
  stamp(
    ATLAS_CELLS.foam,
    radialSprite(128, [
      [0, "rgba(248, 244, 230, 0.9)"],
      [0.4, "rgba(240, 238, 222, 0.5)"],
      [1, "rgba(238, 236, 220, 0)"],
    ]),
    0.8,
  );
  stamp(ATLAS_CELLS.beam, beamSprite(128));
  return canvas;
}

function buildGrainTile() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const c = canvas.getContext("2d");
  const imageData = c.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const x = i % 128;
    const y = (i / 128) | 0;
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const value = n - Math.floor(n);
    const dark = value > 0.88 ? 1 : 0;
    const light = value < 0.09 ? 1 : 0;
    imageData.data[i * 4] = 70 + light * 160;
    imageData.data[i * 4 + 1] = Math.floor(110 + value * 40);
    imageData.data[i * 4 + 2] = 52 + light * 110;
    imageData.data[i * 4 + 3] = dark ? 90 : light ? 120 : 30;
  }
  c.putImageData(imageData, 0, 0);
  return canvas;
}

function mat4Compose(out, x, y, z, heading, roll, pitch, scale) {
  // Ship-local axes: forward +x, port +y, up +z. Roll leans about local x,
  // pitch about local y, then heading turns the whole frame about world z.
  const ch = Math.cos(heading);
  const sh = Math.sin(heading);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const localX = [cr, sr * sp, sr * cp];
  const localY = [0, cp, -sp];
  const localZ = [-sr, cr * sp, cr * cp];
  const m = out;
  m[0] = (localX[0] * ch - localX[1] * sh) * scale;
  m[1] = (localX[1] * ch + localX[0] * sh) * scale;
  m[2] = localX[2] * scale;
  m[3] = 0;
  m[4] = (localY[0] * ch - localY[1] * sh) * scale;
  m[5] = (localY[1] * ch + localY[0] * sh) * scale;
  m[6] = localY[2] * scale;
  m[7] = 0;
  m[8] = (localZ[0] * ch - localZ[1] * sh) * scale;
  m[9] = (localZ[1] * ch + localZ[0] * sh) * scale;
  m[10] = localZ[2] * scale;
  m[11] = 0;
  m[12] = x;
  m[13] = y;
  m[14] = z;
  m[15] = 1;
  return m;
}

const INSTANCE_FLOATS = 16; // billboard/screen quads
const VESSEL_INSTANCE_FLOATS = 22; // mat4 + tint(3) + pad + phase(2)
const BILLBOARD_CAPACITY = 4096;
const SCREEN_CAPACITY = 768;

export function createWorldRenderer({ canvas }) {
  const gl = canvas.getContext("webgl2", {
    antialias: true,
    alpha: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const terrainProgram = program(gl, TERRAIN_VS, TERRAIN_FS);
  const vesselProgram = program(gl, VESSEL_VS, VESSEL_FS);
  const billboardProgram = program(gl, BILLBOARD_VS, BILLBOARD_FS);
  const screenProgram = program(gl, SCREEN_VS, SCREEN_FS);
  const presentProgram = program(gl, PRESENT_VS, PRESENT_FS);

  const atlasTexture = textureFromCanvas(gl, buildAtlas());
  const grainTexture = textureFromCanvas(gl, buildGrainTile(), {
    wrapS: gl.REPEAT,
    wrapT: gl.REPEAT,
    mipmap: false,
  });
  const mapTexture = gl.createTexture();
  let mapTextureReady = false;
  const fogMaskTexture = gl.createTexture();
  let fogMaskReady = false;
  let fogMaskSize = [0, 0];
  const exploredTexture = gl.createTexture();
  let exploredReady = false;

  let sceneTexture = null;
  let depthBuffer = null;
  let sceneFramebuffer = null;
  let sceneWidth = 0;
  let sceneHeight = 0;

  const cornerBuffer = buffer(
    gl,
    gl.ARRAY_BUFFER,
    new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]),
  );
  const fullscreenBuffer = buffer(
    gl,
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
  );

  const billboardData = new Float32Array(BILLBOARD_CAPACITY * INSTANCE_FLOATS);
  const screenData = new Float32Array(SCREEN_CAPACITY * INSTANCE_FLOATS);
  const billboardInstanceBuffer = gl.createBuffer();
  const screenInstanceBuffer = gl.createBuffer();
  const billboardVao = gl.createVertexArray();
  gl.bindVertexArray(billboardVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, billboardInstanceBuffer);
  const bbAttr = (index, size, offset) => {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(
      index,
      size,
      gl.FLOAT,
      false,
      INSTANCE_FLOATS * 4,
      offset,
    );
    gl.vertexAttribDivisor(index, 1);
  };
  bbAttr(1, 3, 0);
  bbAttr(2, 4, 16);
  bbAttr(3, 4, 32);
  bbAttr(4, 4, 48);
  gl.bindVertexArray(null);

  const screenVao = gl.createVertexArray();
  gl.bindVertexArray(screenVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, screenInstanceBuffer);
  const scAttr = (index, size, offset) => {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(
      index,
      size,
      gl.FLOAT,
      false,
      INSTANCE_FLOATS * 4,
      offset,
    );
    gl.vertexAttribDivisor(index, 1);
  };
  scAttr(1, 4, 0);
  scAttr(2, 4, 16);
  scAttr(3, 4, 32);
  gl.bindVertexArray(null);

  const meshes = new Map();

  function uploadVesselMesh(key, mesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = buffer(gl, gl.ARRAY_BUFFER, mesh.data);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VERTEX_STRIDE * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, VERTEX_STRIDE * 4, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, VERTEX_STRIDE * 4, 24);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, VERTEX_STRIDE * 4, 36);
    // Per-instance model matrix (slots 4-7), tint (8), motion (9).
    const instanceVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, instanceVbo);
    const stride = VESSEL_INSTANCE_FLOATS * 4;
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(4 + i);
      gl.vertexAttribPointer(4 + i, 4, gl.FLOAT, false, stride, i * 16);
      gl.vertexAttribDivisor(4 + i, 1);
    }
    gl.enableVertexAttribArray(8);
    gl.vertexAttribPointer(8, 3, gl.FLOAT, false, stride, 64);
    gl.vertexAttribDivisor(8, 1);
    gl.enableVertexAttribArray(9);
    gl.vertexAttribPointer(9, 2, gl.FLOAT, false, stride, 76);
    gl.vertexAttribDivisor(9, 1);
    gl.bindVertexArray(null);
    const entry = { vao, vbo, instanceVbo, count: mesh.vertexCount };
    meshes.set(key, entry);
    return entry;
  }

  function setTerrainMesh(mesh) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = buffer(gl, gl.ARRAY_BUFFER, mesh.positions);
    const indexBuffer = buffer(gl, gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, TERRAIN_STRIDE * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, TERRAIN_STRIDE * 4, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, TERRAIN_STRIDE * 4, 20);
    gl.bindVertexArray(null);
    meshes.set("terrain", {
      vao,
      vbo,
      indexBuffer,
      count: mesh.indices.length,
    });
  }

  function ensureSceneTarget(width, height) {
    if (sceneFramebuffer && sceneWidth === width && sceneHeight === height)
      return;
    if (sceneTexture) gl.deleteTexture(sceneTexture);
    if (depthBuffer) gl.deleteRenderbuffer(depthBuffer);
    if (sceneFramebuffer) gl.deleteFramebuffer(sceneFramebuffer);
    sceneTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      gl.DEPTH_COMPONENT24,
      width,
      height,
    );
    sceneFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      sceneTexture,
      0,
    );
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depthBuffer,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    sceneWidth = width;
    sceneHeight = height;
  }

  function resize(width, height, pixelRatio) {
    canvas.width = Math.max(1, Math.floor(width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(height * pixelRatio));
    ensureSceneTarget(canvas.width, canvas.height);
  }

  function updateMapTexture(source) {
    gl.bindTexture(gl.TEXTURE_2D, mapTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    mapTextureReady = true;
  }

  function updateFogMask(source, width, height) {
    gl.bindTexture(gl.TEXTURE_2D, fogMaskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    fogMaskReady = true;
    fogMaskSize = [width, height];
  }

  function updateExploredTexture(source) {
    gl.bindTexture(gl.TEXTURE_2D, exploredTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    exploredReady = true;
  }

  // --- Frame rendering -----------------------------------------------------

  let instanceCursor = 0;
  function pushBillboard(params) {
    if (instanceCursor >= BILLBOARD_CAPACITY) return;
    const base = instanceCursor * INSTANCE_FLOATS;
    const data = billboardData;
    // GL world mirrors chart y (see the view-matrix note in camera3d).
    data[base] = params.x;
    data[base + 1] = -params.y;
    data[base + 2] = params.z ?? 0;
    data[base + 4] = params.width;
    data[base + 5] = params.height ?? params.width;
    data[base + 6] = -(params.rotation ?? 0);
    data[base + 7] = params.flat ? 1 : 0;
    const cell = ATLAS_CELLS[params.sprite] ?? ATLAS_CELLS.glow;
    data[base + 8] = cell[0] * CELL;
    data[base + 9] = cell[1] * CELL;
    data[base + 10] = CELL;
    data[base + 11] = CELL;
    data[base + 12] = params.color[0];
    data[base + 13] = params.color[1];
    data[base + 14] = params.color[2];
    data[base + 15] = params.alpha ?? 1;
    instanceCursor++;
  }

  let screenCursor = 0;
  function pushScreenSprite(params) {
    if (screenCursor >= SCREEN_CAPACITY) return;
    const base = screenCursor * INSTANCE_FLOATS;
    const data = screenData;
    data[base] = params.x;
    data[base + 1] = params.y;
    data[base + 2] = params.width;
    data[base + 3] = params.height ?? params.width;
    data[base + 4] = params.color[0];
    data[base + 5] = params.color[1];
    data[base + 6] = params.color[2];
    data[base + 7] = params.alpha ?? 1;
    data[base + 8] = params.uvSpanX ?? 0.25;
    data[base + 9] = params.uvSpanY ?? 0.25;
    screenCursor++;
  }

  function drawBillboards(
    view,
    proj,
    camRight,
    camUp,
    env,
    { additive, fogHide, fogInvert },
  ) {
    if (!instanceCursor) return;
    gl.useProgram(billboardProgram.handle);
    gl.uniformMatrix4fv(billboardProgram.uniform("u_view"), false, view);
    gl.uniformMatrix4fv(billboardProgram.uniform("u_proj"), false, proj);
    gl.uniform3fv(billboardProgram.uniform("u_camRight"), camRight);
    gl.uniform3fv(billboardProgram.uniform("u_camUp"), camUp);
    gl.uniform1i(billboardProgram.uniform("u_atlas"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fogMaskReady ? fogMaskTexture : atlasTexture);
    gl.uniform1i(billboardProgram.uniform("u_fogMask"), 1);
    gl.uniform2fv(billboardProgram.uniform("u_fogResolution"), fogMaskSize);
    gl.uniform1f(
      billboardProgram.uniform("u_fogHide"),
      fogMaskReady ? fogHide : 0,
    );
    gl.uniform1f(billboardProgram.uniform("u_fogInvert"), fogInvert ?? 0);
    gl.uniform1i(billboardProgram.uniform("u_explored"), 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(
      gl.TEXTURE_2D,
      exploredReady ? exploredTexture : atlasTexture,
    );
    gl.uniform1f(billboardProgram.uniform("u_hasFog"), env.hasFog);
    gl.uniform2fv(billboardProgram.uniform("u_worldSize"), env.worldSize);
    gl.uniform2fv(billboardProgram.uniform("u_shipPos"), env.shipPos);
    gl.uniform1f(billboardProgram.uniform("u_sightRadius"), env.sightRadius);
    gl.bindBuffer(gl.ARRAY_BUFFER, billboardInstanceBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      billboardData.subarray(0, instanceCursor * INSTANCE_FLOATS),
      gl.DYNAMIC_DRAW,
    );
    gl.bindVertexArray(billboardVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCursor);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(null);
    instanceCursor = 0;
  }

  function drawScreenSprites(viewportWidth, viewportHeight, additive) {
    if (!screenCursor) return;
    gl.useProgram(screenProgram.handle);
    gl.uniform2f(
      screenProgram.uniform("u_viewport"),
      viewportWidth,
      viewportHeight,
    );
    gl.uniform1i(screenProgram.uniform("u_atlas"), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.bindBuffer(gl.ARRAY_BUFFER, screenInstanceBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      screenData.subarray(0, screenCursor * INSTANCE_FLOATS),
      gl.DYNAMIC_DRAW,
    );
    gl.bindVertexArray(screenVao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, screenCursor);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(null);
    screenCursor = 0;
  }

  function drawVesselInstances(entry, instances, view, proj, env, outline) {
    if (!entry || !instances.length) return;
    const data = new Float32Array(instances.length * VESSEL_INSTANCE_FLOATS);
    const model = new Float32Array(16);
    instances.forEach((ship, i) => {
      const base = i * VESSEL_INSTANCE_FLOATS;
      mat4Compose(
        model,
        ship.x,
        -ship.y,
        ship.z ?? 0,
        -ship.angle,
        -(ship.roll ?? 0),
        ship.pitch ?? 0,
        ship.scale ?? 1,
      );
      data.set(model, base);
      data[base + 16] = ship.tint?.[0] ?? 1;
      data[base + 17] = ship.tint?.[1] ?? 1;
      data[base + 18] = ship.tint?.[2] ?? 1;
      data[base + 24] = ship.phase ?? 0;
      data[base + 25] = ship.flutter ?? 0;
    });
    gl.useProgram(vesselProgram.handle);
    gl.uniformMatrix4fv(vesselProgram.uniform("u_view"), false, view);
    gl.uniformMatrix4fv(vesselProgram.uniform("u_proj"), false, proj);
    gl.uniform3f(
      vesselProgram.uniform("u_lightDir"),
      env.lightDir[0],
      -env.lightDir[1],
      env.lightDir[2],
    );
    gl.uniform3fv(vesselProgram.uniform("u_lightTint"), env.lightTint);
    gl.uniform1f(vesselProgram.uniform("u_ambient"), env.ambient);
    gl.uniform1f(vesselProgram.uniform("u_flutter"), env.flutter);
    gl.uniform1f(vesselProgram.uniform("u_time"), env.time);
    gl.uniform1f(vesselProgram.uniform("u_outline"), outline ?? 0);
    gl.uniform3fv(vesselProgram.uniform("u_outlineColor"), env.outlineColor);
    gl.bindVertexArray(entry.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, entry.instanceVbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, entry.count, instances.length);
    gl.bindVertexArray(null);
  }

  function drawTerrain(view, proj, env) {
    const entry = meshes.get("terrain");
    if (!entry || !mapTextureReady) return;
    gl.useProgram(terrainProgram.handle);
    gl.uniformMatrix4fv(terrainProgram.uniform("u_view"), false, view);
    gl.uniformMatrix4fv(terrainProgram.uniform("u_proj"), false, proj);
    gl.uniform1f(terrainProgram.uniform("u_time"), env.time);
    gl.uniform1f(terrainProgram.uniform("u_waveAmp"), env.waveAmp);
    gl.uniform3f(
      terrainProgram.uniform("u_lightDir"),
      env.lightDir[0],
      -env.lightDir[1],
      env.lightDir[2],
    );
    gl.uniform2fv(terrainProgram.uniform("u_windDir"), env.windDir);
    gl.uniform1f(terrainProgram.uniform("u_daylight"), env.daylight);
    gl.uniform1f(terrainProgram.uniform("u_storm"), env.storm);
    gl.uniform1f(terrainProgram.uniform("u_ice"), env.ice);
    gl.uniform1f(terrainProgram.uniform("u_relief"), env.relief);
    gl.uniform1f(terrainProgram.uniform("u_hasFog"), env.hasFog);
    gl.uniform2fv(terrainProgram.uniform("u_worldSize"), env.worldSize);
    gl.uniform2f(
      terrainProgram.uniform("u_shipPos"),
      env.shipPos[0],
      -env.shipPos[1],
    );
    gl.uniform1f(terrainProgram.uniform("u_sightRadius"), env.sightRadius);
    gl.uniform3fv(terrainProgram.uniform("u_fogColor"), env.fogMid);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mapTexture);
    gl.uniform1i(terrainProgram.uniform("u_map"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, exploredReady ? exploredTexture : mapTexture);
    gl.uniform1i(terrainProgram.uniform("u_explored"), 1);
    gl.bindVertexArray(entry.vao);
    for (const offset of env.worldCopies) {
      gl.uniform1f(terrainProgram.uniform("u_offsetX"), offset);
      gl.drawElements(gl.TRIANGLES, entry.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }

  function present(scene, env, viewportWidth, viewportHeight) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(presentProgram.handle);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.uniform1i(presentProgram.uniform("u_scene"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fogMaskReady ? fogMaskTexture : sceneTexture);
    gl.uniform1i(presentProgram.uniform("u_fogMask"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, grainTexture);
    gl.uniform1i(presentProgram.uniform("u_grain"), 2);
    gl.uniform1f(
      presentProgram.uniform("u_hasFog"),
      scene.fog?.has && fogMaskReady ? 1 : 0,
    );
    gl.uniform3fv(presentProgram.uniform("u_fogTop"), env.fogTop);
    gl.uniform3fv(presentProgram.uniform("u_fogMid"), env.fogMid);
    gl.uniform3fv(presentProgram.uniform("u_fogBottom"), env.fogBottom);
    gl.uniform1f(
      presentProgram.uniform("u_fogAlpha"),
      scene.fog?.alpha ?? 0.85,
    );
    gl.uniform1f(presentProgram.uniform("u_grainAlpha"), env.grainAlpha);
    gl.uniform1f(presentProgram.uniform("u_daylight"), env.daylight);
    gl.uniform1f(presentProgram.uniform("u_dusk"), env.dusk);
    gl.uniform1f(presentProgram.uniform("u_storm"), env.storm);
    gl.uniform1f(presentProgram.uniform("u_night"), env.night);
    gl.uniform1f(presentProgram.uniform("u_moon"), env.moon);
    gl.uniform2f(
      presentProgram.uniform("u_moonUv"),
      env.moonUv[0],
      env.moonUv[1],
    );
    gl.uniform2f(
      presentProgram.uniform("u_shipUv"),
      scene.shipScreen[0] / viewportWidth,
      1 - scene.shipScreen[1] / viewportHeight,
    );
    gl.uniform2f(
      presentProgram.uniform("u_shipPx"),
      viewportWidth,
      viewportHeight,
    );
    gl.uniform1f(
      presentProgram.uniform("u_sharpRadius"),
      scene.sharpRadius ?? 230,
    );
    gl.uniform1f(
      presentProgram.uniform("u_washRadius"),
      scene.washRadius ?? 680,
    );
    gl.uniform1f(presentProgram.uniform("u_starAlpha"), env.starAlpha);
    gl.uniform1f(presentProgram.uniform("u_time"), env.time);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, fullscreenBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    gl.deleteVertexArray(vao);
  }

  // The main entry: renders one full frame from the scene description.
  function frame(scene) {
    const { camera, viewport } = scene;
    const { cameraViewMatrix, perspectiveMatrix } = scene.math;
    const view = cameraViewMatrix(camera);
    const proj = perspectiveMatrix(
      camera.fov,
      viewport.width / Math.max(1, viewport.height),
      24,
      camera.distance * 6 + 4000,
    );
    const env = scene.env;
    instanceCursor = 0;
    screenCursor = 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(env.fogMid[0], env.fogMid[1], env.fogMid[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.BLEND);

    drawTerrain(view, proj, env);

    // Flat sea-level decoration first, so hulls occlude it correctly.
    for (const sprite of scene.flatSprites ?? []) pushBillboard(sprite);
    drawBillboards(view, proj, env.camRight, env.camUp, env, {
      additive: false,
      fogHide: 0,
    });

    for (const [key, instances] of Object.entries(scene.vessels ?? {})) {
      const entry = meshes.get(key);
      if (!entry) continue;
      drawVesselInstances(entry, instances, view, proj, env, 0);
      if (env.outlineWidth > 0) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.FRONT);
        drawVesselInstances(
          entry,
          instances,
          view,
          proj,
          env,
          env.outlineWidth,
        );
        gl.disable(gl.CULL_FACE);
      }
    }

    // Additive light: beams, lanterns, harbor glows, moon halo.
    for (const sprite of scene.lightSprites ?? []) pushBillboard(sprite);
    drawBillboards(view, proj, env.camRight, env.camUp, env, {
      additive: true,
      fogHide: 0,
    });

    // Weather above the world: clouds, then fog banks confined to unsurveyed
    // water, then screen-space rain, spray, and lightning.
    for (const sprite of scene.weatherSprites ?? []) pushBillboard(sprite);
    drawBillboards(view, proj, env.camRight, env.camUp, env, {
      additive: false,
      fogHide: 0,
    });
    for (const sprite of scene.fogSprites ?? []) pushBillboard(sprite);
    drawBillboards(view, proj, env.camRight, env.camUp, env, {
      additive: false,
      fogHide: 0,
      fogInvert: 1,
    });
    for (const sprite of scene.screenSprites ?? []) pushScreenSprite(sprite);
    drawScreenSprites(viewport.width, viewport.height, false);
    for (const sprite of scene.screenGlows ?? []) pushScreenSprite(sprite);
    drawScreenSprites(viewport.width, viewport.height, true);

    present(scene, env, viewport.width, viewport.height);
    gl.enable(gl.DEPTH_TEST);
  }

  function dispose() {
    for (const entry of meshes.values()) {
      gl.deleteVertexArray(entry.vao);
      gl.deleteBuffer(entry.vbo);
    }
    meshes.clear();
  }

  return {
    gl,
    resize,
    updateMapTexture,
    updateFogMask,
    updateExploredTexture,
    setTerrainMesh,
    setMesh: uploadVesselMesh,
    getMesh: (key) => meshes.get(key),
    frame,
    dispose,
  };
}
