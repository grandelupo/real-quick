import * as THREE from 'three';
import type { ExpoWebGLRenderingContext } from 'expo-gl';

// The forest at the bottom of every day: a small low-poly planet lit by a warm
// sun, one biome per weekday standing on its top. It grows with what you eat;
// past the goal it overgrows and turns. Changing day rolls the planet: the
// next forest comes over the far horizon (or rises from the near edge going
// back). Everything is procedural — no model files.

export type Biome = 'meadow' | 'autumn' | 'lavender' | 'golden' | 'sakura' | 'winter' | 'tropical';
/** Index 0 = Monday, matching theme.DAYS. */
export const BIOME_BY_DAY: Biome[] = ['meadow', 'autumn', 'lavender', 'golden', 'sakura', 'winter', 'tropical'];

interface Palette {
  ground: number;
  trunk: number;
  foliage: number[];
  accent: number[];
  particle: number;
  particleKind: 'float' | 'fall' | 'snow' | 'spark';
  /** The page colour the far end melts into (DAYS[].bgDeep). */
  fog: number;
}

const PALETTES: Record<Biome, Palette> = {
  meadow: { ground: 0x8fd4a2, trunk: 0x9a6b4a, foliage: [0x5fc48a, 0x7ad39b, 0x4caf78], accent: [0xff9fb8, 0xfff2a8, 0xffffff, 0xffb86b], particle: 0xfff4c2, particleKind: 'float', fog: 0xc4ecd9 },
  autumn: { ground: 0xd9b36a, trunk: 0x8a5a3c, foliage: [0xf0893e, 0xe0592e, 0xf4b43c, 0xc9452a], accent: [0xf4b43c, 0xe0592e], particle: 0xf0893e, particleKind: 'fall', fog: 0xffd0b9 },
  lavender: { ground: 0xa9c58f, trunk: 0x7c5a4a, foliage: [0x6eb37e, 0x8fcf8e], accent: [0x9d7fe6, 0x8266d9, 0xb79cf2], particle: 0xfff0a8, particleKind: 'spark', fog: 0xd8ceff },
  golden: { ground: 0xe3c56a, trunk: 0x8b6240, foliage: [0x7fb257, 0x9cc26b], accent: [0xffd43b, 0xffb020], particle: 0xfff0b8, particleKind: 'float', fog: 0xffeaa6 },
  sakura: { ground: 0x9fd6a7, trunk: 0x7a5546, foliage: [0xffb7cf, 0xff9ebd, 0xffd0de], accent: [0xff9ebd, 0xffffff], particle: 0xffb7cf, particleKind: 'fall', fog: 0xffcbdc },
  winter: { ground: 0xeaf2fb, trunk: 0x6f5649, foliage: [0x3d8c6c, 0x2f7a5e, 0x4f9c7a], accent: [0xffffff], particle: 0xffffff, particleKind: 'snow', fog: 0xc6e3ff },
  tropical: { ground: 0x7fcf7a, trunk: 0xa47a52, foliage: [0x3fae63, 0x59c272, 0x2f9d58], accent: [0xff6f61, 0xffc93c, 0xff8fab], particle: 0xfff6c8, particleKind: 'float', fog: 0xdaebb6 },
};

const NIGHT_FOG = 0x2b2756; // the page's night indigo, so the horizon melts into it
const SICK = new THREE.Color(0xb7a24a); // what foliage turns to past the goal
const SICK_GROUND = new THREE.Color(0xb9a97c);

interface PlantSet {
  group: THREE.Group;
  biome: Biome;
  growth: number;
  over: number;
}

interface Plant {
  group: THREE.Group;
  /** Inner group that sways; the outer one is oriented to the planet's surface. */
  body: THREE.Group;
  set: PlantSet;
  kind: 'tree' | 'small' | 'weed';
  threshold: number;
  scale: number;
  target: number;
  dying: boolean;
  sway: number;
  phase: number;
  speed: number;
  mats: THREE.MeshStandardMaterial[];
}

function rand(seed: number) {
  // small deterministic generator so a day's forest is laid out the same every time
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function softDot(size = 32): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a * a);
    }
  }
  const t = new THREE.DataTexture(data, size, size);
  t.needsUpdate = true;
  return t;
}

function rayTexture(): THREE.DataTexture {
  const n = 64;
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const a = Math.sin(k * Math.PI) * (1 - k * 0.5);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 255;
    data[i * 4 + 3] = Math.round(255 * a);
  }
  const t = new THREE.DataTexture(data, 1, n);
  t.needsUpdate = true;
  return t;
}

/** Planet radius: big enough that the ground reads as gentle hills, small enough for a horizon. */
const R = 20;
/** How far a day's forest sits around the planet from the one before/after it. */
const STEP = 0.96;
/** Where the camera looks (height at z = −1.5): lower puts the horizon higher in the band. */
const LOOK_Y = 0.3;
/** The camera's horizontal field of view; the vertical one follows the band's shape, so a taller band shows more sky, not bigger trees. */
const HFOV = 31.4;
const vfov = (aspect: number) => (2 * Math.atan(Math.tan((HFOV * Math.PI) / 360) / aspect) * 180) / Math.PI;

function hills(x: number, z: number) {
  return 0.16 * Math.sin(x * 0.55 + 1.3) * Math.cos(z * 0.45) + 0.09 * Math.sin(x * 1.3 + z * 0.9);
}

const X_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * A point on the planet for flat coordinates (x across, z towards the
 * camera), measured from the planet's centre. The hills are baked into the
 * sphere, so `turn` says how far (about x) this point's frame is rotated
 * from the ground mesh, and the height is read where it really lands.
 */
function surface(x: number, z: number, lift = 0, turn = 0): THREE.Vector3 {
  const phi = x / R;
  const theta = z / R;
  const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi) * Math.cos(theta), Math.sin(theta));
  const onGround = dir.clone().applyAxisAngle(X_AXIS, turn);
  const lat = Math.asin(THREE.MathUtils.clamp(onGround.y, -1, 1));
  const lon = Math.atan2(onGround.x, onGround.z);
  return dir.multiplyScalar(R + hills(lon * R * 0.5, lat * R * 0.5) + lift);
}

const UP = new THREE.Vector3(0, 1, 0);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A tapered limb from `a` to `b`: trunks, branches, stems. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, mat: THREE.Material, seg = 10): THREE.Mesh {
  const d = b.clone().sub(a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}

/** A slightly irregular ball of clay: canopy lobes, bushes, stones. */
function blob(r: number, mat: THREE.Material, rand: () => number, detail = 2): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat);
  m.scale.set(0.9 + rand() * 0.25, 0.85 + rand() * 0.2, 0.9 + rand() * 0.25);
  m.rotation.set(rand() * 0.6, rand() * Math.PI, rand() * 0.6);
  return m;
}

/** Three little root bumps at a trunk's foot. */
function roots(group: THREE.Group, mat: THREE.Material, rand: () => number) {
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + rand() * 0.6;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), mat);
    b.scale.set(1.4, 0.5, 0.8);
    b.position.set(Math.cos(a) * 0.1, 0.02, Math.sin(a) * 0.1);
    b.rotation.y = -a;
    group.add(b);
  }
}

/** A toadstool: cream stem, a domed cap with three white dots. */
function mushroom(group: THREE.Group, scene: ForestScene, rand: () => number, capMat: THREE.Material) {
  const h = 0.11 + rand() * 0.06;
  group.add(limb(V(0, 0, 0), V(0, h, 0), 0.035, 0.03, scene.clay(0xf2e6d0), 10));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
  cap.scale.y = 0.65;
  cap.position.y = h - 0.01;
  group.add(cap);
  const dot = scene.clay(0xffffff);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + rand();
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), dot);
    d.position.set(Math.cos(a) * 0.05, h + 0.03, Math.sin(a) * 0.05);
    group.add(d);
  }
}

/** One tapered limb, unit size: instanced for every branch segment of a tree. */
const UNIT_LIMB = new THREE.CylinderGeometry(0.62, 1, 1, 8);
/** A leaf card: a rounded flat shape, scaled per leaf. */
const LEAF = new THREE.CircleGeometry(0.5, 7);

interface Seg {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
}

/** How a kind of tree grows: its skeleton and its leaves. */
interface TreeSpec {
  trunk: number;
  trunkR: number;
  /** Branch levels below the trunk (3 = limbs, branches, twigs). */
  levels: number;
  /** 1: the first branches leave the trunk near its top; more: rings up the trunk (a fir). */
  whorls: number;
  perWhorl: number;
  /** Where on the trunk the first branches start (share of its height). */
  firstFrom: number;
  /** Angle a branch turns away from its parent, radians. */
  spread: number;
  /** Upward pull on every branch direction. */
  lift: number;
  /** Length of a child over its parent. */
  lenFall: number;
  branchLen: number;
  leaf: { size: number; aspect: number; per: number; along: boolean };
  snow?: boolean;
  flat?: boolean;
  fruit?: number;
}

export class ForestScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private sunSprite: THREE.Sprite;
  private rays: THREE.Mesh[] = [];
  private planet = new THREE.Group();
  private ground: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private fog: THREE.Fog;
  private plants: Plant[] = [];
  private current: PlantSet | null = null;
  private incoming: PlantSet | null = null;
  private k = 0;
  private particles: THREE.Points;
  private particleVel: Float32Array;
  private particleMat: THREE.PointsMaterial;
  /** A few points of light that drift between the trees after dark. */
  private fireflies: THREE.Mesh[] = [];
  private dot = softDot();
  private biome: Biome = 'meadow';
  private shownOver = 0;
  private night = false;
  private tilt = new THREE.Vector2();
  private tiltTarget = new THREE.Vector2();
  private targetGround = new THREE.Color();
  private targetFog = new THREE.Color();
  private targetParticle = new THREE.Color();
  private t = 0;
  private last = 0;
  private disposed = false;

  constructor(private gl: ExpoWebGLRenderingContext, width: number, height: number, pixelRatio: number) {
    // expo-gl's context lacks a few WebGL methods three calls at start-up and
    // every frame (expo-three used to shim these; build 3 crashed on launch
    // without them), and three wants a canvas: a stub with the drawing buffer
    // size is all the renderer reads from it.
    const ctx = gl as unknown as Record<string, unknown>;
    if (typeof ctx.getContextAttributes !== 'function') {
      ctx.getContextAttributes = () => ({ alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false, desynchronized: false, powerPreference: 'default' });
    }
    if (typeof ctx.isContextLost !== 'function') ctx.isContextLost = () => false;
    const canvas = {
      width: gl.drawingBufferWidth,
      height: gl.drawingBufferHeight,
      clientWidth: width,
      clientHeight: height,
      style: {},
      addEventListener() {},
      removeEventListener() {},
      getContext: () => gl,
    } as unknown as HTMLCanvasElement;
    if (!ctx.canvas) ctx.canvas = canvas;
    // expo-gl's WebGL2 context is also an `instanceof WebGLRenderingContext`
    // (it extends it, as the spec says), and three ≥ r163 refuses any context
    // that passes that test. Hide the global for the one check three makes.
    if (ctx.supportsWebGL2 === false) throw new Error('forest needs WebGL2'); // expo-gl only; a browser context has no such flag
    const g = globalThis as unknown as Record<string, unknown>;
    const webgl1 = g.WebGLRenderingContext;
    g.WebGLRenderingContext = undefined;
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, context: gl as unknown as WebGL2RenderingContext, alpha: true, antialias: true, premultipliedAlpha: true });
    } finally {
      g.WebGLRenderingContext = webgl1;
    }
    // the full ratio: expo-gl's buffer is view × scale, and three's viewport
    // has to cover all of it (a lower ratio drew into the bottom-left corner)
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;

    this.camera = new THREE.PerspectiveCamera(vfov(width / height), width / height, 0.1, 60);
    // close and pitched down a little, so the trees stand above the chips and
    // bar that float over the lower third of the band
    this.camera.position.set(0, 2.0, 6.4);
    this.camera.lookAt(0, LOOK_Y, -1.5);

    this.fog = new THREE.Fog(PALETTES.meadow.fog, 10, 24);
    this.scene.fog = this.fog;

    this.hemi = new THREE.HemisphereLight(0xfff4dc, 0x9fb08a, 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe8bf, 1.45);
    this.sun.position.set(-4.5, 6.5, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -8;
    this.sun.shadow.camera.right = 8;
    this.sun.shadow.camera.top = 8;
    this.sun.shadow.camera.bottom = -8;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 25;
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.radius = 6;
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    // a cool fill from the viewer's side rounds the shapes off
    const fill = new THREE.DirectionalLight(0xd6e4ff, 0.3);
    fill.position.set(4, 3, 7);
    this.scene.add(fill);

    // the sun itself, and a few soft rays leaning into the scene
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dot, color: 0xfff3c8, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.sunSprite.position.set(-2.6, 2.3, -12);
    this.sunSprite.scale.set(3.4, 3.4, 1);
    this.scene.add(this.sunSprite);
    const rayTex = rayTexture();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + i * 0.3, 16), new THREE.MeshBasicMaterial({ map: rayTex, color: 0xfff0c0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(-2.6 + i * 0.5, 2.8, -11);
      m.rotation.z = -0.55 - i * 0.12;
      m.rotation.x = 0.15;
      m.translateY(-7);
      this.rays.push(m);
      this.scene.add(m);
    }

    // ground: the planet, gentle hills on it, fading out towards the horizon so the page shows through
    const geo = new THREE.SphereGeometry(R, 160, 112);
    // poles to the sides: a UV sphere's converging triangles would otherwise
    // sit right under the camera and show as creases in the ground
    geo.rotateZ(Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const lat = Math.asin(THREE.MathUtils.clamp(v.y / R, -1, 1));
      const lon = Math.atan2(v.x, v.z);
      v.multiplyScalar(1 + hills(lon * R * 0.5, lat * R * 0.5) / R);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    this.scene.add(this.planet);
    this.groundMat = new THREE.MeshStandardMaterial({ color: PALETTES.meadow.ground, flatShading: false, roughness: 0.95, metalness: 0, transparent: true });
    this.groundMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vFade;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 wp = modelMatrix * vec4(transformed, 1.0);\nvFade = (1.0 - smoothstep(-6.5, -12.5, wp.z)) * smoothstep(-9.0, -3.0, wp.y);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFade;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= vFade;');
    };
    // the planet group sits at the planet's centre, so rolling it (and placing a
    // day's forest at an angle) turns about the centre, not the ground under the camera
    this.planet.position.y = -R;
    this.ground = new THREE.Mesh(geo, this.groundMat);
    this.ground.receiveShadow = true;
    this.planet.add(this.ground);

    // particles: pollen, petals, leaves, snow or sparks depending on the biome
    const N = 220;
    const p = new Float32Array(N * 3);
    this.particleVel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) this.seedParticle(p, i, true);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.particleMat = new THREE.PointsMaterial({ size: 0.11, map: this.dot, transparent: true, opacity: 0.85, depthWrite: false, sizeAttenuation: true, color: 0xffffff });
    this.particles = new THREE.Points(pg, this.particleMat);
    this.scene.add(this.particles);

    const fly = this.glow(0xfff2a0, 2.4);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), fly);
      f.position.set(-3 + i * 1.2, 0.7 + (i % 3) * 0.35, -2.5 + (i % 2) * 2);
      f.scale.setScalar(0.001);
      this.fireflies.push(f);
      this.scene.add(f);
    }

    this.setDay(0, true);
  }

  // ---------------------------------------------------------------- state --

  /** Show a day's forest outright (first paint, deep links). */
  setDay(weekday: number, immediate = false) {
    const biome = BIOME_BY_DAY[((weekday % 7) + 7) % 7];
    if (this.current && biome === this.current.biome && !immediate) return;
    this.dropIncoming();
    if (this.current) this.dropSet(this.current);
    this.current = this.buildSet(biome, weekday, 0);
    this.planet.rotation.x = 0;
    this.k = 0;
    this.applyBiome(biome, immediate);
    if (immediate) {
      for (const pl of this.plants) {
        pl.scale = pl.target = this.targetFor(pl);
        pl.group.scale.setScalar(pl.scale);
      }
    }
  }

  setGrowth(growth: number, over: number) {
    if (!this.current) return;
    this.current.growth = Math.min(1, Math.max(0, growth));
    this.current.over = Math.min(1, Math.max(0, over));
  }

  /**
   * The roll to another day. `dir` +1 (a swipe up): the planet turns away
   * from the viewer and the next forest rises past the near edge; −1: it
   * comes over the far horizon. `setRoll(k)` with k in [0, 1] drives it;
   * commit or cancel ends it.
   */
  beginRoll(dir: 1 | -1, weekday: number, growth: number, over: number) {
    this.dropIncoming();
    const biome = BIOME_BY_DAY[((weekday % 7) + 7) % 7];
    this.incoming = this.buildSet(biome, weekday, dir * STEP);
    this.incoming.growth = Math.min(1, Math.max(0, growth));
    this.incoming.over = Math.min(1, Math.max(0, over));
    this.rollDir = dir;
    // the incoming forest is already fully grown when it appears
    for (const pl of this.plants) {
      if (pl.set === this.incoming) {
        pl.scale = pl.target = this.targetFor(pl);
        pl.group.scale.setScalar(Math.max(0.001, pl.scale));
      }
    }
  }

  setRoll(k: number) {
    this.k = Math.min(1, Math.max(0, k));
    this.planet.rotation.x = -this.rollDir * this.k * STEP;
  }

  commitRoll() {
    if (!this.incoming) return;
    if (this.current) this.dropSet(this.current);
    this.current = this.incoming;
    this.incoming = null;
    this.current.group.rotation.x = 0;
    // keep the ground where it is in the world while the frame of reference resets
    this.ground.rotation.x -= this.rollDir * STEP;
    this.planet.rotation.x = 0;
    this.k = 0;
    this.applyBiome(this.current.biome, false);
  }

  cancelRoll() {
    this.dropIncoming();
    this.planet.rotation.x = 0;
    this.k = 0;
  }

  private rollDir: 1 | -1 = 1;

  private applyBiome(biome: Biome, immediate: boolean) {
    this.biome = biome;
    const pal = PALETTES[biome];
    this.targetGround.set(pal.ground);
    this.targetFog.set(this.night ? NIGHT_FOG : pal.fog);
    this.targetParticle.set(this.night ? 0xfff2a0 : pal.particle);
    this.particleMat.blending = pal.particleKind === 'spark' || pal.particleKind === 'float' ? THREE.AdditiveBlending : THREE.NormalBlending;
    this.particleMat.size = pal.particleKind === 'snow' ? 0.13 : pal.particleKind === 'fall' ? 0.14 : 0.1;
    const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) this.seedParticle(pos.array as Float32Array, i, true);
    pos.needsUpdate = true;
    if (immediate) {
      this.groundMat.color.copy(this.targetGround);
      this.fog.color.copy(this.targetFog);
      this.particleMat.color.copy(this.targetParticle);
    }
  }

  private dropIncoming() {
    if (this.incoming) this.dropSet(this.incoming);
    this.incoming = null;
  }

  private dropSet(set: PlantSet) {
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const pl = this.plants[i];
      if (pl.set !== set) continue;
      pl.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        // the instanced limb and leaf shapes are shared by every tree; never dispose those
        if (mesh.isMesh && mesh.geometry !== UNIT_LIMB && mesh.geometry !== LEAF) mesh.geometry.dispose();
      });
      for (const m of pl.mats) m.dispose();
      this.plants.splice(i, 1);
    }
    this.planet.remove(set.group);
  }

  setNight(night: boolean) {
    if (night === this.night) return;
    this.night = night;
    const pal = PALETTES[this.biome];
    this.targetFog.set(night ? NIGHT_FOG : pal.fog);
    this.targetParticle.set(night ? 0xfff2a0 : pal.particle);
  }

  /** Device tilt in radians (roll, pitch), already relative to the resting pose. */
  setTilt(roll: number, pitch: number) {
    this.tiltTarget.set(THREE.MathUtils.clamp(roll, -0.6, 0.6), THREE.MathUtils.clamp(pitch, -0.6, 0.6));
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = vfov(this.camera.aspect);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- build --

  private targetFor(pl: Plant) {
    if (pl.dying) return 0;
    const { growth, over } = pl.set;
    if (pl.kind === 'weed') return over;
    const g = pl.threshold === 0 ? 0.7 + 0.3 * smoothstep(0, 0.3, growth) : smoothstep(pl.threshold, pl.threshold + 0.3, growth);
    return g * (pl.kind === 'tree' ? 1 + 0.22 * over : 1 + 0.1 * over);
  }

  /** One day's forest, standing on the planet, rotated `offset` around it (0 = on top, in view). */
  private buildSet(biome: Biome, seed: number, offset: number): PlantSet {
    const set: PlantSet = { group: new THREE.Group(), biome, growth: 0, over: 0 };
    set.group.rotation.x = offset;
    this.planet.add(set.group);
    this.buildPlants(set, seed, offset);
    return set;
  }

  private buildPlants(set: PlantSet, seed: number, offset: number) {
    const biome = set.biome;
    const pal = PALETTES[biome];
    const r = rand(1234 + seed * 97 + biome.length * 31);
    const up = new THREE.Vector3(0, 1, 0);
    const add = (body: THREE.Group, kind: Plant['kind'], threshold: number, sway: number, mats: THREE.MeshStandardMaterial[], x: number, z: number) => {
      const group = new THREE.Group();
      // this set sits `offset` around the planet; the ground mesh has turned by its own rotation
      const at = surface(x, z, -0.02, offset - this.ground.rotation.x);
      group.position.copy(at);
      const normal = at.clone().normalize();
      group.quaternion.setFromUnitVectors(up, normal);
      body.rotation.y = r() * Math.PI * 2;
      group.add(body);
      group.scale.setScalar(0.001);
      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = kind !== 'tree';
        }
      });
      set.group.add(group);
      this.plants.push({ group, body, set, kind, threshold, scale: 0.001, target: 0, dying: false, sway, phase: r() * Math.PI * 2, speed: 0.9 + r() * 0.6, mats });
    };
    const spots: [number, number][] = [];
    const pick = (minZ: number, maxZ: number, minX = -4.8, maxX = 4.8, tries = 12, gap = 0.9) => {
      for (let i = 0; i < tries; i++) {
        const x = minX + r() * (maxX - minX);
        const z = minZ + r() * (maxZ - minZ);
        if (Math.abs(x) < 1.1 && z > 0.9) continue; // keep the middle front open
        if (spots.every(([sx, sz]) => (sx - x) ** 2 + (sz - z) ** 2 > gap * gap)) {
          spots.push([x, z]);
          return [x, z] as [number, number];
        }
      }
      return null;
    };

    // trees: a back row, a middle row, two or three in front
    const treeCount = biome === 'lavender' ? 9 : 14;
    for (let i = 0; i < treeCount; i++) {
      const row = i < 6 ? [-7, -4] : i < 11 ? [-3.5, -0.8] : [-0.3, 2.0];
      const s = pick(row[0], row[1], i < 6 ? -6 : -4.6, i < 6 ? 6 : 4.6, 16, i < 6 ? 1.0 : 1.5);
      if (!s) continue;
      const { group, mats } = this.makeTree(biome, pal, r);
      const size = (i < 6 ? 1.25 : i < 11 ? 1.05 : 0.85) * (0.85 + r() * 0.35);
      group.children.forEach((c) => c.scale.multiplyScalar(size));
      // a few trees in every row are always there; the rest come with the day's intake
      const always = i < 2 || i === 6 || i === 7 || i === 11;
      add(group, 'tree', always ? 0 : i < 6 ? r() * 0.2 : 0.1 + r() * 0.6, 0.025, mats, s[0], s[1]);
    }
    // small plants: flowers, bushes, grass, lavender, sunflowers…
    const smallCount = biome === 'winter' ? 26 : 46;
    for (let i = 0; i < smallCount; i++) {
      const s = pick(-5, 2.6, -4.6, 4.6, 10, 0.42);
      if (!s) continue;
      const { group, mats } = this.makeSmall(biome, pal, r);
      add(group, 'small', i < 10 ? 0 : 0.05 + r() * 0.85, 0.07, mats, s[0], s[1]);
    }
    // weeds: only when over the goal
    for (let i = 0; i < 14; i++) {
      const s = pick(-4, 2.4, -4.4, 4.4, 8, 0.6);
      if (!s) continue;
      const { group, mats } = this.makeWeed(r);
      add(group, 'weed', 0, 0.05, mats, s[0], s[1]);
    }
  }

  // ---------------------------------------------------------- materials --

  /** Matte clay: the default for everything, smooth and without facets. */
  private std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: false, roughness: 0.92, metalness: 0, ...extra });
    m.userData.base = new THREE.Color(color);
    return m;
  }

  /** The matte clay material, for helpers outside the class. */
  clay(color: number) {
    return this.std(color);
  }

  /** Candy gloss, for the few things that shine: fruit, berries, caps, eyes. */
  private gloss(color: number) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
    m.userData.base = new THREE.Color(color);
    return m;
  }

  /** Light of its own: fireflies, the glowing caps on the lavender day. */
  private glow(color: number, strength = 1.6) {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 1, metalness: 0 });
    m.userData.base = new THREE.Color(color);
    return m;
  }

  // -------------------------------------------------------------- trees --

  private makeTree(biome: Biome, pal: Palette, r: () => number) {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const trunkMat = this.std(pal.trunk);
    const pickF = () => pal.foliage[Math.floor(r() * pal.foliage.length)];

    if (biome === 'tropical') {
      // a palm: a leaning trunk, fronds with leaflets, glossy coconuts
      let y = 0;
      let x = 0;
      let last = V(0, 0, 0);
      for (let i = 0; i < 5; i++) {
        const next = V(x + 0.05 * i, y + 0.38, 0);
        group.add(limb(last, next, 0.1 - i * 0.006, 0.09 - i * 0.006, trunkMat, 12));
        last = next;
        y = next.y;
        x = next.x;
      }
      const frond = this.std(pickF(), { side: THREE.DoubleSide });
      mats.push(frond);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + r() * 0.5;
        const dir = V(Math.cos(a) * 0.85, 0.2 - r() * 0.1, Math.sin(a) * 0.85);
        const end = last.clone().add(dir);
        end.y -= 0.4;
        group.add(limb(last, end, 0.022, 0.008, trunkMat, 6));
        // leaflets: flat cards either side of the stalk, drooping more towards the tip
        const along = end.clone().sub(last).normalize();
        const side = new THREE.Vector3().crossVectors(along, UP).normalize();
        for (let j = 0; j < 8; j++) {
          const t = 0.15 + j * 0.11;
          const at = last.clone().lerp(end, t);
          for (const sg of [-1, 1]) {
            const droop = 0.35 + j * 0.09;
            const xAxis = side.clone().multiplyScalar(sg).multiplyScalar(Math.cos(droop)).addScaledVector(UP, -Math.sin(droop)).normalize();
            const zAxis = new THREE.Vector3().crossVectors(xAxis, along).normalize();
            const leaflet = new THREE.Mesh(LEAF, frond);
            leaflet.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, along, zAxis));
            leaflet.scale.set(0.34 - j * 0.02, 0.085, 1);
            leaflet.position.copy(at).addScaledVector(xAxis, 0.14 - j * 0.008);
            group.add(leaflet);
          }
        }
      }
      const coco = this.gloss(0x6b4a33);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), coco);
        c.position.set(last.x + Math.cos(i * 2.1) * 0.11, last.y - 0.12, Math.sin(i * 2.1) * 0.11);
        group.add(c);
      }
      return { group, mats };
    }

    // every other tree: a branching skeleton with leaves on the outer twigs
    const spec: TreeSpec =
      biome === 'winter'
        ? { trunk: 1.5, trunkR: 0.07, levels: 2, whorls: 5, perWhorl: 5, firstFrom: 0.2, spread: 1.3, lift: -0.12, lenFall: 0.5, branchLen: 0.58, leaf: { size: 0.12, aspect: 0.2, per: 18, along: true }, snow: true }
        : biome === 'golden'
          ? { trunk: 0.95, trunkR: 0.085, levels: 3, whorls: 1, perWhorl: 3, firstFrom: 0.75, spread: 1.15, lift: 0.1, lenFall: 0.7, branchLen: 0.6, leaf: { size: 0.1, aspect: 0.5, per: 12, along: false }, flat: true }
          : biome === 'lavender'
            ? { trunk: 0.75, trunkR: 0.09, levels: 3, whorls: 1, perWhorl: 3, firstFrom: 0.6, spread: 0.85, lift: 0.35, lenFall: 0.7, branchLen: 0.5, leaf: { size: 0.1, aspect: 0.35, per: 16, along: true } }
            : { trunk: 0.9 + r() * 0.3, trunkR: 0.1, levels: 3, whorls: 1, perWhorl: 3 + Math.floor(r() * 2), firstFrom: 0.55, spread: 0.75, lift: 0.45, lenFall: 0.68, branchLen: 0.55, leaf: { size: 0.13, aspect: 0.75, per: 14, along: false }, fruit: biome === 'autumn' ? 0xd9362b : biome === 'sakura' ? 0xffffff : undefined };

    const segs: Seg[] = [];
    const tips: THREE.Vector3[] = [];
    // the trunk
    segs.push({ a: V(0, 0, 0), b: V(0, spec.trunk, 0), r: spec.trunkR });
    roots(group, trunkMat, r);
    const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, level: number) => {
      const b = a.clone().addScaledVector(dir, len);
      segs.push({ a, b, r: rad });
      if (level <= 1) tips.push(b);
      if (spec.leaf.along && level <= 1) tips.push(a.clone().lerp(b, 0.5));
      if (level === 0) return;
      const n = level === spec.levels ? spec.perWhorl : 2;
      for (let i = 0; i < n; i++) {
        // turn away from the parent by `spread`, around it by a random azimuth, then lift a little
        const az = (i / n) * Math.PI * 2 + r() * 1.2;
        const side = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.9 ? UP : V(1, 0, 0)).normalize();
        const other = new THREE.Vector3().crossVectors(dir, side);
        const turn = spec.spread * (0.6 + r() * 0.5) * (spec.flat && level < spec.levels ? 0.5 : 1);
        const nd = dir.clone().multiplyScalar(Math.cos(turn)).addScaledVector(side, Math.sin(turn) * Math.cos(az)).addScaledVector(other, Math.sin(turn) * Math.sin(az));
        nd.y += spec.lift;
        if (spec.flat) nd.y *= 0.4;
        nd.normalize();
        grow(b, nd, len * spec.lenFall * (0.85 + r() * 0.3), rad * 0.62, level - 1);
      }
    };
    // first-level branches come off the trunk, at one height or in whorls
    for (let w = 0; w < spec.whorls; w++) {
      const t = spec.whorls === 1 ? spec.firstFrom + r() * (1 - spec.firstFrom) : spec.firstFrom + (w / (spec.whorls - 1)) * (0.95 - spec.firstFrom);
      const at = V(0, spec.trunk * t, 0);
      const len = spec.branchLen * (spec.whorls === 1 ? 1 : 1.1 - t * 0.75);
      const n = spec.whorls === 1 ? spec.perWhorl : spec.perWhorl;
      for (let i = 0; i < n; i++) {
        const az = (i / n) * Math.PI * 2 + r() * 0.8;
        const dir = V(Math.sin(spec.spread) * Math.cos(az), Math.cos(spec.spread) + spec.lift, Math.sin(spec.spread) * Math.sin(az)).normalize();
        const start = spec.whorls === 1 ? V(0, spec.trunk * (spec.firstFrom + r() * (1 - spec.firstFrom)), 0) : at;
        grow(start, dir, len * (0.85 + r() * 0.3), spec.trunkR * 0.5, spec.levels - 1);
      }
    }
    if (spec.whorls === 1) {
      // a leader on top
      grow(V(0, spec.trunk, 0), V(0.1 * (r() - 0.5), 1, 0.1 * (r() - 0.5)).normalize(), spec.branchLen * 0.8, spec.trunkR * 0.55, spec.levels - 1);
    }

    // wood: one instanced tapered cylinder per segment
    const wood = new THREE.InstancedMesh(UNIT_LIMB, trunkMat, segs.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    segs.forEach((sg, i) => {
      const d = sg.b.clone().sub(sg.a);
      const len = d.length();
      q.setFromUnitVectors(UP, d.normalize());
      m4.compose(sg.a.clone().addScaledVector(d, len / 2), q, V(sg.r, len, sg.r));
      wood.setMatrixAt(i, m4);
    });
    group.add(wood);

    // leaves: flat cards scattered around every tip, each its own tint
    const leafMat = this.std(0xffffff, { side: THREE.DoubleSide });
    leafMat.userData.base = new THREE.Color(0xffffff);
    mats.push(leafMat);
    const count = tips.length * spec.leaf.per;
    const leaves = new THREE.InstancedMesh(LEAF, leafMat, count);
    const col = new THREE.Color();
    const tint = new THREE.Color();
    let i = 0;
    for (const tip of tips) {
      for (let j = 0; j < spec.leaf.per; j++) {
        const dir = V(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
        const p = tip.clone().addScaledVector(dir, 0.04 + r() * (spec.snow ? 0.12 : 0.2));
        q.setFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI));
        const s = spec.leaf.size * (0.8 + r() * 0.5);
        m4.compose(p, q, V(s, s * spec.leaf.aspect, s));
        leaves.setMatrixAt(i, m4);
        col.set(pickF());
        tint.setHSL(0, 0, 0.75 + r() * 0.25);
        leaves.setColorAt(i, col.lerp(tint, 0.12));
        i++;
      }
    }
    group.add(leaves);

    if (spec.snow) {
      // snow resting on the branches
      const snowMat = this.std(0xffffff, { roughness: 1 });
      const snow = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), snowMat, tips.length);
      tips.forEach((tip, k) => {
        m4.compose(tip.clone().add(V(0, 0.04, 0)), new THREE.Quaternion(), V(0.06 + r() * 0.04, 0.028, 0.05 + r() * 0.04));
        snow.setMatrixAt(k, m4);
      });
      group.add(snow);
    }
    if (spec.fruit) {
      const fruitMat = this.gloss(spec.fruit);
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const tip = tips[Math.floor(r() * tips.length)];
        const f = new THREE.Mesh(new THREE.SphereGeometry(spec.fruit === 0xffffff ? 0.03 : 0.045, 12, 10), fruitMat);
        f.position.copy(tip).add(V((r() - 0.5) * 0.1, -0.08, (r() - 0.5) * 0.1));
        group.add(f);
      }
    }
    return { group, mats };
  }

  // ------------------------------------------------------- small plants --

  private makeSmall(biome: Biome, pal: Palette, r: () => number) {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const accent = () => pal.accent[Math.floor(r() * pal.accent.length)];
    const foliage = () => pal.foliage[Math.floor(r() * pal.foliage.length)];
    const leaf = (color: number) => {
      const m = this.std(color);
      mats.push(m);
      return m;
    };
    const stemMat = this.std(0x6f9a5c);
    const k = r();

    if (biome === 'winter') {
      if (k < 0.1) {
        // a snowman
        const snow = this.std(0xffffff, { roughness: 1 });
        const sizes = [0.15, 0.11, 0.08];
        let y = 0.1;
        for (const s of sizes) {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), snow);
          ball.position.y = y;
          group.add(ball);
          y += s * 1.6;
        }
        const headY = y - sizes[2] * 1.6;
        const coal = this.gloss(0x2b2350);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), coal);
          eye.position.set(side * 0.028, headY + 0.02, 0.07);
          group.add(eye);
        }
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.08, 8), this.std(0xff8a3d));
        nose.position.set(0, headY, 0.1);
        nose.rotation.x = Math.PI / 2;
        group.add(nose);
        const arms = this.std(0x6f5649);
        for (const side of [-1, 1]) {
          group.add(limb(V(side * 0.09, sizes[0] * 1.6 + 0.08, 0), V(side * 0.27, sizes[0] * 1.6 + 0.2, 0.02), 0.012, 0.006, arms, 6));
        }
      } else {
        const mound = blob(0.16 + r() * 0.14, this.std(0xffffff, { roughness: 1 }), r);
        mound.scale.y *= 0.5;
        group.add(mound);
      }
      return { group, mats };
    }

    if (biome === 'lavender' && k < 0.55) {
      // a lavender spike: beads of purple up a stem
      group.add(limb(V(0, 0, 0), V(0, 0.34, 0), 0.016, 0.012, stemMat, 6));
      const m = leaf(accent());
      for (let i = 0; i < 4; i++) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045 - i * 0.007, 10, 8), m);
        bead.position.y = 0.3 + i * 0.065;
        group.add(bead);
      }
      return { group, mats };
    }
    if (biome === 'lavender' && k < 0.7) {
      mushroom(group, this, r, this.glow(0xb59cff, 1.4));
      return { group, mats };
    }
    if (biome === 'golden' && k < 0.5) {
      // a sunflower
      group.add(limb(V(0, 0, 0), V(0, 0.74, 0), 0.022, 0.016, stemMat, 8));
      const head = new THREE.Group();
      head.position.y = 0.76;
      head.rotation.x = 1.2;
      const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.035, 20), this.std(0x6b4a2e));
      head.add(centre);
      const petal = leaf(0xffd43b);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), petal);
        p.scale.set(1.5, 0.3, 0.6);
        p.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14);
        p.rotation.y = -a;
        head.add(p);
      }
      group.add(head);
      return { group, mats };
    }
    if (biome === 'autumn' && k < 0.3) {
      // leaves on the ground
      for (let i = 0; i < 4; i++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), leaf(accent()));
        l.scale.set(1, 0.18, 0.7);
        l.position.set((r() - 0.5) * 0.4, 0.01, (r() - 0.5) * 0.4);
        l.rotation.y = r() * Math.PI;
        group.add(l);
      }
      return { group, mats };
    }
    if (k < 0.12) {
      // pebbles
      const stone = this.std(r() < 0.5 ? 0x9aa0a6 : 0xb8bcc2);
      for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
        const p = blob(0.05 + r() * 0.05, stone, r);
        p.scale.y *= 0.6;
        p.position.set((r() - 0.5) * 0.25, 0.02, (r() - 0.5) * 0.25);
        group.add(p);
      }
    } else if (k < 0.22) {
      mushroom(group, this, r, this.gloss(biome === 'sakura' ? 0xffb3c6 : 0xe04a3a));
    } else if (k < 0.3) {
      // a stump
      const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.13, 14), this.std(pal.trunk));
      stump.position.y = 0.065;
      group.add(stump);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.012, 14), this.std(0xd9b48c));
      top.position.y = 0.135;
      group.add(top);
    } else if (k < 0.55) {
      // a flower: petals around a glossy centre
      group.add(limb(V(0, 0, 0), V(0, 0.3, 0), 0.015, 0.011, stemMat, 6));
      const petal = leaf(accent());
      const n = 5 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), petal);
        p.scale.set(1.3, 0.35, 0.7);
        p.position.set(Math.cos(a) * 0.05, 0.31, Math.sin(a) * 0.05);
        p.rotation.y = -a;
        p.rotation.z = 0.25;
        group.add(p);
      }
      const centre = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), this.gloss(0xffe27a));
      centre.position.y = 0.33;
      group.add(centre);
    } else if (k < 0.78) {
      // a bush with berries
      const bushMat = leaf(foliage());
      for (let i = 0; i < 3; i++) {
        const b = blob(0.11 + r() * 0.06, bushMat, r);
        b.scale.y *= 0.8;
        b.position.set((r() - 0.5) * 0.22, 0.1 + r() * 0.06, (r() - 0.5) * 0.22);
        group.add(b);
      }
      const berry = this.gloss(accent());
      for (let i = 0; i < 4; i++) {
        const a = r() * Math.PI * 2;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), berry);
        b.position.set(Math.cos(a) * 0.13, 0.12 + r() * 0.08, Math.sin(a) * 0.13);
        group.add(b);
      }
    } else {
      // a grass tuft: green, or straw-coloured on the dry days
      const m = leaf(biome === 'autumn' || biome === 'golden' ? 0xd2b25a : 0x6fae5a);
      for (let i = 0; i < 5; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.3 + r() * 0.12, 6), m);
        blade.position.set((i - 2) * 0.035, 0.14, (r() - 0.5) * 0.04);
        blade.rotation.z = (i - 2) * 0.22;
        group.add(blade);
      }
    }
    return { group, mats };
  }

  private makeWeed(r: () => number) {
    const group = new THREE.Group();
    const m = this.std(0x4f6b3a);
    const mats = [m];
    for (let i = 0; i < 3; i++) {
      const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9 + r() * 0.6, 10), m);
      stalk.position.set((r() - 0.5) * 0.3, 0.45, (r() - 0.5) * 0.3);
      stalk.rotation.set((r() - 0.5) * 0.9, 0, (r() - 0.5) * 0.9);
      group.add(stalk);
    }
    return { group, mats };
  }

  private seedParticle(arr: Float32Array, i: number, anywhere: boolean) {
    const pal = PALETTES[this.biome];
    const falling = pal.particleKind === 'fall' || pal.particleKind === 'snow';
    arr[i * 3] = (Math.random() - 0.5) * 16;
    arr[i * 3 + 1] = anywhere || !falling ? Math.random() * 6 : 5.5 + Math.random();
    arr[i * 3 + 2] = -9 + Math.random() * 12;
    this.particleVel[i * 3] = (Math.random() - 0.5) * 0.3;
    this.particleVel[i * 3 + 1] = falling ? -(0.25 + Math.random() * 0.4) : (Math.random() - 0.5) * 0.15;
    this.particleVel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }

  // ---------------------------------------------------------------- frame --

  frame(now: number) {
    if (this.disposed) return;
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now;
    this.t += dt;
    const t = this.t;

    // colours ease towards the day/night targets
    this.fog.color.lerp(this.targetFog, Math.min(1, dt * 3));
    this.particleMat.color.lerp(this.targetParticle, Math.min(1, dt * 3));
    const over = this.incoming ? THREE.MathUtils.lerp(this.current?.over ?? 0, this.incoming.over, this.k) : this.current?.over ?? 0;
    this.shownOver += (over - this.shownOver) * Math.min(1, dt * 2.5);
    // during a roll the ground and the haze mix towards the incoming biome
    const inPal = this.incoming ? PALETTES[this.incoming.biome] : null;
    const groundTarget = inPal ? new THREE.Color().copy(this.targetGround).lerp(new THREE.Color(inPal.ground), this.k) : this.targetGround.clone();
    if (inPal) this.fog.color.lerp(new THREE.Color(this.night ? NIGHT_FOG : inPal.fog), this.k * Math.min(1, dt * 3));
    const g = groundTarget.lerp(SICK_GROUND, this.shownOver * 0.7);
    this.groundMat.color.lerp(g, Math.min(1, dt * 3));

    // light: warm sun by day, cool moon by night
    const nightK = this.night ? 1 : 0;
    this.sun.intensity += ((this.night ? 0.75 : 1.45) - this.sun.intensity) * Math.min(1, dt * 3);
    this.sun.color.lerp(new THREE.Color(this.night ? 0xb9c6ff : 0xffe8bf), Math.min(1, dt * 3));
    this.hemi.intensity += ((this.night ? 0.55 : 1.05) - this.hemi.intensity) * Math.min(1, dt * 3);
    this.hemi.color.lerp(new THREE.Color(this.night ? 0x9aa8ff : 0xfff4dc), Math.min(1, dt * 3));
    // by night the sun's sprite becomes a small pale moon
    const sunMat = this.sunSprite.material as THREE.SpriteMaterial;
    sunMat.opacity += ((this.night ? 0.42 : 0.7) - sunMat.opacity) * Math.min(1, dt * 3);
    sunMat.color.lerp(new THREE.Color(this.night ? 0xe3e9ff : 0xfff3c8), Math.min(1, dt * 3));
    const sunScale = this.night ? 1.9 : 3.4;
    this.sunSprite.scale.x += (sunScale - this.sunSprite.scale.x) * Math.min(1, dt * 3);
    this.sunSprite.scale.y = this.sunSprite.scale.x;
    this.rays.forEach((ray, i) => {
      const m = ray.material as THREE.MeshBasicMaterial;
      m.opacity = (1 - nightK) * (0.03 + 0.035 * (0.5 + 0.5 * Math.sin(t * 0.5 + i * 1.7)));
    });

    // camera: device tilt plus a very slow drift
    this.tilt.lerp(this.tiltTarget, Math.min(1, dt * 4));
    this.camera.position.x = this.tilt.x * 1.1 + Math.sin(t * 0.11) * 0.12;
    this.camera.position.y = 2.0 - this.tilt.y * 0.7 + Math.sin(t * 0.17) * 0.05;
    this.camera.lookAt(0, LOOK_Y, -1.5);

    // plants: grow, die, sway, turn
    const wind = 1 + 0.35 * Math.sin(t * 0.37);
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const pl = this.plants[i];
      pl.target = this.targetFor(pl);
      pl.scale += (pl.target - pl.scale) * Math.min(1, dt * 2.6);
      const s = Math.max(0.001, pl.scale);
      pl.group.scale.set(s, s, s);
      const setOver = pl.set.over;
      const droop = pl.kind === 'tree' ? -0.16 * setOver : -0.3 * setOver;
      pl.body.rotation.z = droop + Math.sin(t * pl.speed * 1.3 + pl.phase) * pl.sway * wind;
      pl.body.rotation.x = Math.sin(t * pl.speed * 0.9 + pl.phase * 1.3) * pl.sway * 0.5 * wind;
      if (pl.kind !== 'weed') {
        for (const m of pl.mats) m.color.copy(m.userData.base as THREE.Color).lerp(SICK, setOver * 0.85);
      }
    }

    // particles drift or fall; snow and leaves respawn at the top
    const pos = this.particles.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const pal = PALETTES[this.biome];
    const falling = pal.particleKind === 'fall' || pal.particleKind === 'snow';
    for (let i = 0; i < pos.count; i++) {
      const j = i * 3;
      arr[j] += (this.particleVel[j] + Math.sin(t * 0.8 + i) * 0.25) * dt;
      arr[j + 1] += this.particleVel[j + 1] * dt + (falling ? 0 : Math.sin(t * 0.6 + i * 0.7) * 0.004);
      arr[j + 2] += this.particleVel[j + 2] * dt;
      if (arr[j + 1] < -0.3 || arr[j + 1] > 6.5 || Math.abs(arr[j]) > 9) this.seedParticle(arr, i, false);
    }
    pos.needsUpdate = true;
    this.particleMat.opacity = this.night && pal.particleKind !== 'snow' ? 0.5 + 0.4 * Math.sin(t * 2.2) : 0.85;

    // fireflies: out after dark, drifting and pulsing slowly
    this.fireflies.forEach((f, i) => {
      const want = this.night ? 0.8 + 0.4 * Math.sin(t * 1.7 + i * 1.3) : 0.001;
      f.scale.setScalar(f.scale.x + (want - f.scale.x) * Math.min(1, dt * 2));
      f.position.x += Math.sin(t * 0.5 + i) * 0.004;
      f.position.y += Math.cos(t * 0.7 + i * 0.8) * 0.003;
    });

    this.renderer.render(this.scene, this.camera);
    this.gl.endFrameEXP();
  }

  /** Blocks until the GL thread has drawn everything queued so far. */
  drain() {
    this.gl.getError();
  }

  dispose() {
    this.disposed = true;
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m.dispose();
      }
    });
    this.dot.dispose();
    this.renderer.dispose();
  }
}
