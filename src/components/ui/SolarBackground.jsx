import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const SolarBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId;
    let renderer, scene, camera, mesh;

    try {
      // 1. Scene setup
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog('#000000', 200, 700);

      // 2. Camera setup
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      
      const updateCameraPosition = (width, height) => {
        const aspect = width / height;
        const isMobile = width < 768;
        let baseDistance = isMobile ? 380 : 320;
        if (aspect < 1) {
          baseDistance = baseDistance / Math.max(aspect, 0.45);
        }
        camera.position.set(0, 0, Math.min(baseDistance, 680));
        camera.lookAt(0, 0, 0);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      };

      // 3. Renderer setup
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const handleResize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        const width = parent.clientWidth || window.innerWidth;
        const height = parent.clientHeight || window.innerHeight;
        renderer.setSize(width, height, false);
        updateCameraPosition(width, height);
      };

      handleResize();

      const resizeObserver = new ResizeObserver(() => handleResize());
      if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
      }

      // 4. Instanced Particles setup
      const count = 12000;
      const geometry = new THREE.TetrahedronGeometry(0.3);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      mesh = new THREE.InstancedMesh(geometry, material, count);

      const dummy = new THREE.Object3D();
      const target = new THREE.Vector3();
      const pColor = new THREE.Color();

      const positions = [];
      for (let i = 0; i < count; i++) {
        positions.push(new THREE.Vector3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        ));
      }

      scene.add(mesh);

      const PARAMS = { radius: 118, fusion: 6, convect: 1.05, magnetic: 1.65, wind: 1.2, loops: 21.28 };
      const clock = new THREE.Clock();

      // 5. Animation Loop
      const render = () => {
        const time = clock.getElapsedTime();

        for (let i = 0; i < count; i++) {
          const scaleR = PARAMS.radius;
          const fusionRate = PARAMS.fusion;
          const convection = PARAMS.convect;
          const magnetic = PARAMS.magnetic;
          const windSpeed = PARAMS.wind;
          const loopsCount = Math.max(4, Math.floor(PARAMS.loops));

          const t = i / count;
          const h1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
          const h2 = Math.abs(Math.sin(i * 78.2330) * 12543.1230) % 1;
          const h3 = Math.abs(Math.sin(i * 45.1640) * 98765.4320) % 1;
          const h4 = Math.abs(Math.sin(i * 33.7190) * 54321.9870) % 1;
          const h5 = Math.abs(Math.sin(i * 61.4310) * 31415.9265) % 1;

          const t0 = 0.12, t1 = 0.32, t2 = 0.55, t3 = 0.68, t4 = 0.78, t5 = 0.90, t6 = 0.97;
          let px = 0, py = 0, pz = 0;

          if (t < t0) {
            const coreR = scaleR * 0.22;
            const theta = h1 * 6.2831853;
            const cphi = h2 * 2 - 1;
            const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
            const rr = Math.cbrt(Math.max(h3, 0.0001)) * coreR;
            const rad = rr + Math.sin(time * 3 + h4 * 6.283) * coreR * 0.03;
            px = rad * sphi * Math.cos(theta);
            py = rad * sphi * Math.sin(theta);
            pz = rad * cphi;
            const burst = Math.pow(0.5 + 0.5 * Math.sin(time * fusionRate * 4 + h5 * 18.85), 6);
            const bright = 0.5 + 0.5 * burst;
            pColor.setHSL(Math.max(0, 0.14 - burst * 0.05), 1.0, Math.min(0.95, 0.55 + bright * 0.4));
          } else if (t < t1) {
            const rMin = scaleR * 0.22, rMax = scaleR * 0.46;
            const rr = rMin + h1 * (rMax - rMin);
            const theta = h2 * 6.2831853 + Math.sin(time * 0.03 + h3 * 6.283) * 0.3;
            const cphi = h3 * 2 - 1;
            const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
            const rad = rr + Math.sin(time * 0.08 + h4 * 6.283) * scaleR * 0.02;
            px = rad * sphi * Math.cos(theta);
            py = rad * sphi * Math.sin(theta);
            pz = rad * cphi;
            pColor.setHSL(0.06, 0.9, 0.25 + h5 * 0.1);
          } else if (t < t2) {
            const rMin = scaleR * 0.46, rMax = scaleR * 0.72;
            const rr = rMin + h1 * (rMax - rMin);
            const theta = h2 * 6.2831853;
            const cphi = h3 * 2 - 1;
            const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
            const cell = Math.sin(theta * 6 + time * convection * 0.5) + Math.sin(cphi * 18 + time * convection * 0.4 + h4 * 6.283) + Math.sin((theta + cphi) * 12 - time * convection * 0.6);
            const flow = cell * convection * scaleR * 0.015;
            const rad = rr + flow;
            px = rad * sphi * Math.cos(theta + flow * 0.01);
            py = rad * sphi * Math.sin(theta + flow * 0.01);
            pz = rad * cphi;
            const heat = (cell + 3) / 6;
            pColor.setHSL(Math.max(0, 0.08 - heat * 0.02), 1.0, 0.3 + heat * 0.35);
          } else if (t < t3) {
            const R = scaleR * 0.76;
            const theta = h1 * 6.2831853;
            const cphi = h2 * 2 - 1;
            const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
            const granule = Math.sin(theta * 24 + time * 0.6) + Math.sin(cphi * 30 - time * 0.5 + h3 * 6.283) + Math.sin(theta * 17 + cphi * 13 + time * 0.4);
            const spotNoise = Math.sin(theta * 3 + h4 * 6.283) + Math.sin(cphi * 4 + time * 0.05);
            const spotDark = Math.max(0, -spotNoise - 1.1) * 0.8;
            const rad = R + granule * scaleR * 0.004;
            px = rad * sphi * Math.cos(theta);
            py = rad * sphi * Math.sin(theta);
            pz = rad * cphi;
            const bright = 0.6 + granule * 0.1 - spotDark;
            pColor.setHSL(0.13, 0.9, Math.max(0.08, Math.min(0.85, bright)));
          } else if (t < t4) {
            const Rbase = scaleR * 0.79;
            const theta = h1 * 6.2831853;
            const cphi = h2 * 2 - 1;
            const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
            const spiculeLen = scaleR * 0.05;
            const spicule = Math.abs(Math.sin(time * 2 + h3 * 18.85)) * spiculeLen;
            const rad = Rbase + spicule;
            px = rad * sphi * Math.cos(theta);
            py = rad * sphi * Math.sin(theta);
            pz = rad * cphi;
            pColor.setHSL(0.98, 0.85, 0.35 + (spicule / Math.max(spiculeLen, 0.0001)) * 0.25);
          } else if (t < t5) {
            if (h5 < 0.5) {
              const loopIndex = Math.floor(i % loopsCount);
              const lh1 = Math.abs(Math.sin(loopIndex * 17.17) * 6543.21) % 1;
              const lh2 = Math.abs(Math.sin(loopIndex * 29.71) * 7654.32) % 1;
              const lh3 = Math.abs(Math.sin(loopIndex * 53.13) * 8765.43) % 1;
              const lh4 = Math.abs(Math.sin(loopIndex * 71.91) * 9876.54) % 1;
              const pcphi = lh2 * 2 - 1;
              const psphi = Math.sqrt(Math.max(0, 1 - pcphi * pcphi));
              const pTheta = lh1 * 6.2831853;
              const pX = psphi * Math.cos(pTheta), pY = psphi * Math.sin(pTheta), pZ = pcphi;
              const refX = 0, refY = 1, refZ = 0.15;
              let e1x = refY * pZ - refZ * pY, e1y = refZ * pX - refX * pZ, e1z = refX * pY - refY * pX;
              const len1 = Math.max(Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z), 1e-5);
              e1x /= len1; e1y /= len1; e1z /= len1;
              let e2x = pY * e1z - pZ * e1y, e2y = pZ * e1x - pX * e1z, e2z = pX * e1y - pY * e1x;
              const len2 = Math.max(Math.sqrt(e2x * e2x + e2y * e2y + e2z * e2z), 1e-5);
              e2x /= len2; e2y /= len2; e2z /= len2;
              const halfWidth = 0.2 + lh3 * 0.35;
              const alpha = (h1 - 0.5) * halfWidth * 2;
              let dirx = e1x * Math.cos(alpha) + e2x * Math.sin(alpha);
              let diry = e1y * Math.cos(alpha) + e2y * Math.sin(alpha);
              let dirz = e1z * Math.cos(alpha) + e2z * Math.sin(alpha);
              const dlen = Math.max(Math.sqrt(dirx * dirx + diry * diry + dirz * dirz), 1e-5);
              dirx /= dlen; diry /= dlen; dirz /= dlen;
              const bulge = Math.cos((h1 - 0.5) * 3.14159);
              const flarePulse = 0.6 + 0.4 * Math.sin(time * 0.4 * magnetic + lh4 * 6.283);
              const archHeight = scaleR * (0.1 + lh3 * 0.15) * Math.max(0.1, magnetic) * flarePulse;
              const radius = scaleR * 0.8 + archHeight * bulge;
              px = dirx * radius; py = diry * radius; pz = dirz * radius;
              pColor.setHSL(0.55, 0.3, 0.45 + bulge * 0.3);
            } else {
              const theta = h1 * 6.2831853;
              const cphi = h2 * 2 - 1;
              const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
              const travel = (time * windSpeed * 0.6 + h3 * 18) % 18;
              const rad = scaleR * 0.82 + travel * scaleR * 0.05;
              px = rad * sphi * Math.cos(theta);
              py = rad * sphi * Math.sin(theta);
              pz = rad * cphi;
              const fade = Math.max(0, 1 - travel / 18);
              pColor.setHSL(0.58, 0.4, 0.15 + fade * 0.5);
            }
          } else if (t < t6) {
            const loopIndex = Math.floor(i % loopsCount);
            const lh1 = Math.abs(Math.sin(loopIndex * 21.31) * 5432.19) % 1;
            const lh2 = Math.abs(Math.sin(loopIndex * 37.77) * 6321.98) % 1;
            const lh3 = Math.abs(Math.sin(loopIndex * 59.59) * 7219.87) % 1;
            const lh4 = Math.abs(Math.sin(loopIndex * 83.13) * 8123.65) % 1;
            const pcphi = lh2 * 2 - 1;
            const psphi = Math.sqrt(Math.max(0, 1 - pcphi * pcphi));
            const pTheta = lh1 * 6.2831853;
            const pX = psphi * Math.cos(pTheta), pY = psphi * Math.sin(pTheta), pZ = pcphi;
            const refX = 0.15, refY = 0, refZ = 1;
            let e1x = refY * pZ - refZ * pY, e1y = refZ * pX - refX * pZ, e1z = refX * pY - refY * pX;
            const len1 = Math.max(Math.sqrt(e1x * e1x + e1y * e1y + e1z * e1z), 1e-5);
            e1x /= len1; e1y /= len1; e1z /= len1;
            let e2x = pY * e1z - pZ * e1y, e2y = pZ * e1x - pX * e1z, e2z = pX * e1y - pY * e1x;
            const len2 = Math.max(Math.sqrt(e2x * e2x + e2y * e2y + e2z * e2z), 1e-5);
            e2x /= len2; e2y /= len2; e2z /= len2;
            const halfWidth = 0.3 + lh3 * 0.5;
            const alpha = (h1 - 0.5) * halfWidth * 2;
            let dirx = e1x * Math.cos(alpha) + e2x * Math.sin(alpha);
            let diry = e1y * Math.cos(alpha) + e2y * Math.sin(alpha);
            let dirz = e1z * Math.cos(alpha) + e2z * Math.sin(alpha);
            const dlen = Math.max(Math.sqrt(dirx * dirx + diry * diry + dirz * dirz), 1e-5);
            dirx /= dlen; diry /= dlen; dirz /= dlen;
            const bulge = Math.cos((h1 - 0.5) * 3.14159);
            const flarePulse = 0.5 + 0.5 * Math.sin(time * 0.5 * magnetic + lh4 * 6.283);
            const archHeight = scaleR * (0.2 + lh3 * 0.3) * Math.max(0.1, magnetic) * flarePulse;
            const radius = scaleR * 0.79 + archHeight * bulge;
            px = dirx * radius; py = diry * radius; pz = dirz * radius;
            pColor.setHSL(Math.max(0, 0.05 - flarePulse * 0.02), 0.95, 0.4 + flarePulse * 0.3 + bulge * 0.1);
          } else {
            const theta = h1 * 6.2831853;
            const cphi = h2 * 2 - 1;
            const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
            const travel = (time * windSpeed * 1.1 + h3 * 70) % 70;
            const rad = scaleR * 0.95 + travel * scaleR * 0.045;
            px = rad * sphi * Math.cos(theta);
            py = rad * sphi * Math.sin(theta);
            pz = rad * cphi;
            const fade = Math.max(0, 1 - travel / 70);
            pColor.setHSL(0.6, 0.35, 0.1 + fade * 0.4);
          }

          const ang = time * 0.03;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const fx = px * ca - py * sa;
          const fy = px * sa + py * ca;
          target.set(fx, fy, pz);

          positions[i].lerp(target, 0.1);
          dummy.position.copy(positions[i]);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, pColor);
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        mesh.rotation.y = time * 0.05;

        renderer.render(scene, camera);
        animId = requestAnimationFrame(render);
      };

      animId = requestAnimationFrame(render);

    } catch (e) {
      console.warn('Native Three.js solar background failed to initialize:', e);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (renderer) {
        renderer.dispose();
      }
    };
  }, []);

  return (
    <div
      className="sb-solar-bg-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

export default SolarBackground;
