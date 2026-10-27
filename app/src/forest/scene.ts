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

const NIGHT_FOG = 0xece8f3;
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
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;

    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 60);
    // close and pitched down a little, so the trees stand above the chips and
    // bar that float over the lower third of the band
    this.camera.position.set(0, 2.0, 6.4);
    this.camera.lookAt(0, LOOK_Y, -1.5);

    this.fog = new THREE.Fog(PALETTES.meadow.fog, 9, 21);
    this.scene.fog = this.fog;

    this.hemi = new THREE.HemisphereLight(0xfff4dc, 0x9fb08a, 0.7);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe8bf, 1.7);
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
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06));

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
    const geo = new THREE.SphereGeometry(R, 96, 72);
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
    this.groundMat = new THREE.MeshStandardMaterial({ color: PALETTES.meadow.ground, flatShading: true, roughness: 0.95, metalness: 0, transparent: true });
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
   * The roll to another day. `dir` +1: the next forest waits beyond the far
   * horizon and the planet rolls it in; −1: it waits past the near edge and
   * rises. `setRoll(k)` with k in [0, 1] drives it; commit or cancel ends it.
   */
  beginRoll(dir: 1 | -1, weekday: number, growth: number, over: number) {
    this.dropIncoming();
    const biome = BIOME_BY_DAY[((weekday % 7) + 7) % 7];
    this.incoming = this.buildSet(biome, weekday, -dir * STEP);
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
    this.planet.rotation.x = this.rollDir * this.k * STEP;
  }

  commitRoll() {
    if (!this.incoming) return;
    if (this.current) this.dropSet(this.current);
    this.current = this.incoming;
    this.incoming = null;
    this.current.group.rotation.x = 0;
    // keep the ground where it is in the world while the frame of reference resets
    this.ground.rotation.x += this.rollDir * STEP;
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
        if (mesh.isMesh) mesh.geometry.dispose();
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
      const size = (i < 6 ? 1.4 : i < 11 ? 1.2 : 1.0) * (0.85 + r() * 0.35);
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

  private std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
    const m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...extra });
    m.userData.base = new THREE.Color(color);
    return m;
  }

  private makeTree(biome: Biome, pal: Palette, r: () => number) {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const trunkMat = this.std(pal.trunk);
    const pickF = () => pal.foliage[Math.floor(r() * pal.foliage.length)];
    if (biome === 'winter') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.6, 6), trunkMat);
      trunk.position.y = 0.3;
      group.add(trunk);
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const rad = 0.62 - i * 0.15;
        const h = 0.75;
        const y = 0.55 + i * 0.5;
        const m = this.std(pickF());
        mats.push(m);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), m);
        cone.position.y = y + h / 2;
        group.add(cone);
        const snow = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.72, h * 0.35, 7), this.std(0xffffff, { roughness: 1 }));
        snow.position.y = y + h - h * 0.35 / 2 + 0.01;
        group.add(snow);
      }
    } else if (biome === 'tropical') {
      let y = 0;
      let x = 0;
      for (let i = 0; i < 6; i++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.09 - i * 0.005, 0.11 - i * 0.005, 0.44, 6), trunkMat);
        seg.position.set(x, y + 0.22, 0);
        seg.rotation.z = -0.08 * i;
        group.add(seg);
        y += 0.42;
        x += 0.06 * i;
      }
      const leafMat = this.std(pickF(), { side: THREE.DoubleSide });
      mats.push(leafMat);
      for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.6, 6), leafMat);
        leaf.scale.z = 0.45;
        const a = (i / 7) * Math.PI * 2 + 0.3;
        leaf.position.set(x + Math.cos(a) * 0.58, y - 0.12, Math.sin(a) * 0.58);
        leaf.rotation.set(Math.sin(a) * 1.42, 0, -Math.cos(a) * 1.42);
        group.add(leaf);
      }
      const coco = this.std(0x6b4a33);
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), coco);
        c.position.set(x + Math.cos(i * 2.1) * 0.12, y - 0.1, Math.sin(i * 2.1) * 0.12);
        group.add(c);
      }
    } else if (biome === 'golden') {
      // a flat-topped acacia
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.3, 6), trunkMat);
      trunk.position.y = 0.65;
      group.add(trunk);
      const m = this.std(pickF());
      mats.push(m);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.55, 0.42, 9), m);
      crown.position.y = 1.5;
      group.add(crown);
      const m2 = this.std(pickF());
      mats.push(m2);
      const crown2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.3, 8), m2);
      crown2.position.set(0.25, 1.85, 0.1);
      group.add(crown2);
    } else {
      // round deciduous tree: trunk + three canopy lobes
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.95, 6), trunkMat);
      trunk.position.y = 0.47;
      group.add(trunk);
      const lobes: [number, number, number, number][] = [[0, 1.25, 0, 0.55], [-0.32, 1.05, 0.12, 0.4], [0.3, 1.1, -0.1, 0.42], [0.02, 1.6, 0.02, 0.36]];
      for (const [x, y, z, s] of lobes) {
        const m = this.std(pickF());
        mats.push(m);
        const lobe = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), m);
        lobe.position.set(x, y, z);
        group.add(lobe);
      }
    }
    return { group, mats };
  }

  private makeSmall(biome: Biome, pal: Palette, r: () => number) {
    const group = new THREE.Group();
    const mats: THREE.MeshStandardMaterial[] = [];
    const accent = () => pal.accent[Math.floor(r() * pal.accent.length)];
    const k = r();
    if (biome === 'lavender' && k < 0.75) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 4), this.std(0x6f9a5c));
      stem.position.y = 0.15;
      group.add(stem);
      const m = this.std(accent());
      mats.push(m);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), m);
      head.scale.set(1, 2.4, 1);
      head.position.y = 0.42;
      group.add(head);
    } else if (biome === 'golden' && k < 0.6) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.75, 4), this.std(0x6f9a5c));
      stem.position.y = 0.37;
      group.add(stem);
      const m = this.std(0xffd43b);
      mats.push(m);
      const petals = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 10), m);
      petals.position.y = 0.76;
      petals.rotation.x = 1.25;
      group.add(petals);
      const centre = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), this.std(0x6b4a2e));
      centre.position.set(0, 0.77, 0.02);
      centre.rotation.x = 1.25;
      group.add(centre);
    } else if (biome === 'winter') {
      const m = this.std(0xffffff, { roughness: 1 });
      const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + r() * 0.14, 1), m);
      mound.scale.y = 0.5;
      group.add(mound);
    } else if (k < 0.45) {
      // flower
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.32, 4), this.std(0x6f9a5c));
      stem.position.y = 0.16;
      group.add(stem);
      const m = this.std(accent());
      mats.push(m);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), m);
      head.position.y = 0.34;
      group.add(head);
    } else if (k < 0.75) {
      // bush
      const m = this.std(pal.foliage[Math.floor(r() * pal.foliage.length)]);
      mats.push(m);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24 + r() * 0.12, 1), m);
      bush.scale.y = 0.75;
      bush.position.y = 0.12;
      group.add(bush);
    } else {
      // grass tuft
      const m = this.std(pal.foliage[0]);
      mats.push(m);
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.32, 4), m);
        blade.position.set((i - 1) * 0.05, 0.16, 0);
        blade.rotation.z = (i - 1) * 0.25;
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
      const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.9 + r() * 0.6, 5), m);
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
    this.sun.intensity += ((this.night ? 0.55 : 1.7) - this.sun.intensity) * Math.min(1, dt * 3);
    this.sun.color.lerp(new THREE.Color(this.night ? 0xb9c6ff : 0xffe8bf), Math.min(1, dt * 3));
    this.hemi.intensity += ((this.night ? 0.4 : 0.7) - this.hemi.intensity) * Math.min(1, dt * 3);
    this.hemi.color.lerp(new THREE.Color(this.night ? 0x9aa8ff : 0xfff4dc), Math.min(1, dt * 3));
    (this.sunSprite.material as THREE.SpriteMaterial).opacity += ((this.night ? 0 : 0.7) - (this.sunSprite.material as THREE.SpriteMaterial).opacity) * Math.min(1, dt * 3);
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
