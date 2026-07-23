// <molecule-3d data-id="bpc157"></molecule-3d>
// Accurate, element-colored ball-and-stick molecular viewer (three.js).
// Atoms are CPK-colored by true element; bonds come from the structure's
// real connectivity. Drag to rotate, auto-spins when idle.
import { getStructure, elementInfo, hasStructure } from './structures-engine.js';

let threePromise = null;
function loadThree() {
  if (!threePromise) threePromise = import('./vendor/three.module.js');
  return threePromise;
}

class Molecule3D extends HTMLElement {
  static get observedAttributes() { return ['data-id']; }

  connectedCallback() {
    if (this._disconnectTimer) {
      clearTimeout(this._disconnectTimer);
      this._disconnectTimer = null;
      return;
    }
    if (this._started) return;
    this._started = true;
    if (!this.style.display) this.style.display = 'block';
    this.style.touchAction = 'none';
    this.style.cursor = 'grab';
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(this._canvas);
    this._rotX = -0.25; this._rotY = 0.5; this._velY = 0; this._dragging = false;
    this._setup();
  }

  attributeChangedCallback(name, oldV, newV) {
    if (name === 'data-id' && this._THREE && oldV !== newV) this._build();
  }

  disconnectedCallback() {
    this._disconnectTimer = setTimeout(() => {
      this._disconnectTimer = null;
      if (this.isConnected) return;
      cancelAnimationFrame(this._raf);
      if (this._ro) this._ro.disconnect();
      if (this._renderer) this._renderer.dispose();
      this._started = false;
    }, 300);
  }

  async _setup() {
    const THREE = await loadThree();
    if (!this.isConnected || !this._canvas) return;
    this._THREE = THREE;
    this._renderer = new THREE.WebGLRenderer({ canvas: this._canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this._scene = new THREE.Scene();
    this._camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
    this._camera.position.set(0, 0, 30);

    this._scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(5, 8, 7); this._scene.add(key);
    const fill = new THREE.DirectionalLight(0xbcccff, 0.5); fill.position.set(-6, -3, 4); this._scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(-4, 2, -6); this._scene.add(rim);

    this._group = new THREE.Group();
    this._scene.add(this._group);

    this._sphereGeo = new THREE.SphereGeometry(1, 40, 28);
    this._materials = {};

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._resize();
    await this._build();
    this._bindPointer();

    const tick = () => {
      this._raf = requestAnimationFrame(tick);
      if (!this._dragging) { this._velY *= 0.95; this._rotY += 0.004 + this._velY; }
      this._group.rotation.x = this._rotX;
      this._group.rotation.y = this._rotY;
      this._renderer.render(this._scene, this._camera);
    };
    tick();
  }

  _resize() {
    if (!this._renderer) return;
    const w = this.clientWidth || 300, h = this.clientHeight || 300;
    this._renderer.setSize(w, h, false);
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
  }

  _bindPointer() {
    let px = 0, py = 0;
    this.addEventListener('pointerdown', (e) => {
      this._dragging = true; px = e.clientX; py = e.clientY;
      try { this.setPointerCapture(e.pointerId); } catch (err) {}
      this.style.cursor = 'grabbing';
    });
    this.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      this._rotY += dx * 0.008;
      this._rotX = Math.max(-1.4, Math.min(1.4, this._rotX + dy * 0.006));
      this._velY = dx * 0.0004;
    });
    const up = () => { this._dragging = false; this.style.cursor = 'grab'; };
    this.addEventListener('pointerup', up);
    this.addEventListener('pointercancel', up);
  }

  _mat(color) {
    if (!this._materials[color]) {
      // Glowing-glass orb: glossy surface (bright specular highlight, low
      // roughness) plus a dim self-emission in the atom's own color so it reads
      // as lit from within. The halo/bloom comes from the glow shells below.
      this._materials[color] = new this._THREE.MeshStandardMaterial({
        color,
        roughness: 0.18,
        metalness: 0.0,
        emissive: color,
        emissiveIntensity: 0.55,
      });
    }
    return this._materials[color];
  }

  // Soft translucent shells stacked around an atom to fake an additive bloom
  // halo (this bundle has no AdditiveBlending/Sprite). Cached per color.
  _glowMat(color, opacity) {
    const key = color + ':' + opacity;
    if (!this._glowMats) this._glowMats = {};
    if (!this._glowMats[key]) {
      this._glowMats[key] = new this._THREE.MeshStandardMaterial({
        color: 0x000000,
        emissive: color,
        emissiveIntensity: 1.0,
        roughness: 1.0,
        metalness: 0.0,
        transparent: true,
        opacity,
        depthWrite: false,
      });
    }
    return this._glowMats[key];
  }

  _clear() {
    const g = this._group;
    while (g.children.length) {
      const m = g.children.pop();
      if (m.geometry && m.geometry !== this._sphereGeo) m.geometry.dispose();
    }
  }

  async _build() {
    const THREE = this._THREE;
    const id = this.getAttribute('data-id');
    const token = (this._token = Symbol());
    const mol = await getStructure(id);
    if (token !== this._token || !this.isConnected) return; // superseded
    this._clear();
    if (!mol) { this.dispatchEvent(new CustomEvent('molempty')); return; }

    const V = (a) => new THREE.Vector3(a.x, a.y, a.z);
    // scale model to a consistent on-screen size
    let maxR = 0;
    for (const a of mol.atoms) maxR = Math.max(maxR, Math.hypot(a.x, a.y, a.z));
    const fit = 11 / (maxR || 1);

    // Detect flat (2D) structures: some PubChem records have no 3D conformer,
    // so every atom sits on z=0. Rendered as-is they collapse to an edge-on
    // sliver when spun. Give them real depth by puckering the layout into a
    // gentle, deterministic 3D surface so the molecule reads as three-dimensional.
    let maxZ = 0;
    for (const a of mol.atoms) maxZ = Math.max(maxZ, Math.abs(a.z));
    this._flat = maxZ < 1e-3 && mol.atoms.length > 3;
    if (this._flat) {
      let cx = 0, cy = 0;
      for (const a of mol.atoms) { cx += a.x; cy += a.y; }
      cx /= mol.atoms.length; cy /= mol.atoms.length;
      let spanX = 0, spanY = 0;
      for (const a of mol.atoms) { spanX = Math.max(spanX, Math.abs(a.x - cx)); spanY = Math.max(spanY, Math.abs(a.y - cy)); }
      const span = Math.max(spanX, spanY) || 1;
      const amp = span * 0.45; // depth amplitude relative to molecule size
      for (const a of mol.atoms) {
        const nx = (a.x - cx) / span, ny = (a.y - cy) / span;
        // smooth, wave-like pucker — deterministic and dependent on position
        a.z = amp * (Math.sin(nx * 2.4) * Math.cos(ny * 2.1) + 0.35 * Math.sin((nx + ny) * 3.1));
      }
    }

    // Ball-and-stick: atom radius = 0.34 * covalent radius (scaled)
    // Luminous bonds: softly self-lit, slightly translucent tubes so they read
    // like glowing connectors rather than matte sticks.
    const bondMat = new THREE.MeshStandardMaterial({
      color: 0xaeb4c8,
      emissive: 0x8893ad,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.0,
      transparent: true,
      opacity: 0.82,
    });
    const Y = new THREE.Vector3(0, 1, 0);

    for (const a of mol.atoms) {
      const info = elementInfo(a.el);
      const pos = V(a).multiplyScalar(fit);
      const coreR = Math.max(0.32, info.radius * 0.40) * fit;

      // Solid glowing core orb.
      const m = new THREE.Mesh(this._sphereGeo, this._mat(info.color));
      m.position.copy(pos);
      m.scale.setScalar(coreR);
      this._group.add(m);

      // Two translucent shells around it create a soft, color-bleeding halo so
      // each atom looks like a luminous orb (faked bloom).
      const shells = [
        { scale: coreR * 1.55, opacity: 0.22 },
        { scale: coreR * 2.35, opacity: 0.10 },
      ];
      for (const s of shells) {
        const glow = new THREE.Mesh(this._sphereGeo, this._glowMat(info.color, s.opacity));
        glow.position.copy(pos);
        glow.scale.setScalar(s.scale);
        glow.renderOrder = 2;
        this._group.add(glow);
      }
    }

    const bondR = 0.085 * fit;
    for (const [i, j, order] of mol.bonds) {
      const a = V(mol.atoms[i]).multiplyScalar(fit);
      const b = V(mol.atoms[j]).multiplyScalar(fit);
      const dir = new THREE.Vector3().subVectors(b, a);
      const length = dir.length();
      if (length < 1e-4) continue;
      const offsets = order >= 2 ? [-1, 1] : [0];
      // perpendicular for drawing double bonds as twin cylinders
      const perp = new THREE.Vector3().crossVectors(dir, Y).normalize();
      if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
      for (const off of offsets) {
        const r = order >= 2 ? bondR * 0.62 : bondR;
        const geo = new THREE.CylinderGeometry(r, r, length, 12);
        const mesh = new THREE.Mesh(geo, bondMat);
        const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
          .addScaledVector(perp, off * bondR * 1.1);
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(Y, dir.clone().normalize());
        this._group.add(mesh);
      }
    }

    // frame the camera to fit
    const box = new THREE.Box3().setFromObject(this._group);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this._camera.position.set(0, 0, Math.max(20, sphere.radius * 2.6));
    const order = ['C', 'N', 'O', 'S', 'P', 'Cu', 'H'];
    const elements = [...new Set(mol.atoms.map((a) => a.el))].sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).map((el) => ({ el, color: '#' + elementInfo(el).color.toString(16).padStart(6, '0') }));
    this.dispatchEvent(new CustomEvent('molready', {
      bubbles: true,
      detail: { source: mol.source, atoms: mol.atoms.length, elements },
    }));
  }
}

if (!customElements.get('molecule-3d')) customElements.define('molecule-3d', Molecule3D);
export { Molecule3D };

// Expose a synchronous capability check to the (classic-script) main app so it
// can decide whether to render the 3D section for a given compound.
window.hasMoleculeStructure = hasStructure;
