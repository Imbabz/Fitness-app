import { useEffect, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  RepeatWrapping,
  CanvasTexture,
  CircleGeometry,
  Color,
  HalfFloatType,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import {
  BlendFunction,
  BloomEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  GodRaysEffect,
  NoiseEffect,
  RenderPass,
  VignetteEffect,
} from 'postprocessing';
import type { SceneSpec } from '../data/adventures';
import { reveal, storyStage } from './CampScene';

/*
 * La clairière, filmée.
 *
 * Les plans peints de la scène deviennent des panneaux posés à de vraies
 * distances, sur un vrai sol, devant une vraie caméra. Rien n'est modélisé :
 * c'est de la 2D peinte, mais la profondeur, la mise au point, les rayons de
 * lumière et le halo du feu sont réels — le principe de la caméra multiplane
 * des films d'animation, en WebGL.
 *
 * La description de la scène est la même que pour la version CSS : chaque
 * plan a une profondeur de 0 (le lointain) à 1 (devant l'objectif), qui
 * devient ici une distance. La version CSS reste le secours, et c'est elle
 * qu'on voit le temps que ce module se charge.
 *
 * Sobriété : 24 images par seconde au plus, et rien du tout quand la scène est
 * hors de l'écran ou l'app en arrière-plan. Une séance dure une heure, sur un
 * téléphone posé contre une gourde.
 */

const FOV = 30;
const GROUND = -2.2;
const CAM_FROM = new Vector3(1.4, -0.9, 10);
const CAM_TO = new Vector3(-0.2, -1.2, 6.6);
const LOOK = new Vector3(0.1, -0.6, -6);
/** La hauteur de référence de la scène CSS, pour convertir ses pixels. */
const CSS_SCENE_H = 287;

/** Une profondeur de la description devient une distance dans la clairière. */
function zOf(depth: number): number {
  return depth >= 1 ? 3.4 : -32 + depth * 33;
}
/** La hauteur visible à la distance d'un plan, vue depuis la position de départ. */
function visibleHeight(z: number): number {
  return 2 * (CAM_FROM.z - z) * Math.tan(MathUtils.degToRad(FOV / 2));
}

/*
 * Un seul matériau pour tous les plans. La texture, une teinte (la nuit
 * tombe), la brume (la distance), le vent (le haut bouge, le pied non), et la
 * construction : on ne montre que le bas de la pièce, série après série.
 */
const VERT = /* glsl */ `
  uniform float uTime, uWind, uPhase;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.x += sin(uTime * 0.9 + uPhase) * uWind * uv.y * uv.y;
    vec4 w = modelMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
/*
 * La lumière de Klaus, sur des dessins plats.
 *
 * Chaque image peinte a sa carte de normales : le relief de la forme, calculé
 * hors ligne à partir de sa transparence et de sa luminosité. Le shader
 * l'éclaire comme un volume — c'est le principe de l'outil de lumière de
 * Klaus : des dessins 2D, des normales, une lumière principale et une
 * lumière d'ambiance.
 *  - le ciel : une lumière directionnelle, le soleil bas puis la lune ;
 *  - le feu : une lumière ponctuelle, chaude, qui décroît avec la distance ;
 *  - un liseré sur les bords tournés vers le feu, la signature du film.
 * Sans carte de normales, l'image garde sa couleur, teintée par la nuit.
 */
const FRAG = /* glsl */ `
  uniform sampler2D map, nmap;
  uniform vec3 uTint, uHazeColor, uAmbient, uSkyColor, uFireColor, uFirePos, uSkyDir;
  uniform float uHaze, uReveal, uFade, uLit, uFlip, uFire;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    if (vUv.y > uReveal) discard;
    vec4 c = texture2D(map, vUv);
    float a = c.a * smoothstep(0.0, uFade + 0.0001, vUv.y);
    if (a < 0.08) discard;
    vec3 col = c.rgb * uTint;
    if (uLit > 0.5) {
      vec3 n = texture2D(nmap, vUv).rgb * 2.0 - 1.0;
      n.x *= uFlip;
      n = normalize(n);
      vec3 toFire = uFirePos - vWorld;
      float d = length(toFire);
      vec3 lf = toFire / d;
      float att = uFire / (1.0 + d * d * 0.09);
      float sky = max(dot(n, normalize(uSkyDir)), 0.0);
      float fire = max(dot(n, lf), 0.0) * att;
      // Le liseré : les bords (normale presque de profil) tournés vers le feu.
      float rim = pow(1.0 - n.z, 1.6) * max(dot(normalize(n.xy + 1e-4), normalize(lf.xy + 1e-4)), 0.0) * att;
      col = c.rgb * (uAmbient + uSkyColor * sky + uFireColor * fire * 1.6) + uFireColor * rim * 1.2;
    }
    gl_FragColor = vec4(mix(col, uHazeColor, uHaze), a);
  }`;

interface Live {
  stageIndex: number;
  stageCount: number;
  setsDone: number;
  setsTotal: number;
}

export default function CampSceneGL({
  scene: spec,
  stageIndex,
  stageCount,
  setsDone,
  setsTotal,
  onFail,
}: {
  scene: SceneSpec;
  stageIndex: number;
  stageCount: number;
  setsDone: number;
  setsTotal: number;
  /** WebGL a refusé ou s'est perdu : on rend la main à la version CSS. */
  onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef<Live>({ stageIndex, stageCount, setsDone, setsTotal });
  live.current = { stageIndex, stageCount, setsDone, setsTotal };

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full';
    el.appendChild(canvas);

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
    } catch {
      canvas.remove();
      onFail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();
    const camera = new PerspectiveCamera(FOV, 1, 0.5, 200);
    const loader = new TextureLoader();
    const owned: Array<{ dispose: () => void }> = [];
    const keep = <T extends { dispose: () => void }>(x: T) => (owned.push(x), x);
    const tex = (src: string) => {
      const t = keep(loader.load(src));
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const uTime = { value: 0 };
    // La lumière est partagée par tous les plans : un seul endroit à animer.
    const light = {
      ambient: { value: new Color(1, 1, 1) },
      skyColor: { value: new Color('#ffc890') },
      skyDir: { value: new Vector3(0.9, 0.25, 0.35) },
      fireColor: { value: new Color('#ffa65a') },
      firePos: { value: new Vector3(0, 0, 0) },
      fire: { value: 0 },
    };
    const tinted: ShaderMaterial[] = [];

    function layerMat(map: Texture, o: { haze?: number; wind?: number; fade?: number; nmap?: Texture | null; flip?: boolean } = {}) {
      return keep(
        new ShaderMaterial({
          uniforms: {
            map: { value: map },
            uTime,
            uWind: { value: o.wind ?? 0 },
            uPhase: { value: Math.random() * 6 },
            uHaze: { value: o.haze ?? 0 },
            uHazeColor: { value: new Color('#8d93b8') },
            uTint: { value: new Color(1, 1, 1) },
            uReveal: { value: 1 },
            uFade: { value: o.fade ?? 0 },
            nmap: { value: o.nmap ?? null },
            uLit: { value: o.nmap ? 1 : 0 },
            uFlip: { value: o.flip ? -1 : 1 },
            uAmbient: light.ambient,
            uSkyColor: light.skyColor,
            uSkyDir: light.skyDir,
            uFireColor: light.fireColor,
            uFirePos: light.firePos,
            uFire: light.fire,
          },
          vertexShader: VERT,
          fragmentShader: FRAG,
          alphaToCoverage: true,
        }),
      );
    }
    /** Un panneau posé au sol, son pied à l'origine. */
    function panel(map: Texture, h: number, aspect: number, x: number, z: number, o: { haze?: number; wind?: number; fade?: number; flip?: boolean; lit?: boolean; nmap?: Texture | null } = {}) {
      const g = keep(new PlaneGeometry(h * aspect, h));
      g.translate(0, h / 2, 0);
      const m = new Mesh(g, layerMat(map, o));
      m.position.set(x, GROUND, z);
      if (o.flip) m.scale.x = -1;
      if (!o.lit) tinted.push(m.material);
      scene.add(m);
      return m;
    }
    function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      if (g) draw(g);
      const t = keep(new CanvasTexture(c));
      t.colorSpace = SRGBColorSpace;
      return t;
    }
    /** Une image de la description, placée à sa profondeur, à sa taille d'origine. */
    function fromSpec(src: string, x: number, h: number, depth: number, o: { haze?: number; wind?: number; fade?: number; flip?: boolean; lit?: boolean; scale?: number; normal?: string | undefined } = {}) {
      const z = zOf(depth);
      const vh = visibleHeight(z);
      const worldH = (h / CSS_SCENE_H) * vh * (o.scale ?? 1);
      const halfW = (vh / 2) * 1.22;
      // Les proportions réelles ne sont connues qu'au chargement de l'image.
      const map = keep(
        loader.load(src, (t) => {
          const img = t.image as HTMLImageElement;
          if (img?.width) {
            m.scale.x = (o.flip ? -1 : 1) * (img.width / img.height);
          }
        }),
      );
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = 4;
      const nmap = o.normal ? tex(o.normal) : null;
      if (nmap) nmap.colorSpace = NoColorSpace; // une normale est une donnée, pas une couleur
      const m = panel(map, worldH, 1, (x / 100 - 0.5) * 2 * halfW + 0.4, z, { ...o, nmap });
      return m;
    }

    // Le ciel, très loin : le crépuscule, puis la nuit par-dessus.
    const skyGeo = keep(new PlaneGeometry(96, 45.4));
    const skyDusk = new Mesh(skyGeo, keep(new MeshBasicMaterial({ map: tex(spec.skies[0]), depthWrite: false })));
    const nightMat = keep(new MeshBasicMaterial({ map: tex(spec.skies[1]), transparent: true, opacity: 0, depthWrite: false }));
    const skyNight = new Mesh(skyGeo, nightMat);
    skyDusk.position.set(0, 9, -70);
    skyNight.position.set(0, 9, -69.9);
    scene.add(skyDusk, skyNight);

    // La source des rayons : le soleil bas, puis la lune.
    const sunMat = keep(new MeshBasicMaterial({ color: new Color('#ffd6a0'), transparent: true }));
    const sun = new Mesh(keep(new CircleGeometry(2.4, 48)), sunMat);
    sun.position.set(6, 1.2, -60);
    scene.add(sun);

    // Les montagnes, en deux crêtes de lavis.
    const mountains = canvasTex(1024, 256, (g) => {
      const ridge = (pts: number[][], top: string, bottom: string) => {
        const grad = g.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, top);
        grad.addColorStop(1, bottom);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0, 256);
        pts.forEach(([x, y]) => g.lineTo(x! * 1024, y! * 256));
        g.lineTo(1024, 256);
        g.closePath();
        g.fill();
      };
      ridge([[0, 0.62], [0.08, 0.38], [0.17, 0.55], [0.3, 0.18], [0.42, 0.5], [0.55, 0.3], [0.68, 0.58], [0.8, 0.32], [0.92, 0.5], [1, 0.4]], '#a7add0', '#8b90b4');
      ridge([[0, 0.8], [0.12, 0.6], [0.25, 0.74], [0.4, 0.55], [0.56, 0.78], [0.7, 0.6], [0.86, 0.76], [1, 0.64]], '#7a7fa6', '#666a90');
    });
    const mountainMesh = panel(mountains, 9, 4, 0, -40, { haze: 0.15 });
    mountainMesh.position.y = GROUND - 1.5;

    // Le sol de la clairière, peint au pinceau : une base, puis des centaines
    // de touches douces d'herbe et de terre. Le hasard est fixé (une graine),
    // pour que le sol ne change pas d'une étape à l'autre.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const groundTex = canvasTex(512, 512, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#6b7882');
      grad.addColorStop(0.5, '#56655a');
      grad.addColorStop(1, '#46523f');
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 512);
      const tones = ['#4f6048', '#64735a', '#7a8466', '#5c5444', '#3f4a3a', '#8a8f72'];
      for (let i = 0; i < 1400; i++) {
        g.globalAlpha = 0.05 + rnd() * 0.08;
        g.fillStyle = tones[Math.floor(rnd() * tones.length)]!;
        g.beginPath();
        g.ellipse(rnd() * 512, rnd() * 512, 4 + rnd() * 18, 1.5 + rnd() * 4, rnd() * 0.6 - 0.3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    });
    groundTex.wrapS = groundTex.wrapT = RepeatWrapping;
    groundTex.repeat.set(4, 3);
    const ground = new Mesh(keep(new PlaneGeometry(80, 60)), layerMat(groundTex));
    ground.material.alphaToCoverage = false;
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, GROUND, -25);
    tinted.push(ground.material);
    scene.add(ground);

    // Les étoiles, qui n'apparaissent qu'avec la nuit.
    const starGeo = keep(new BufferGeometry());
    const starPos: number[] = [];
    for (let i = 0; i < 90; i++) starPos.push((rnd() - 0.5) * 90, 4 + rnd() * 26, -66);
    starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
    const starMat = keep(
      new ShaderMaterial({
        uniforms: { uAlpha: { value: 0 }, uTime },
        vertexShader: `uniform float uTime; varying float vT; void main(){ vT = sin(uTime*1.3 + position.x*7.0 + position.y*3.0); vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = 2.0 + vT; gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform float uAlpha; varying float vT; void main(){ float d = length(gl_PointCoord-0.5); if (d>0.5) discard; gl_FragColor = vec4(vec3(0.92,0.94,1.0), (1.0-d*2.0)*uAlpha*(0.65+0.35*vT)); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    scene.add(new Points(starGeo, starMat));

    // La brume : deux nappes entre les plans, qui dérivent lentement. C'est
    // elle qui fait sentir l'air entre le lointain et le camp.
    const mistTex = canvasTex(512, 128, (g) => {
      for (let i = 0; i < 60; i++) {
        const x = rnd() * 512;
        const y = 50 + rnd() * 40;
        const r = 30 + rnd() * 70;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(225,230,245,0.16)');
        gr.addColorStop(1, 'rgba(225,230,245,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 512, 128);
      }
      // Aucun bord net : la nappe s'évanouit en haut et en bas.
      g.globalCompositeOperation = 'destination-in';
      const fade = g.createLinearGradient(0, 0, 0, 128);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(0.45, 'rgba(0,0,0,1)');
      fade.addColorStop(0.8, 'rgba(0,0,0,1)');
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fade;
      g.fillRect(0, 0, 512, 128);
      g.globalCompositeOperation = 'source-over';
    });
    mistTex.wrapS = RepeatWrapping;
    const mists = [
      { z: -20, y: GROUND - 0.05, w: 70, h: 4.5, speed: 0.004, alpha: 0.7 },
      { z: -9.5, y: GROUND - 0.05, w: 40, h: 2.6, speed: 0.007, alpha: 0.5 },
    ].map((m) => {
      const t = mistTex.clone();
      keep(t);
      t.wrapS = RepeatWrapping;
      t.needsUpdate = true;
      const mat = keep(new MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: m.alpha }));
      const mesh = new Mesh(keep(new PlaneGeometry(m.w, m.h)), mat);
      mesh.position.set(0, m.y + m.h / 2, m.z);
      scene.add(mesh);
      return { t, mat, speed: m.speed, alpha: m.alpha };
    });

    // Les ombres de contact : une tache douce sous chaque chose posée au sol.
    // Sans elle, tout flotte ; avec elle, tout pèse.
    const blobTex = canvasTex(128, 64, (g) => {
      const gr = g.createRadialGradient(64, 32, 0, 64, 32, 64);
      gr.addColorStop(0, 'rgba(10,12,20,0.55)');
      gr.addColorStop(1, 'rgba(10,12,20,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 64);
    });
    const blobGeo = keep(new PlaneGeometry(1, 1));
    const shadows: Array<{ of: Mesh; blob: Mesh }> = [];
    const addShadow = (of: Mesh) => {
      const blob = new Mesh(blobGeo, keep(new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })));
      blob.rotation.x = -Math.PI / 2;
      scene.add(blob);
      shadows.push({ of, blob });
    };

    // Les plans de décor, puis les pièces de l'histoire.
    spec.layers.forEach((l) =>
      fromSpec(l.src, l.x, l.h, l.depth, { haze: Math.max(0, 0.6 - l.depth) * 1.1, wind: l.sway ? 0.15 : 0, flip: !!l.flip, normal: l.normal }),
    );
    const decor = scene.children.filter((c): c is Mesh => c instanceof Mesh && c.position.z > -30 && c.position.z < -5 && c !== ground);
    decor.forEach(addShadow);
    const pieces = spec.pieces.map((pc) => ({
      pc,
      mesh: fromSpec(pc.src, pc.x, pc.h, pc.depth, { lit: !!pc.glow, fade: pc.glow ? 0.25 : 0, scale: 0.8, normal: pc.normal }),
    }));
    const fireMesh = pieces.find((p) => p.pc.glow)?.mesh;
    pieces.forEach(({ mesh, pc }) => !pc.glow && addShadow(mesh));
    // L'image provisoire du feu a une bande de sol claire en bas : on enfonce
    // le panneau, et c'est le sol de la clairière qui la cache.
    if (fireMesh) fireMesh.position.y = GROUND - (fireMesh.geometry as PlaneGeometry).parameters.height * 0.2;

    // Les braises : elles montent du feu, dérivent, s'éteignent. Tout se
    // calcule dans le shader à partir du temps : aucune particule à suivre.
    const emberGeo = keep(new BufferGeometry());
    const emberSeed: number[] = [];
    for (let i = 0; i < 46; i++) emberSeed.push(rnd(), rnd(), rnd());
    emberGeo.setAttribute('position', new Float32BufferAttribute(emberSeed, 3));
    const emberMat = keep(
      new ShaderMaterial({
        uniforms: { uTime, uOrigin: { value: new Vector3() }, uAlpha: { value: 0 } },
        vertexShader: `uniform float uTime; uniform vec3 uOrigin; varying float vLife;
          void main(){ float t = fract(uTime*(0.18+position.y*0.22) + position.x); vLife = t;
            vec3 p = uOrigin + vec3((position.x-0.5)*0.5 + sin(uTime*1.7+position.z*9.0)*0.25*t, t*3.2, (position.z-0.5)*0.4);
            vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = (3.5 - t*2.5) * (12.0 / -mv.z); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform float uAlpha; varying float vLife; void main(){ float d = length(gl_PointCoord-0.5); if (d>0.5) discard;
          gl_FragColor = vec4(1.0, 0.62 + 0.3*(1.0-vLife), 0.28, (1.0-d*2.0)*(1.0-vLife)*uAlpha); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    scene.add(new Points(emberGeo, emberMat));

    // Les lucioles, la nuit, au ras des herbes.
    const flyGeo = keep(new BufferGeometry());
    const flyPos: number[] = [];
    for (let i = 0; i < 22; i++) flyPos.push((rnd() - 0.5) * 12, GROUND + 0.3 + rnd() * 1.6, -3 - rnd() * 9);
    flyGeo.setAttribute('position', new Float32BufferAttribute(flyPos, 3));
    const flyMat = keep(
      new ShaderMaterial({
        uniforms: { uTime, uAlpha: { value: 0 } },
        vertexShader: `uniform float uTime; varying float vB;
          void main(){ vec3 p = position + vec3(sin(uTime*0.4+position.z*3.0)*0.5, sin(uTime*0.7+position.x*2.0)*0.25, cos(uTime*0.3+position.y)*0.3);
            vB = 0.5+0.5*sin(uTime*2.2+position.x*11.0); vec4 mv = modelViewMatrix*vec4(p,1.0); gl_PointSize = 9.0*(10.0 / -mv.z); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform float uAlpha; varying float vB; void main(){ float d = length(gl_PointCoord-0.5); if (d>0.5) discard;
          gl_FragColor = vec4(0.95, 1.0, 0.6, pow(1.0-d*2.0, 2.0)*vB*uAlpha); }`,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    scene.add(new Points(flyGeo, flyMat));

    // La lueur du feu : un disque additif ; le halo fait le reste.
    const glowMat = keep(
      new MeshBasicMaterial({
        map: canvasTex(256, 256, (g) => {
          const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
          r.addColorStop(0, 'rgba(255,180,100,.9)');
          r.addColorStop(0.4, 'rgba(255,140,60,.25)');
          r.addColorStop(1, 'rgba(255,140,60,0)');
          g.fillStyle = r;
          g.fillRect(0, 0, 256, 256);
        }),
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      }),
    );
    const glow = new Mesh(keep(new PlaneGeometry(6, 4)), glowMat);
    if (fireMesh) glow.position.set(fireMesh.position.x, GROUND + 0.6, fireMesh.position.z + 0.2);
    scene.add(glow);

    // Le premier plan, tout près de l'objectif : flou, sombre, il bouge le plus.
    const fore = spec.foreground.map((f) => fromSpec(f.src, f.x, f.h * 0.75, 1, { wind: 0.05, flip: !!f.flip, normal: f.normal }));

    // Les effets. Rayons et mise au point dans la même passe : deux passes
    // séparées lisaient et écrivaient la même texture.
    const composer = keep(new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    const godRays = new GodRaysEffect(camera, sun, { density: 0.95, decay: 0.92, weight: 0.32, exposure: 0.6, samples: 50, clampMax: 1, blur: true });
    const dof = new DepthOfFieldEffect(camera, { worldFocusRange: 5, bokehScale: 2.6, resolutionScale: 0.5 });
    dof.target = new Vector3(0, GROUND + 0.8, -5.8);
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY });
    noise.blendMode.opacity.value = 0.18;
    composer.addPass(new EffectPass(camera, godRays, dof));
    composer.addPass(
      new EffectPass(camera, new BloomEffect({ luminanceThreshold: 0.62, luminanceSmoothing: 0.2, intensity: 1.1, mipmapBlur: true }), new VignetteEffect({ offset: 0.3, darkness: 0.5 }), noise),
    );

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // On ne dessine que si on est vu.
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(el);

    const lost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    canvas.addEventListener('webglcontextlost', lost);

    const nightTint = new Color(0.42, 0.47, 0.68);
    const nightSky = new Color(0.32, 0.36, 0.55);
    const white = new Color(1, 1, 1);
    const tint = new Color();
    let p = live.current.stageIndex / Math.max(1, live.current.stageCount - 1);
    let raf = 0;
    let last = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !visible || now - last < 1000 / 24) return;
      last = now;
      const L = live.current;
      const lastStage = Math.max(1, L.stageCount - 1);
      const target = L.stageIndex / lastStage;
      // La caméra et la lumière rejoignent l'étape en douceur.
      p += (target - p) * 0.06;
      if (Math.abs(target - p) < 0.0005) p = target;
      uTime.value = now / 1000;

      camera.position.lerpVectors(CAM_FROM, CAM_TO, p);
      camera.lookAt(LOOK);
      nightMat.opacity = p;
      const night = MathUtils.smoothstep(p, 0.45, 0.75);
      sun.position.set(MathUtils.lerp(6, -7, night), MathUtils.lerp(1.2 - p * 2, 9, night), -60);
      sunMat.color.set(night > 0.5 ? '#dfe6ff' : '#ffd6a0');
      sun.scale.setScalar(night > 0.5 ? 0.55 : 1);
      godRays.godRaysMaterial.uniforms.weight!.value = night > 0.5 ? 0.16 : 0.32 * (1 - p * 0.8);
      tint.copy(white).lerp(nightTint, p);
      // Ce qui n'a pas de relief (le sol, les montagnes) prend seulement la teinte.
      tinted.forEach((m) => { if (!m.uniforms.uLit!.value) m.uniforms.uTint!.value.copy(tint); });
      fore.forEach((m) => (m.material as ShaderMaterial).uniforms.uTint!.value.setScalar(0.6));

      let fire = 0;
      for (const { pc, mesh } of pieces) {
        const gone = pc.until !== undefined && L.stageIndex >= storyStage(pc.until, L.stageCount);
        const r = gone ? 0 : reveal(storyStage(pc.at, L.stageCount), L.stageIndex, L.setsDone, L.setsTotal);
        mesh.visible = r > 0;
        (mesh.material as ShaderMaterial).uniforms.uReveal!.value = r;
        if (pc.glow) fire = r;
      }
      glowMat.opacity = fire * 0.85;

      // Le ciel : le soleil bas à droite, chaud, puis la lune en haut à
      // gauche, froide. L'ambiance passe du jour tiède au bleu de la nuit.
      light.ambient.value.copy(white).lerp(nightTint, p);
      if (night > 0.5) {
        light.skyDir.value.set(-0.5, 0.75, 0.45);
        light.skyColor.value.set('#8fa6e8').multiplyScalar(0.45);
      } else {
        light.skyDir.value.set(0.9, 0.25, 0.35);
        light.skyColor.value.set('#ffbe82').multiplyScalar(0.55 * (1 - p));
      }
      light.fire.value = fire;
      if (fireMesh) light.firePos.value.set(fireMesh.position.x, GROUND + 0.7, fireMesh.position.z + 0.3);
      // Le ciel s'assombrit vraiment, les étoiles viennent avec la nuit.
      (skyDusk.material as MeshBasicMaterial).color.copy(white).lerp(nightSky, p);
      nightMat.color.copy(white).lerp(nightSky, p * 0.9);
      starMat.uniforms.uAlpha!.value = MathUtils.smoothstep(p, 0.5, 0.9);
      mists.forEach((m) => {
        m.t.offset.x = (now / 1000) * m.speed;
        m.mat.color.copy(white).lerp(nightTint, p);
        m.mat.opacity = m.alpha * (1 - p * 0.35);
      });
      for (const { of, blob } of shadows) {
        const g = (of.geometry as PlaneGeometry).parameters;
        const w = Math.abs(of.scale.x) * g.width;
        blob.visible = of.visible;
        blob.position.set(of.position.x, GROUND + 0.01, of.position.z + 0.05);
        blob.scale.set(w * 0.95, Math.max(0.35, w * 0.28), 1);
      }
      if (fireMesh) emberMat.uniforms.uOrigin!.value.set(fireMesh.position.x, GROUND + 0.5, fireMesh.position.z + 0.1);
      emberMat.uniforms.uAlpha!.value = fire;
      flyMat.uniforms.uAlpha!.value = MathUtils.smoothstep(p, 0.55, 0.95);

      // Le feu vacille sur deux rythmes qui ne se répètent jamais tout à fait.
      if (fireMesh && fire > 0) fireMesh.scale.y = 1 + Math.sin(now / 90) * 0.03 + Math.sin(now / 37) * 0.02;

      composer.render();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('webglcontextlost', lost);
      owned.forEach((o) => o.dispose());
      renderer.dispose();
      canvas.remove();
    };
    // La scène se construit une fois ; l'étape et les séries passent par `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  return <div ref={host} aria-hidden="true" className="ridge-story absolute inset-0 overflow-hidden" />;
}
