import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { OrbitControls, Effects } from '@react-three/drei';
import { UnrealBloomPass } from 'three-stdlib';
import * as THREE from 'three';

extend({ UnrealBloomPass });

// Responsive Camera Controller to keep animation proportional on mobile and desktop
const ResponsiveCamera = () => {
  const { camera, size } = useThree();

  useEffect(() => {
    const aspect = size.width / size.height;
    const isMobile = size.width < 768;

    let baseDistance = isMobile ? 380 : 320;

    if (aspect < 1) {
      baseDistance = baseDistance / Math.max(aspect, 0.45);
    }

    camera.position.set(0, 0, Math.min(baseDistance, 680));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [size.width, size.height, camera]);

  return null;
};

const ParticleSwarm = () => {
  const meshRef = useRef();
  
  const count = useMemo(() => {
    if (typeof window === 'undefined') return 20000;
    return window.innerWidth < 768 ? 10000 : 20000;
  }, []);

  const speedMult = 1;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const pColor = useMemo(() => new THREE.Color(), []);
  const color = pColor;
  
  const positions = useMemo(() => {
     const pos = [];
     for (let i = 0; i < count; i++) {
       pos.push(new THREE.Vector3((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100));
     }
     return pos;
  }, [count]);

  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff }), []);
  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.25), []);

  const PARAMS = useMemo(() => ({"radius": 118, "fusion": 6, "convect": 1.05, "magnetic": 1.65, "wind": 1.2, "loops": 21.28}), []);
  const addControl = (id, l, min, max, val) => {
      return PARAMS[id] !== undefined ? PARAMS[id] : val;
  };
  const setInfo = () => {};
  const annotate = () => {};

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime() * speedMult;

    if (material.uniforms && material.uniforms.uTime) {
         material.uniforms.uTime.value = time;
    }

    for (let i = 0; i < count; i++) {
        const scaleR = addControl("radius", "Sun Radius", 40, 300, 120);
        const fusionRate = addControl("fusion", "Fusion Rate", 0.5, 6, 2.5);
        const convection = addControl("convect", "Convection Turbulence", 0, 3, 1.2);
        const magnetic = addControl("magnetic", "Magnetic Activity", 0, 3, 1.4);
        const windSpeed = addControl("wind", "Solar Wind Speed", 0, 5, 1.8);
        const loopsCount = Math.max(4, Math.floor(addControl("loops", "Active Regions", 4, 40, 16)));
        
        const t = i / Math.max(1, count);
        const h1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
        const h2 = Math.abs(Math.sin(i * 78.2330) * 12543.1230) % 1;
        const h3 = Math.abs(Math.sin(i * 45.1640) * 98765.4320) % 1;
        const h4 = Math.abs(Math.sin(i * 33.7190) * 54321.9870) % 1;
        const h5 = Math.abs(Math.sin(i * 61.4310) * 31415.9265) % 1;
        const h6 = Math.abs(Math.sin(i * 19.8410) * 27182.8182) % 1;
        
        const t0 = 0.12, t1 = 0.32, t2 = 0.55, t3 = 0.68, t4 = 0.78, t5 = 0.90, t6 = 0.97;
        
        let px = 0, py = 0, pz = 0;
        
        if (t < t0) {
          const coreR = scaleR * 0.22;
          const theta = h1 * 6.2831853;
          const cphi = h2 * 2 - 1;
          const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
          const rr = Math.cbrt(Math.max(h3, 0.0001)) * coreR;
          const jitter = Math.sin(time * 3 + h4 * 6.283) * coreR * 0.03;
          const rad = rr + jitter;
          px = rad * sphi * Math.cos(theta);
          py = rad * sphi * Math.sin(theta);
          pz = rad * cphi;
          const burst = Math.pow(0.5 + 0.5 * Math.sin(time * fusionRate * 4 + h5 * 18.85), 6);
          const bright = 0.5 + 0.5 * burst;
          color.setHSL(Math.max(0, 0.14 - burst * 0.05), 1.0, Math.min(0.95, 0.55 + bright * 0.4));
        } else if (t < t1) {
          const rMin = scaleR * 0.22, rMax = scaleR * 0.46;
          const rr = rMin + h1 * (rMax - rMin);
          const theta = h2 * 6.2831853 + Math.sin(time * 0.03 + h3 * 6.283) * 0.3;
          const cphi = h3 * 2 - 1;
          const sphi = Math.sqrt(Math.max(0, 1 - cphi * cphi));
          const wander = Math.sin(time * 0.08 + h4 * 6.283) * scaleR * 0.02;
          const rad = rr + wander;
          px = rad * sphi * Math.cos(theta);
          py = rad * sphi * Math.sin(theta);
          pz = rad * cphi;
          color.setHSL(0.06, 0.9, 0.25 + h5 * 0.1);
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
          color.setHSL(Math.max(0, 0.08 - heat * 0.02), 1.0, 0.3 + heat * 0.35);
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
          color.setHSL(0.13, 0.9, Math.max(0.08, Math.min(0.85, bright)));
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
          color.setHSL(0.98, 0.85, 0.35 + (spicule / Math.max(spiculeLen, 0.0001)) * 0.25);
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
            const s = h1;
            const alpha = (s - 0.5) * halfWidth * 2;
            let dirx = e1x * Math.cos(alpha) + e2x * Math.sin(alpha);
            let diry = e1y * Math.cos(alpha) + e2y * Math.sin(alpha);
            let dirz = e1z * Math.cos(alpha) + e2z * Math.sin(alpha);
            const dlen = Math.max(Math.sqrt(dirx * dirx + diry * diry + dirz * dirz), 1e-5);
            dirx /= dlen; diry /= dlen; dirz /= dlen;
            const bulge = Math.cos((s - 0.5) * 3.14159);
            const flarePulse = 0.6 + 0.4 * Math.sin(time * 0.4 * magnetic + lh4 * 6.283);
            const archHeight = scaleR * (0.1 + lh3 * 0.15) * Math.max(0.1, magnetic) * flarePulse;
            const radius = scaleR * 0.8 + archHeight * bulge;
            px = dirx * radius; py = diry * radius; pz = dirz * radius;
            color.setHSL(0.55, 0.3, 0.45 + bulge * 0.3);
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
            color.setHSL(0.58, 0.4, 0.15 + fade * 0.5);
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
          const s = h1;
          const alpha = (s - 0.5) * halfWidth * 2;
          let dirx = e1x * Math.cos(alpha) + e2x * Math.sin(alpha);
          let diry = e1y * Math.cos(alpha) + e2y * Math.sin(alpha);
          let dirz = e1z * Math.cos(alpha) + e2z * Math.sin(alpha);
          const dlen = Math.max(Math.sqrt(dirx * dirx + diry * diry + dirz * dirz), 1e-5);
          dirx /= dlen; diry /= dlen; dirz /= dlen;
          const bulge = Math.cos((s - 0.5) * 3.14159);
          const flarePulse = 0.5 + 0.5 * Math.sin(time * 0.5 * magnetic + lh4 * 6.283);
          const archHeight = scaleR * (0.2 + lh3 * 0.3) * Math.max(0.1, magnetic) * flarePulse;
          const radius = scaleR * 0.79 + archHeight * bulge;
          px = dirx * radius; py = diry * radius; pz = dirz * radius;
          color.setHSL(Math.max(0, 0.05 - flarePulse * 0.02), 0.95, 0.4 + flarePulse * 0.3 + bulge * 0.1);
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
          color.setHSL(0.6, 0.35, 0.1 + fade * 0.4);
        }
        
        const ang = time * 0.03;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const fx = px * ca - py * sa;
        const fy = px * sa + py * ca;
        target.set(fx, fy, pz);
        
        if (i === 0) {
          setInfo("The Sun", "Layered stellar model...");
          annotate("core", new THREE.Vector3(0, 0, 0), "Fusion Core");
          annotate("photo", new THREE.Vector3(scaleR * 0.76, 0, 0), "Photosphere");
          annotate("corona", new THREE.Vector3(0, scaleR * 1.3, 0), "Corona");
        }

        positions[i].lerp(target, 0.1);
        dummy.position.copy(positions[i]);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        meshRef.current.setColorAt(i, pColor);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, count]} />
  );
};

class SolarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('SolarBackground 3D Canvas error caught safely:', err);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export const SolarBackground = () => {
  const bloomResolution = useMemo(() => {
    if (typeof window !== 'undefined') {
      return new THREE.Vector2(window.innerWidth, window.innerHeight);
    }
    return new THREE.Vector2(512, 512);
  }, []);

  return (
    <SolarErrorBoundary>
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
        <Canvas camera={{ position: [0, 0, 350], fov: 60 }} style={{ pointerEvents: 'none' }}>
          <ResponsiveCamera />
          <fog attach="fog" args={['#000000', 0.01]} />
          <ParticleSwarm />
          <OrbitControls autoRotate={true} autoRotateSpeed={0.8} enableZoom={false} enablePan={false} enableRotate={false} />
          <Effects disableGamma>
            <unrealBloomPass attach="passes" args={[bloomResolution, 1.6, 0.4, 0]} />
          </Effects>
        </Canvas>
      </div>
    </SolarErrorBoundary>
  );
};

export default SolarBackground;
