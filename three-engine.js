/**
 * Ssemble × WhopClip Studio — Three.js 3D Engine (window.WhopThreeEngine)
 * =========================================================================
 * Provides:
 * 1. Interactive 3D Cyber Studio Backdrop (Grid, drifting neon stars, tumbling geometric polyhedra, audio-reactive)
 * 2. 60fps 3D Canvas Visual FX Overlay (Composited onto 1080x1920 video canvas for live preview & export):
 *    - '3d-coins': Metallic 3D spinning gold coins shower with specular glints
 *    - '3d-cyber-rings': Rotating neon holographic gimbal/rings framing center
 *    - '3d-diamond-trophy': Faceted sparkling 3D diamond with dynamic lighting
 *    - '3d-particle-vortex': Explosive 3D particle vortex on hook & vocal hits
 *    - '3d-matrix-grid': 3D cyber perspective grid
 */

(function (window) {
  'use strict';

  const WhopThreeEngine = {
    // Backdrop state
    backdrop: {
      active: true,
      container: null,
      renderer: null,
      scene: null,
      camera: null,
      grid: null,
      particles: null,
      crystals: [],
      animId: null,
      mouseX: 0,
      mouseY: 0,
      targetMouseX: 0,
      targetMouseY: 0,
    },

    // Video Canvas 3D Overlay State (Offscreen WebGL Renderer)
    canvasFx: {
      renderer: null,
      scene: null,
      camera: null,
      canvas: null,
      initialized: false,
      currentPreset: 'none',
      width: 540,
      height: 960,
      objects: [],
      lights: [],
    },

    /**
     * Initialize Interactive 3D Cyber Studio Backdrop behind the phone canvas
     */
    initStudioBackdrop(containerEl) {
      if (typeof THREE === 'undefined') {
        console.warn('[WhopThreeEngine] THREE is not loaded yet.');
        return;
      }
      if (!containerEl) return;
      this.backdrop.container = containerEl;

      // Clean existing if any
      if (this.backdrop.renderer) {
        this.destroyStudioBackdrop();
      }

      const rect = containerEl.getBoundingClientRect();
      const w = Math.max(200, rect.width || window.innerWidth);
      const h = Math.max(200, rect.height || window.innerHeight);

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x060610, 0.04);

      const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 1000);
      camera.position.set(0, 4, 14);
      camera.lookAt(0, 0, 0);

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.className = 'three-backdrop-canvas';
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.zIndex = '1';
      containerEl.appendChild(renderer.domElement);

      // 1. Cyber Grid Floor
      const grid = new THREE.GridHelper(40, 40, 0x6366f1, 0x1e1e38);
      grid.position.y = -2.8;
      scene.add(grid);

      // 2. Drifting Star / Spark Field (450 particles)
      const partCount = 450;
      const partGeo = new THREE.BufferGeometry();
      const posArray = new Float32Array(partCount * 3);
      const colArray = new Float32Array(partCount * 3);

      const palette = [
        new THREE.Color(0x6366f1), // Indigo
        new THREE.Color(0xe11d48), // Rose
        new THREE.Color(0x06b6d4), // Cyan
        new THREE.Color(0x10b981), // Emerald
      ];

      for (let i = 0; i < partCount; i++) {
        posArray[i * 3 + 0] = (Math.random() - 0.5) * 32;
        posArray[i * 3 + 1] = (Math.random() - 0.5) * 20;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * 26;

        const col = palette[Math.floor(Math.random() * palette.length)];
        colArray[i * 3 + 0] = col.r;
        colArray[i * 3 + 1] = col.g;
        colArray[i * 3 + 2] = col.b;
      }

      partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      partGeo.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

      const partMat = new THREE.PointsMaterial({
        size: 0.14,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });

      const particles = new THREE.Points(partGeo, partMat);
      scene.add(particles);

      // 3. Tumbling 3D Translucent Crystals in corners
      const crystals = [];
      const cryGeo = new THREE.IcosahedronGeometry(0.85, 0);
      const cryMat = new THREE.MeshPhongMaterial({
        color: 0x6366f1,
        emissive: 0x1e1b4b,
        specular: 0x00f2fe,
        shininess: 90,
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      });

      const posList = [
        [-8, 3, -4],
        [8, 2.5, -3],
        [-6, -1.5, 2],
        [7, -1.8, 1],
      ];

      posList.forEach(([px, py, pz], idx) => {
        const mesh = new THREE.Mesh(cryGeo, cryMat.clone());
        mesh.position.set(px, py, pz);
        mesh.scale.setScalar(0.7 + idx * 0.2);
        scene.add(mesh);
        crystals.push({
          mesh,
          rotSpeed: {
            x: (Math.random() - 0.5) * 0.015,
            y: (Math.random() - 0.5) * 0.02,
            z: (Math.random() - 0.5) * 0.01,
          },
        });
      });

      // Lighting
      const ambLight = new THREE.AmbientLight(0x222233, 1.2);
      scene.add(ambLight);

      const dirLight = new THREE.DirectionalLight(0x6366f1, 2.0);
      dirLight.position.set(5, 10, 7);
      scene.add(dirLight);

      const pointLight = new THREE.PointLight(0xe11d48, 2.5, 25);
      pointLight.position.set(-5, 3, 5);
      scene.add(pointLight);

      this.backdrop.scene = scene;
      this.backdrop.camera = camera;
      this.backdrop.renderer = renderer;
      this.backdrop.grid = grid;
      this.backdrop.particles = particles;
      this.backdrop.crystals = crystals;

      // Mouse Parallax listener on window
      const onMouseMove = (e) => {
        const cx = window.innerWidth * 0.5;
        const cy = window.innerHeight * 0.5;
        this.backdrop.targetMouseX = (e.clientX - cx) / cx;
        this.backdrop.targetMouseY = (e.clientY - cy) / cy;
      };
      window.addEventListener('mousemove', onMouseMove, { passive: true });

      // Window resize listener
      const onResize = () => {
        if (!this.backdrop.container || !this.backdrop.renderer) return;
        const r = this.backdrop.container.getBoundingClientRect();
        const nw = Math.max(200, r.width);
        const nh = Math.max(200, r.height);
        this.backdrop.camera.aspect = nw / nh;
        this.backdrop.camera.updateProjectionMatrix();
        this.backdrop.renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', onResize);

      // Animation Loop for Studio Backdrop
      let lastTime = performance.now();
      const animate = () => {
        if (!this.backdrop.active || !this.backdrop.renderer) return;
        this.backdrop.animId = requestAnimationFrame(animate);

        const now = performance.now();
        const dt = (now - lastTime) * 0.001;
        lastTime = now;

        // Smooth mouse parallax lerp
        this.backdrop.mouseX += (this.backdrop.targetMouseX - this.backdrop.mouseX) * 0.05;
        this.backdrop.mouseY += (this.backdrop.targetMouseY - this.backdrop.mouseY) * 0.05;

        camera.position.x = this.backdrop.mouseX * 3.5;
        camera.position.y = 4 - this.backdrop.mouseY * 2.2;
        camera.lookAt(0, 0, 0);

        // Slowly scroll grid forward
        if (grid) {
          grid.position.z = (grid.position.z + dt * 1.5) % 2;
        }

        // Rotate particle field
        if (particles) {
          particles.rotation.y += dt * 0.04;
          particles.rotation.x += dt * 0.015;
        }

        // Tumble crystals
        crystals.forEach((c) => {
          c.mesh.rotation.x += c.rotSpeed.x;
          c.mesh.rotation.y += c.rotSpeed.y;
          c.mesh.rotation.z += c.rotSpeed.z;
        });

        renderer.render(scene, camera);
      };

      animate();
      console.log('[WhopThreeEngine] 🌌 Interactive 3D Cyber Studio Backdrop initialized.');
    },

    toggleStudioBackdrop(enabled) {
      this.backdrop.active = !!enabled;
      if (this.backdrop.container) {
        this.backdrop.container.style.opacity = enabled ? '1' : '0';
        this.backdrop.container.style.transition = 'opacity 0.3s ease';
      }
    },

    destroyStudioBackdrop() {
      if (this.backdrop.animId) {
        cancelAnimationFrame(this.backdrop.animId);
        this.backdrop.animId = null;
      }
      if (this.backdrop.renderer && this.backdrop.renderer.domElement) {
        const el = this.backdrop.renderer.domElement;
        if (el.parentNode) el.parentNode.removeChild(el);
        this.backdrop.renderer.dispose();
      }
      this.backdrop.renderer = null;
      this.backdrop.scene = null;
      this.backdrop.camera = null;
    },

    // =========================================================================
    // 60FPS 3D CANVAS VISUAL FX OVERLAY (COMPOSITED ONTO VIDEO CANVAS)
    // =========================================================================
    initCanvas3DFX() {
      if (typeof THREE === 'undefined') return;
      if (this.canvasFx.initialized) return;

      const w = this.canvasFx.width;
      const h = this.canvasFx.height;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 100);
      camera.position.set(0, 0, 8);

      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
      renderer.setSize(w, h);
      renderer.setClearColor(0x000000, 0);

      this.canvasFx.scene = scene;
      this.canvasFx.camera = camera;
      this.canvasFx.renderer = renderer;
      this.canvasFx.canvas = renderer.domElement;
      this.canvasFx.initialized = true;

      // Lights
      const ambLight = new THREE.AmbientLight(0xffffff, 0.9);
      scene.add(ambLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
      dirLight.position.set(4, 6, 8);
      scene.add(dirLight);

      const pointLight = new THREE.PointLight(0xffd700, 2.5, 15);
      pointLight.position.set(0, 1, 4);
      scene.add(pointLight);

      this.canvasFx.lights = [ambLight, dirLight, pointLight];
    },

    setCanvas3DPreset(presetId) {
      if (!this.canvasFx.initialized) this.initCanvas3DFX();
      if (this.canvasFx.currentPreset === presetId) return;

      const scene = this.canvasFx.scene;
      if (!scene) return;

      // Clear previous objects
      this.canvasFx.objects.forEach((obj) => scene.remove(obj.mesh || obj));
      this.canvasFx.objects = [];
      this.canvasFx.currentPreset = presetId || 'none';

      if (presetId === '3d-coins') {
        this._build3DCoinsPreset();
      } else if (presetId === '3d-cyber-rings') {
        this._build3DCyberRingsPreset();
      } else if (presetId === '3d-diamond-trophy') {
        this._build3DDiamondPreset();
      } else if (presetId === '3d-particle-vortex') {
        this._build3DParticleVortexPreset();
      } else if (presetId === '3d-matrix-grid') {
        this._build3DMatrixGridPreset();
      }
    },

    _build3DCoinsPreset() {
      const scene = this.canvasFx.scene;
      const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.08, 32);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        metalness: 0.9,
        roughness: 0.22,
        emissive: 0x332200,
      });

      const count = 18;
      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(coinGeo, coinMat);
        mesh.position.set(
          (Math.random() - 0.5) * 6,
          Math.random() * 12 - 2,
          (Math.random() - 0.5) * 4
        );
        mesh.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        scene.add(mesh);
        this.canvasFx.objects.push({
          mesh,
          speedY: 1.8 + Math.random() * 2.5,
          rotX: (Math.random() - 0.5) * 0.08,
          rotY: (Math.random() - 0.5) * 0.1,
          rotZ: (Math.random() - 0.5) * 0.05,
          resetY: 6.5,
          floorY: -6.5,
        });
      }
    },

    _build3DCyberRingsPreset() {
      const scene = this.canvasFx.scene;
      const ringMat1 = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        metalness: 0.8,
        roughness: 0.2,
      });
      const ringMat2 = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0x9f1239,
        metalness: 0.8,
        roughness: 0.2,
      });
      const ringMat3 = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x6b21a8,
        metalness: 0.8,
        roughness: 0.2,
      });

      const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.06, 16, 64), ringMat1);
      const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.05, 16, 64), ringMat2);
      const r3 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 16, 64), ringMat3);

      scene.add(r1);
      scene.add(r2);
      scene.add(r3);

      this.canvasFx.objects.push(
        { mesh: r1, rx: 0.02, ry: 0.03, rz: 0.01 },
        { mesh: r2, rx: -0.03, ry: 0.015, rz: -0.02 },
        { mesh: r3, rx: 0.015, ry: -0.025, rz: 0.035 }
      );
    },

    _build3DDiamondPreset() {
      const scene = this.canvasFx.scene;
      const diaGeo = new THREE.OctahedronGeometry(1.3, 0);
      const diaMat = new THREE.MeshPhysicalMaterial({
        color: 0x60a5fa,
        emissive: 0x1e3a8a,
        metalness: 0.2,
        roughness: 0.05,
        transmission: 0.6,
        thickness: 1.2,
        specularIntensity: 1.5,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(diaGeo, diaMat);
      mesh.position.set(0, 0.5, 0);
      scene.add(mesh);

      // Surrounding sparkles
      const sparkGeo = new THREE.IcosahedronGeometry(0.18, 0);
      const sparkMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        roughness: 0.1,
      });

      const sparks = [];
      for (let i = 0; i < 6; i++) {
        const sm = new THREE.Mesh(sparkGeo, sparkMat);
        scene.add(sm);
        sparks.push(sm);
      }

      this.canvasFx.objects.push({
        mesh,
        sparks,
        rx: 0.015,
        ry: 0.025,
      });
    },

    _build3DParticleVortexPreset() {
      const scene = this.canvasFx.scene;
      const count = 300;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        const radius = Math.random() * 3.8 + 0.4;
        const theta = Math.random() * Math.PI * 2;
        pos[i * 3 + 0] = Math.cos(theta) * radius;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
        pos[i * 3 + 2] = Math.sin(theta) * radius;

        col[i * 3 + 0] = 1.0;
        col[i * 3 + 1] = Math.random() * 0.7 + 0.2;
        col[i * 3 + 2] = Math.random() * 0.4;
      }

      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.18,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geo, mat);
      scene.add(points);
      this.canvasFx.objects.push({ mesh: points });
    },

    _build3DMatrixGridPreset() {
      const scene = this.canvasFx.scene;
      const grid = new THREE.GridHelper(16, 16, 0x10b981, 0x064e3b);
      grid.rotation.x = Math.PI * 0.35;
      grid.position.y = -2;
      scene.add(grid);
      this.canvasFx.objects.push({ mesh: grid, isGrid: true });
    },

    /**
     * Render the 3D FX offscreen WebGL scene and composite onto the 2D canvas context
     */
    renderCanvas3DFX(targetCtx, W, H, timeSec, voiceLevel, fxPreset) {
      if (!fxPreset || fxPreset === 'none') return;
      if (!this.canvasFx.initialized) this.initCanvas3DFX();
      if (this.canvasFx.currentPreset !== fxPreset) this.setCanvas3DPreset(fxPreset);

      const scene = this.canvasFx.scene;
      const camera = this.canvasFx.camera;
      const renderer = this.canvasFx.renderer;
      if (!scene || !renderer) return;

      // Update 3D animation state
      const dt = 0.016;
      if (fxPreset === '3d-coins') {
        this.canvasFx.objects.forEach((c) => {
          c.mesh.position.y -= c.speedY * dt * (1.0 + voiceLevel * 0.6);
          c.mesh.rotation.x += c.rotX;
          c.mesh.rotation.y += c.rotY;
          c.mesh.rotation.z += c.rotZ;
          if (c.mesh.position.y < c.floorY) {
            c.mesh.position.y = c.resetY;
            c.mesh.position.x = (Math.random() - 0.5) * 6;
          }
        });
      } else if (fxPreset === '3d-cyber-rings') {
        this.canvasFx.objects.forEach((r, idx) => {
          const mult = 1.0 + voiceLevel * 1.5;
          r.mesh.rotation.x += r.rx * mult;
          r.mesh.rotation.y += r.ry * mult;
          r.mesh.rotation.z += r.rz * mult;
          const s = 1.0 + Math.sin(timeSec * 3 + idx) * 0.05 * (1.0 + voiceLevel);
          r.mesh.scale.setScalar(s);
        });
      } else if (fxPreset === '3d-diamond-trophy') {
        const item = this.canvasFx.objects[0];
        if (item) {
          item.mesh.rotation.y += item.ry * (1.0 + voiceLevel);
          item.mesh.rotation.x = Math.sin(timeSec * 2) * 0.2;
          if (item.sparks) {
            item.sparks.forEach((sp, idx) => {
              const ang = timeSec * 2.5 + (idx * Math.PI * 2) / item.sparks.length;
              const rad = 2.2 + Math.sin(timeSec * 4 + idx) * 0.3;
              sp.position.set(Math.cos(ang) * rad, Math.sin(ang * 1.5) * 0.8 + 0.5, Math.sin(ang) * rad);
            });
          }
        }
      } else if (fxPreset === '3d-particle-vortex') {
        const p = this.canvasFx.objects[0];
        if (p && p.mesh) {
          p.mesh.rotation.y += dt * 1.8 * (1.0 + voiceLevel * 2.0);
          p.mesh.rotation.z = Math.sin(timeSec) * 0.15;
        }
      } else if (fxPreset === '3d-matrix-grid') {
        const g = this.canvasFx.objects[0];
        if (g && g.mesh) {
          g.mesh.position.z = (g.mesh.position.z + dt * 2.0) % 2;
        }
      }

      // Render WebGL
      renderer.render(scene, camera);

      // Composite onto 2D canvas with high-quality alpha blending
      targetCtx.save();
      targetCtx.drawImage(this.canvasFx.canvas, 0, 0, W, H);
      targetCtx.restore();
    },
  };

  window.WhopThreeEngine = WhopThreeEngine;
})(window);
