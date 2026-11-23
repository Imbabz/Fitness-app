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
import { musicLevel } from '../lib/audio';
import { normalFromAlpha, paintForest, paintForeground, paintGround, paintNearPine, paintPeaks, paintSky, PALETTE, type Hour } from './campArt';

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
const LOOK = new Vector3(0.1, -0.05, -6);
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
  uniform sampler2D map, nmap, map2;
  uniform float uMix, uPaired; // le crépuscule et la nuit d'un même plan, fondus
  uniform vec4 uRect; // la case de la planche : décalage xy, taille zw
  uniform vec3 uTint, uHazeColor, uAmbient, uSkyColor, uFireColor, uFirePos, uSkyDir;
  uniform float uHaze, uReveal, uFade, uLit, uFlip, uFire;
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    if (vUv.y > uReveal) discard;
    vec2 st = uRect.xy + vUv * uRect.zw;
    vec4 c = mix(texture2D(map, st), texture2D(map2, st), uMix);
    float a = c.a * smoothstep(0.0, uFade + 0.0001, vUv.y);
    if (a < 0.08) discard;
    vec3 col = c.rgb * uTint;
    if (uLit > 0.5) {
      vec3 n = texture2D(nmap, st).rgb * 2.0 - 1.0;
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
      // Un plan peint en deux palettes porte déjà sa nuit : pas d'ambiance par-dessus.
      vec3 amb = mix(uAmbient, vec3(0.82), uPaired);
      col = c.rgb * (amb + uSkyColor * sky + uFireColor * fire * 1.6) + uFireColor * rim * 1.2;
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
    const nightMix = { value: 0 };
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
            uRect: { value: [0, 0, 1, 1] },
            uFade: { value: o.fade ?? 0 },
            nmap: { value: o.nmap ?? null },
            map2: { value: map },
            uMix: nightMix,
            uPaired: { value: 0 },
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

    // ------------------------------------------------------------ la clairière peinte
    // Chaque plan est peint deux fois (campArt.ts), au crépuscule et à la nuit,
    // et le shader passe de l'un à l'autre avec la routine.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pair = (paint: (h: Hour) => HTMLCanvasElement) => {
      const mk = (c: HTMLCanvasElement) => {
        const t = keep(new CanvasTexture(c));
        t.colorSpace = SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      };
      const dusk = paint('dusk');
      return { d: mk(dusk), n: mk(paint('night')), src: dusk };
    };
    function painted(
      pr: { d: Texture; n: Texture; src: HTMLCanvasElement },
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      o: { wind?: number; normal?: boolean; flat?: boolean; flip?: boolean } = {},
    ) {
      const g = keep(new PlaneGeometry(w, h));
      if (!o.flat) g.translate(0, h / 2, 0);
      let nmap: Texture | null = null;
      if (o.normal) {
        nmap = keep(new CanvasTexture(normalFromAlpha(pr.src)));
        nmap.colorSpace = NoColorSpace;
      }
      const mat = layerMat(pr.d, { wind: o.wind ?? 0, nmap, flip: !!o.flip });
      mat.uniforms.map2!.value = pr.n;
      mat.uniforms.uPaired!.value = 1;
      if (o.flat) mat.alphaToCoverage = false;
      const m = new Mesh(g, mat);
      m.position.set(x, y, z);
      if (o.flip) m.scale.x = -1;
      scene.add(m);
      return m;
    }

    // Le ciel, très loin.
    painted(pair(paintSky), 120, 75, 0, GROUND - 22, -72, { flat: false });

    // La source des rayons : le soleil bas, puis la lune.
    const sunMat = keep(new MeshBasicMaterial({ color: new Color('#ffd6a0'), transparent: true }));
    const sun = new Mesh(keep(new CircleGeometry(2.4, 48)), sunMat);
    sun.position.set(6, 1.2, -60);
    scene.add(sun);

    // Les sommets taillés, puis deux rangées de forêt qui s'enfoncent dans la brume.
    painted(pair(paintPeaks), 86, 21.8, 0, GROUND + 0.4, -50);
    painted(pair((h) => paintForest(h, 'far')), 62, 7.2, 0.5, GROUND - 1.2, -31);
    painted(pair((h) => paintForest(h, 'mid')), 48, 7.4, -0.5, GROUND - 0.9, -21);

    // Le sol, à plat : bruyère, herbe rase, terre tassée du camp, sentier.
    const ground = painted(pair(paintGround), 70, 52, 0, GROUND, -20, { flat: true });
    ground.rotation.x = -Math.PI / 2;

    // Deux grands sapins encadrent la scène, assez près pour que le feu les touche.
    const nearL = pair((h) => paintNearPine(h, 61));
    const nearR = pair((h) => paintNearPine(h, 71));
    painted(nearL, 5.6, 11.2, -6.4, GROUND - 0.2, -10, { normal: true, wind: 0.08 });
    painted(nearR, 5.0, 10, 6.9, GROUND - 0.2, -11.5, { normal: true, wind: 0.07, flip: true });

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
    // Le montagnard : un sprite animé rendu depuis son modèle 3D. Couleur et
    // normales défilent ensemble, si bien que le feu et la lune l'éclairent
    // comme tout le reste. Un geste par étape, jamais un mouvement d'exercice.
    // Les personnages : des sprites animés rendus depuis leurs modèles 3D.
    // Couleur et normales défilent ensemble, si bien que le feu et la lune les
    // éclairent comme tout le reste. Un geste par étape, jamais un mouvement
    // d'exercice.
    const cast = (spec.characters ?? []).map((ch) => {
      const frames: Record<string, { c: Texture; n: Texture }> = {};
      for (const [name, a] of Object.entries(ch.actions)) {
        const c = tex(a.c);
        const n = tex(a.n);
        n.colorSpace = NoColorSpace;
        frames[name] = { c, n };
      }
      const first = frames[ch.plan[0]!]!;
      const z = zOf(ch.depth);
      const vh = visibleHeight(z);
      const h = (ch.h / CSS_SCENE_H) * vh;
      const halfW = (vh / 2) * 1.22;
      const mesh = panel(first.c, h, ch.frameAspect, (ch.x / 100 - 0.5) * 2 * halfW + 0.4, z, { nmap: first.n });
      mesh.position.y = GROUND - h * 0.02;
      addShadow(mesh);
      return { ch, frames, mesh, clock: 0 };
    });
    let level = 0;

    // Le premier plan peint : bruyère, herbes hautes, un rocher, tout près.
    painted(pair((h) => paintForeground(h, 81)), 3.4, 1.42, -2.4, GROUND - 0.25, 3.4, { normal: true, wind: 0.03 });
    painted(pair((h) => paintForeground(h, 91)), 3.0, 1.25, 2.7, GROUND - 0.3, 3.7, { normal: true, wind: 0.03, flip: true });
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
    const mistDusk = new Color(PALETTE.dusk.mist);
    const mistNight = new Color(PALETTE.night.mist);
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
      nightMix.value = p;
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
      starMat.uniforms.uAlpha!.value = MathUtils.smoothstep(p, 0.5, 0.9);
      mists.forEach((m) => {
        m.t.offset.x = (now / 1000) * m.speed;
        m.mat.color.copy(mistDusk).lerp(mistNight, p);
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
      // Les lucioles s'éclairent un peu avec la musique.
      flyMat.uniforms.uAlpha!.value = MathUtils.smoothstep(p, 0.55, 0.95) * (0.8 + level * 0.6);

      // Le niveau de la musique, lissé : Firmin joue avec elle.
      level += (musicLevel() - level) * 0.15;
      for (const actor of cast) {
        const { ch, frames, mesh } = actor;
        // Le geste de l'étape, joué en boucle à son rythme de dessin animé.
        const k = Math.round((L.stageIndex / lastStage) * (ch.plan.length - 1));
        const name = ch.plan[k]!;
        const t = frames[name]!;
        const u = (mesh.material as ShaderMaterial).uniforms;
        u.map!.value = t.c;
        u.map2!.value = t.c; // le même dessin de jour comme de nuit
        u.nmap!.value = t.n;
        const musical = ch.musical?.includes(name) ?? false;
        // Avec la musique, la flûte suit le niveau : plus vive quand ça joue,
        // plus lente dans le silence, et le corps se balance avec la phrase.
        const speed = musical ? 0.55 + level * 0.9 : 1;
        actor.clock += (1000 / 24 / 1000) * ch.fps * speed;
        const f = Math.floor(actor.clock) % (ch.cols * ch.rows);
        const cw = 1 / ch.cols;
        const rh = 1 / ch.rows;
        // Une planche se lit de haut en bas ; une texture, de bas en haut.
        u.uRect!.value = [(f % ch.cols) * cw, 1 - (Math.floor(f / ch.cols) + 1) * rh, cw, rh];
        mesh.rotation.z = musical ? Math.sin(now / 900) * 0.025 * (0.35 + level) : 0;
      }

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
