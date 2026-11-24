import * as THREE from 'three';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a13);
scene.fog = new THREE.FogExp2(0x0a0e1a, 0.02);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 220);
const CAM_BASE = new THREE.Vector3(14.2, 6.8, 14.8);
const LOOK = new THREE.Vector3(-0.8, 2.2, -1.2);
camera.position.copy(CAM_BASE);
camera.lookAt(LOOK);

const INK = 0x17121f;

let _seed = 20240;
function rnd(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  _seed = (_seed * 1664525 + 1013904223) >>> 0;
  return a + (_seed / 4294967296) * (b - a);
}

const gradData = new Uint8Array(16);
[70, 135, 200, 255].forEach((v, i) => gradData.set([v, v, v, 255], i * 4));
const GRAD = new THREE.DataTexture(gradData, 4, 1, THREE.RGBAFormat);
GRAD.minFilter = THREE.NearestFilter;
GRAD.magFilter = THREE.NearestFilter;
GRAD.needsUpdate = true;

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: GRAD, ...opts });
}

function addOutline(mesh, scale = 1.045, color = INK) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  o.scale.setScalar(scale);
  o.castShadow = false;
  o.receiveShadow = false;
  mesh.add(o);
  return o;
}

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function beam(a, b, r0, r1, mat, seg = 10) {
  const d = b.clone().sub(a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

function groundHeight(x, z) {
  return (Math.abs(x) < 7.5 && Math.abs(z) < 7.0) ? 0.15 : 0.0;
}

scene.add(new THREE.HemisphereLight(0x3a4a7a, 0x0b0d15, 0.75));
scene.add(new THREE.AmbientLight(0x2a3654, 0.65));

const moonLight = new THREE.DirectionalLight(0x8ea6ff, 0.5);
moonLight.position.set(-45, 25, -55);
scene.add(moonLight);

const rimPink = new THREE.DirectionalLight(0xff9ecb, 0.4);
rimPink.position.set(-18, 9, -32);
scene.add(rimPink);

const lampGlowTex = canvasTex(128, 128, g => {
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,236,200,1)');
  gr.addColorStop(0.25, 'rgba(255,214,150,0.55)');
  gr.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
});

function streetlight(x, z, target, intensity) {
  const grp = new THREE.Group();
  grp.position.set(x, 0, z);
  const lampMat = toon(0x5d6472);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 5.8, 12), lampMat);
  pole.position.y = 2.9;
  pole.castShadow = true;
  addOutline(pole, 1.06);
  grp.add(pole);
  grp.add(beam(new THREE.Vector3(0, 5.75, 0), new THREE.Vector3(1.25, 5.9, 0), 0.05, 0.045, lampMat));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.3), toon(0x2c313c));
  head.position.set(1.35, 5.86, 0);
  head.castShadow = true;
  addOutline(head, 1.08);
  grp.add(head);
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22), new THREE.MeshBasicMaterial({ color: 0xffe6bd }));
  bulb.rotation.x = -Math.PI / 2;
  bulb.position.set(1.35, 5.805, 0);
  grp.add(bulb);
  const spot = new THREE.SpotLight(0xffd9a8, intensity, 0, 0.62, 0.6, 2);
  spot.position.set(1.35, 5.8, 0);
  spot.target.position.copy(target);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 2;
  spot.shadow.camera.far = 45;
  spot.shadow.bias = -0.0004;
  spot.shadow.normalBias = 0.02;
  grp.add(spot);
  scene.add(grp);
  scene.add(spot.target);
  const pl = new THREE.PointLight(0xffc890, 7, 11, 2);
  pl.position.set(x + 1.35, 5.6, z);
  scene.add(pl);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lampGlowTex, color: 0xffdfb0, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.9,
  }));
  glow.scale.setScalar(3.4);
  glow.position.set(x + 1.35, 5.8, z);
  scene.add(glow);
  return spot;
}

const L1 = streetlight(-11.4, -6.8, new THREE.Vector3(-4, 0, -3.5), 620);
const L2 = streetlight(-11.4, 6.8, new THREE.Vector3(4, 0, -2.5), 560);

const asphaltTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#181b23';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.045)';
    g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(1, 3));
  }
  g.strokeStyle = 'rgba(5,6,9,0.4)';
  for (let i = 0; i < 6; i++) {
    let x = rnd(0, w), y = rnd(0, h);
    g.lineWidth = rnd(1, 2.5);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += rnd(-90, 90); y += rnd(-90, 90); g.lineTo(x, y); }
    g.stroke();
  }
}, { repeat: [14, 14] });

const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), toon(0xffffff, { map: asphaltTex }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const roadTex = canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#151a26';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 700; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.04)';
    g.fillRect(rnd(0, w), rnd(0, h), 2, 2);
  }
  g.fillStyle = 'rgba(220,225,235,0.55)';
  for (let y = 10; y < h; y += 60) g.fillRect(w / 2 - 2, y, 4, 30);
}, { repeat: [1, 12] });

const road = new THREE.Mesh(new THREE.PlaneGeometry(13, 110), toon(0xffffff, { map: roadTex }));
road.rotation.x = -Math.PI / 2;
road.position.set(-19.5, 0.006, 0);
road.receiveShadow = true;
scene.add(road);

const walkTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#2a2e3a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(10,12,18,0.6)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, w, h);
  g.beginPath();
  g.moveTo(w / 2, 0); g.lineTo(w / 2, h);
  g.moveTo(0, h / 2); g.lineTo(w, h / 2);
  g.stroke();
  for (let i = 0; i < 500; i++) {
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(rnd(0, w), rnd(0, h), 2, 2);
  }
}, { repeat: [3, 40] });

const walk = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 110), toon(0xffffff, { map: walkTex }));
walk.rotation.x = -Math.PI / 2;
walk.position.set(-11.35, 0.015, 0);
walk.receiveShadow = true;
scene.add(walk);

const curb = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 110), toon(0x3a3f4c));
curb.position.set(-13.05, 0.07, 0);
curb.receiveShadow = true;
scene.add(curb);

const courtTex = canvasTex(1024, 1024, (g, w, h) => {
  const X = x => (x + 7.5) / 15 * w;
  const Z = z => (z + 7) / 14 * h;
  g.fillStyle = '#3d4a42';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    g.fillStyle = ['#2f3a34', '#414c45', '#333d37', '#3e463f', '#454f47'][i % 5];
    g.globalAlpha = rnd(0.25, 0.5);
    g.beginPath();
    g.ellipse(rnd(0, w), rnd(0, h), rnd(50, 190), rnd(40, 150), rnd(0, 3), 0, 6.3);
    g.fill();
  }
  for (let i = 0; i < 26; i++) {
    g.fillStyle = '#4d5850';
    g.globalAlpha = rnd(0.12, 0.3);
    g.beginPath();
    g.ellipse(rnd(0, w), rnd(0, h), rnd(20, 90), rnd(15, 70), rnd(0, 3), 0, 6.3);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    g.fillStyle = i % 2 ? '#2c2a1e' : '#26301f';
    g.globalAlpha = rnd(0.2, 0.4);
    g.beginPath();
    g.ellipse(rnd(0, w), rnd(0, h), rnd(12, 55), rnd(10, 40), rnd(0, 3), 0, 6.3);
    g.fill();
  }
  g.globalAlpha = 1;
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)';
    g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 2.5), rnd(1, 2.5));
  }
  g.strokeStyle = 'rgba(8,9,11,0.55)';
  for (let i = 0; i < 11; i++) {
    let cx = rnd(0, w), cy = rnd(0, h);
    g.lineWidth = rnd(1.5, 3);
    g.beginPath();
    g.moveTo(cx, cy);
    const segs = 4 + Math.floor(rnd(0, 6));
    for (let s = 0; s < segs; s++) { cx += rnd(-70, 70); cy += rnd(-70, 70); g.lineTo(cx, cy); }
    g.stroke();
    if (rnd(0, 1) < 0.6) {
      let bx = cx, by = cy;
      g.beginPath();
      g.moveTo(bx, by);
      for (let s = 0; s < 3; s++) { bx += rnd(-50, 50); by += rnd(-50, 50); g.lineTo(bx, by); }
      g.stroke();
    }
  }
  for (const s of [1, -1]) {
    g.fillStyle = 'rgba(12,13,16,0.35)';
    g.beginPath();
    g.ellipse(X(0), Z(6.35 * s), 95, 62, 0, 0, 6.3);
    g.fill();
  }
  const line = fn => {
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(232,236,244,0.30)';
    g.lineWidth = 7;
    g.beginPath(); fn(); g.stroke();
    g.strokeStyle = 'rgba(240,244,252,0.15)';
    g.lineWidth = 3;
    g.beginPath(); fn(); g.stroke();
  };
  line(() => g.rect(X(-6.9), Z(-6.4), X(6.9) - X(-6.9), Z(6.4) - Z(-6.4)));
  line(() => { g.moveTo(X(-6.9), Z(0)); g.lineTo(X(6.9), Z(0)); });
  line(() => g.ellipse(X(0), Z(0), (1.8 / 15) * w, (1.8 / 14) * h, 0, 0, 6.3));
  for (const s of [1, -1]) {
    const ze = 6.4 * s, zf = 0.6 * s, zr = (6.4 - 1.575) * s;
    const top = Math.min(Z(ze), Z(zf));
    const hh = Math.abs(Z(ze) - Z(zf));
    g.fillStyle = 'rgba(230,236,244,0.05)';
    g.fillRect(X(-1.8), top, X(1.8) - X(-1.8), hh);
    line(() => g.rect(X(-1.8), top, X(1.8) - X(-1.8), hh));
    line(() => g.ellipse(X(0), Z(zf), (1.8 / 15) * w, (1.8 / 14) * h, 0, 0, 6.3));
    const rx = (6.75 / 15) * w, rz = (6.75 / 14) * h;
    const th = Math.acos(2.5 / 6.75);
    if (s > 0) line(() => g.ellipse(X(0), Z(zr), rx, rz, 0, Math.PI + th, Math.PI * 2 - th));
    else line(() => g.ellipse(X(0), Z(zr), rx, rz, 0, th, Math.PI - th));
    for (const sx of [1, -1]) {
      line(() => {
        g.moveTo(X(2.5 * sx), Z(ze));
        g.lineTo(X(2.5 * sx), Z(zr - s * Math.sqrt(6.75 * 6.75 - 6.25)));
      });
    }
  }
  const vg = g.createRadialGradient(w / 2, h / 2, w * 0.32, w / 2, h / 2, w * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
});

const slabMat = toon(0x596069);
const courtTop = toon(0xffffff, { map: courtTex });
const slab = new THREE.Mesh(
  new THREE.BoxGeometry(15, 0.3, 14),
  [slabMat, slabMat, courtTop, slabMat, slabMat, slabMat]
);
slab.receiveShadow = true;
addOutline(slab, 1.012);
scene.add(slab);

const FENCE_H = 3.1, FX = 9.2, FZ = 8.7;
const postMat = toon(0x6e7686);
const railMat = toon(0x7d8494);

const chainBase = canvasTex(128, 128, g => {
  g.clearRect(0, 0, 128, 128);
  g.translate(64, 64);
  g.rotate(Math.PI / 4);
  g.strokeStyle = 'rgba(178,186,200,0.95)';
  g.lineWidth = 3.4;
  for (let i = -128; i <= 128; i += 17) {
    g.beginPath(); g.moveTo(i, -128); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(-128, i); g.lineTo(128, i); g.stroke();
  }
  g.strokeStyle = 'rgba(230,236,248,0.35)';
  g.lineWidth = 1.2;
  for (let i = -128; i <= 128; i += 17) {
    g.beginPath(); g.moveTo(i - 1.4, -128); g.lineTo(i - 1.4, 128); g.stroke();
  }
});

function chainPanel(w, h) {
  const t = chainBase.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(w / 0.32, h / 0.32);
  return toon(0xb9c0cf, { map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
}

function fencePanel(w, x, z, ry) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, FENCE_H), chainPanel(w, FENCE_H));
  p.position.set(x, FENCE_H / 2, z);
  p.rotation.y = ry;
  scene.add(p);
  return p;
}

fencePanel(2 * FX, 0, -FZ, 0);
fencePanel(2 * FX, 0, FZ, 0);
fencePanel(2 * FZ, -FX, 0, Math.PI / 2);
fencePanel(FZ - 0.7, FX, -(FZ + 0.7) / 2, Math.PI / 2);
fencePanel(FZ - 0.7, FX, (FZ + 0.7) / 2, Math.PI / 2);

const gateGroup = new THREE.Group();
gateGroup.position.set(FX, 0, 0.7);
gateGroup.rotation.y = -0.5;
const gate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, FENCE_H), chainPanel(1.4, FENCE_H));
gate.rotation.y = Math.PI / 2;
gate.position.set(0, FENCE_H / 2, -0.7);
gateGroup.add(gate);
scene.add(gateGroup);

function post(x, z) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, FENCE_H + 0.25, 10), postMat);
  p.position.set(x, (FENCE_H + 0.25) / 2, z);
  p.castShadow = true;
  scene.add(p);
}

for (const x of [-FX, -6.9, -4.6, -2.3, 0, 2.3, 4.6, 6.9, FX]) { post(x, -FZ); post(x, FZ); }
for (const z of [-FZ, -6.5, -4.3, -2.2, 0, 2.2, 4.3, 6.5, FZ]) { post(-FX, z); post(FX, z); }
post(FX, -0.7);
post(FX, 0.7);

function rail(a, b) {
  const r = beam(a, b, 0.028, 0.028, railMat);
  r.castShadow = true;
  scene.add(r);
}

rail(new THREE.Vector3(-FX, FENCE_H, -FZ), new THREE.Vector3(FX, FENCE_H, -FZ));
rail(new THREE.Vector3(-FX, FENCE_H, FZ), new THREE.Vector3(FX, FENCE_H, FZ));
rail(new THREE.Vector3(-FX, FENCE_H, -FZ), new THREE.Vector3(-FX, FENCE_H, FZ));
rail(new THREE.Vector3(FX, FENCE_H, -FZ), new THREE.Vector3(FX, FENCE_H, FZ));

const poleMat = toon(0x3d5a73);
const boardMat = toon(0xe9edf2);
const rimMat = toon(0xe0702a);

const backboardTex = canvasTex(256, 160, (g, w, h) => {
  g.fillStyle = '#e9edf2';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#e0702a';
  g.lineWidth = 6;
  g.strokeRect(10, 10, w - 20, h - 20);
  g.strokeRect(w / 2 - 46, h - 66, 92, 56);
});

const netTex = canvasTex(128, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(245,246,250,0.9)';
  for (let x = 8; x < w; x += 16) {
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  g.strokeStyle = 'rgba(245,246,250,0.65)';
  g.lineWidth = 2;
  for (const y of [16, 32, 48]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
});

function hoop(s) {
  const grp = new THREE.Group();
  const zPole = 7.35 * s;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.9, 12), poleMat);
  pole.position.set(0, 1.95, zPole);
  pole.castShadow = true;
  addOutline(pole, 1.07);
  grp.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 12), toon(0x2a3440));
  base.position.set(0, 0.04, zPole);
  grp.add(base);
  grp.add(beam(new THREE.Vector3(0, 3.72, zPole), new THREE.Vector3(0, 3.9, zPole - 0.5 * s), 0.05, 0.04, poleMat));
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 0.06), boardMat);
  board.position.set(0, 3.42, zPole - 0.62 * s);
  board.castShadow = true;
  addOutline(board, 1.03);
  grp.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.97), new THREE.MeshBasicMaterial({ map: backboardTex }));
  face.position.set(0, 3.42, zPole - 0.62 * s - 0.032 * s);
  face.rotation.y = s > 0 ? Math.PI : 0;
  grp.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.022, 10, 24), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, 3.05, zPole - 1.0 * s);
  rim.castShadow = true;
  grp.add(rim);
  const net = new THREE.Mesh(
    new THREE.CylinderGeometry(0.225, 0.12, 0.38, 12, 1, true),
    toon(0xffffff, { map: netTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })
  );
  net.position.set(0, 2.86, zPole - 1.0 * s);
  grp.add(net);
  scene.add(grp);
}

hoop(1);
hoop(-1);

const ballTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#c86a2e';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(60,25,5,0.15)' : 'rgba(255,200,140,0.08)';
    g.fillRect(rnd(0, w), rnd(0, h), 2, 2);
  }
  g.strokeStyle = 'rgba(20,12,8,0.9)';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, h); g.stroke();
  g.beginPath(); g.moveTo(w, 0); g.lineTo(w, h); g.stroke();
  for (const cx of [w / 4, 3 * w / 4]) {
    g.beginPath();
    g.moveTo(cx, 0);
    g.quadraticCurveTo(cx + (cx < w / 2 ? 70 : -70), h / 2, cx, h);
    g.stroke();
  }
});

const ball = new THREE.Mesh(new THREE.SphereGeometry(0.121, 24, 18), toon(0xffffff, { map: ballTex }));
ball.position.set(-2.1, 0.15 + 0.121, 2.1);
ball.rotation.set(0.6, 0.8, 0.3);
ball.castShadow = true;
addOutline(ball, 1.05);
scene.add(ball);

const TREE_POS = new THREE.Vector3(-7.9, 0, -7.5);
const TREE_C = new THREE.Vector3(-7.5, 2.95, -7.4);
const trunkMat = toon(0x503729);

const tree = new THREE.Group();
tree.position.copy(TREE_POS);
const t1 = beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 1.15, 0.06), 0.17, 0.11, trunkMat, 8);
t1.castShadow = true;
addOutline(t1, 1.1);
tree.add(t1);
const t2 = beam(new THREE.Vector3(0.12, 1.15, 0.06), new THREE.Vector3(0.42, 2.05, 0.12), 0.11, 0.055, trunkMat, 8);
t2.castShadow = true;
addOutline(t2, 1.12);
tree.add(t2);
for (const e of [
  new THREE.Vector3(0.95, 2.6, 0.35),
  new THREE.Vector3(-0.15, 2.7, 0.75),
  new THREE.Vector3(0.3, 2.75, -0.55),
  new THREE.Vector3(0.75, 2.5, -0.2),
]) {
  const b = beam(new THREE.Vector3(0.42, 2.05, 0.12), e, 0.05, 0.018, trunkMat, 7);
  b.castShadow = true;
  tree.add(b);
}

const blobPalette = [0xffd0e2, 0xffc2da, 0xffe0ec, 0xffb3d1];
for (let i = 0; i < 13; i++) {
  const a = rnd(0, Math.PI * 2);
  const r = Math.sqrt(rnd(0, 1)) * 0.95;
  const y = rnd(-0.7, 0.9);
  const blob = new THREE.Mesh(
    new THREE.IcosahedronGeometry(rnd(0.48, 0.68), 1),
    toon(blobPalette[i % blobPalette.length], { emissive: 0x8a4a5c })
  );
  blob.position.set(
    TREE_C.x - TREE_POS.x + Math.cos(a) * r,
    TREE_C.y - TREE_POS.y + y,
    TREE_C.z - TREE_POS.z + Math.sin(a) * r
  );
  blob.scale.y = 0.82;
  blob.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
  blob.castShadow = true;
  addOutline(blob, 1.08);
  tree.add(blob);
}
scene.add(tree);

const vendTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#141b2e';
  g.fillRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 0, 0, 90);
  grd.addColorStop(0, '#eaf4ff');
  grd.addColorStop(1, '#9fc4e8');
  g.fillStyle = grd;
  g.fillRect(10, 8, w - 20, 80);
  const cols = ['#ff6b6b', '#ffd166', '#6bd5ff', '#9dff6b', '#ff9df3', '#ffb26b'];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 4; c++) {
      g.fillStyle = cols[(r * 4 + c) % cols.length];
      g.fillRect(16 + c * 58, 104 + r * 62, 44, 46);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(16 + c * 58, 104 + r * 62, 44, 10);
    }
  }
  g.fillStyle = '#0a0d16';
  g.fillRect(10, h - 70, w - 20, 60);
  g.fillStyle = 'rgba(160,220,255,0.8)';
  g.fillRect(20, h - 60, w - 40, 8);
});

const vend = new THREE.Group();
vend.position.set(-10.35, 0, -3.4);
const vendBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.85, 1.1), toon(0xa03040));
vendBody.position.y = 0.925;
vendBody.castShadow = true;
addOutline(vendBody, 1.03);
vend.add(vendBody);
const vendFace = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.7), new THREE.MeshBasicMaterial({ map: vendTex }));
vendFace.position.set(0.38, 0.95, 0);
vendFace.rotation.y = Math.PI / 2;
vend.add(vendFace);
scene.add(vend);

const vendLight = new THREE.PointLight(0xbfdcff, 2.2, 6, 2);
vendLight.position.set(-9.7, 1.2, -3.4);
scene.add(vendLight);

const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.72, 12), toon(0x2c4a3e));
bin.position.set(-10.35, 0.36, -1.9);
bin.castShadow = true;
addOutline(bin, 1.06);
scene.add(bin);

const bench = new THREE.Group();
bench.position.set(4.8, 0.15, 8.05);
bench.rotation.y = Math.PI;
const wood = toon(0x8a5f3c);
const seat = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.07, 0.42), wood);
seat.position.y = 0.46;
seat.castShadow = true;
addOutline(seat, 1.05);
bench.add(seat);
for (const dx of [-0.7, 0.7]) {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.36), wood);
  leg.position.set(dx, 0.23, 0);
  bench.add(leg);
}
scene.add(bench);

function windowTex(seed) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#0a0e1a';
    g.fillRect(0, 0, w, h);
    let s = seed;
    const rr = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 12; y < h - 16; y += 22) {
      for (let x = 10; x < w - 16; x += 20) {
        if (rr() < 0.4) {
          g.fillStyle = rr() < 0.7 ? 'rgba(255,205,140,0.95)' : 'rgba(170,205,255,0.9)';
          g.fillRect(x, y, 11, 13);
        }
      }
    }
  });
}

const winTexes = [windowTex(11), windowTex(29), windowTex(53)];
const bldMat = toon(0x0e1424);

function building(x, z, w, h, d, ry) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bldMat);
  b.position.set(x, h / 2, z);
  b.rotation.y = ry;
  b.castShadow = true;
  scene.add(b);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.86, h * 0.9),
    new THREE.MeshBasicMaterial({ map: winTexes[Math.floor(rnd(0, 3))] })
  );
  const dir = new THREE.Vector3(-x, 0, -z).normalize();
  face.position.set(x + dir.x * (d / 2 + 0.06), h * 0.5, z + dir.z * (d / 2 + 0.06));
  face.rotation.y = Math.atan2(dir.x, dir.z);
  scene.add(face);
}

building(-33, -20, 10, 17, 10, 0.3);
building(-35, 6, 12, 23, 12, -0.2);
building(-30, 32, 9, 13, 9, 0.5);
building(26, -26, 12, 19, 10, -0.4);
building(32, 4, 10, 27, 12, 0.2);
building(20, 32, 14, 15, 10, -0.6);
building(-6, -36, 16, 21, 12, 0.1);
building(12, 38, 12, 16, 10, -0.3);
building(38, -8, 9, 14, 9, 0.8);

const util = new THREE.Group();
util.position.set(-12.4, 0, -7.6);
const upole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 8, 10), toon(0x3a3f4a));
upole.position.y = 4;
upole.castShadow = true;
addOutline(upole, 1.08);
util.add(upole);
const uarm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), toon(0x3a3f4a));
uarm.position.y = 7.6;
util.add(uarm);
scene.add(util);

const wireMat = new THREE.MeshBasicMaterial({ color: 0x0a0c12 });
function wire(a, b, sag) {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 5), wireMat));
}

wire(new THREE.Vector3(-12.4, 7.9, -6.5), new THREE.Vector3(-33, 9.5, -20), 1.6);
wire(new THREE.Vector3(-12.4, 7.9, -8.7), new THREE.Vector3(-35, 10, 6), 1.8);
wire(new THREE.Vector3(-12.4, 8.1, -7.6), new THREE.Vector3(26, 11, -26), 2.4);

const starTex = canvasTex(32, 32, g => {
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(220,228,255,0.6)');
  gr.addColorStop(1, 'rgba(220,228,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
});

{
  const n = 320;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2);
    const y = rnd(0.02, 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y)) * 88;
    pos.set([Math.cos(a) * r, y * 88, Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, map: starTex, transparent: true,
    depthWrite: false, opacity: 0.9, fog: false,
  })));
}

const moonMesh = new THREE.Mesh(new THREE.CircleGeometry(3.4, 32), new THREE.MeshBasicMaterial({ color: 0xf4f1ff, fog: false }));
moonMesh.position.set(-37.5, 18, -45.7);
moonMesh.lookAt(CAM_BASE);
scene.add(moonMesh);
const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: lampGlowTex, color: 0xcdd6ff, blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true, opacity: 0.5, fog: false,
}));
moonGlow.scale.setScalar(16);
moonGlow.position.copy(moonMesh.position);
scene.add(moonGlow);

const petalShape = new THREE.Shape();
petalShape.moveTo(0, 0);
petalShape.quadraticCurveTo(0.055, 0.03, 0, 0.105);
petalShape.quadraticCurveTo(-0.055, 0.03, 0, 0);
const petalGeo = new THREE.ShapeGeometry(petalShape, 6);
petalGeo.translate(0, -0.05, 0);
const petalMat = toon(0xffffff, { side: THREE.DoubleSide, emissive: 0x6e3a4c });

const PETALS = 260;
const petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, PETALS);
petalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
petalMesh.castShadow = true;
scene.add(petalMesh);

const petals = [];
const cTmp = new THREE.Color();

function respawnPetal(p) {
  const a = rnd(0, Math.PI * 2);
  const r = Math.sqrt(rnd(0, 1));
  p.pos.set(
    TREE_C.x + Math.cos(a) * r * 1.35,
    TREE_C.y + rnd(-0.9, 1.1),
    TREE_C.z + Math.sin(a) * r * 1.35
  );
}

for (let i = 0; i < PETALS; i++) {
  const p = {
    pos: new THREE.Vector3(),
    fall: rnd(0.28, 0.72),
    rot: rnd(0, 6.28),
    rotSpeed: rnd(-3.2, 3.2),
    phase: rnd(0, 6.28),
    flut: rnd(0.4, 1.4),
    spin: rnd(1, 2.4),
  };
  respawnPetal(p);
  p.pos.y -= rnd(0, 4.5);
  petals.push(p);
  cTmp.setHSL(0.92 + rnd(-0.02, 0.03), rnd(0.45, 0.7), rnd(0.76, 0.9));
  petalMesh.setColorAt(i, cTmp);
}
petalMesh.instanceColor.needsUpdate = true;

const GROUND_PETALS = 70;
const groundPetalMesh = new THREE.InstancedMesh(petalGeo, petalMat, GROUND_PETALS);
{
  const d = new THREE.Object3D();
  for (let i = 0; i < GROUND_PETALS; i++) {
    let x, z;
    do {
      const a = rnd(0, Math.PI * 2), r = rnd(0.4, 2.9);
      x = TREE_POS.x + Math.cos(a) * r;
      z = TREE_POS.z + Math.sin(a) * r;
    } while (groundHeight(x, z) > 0);
    d.position.set(x, 0.012, z);
    d.rotation.set(rnd(-0.25, 0.25), rnd(0, 6.28), rnd(-0.25, 0.25));
    d.scale.setScalar(rnd(0.75, 1.25));
    d.updateMatrix();
    groundPetalMesh.setMatrixAt(i, d.matrix);
    groundPetalMesh.setColorAt(i, cTmp.setHSL(0.92, rnd(0.4, 0.65), rnd(0.72, 0.88)));
  }
  groundPetalMesh.instanceColor.needsUpdate = true;
  scene.add(groundPetalMesh);
}

const wind = new THREE.Vector2(0, 0);
const par = { x: 0, y: 0 };
const parT = { x: 0, y: 0 };
let lastX = null, lastY = null;

window.addEventListener('pointermove', e => {
  const dx = lastX === null ? 0 : e.clientX - lastX;
  const dy = lastY === null ? 0 : e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  wind.x = THREE.MathUtils.clamp(wind.x + dx * 0.0045, -6, 6);
  wind.y = THREE.MathUtils.clamp(wind.y + dy * 0.0045, -6, 6);
  parT.x = (e.clientX / window.innerWidth - 0.5) * 2;
  parT.y = (e.clientY / window.innerHeight - 0.5) * 2;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const dummy = new THREE.Object3D();

function updatePetals(dt, t, wx, wz) {
  for (let i = 0; i < PETALS; i++) {
    const p = petals[i];
    p.phase += dt * p.spin;
    p.rot += p.rotSpeed * dt;
    p.pos.x += (wx * (0.5 + p.flut) + Math.sin(t * 2.1 + p.phase) * 0.55) * dt * 1.7;
    p.pos.z += (wz * (0.5 + p.flut) + Math.cos(t * 1.8 + p.phase) * 0.45) * dt * 1.7;
    p.pos.y -= p.fall * dt;
    const gy = groundHeight(p.pos.x, p.pos.z);
    if (p.pos.y <= gy + 0.02 || Math.abs(p.pos.x) > 17 || Math.abs(p.pos.z) > 17) respawnPetal(p);
    dummy.position.set(p.pos.x, Math.max(p.pos.y, gy + 0.02), p.pos.z);
    dummy.rotation.set(p.rot * 0.8, p.phase * 1.3, p.rot);
    dummy.updateMatrix();
    petalMesh.setMatrixAt(i, dummy.matrix);
  }
  petalMesh.instanceMatrix.needsUpdate = true;
}

const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  wind.multiplyScalar(Math.exp(-1.3 * dt));
  const wx = 0.35 * Math.sin(t * 0.5) + wind.x;
  const wz = 0.3 * Math.cos(t * 0.42) + wind.y;
  updatePetals(dt, t, wx, wz);
  L1.intensity = 620 * (1 + 0.035 * Math.sin(t * 11.3) + 0.025 * Math.sin(t * 23.7 + 1.3));
  L2.intensity = 560 * (1 + 0.03 * Math.sin(t * 9.1 + 2) + 0.02 * Math.sin(t * 19.1));
  par.x += (parT.x - par.x) * Math.min(1, dt * 3.5);
  par.y += (parT.y - par.y) * Math.min(1, dt * 3.5);
  camera.position.set(
    CAM_BASE.x + par.x * 1.15,
    CAM_BASE.y - par.y * 0.75 + Math.sin(t * 0.28) * 0.07,
    CAM_BASE.z + par.x * 0.45
  );
  camera.lookAt(LOOK);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
