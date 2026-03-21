import { Suspense, useRef, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center, Grid } from "@react-three/drei";
import * as THREE from "three";

interface STLViewerProps {
  geometry: THREE.BufferGeometry;
  className?: string;
}

function Model({ geometry }: { geometry: THREE.BufferGeometry }) {
  const meshRef = useRef<THREE.Mesh>(null);

  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#4db8a4", roughness: 0.4, metalness: 0.1 }),
    []
  );

  return (
    <Center>
      <mesh ref={meshRef} geometry={geometry} material={material} castShadow receiveShadow />
    </Center>
  );
}

function Scene({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />
      <Model geometry={geometry} />
      <Grid
        args={[200, 200]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#888"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#aaa"
        fadeDistance={200}
        position={[0, -0.01, 0]}
      />
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
    </>
  );
}

export function STLViewer({ geometry, className }: STLViewerProps) {
  return (
    <div className={className ?? "w-full h-64 rounded-lg overflow-hidden border bg-muted/20"}>
      <Canvas
        camera={{ position: [100, 80, 100], fov: 45, near: 0.1, far: 2000 }}
        shadows
      >
        <Suspense fallback={null}>
          <Scene geometry={geometry} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Parse STL binary or ASCII
export async function parseSTL(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
  const loader = new STLLoader();
  return loader.parse(buffer);
}

// Get bounding box info
export function getSTLInfo(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const size = new THREE.Vector3();
  box.getSize(size);

  // Approximate volume using geometry
  let volume = 0;
  const pos = geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i += 3) {
    const v0 = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const v1 = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
    const v2 = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    volume += v0.dot(v1.cross(v2)) / 6;
  }

  return {
    width: Math.round(size.x * 10) / 10,
    height: Math.round(size.y * 10) / 10,
    depth: Math.round(size.z * 10) / 10,
    volume: Math.abs(Math.round(volume)),
    triangles: pos.count / 3,
  };
}
