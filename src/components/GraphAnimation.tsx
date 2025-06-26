'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, ShaderPass, RenderPass } from 'three-stdlib';

function GraphNodes({
  isTransitioning,
  transitionProgress,
  scrollZ,
}: {
  isTransitioning: boolean;
  transitionProgress: number;
  scrollZ: number;
}) {
  const group = useRef<THREE.Group>(null!);
  const nodeCount = 30;

  const randomNodes = useMemo(
    () =>
      Array.from({ length: nodeCount - 1 }).map(() => ({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 80,
          (Math.random() - 0.5) * 80,
          (Math.random() - 0.5) * 80
        ),
      })),
    [nodeCount]
  );

  const edges = useMemo(() => {
    const allNodePositions = [
      new THREE.Vector3(0, 0, 0),
      ...randomNodes.map((n) => n.position),
    ];
    const temp = [];
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (allNodePositions[i].distanceTo(allNodePositions[j]) < 25) {
          temp.push([allNodePositions[i], allNodePositions[j]] as [
            THREE.Vector3,
            THREE.Vector3
          ]);
        }
      }
    }
    return temp;
  }, [randomNodes, nodeCount]);

  const randomNodeRefs = useRef<(THREE.Mesh | null)[]>([]);
  const edgeRefs = useRef<(THREE.Line | null)[]>([]);
  const solidCenterRef = useRef<THREE.Mesh>(null!);
  const wireframeCenterRef = useRef<THREE.Mesh>(null!);

  const nodeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x727272,
        emissive: 0x727272,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0,
      }),
    []
  );

  const solidCenterMaterial = useMemo(
    () => nodeMaterial.clone(),
    [nodeMaterial]
  );
  const wireframeCenterMaterial = useMemo(() => {
    const mat = nodeMaterial.clone();
    mat.wireframe = true;
    return mat;
  }, [nodeMaterial]);

  const edgeMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0x727272,
        transparent: true,
        opacity: 0,
      }),
    []
  );

  useFrame(({ clock, camera }, delta) => {
    const t = clock.getElapsedTime();

    // Calculate scroll-based transition progress
    const TRANSITION_START = 80;
    const TRANSITION_END = 120;
    const scrollProgress = Math.max(
      0,
      Math.min(
        1,
        (scrollZ - TRANSITION_START) / (TRANSITION_END - TRANSITION_START)
      )
    );

    randomNodeRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const delay = (i + 1) * 0.05;
      const animDuration = 2;
      const progress = Math.min(1, Math.max(0, (t - delay) / animDuration));

      mesh.scale.setScalar(THREE.MathUtils.lerp(0.01, 1.5, progress));
      if (mesh.material instanceof THREE.Material) {
        mesh.material.opacity = progress;

        // Smooth transition to wireframe based on scroll position
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          // Gradually enable wireframe after the wave effect completes
          mesh.material.wireframe = transitionProgress > 0.8;

          // Keep the same gray color instead of transitioning to white
          const grayColor = new THREE.Color(0x727272);
          mesh.material.color.copy(grayColor);

          // Keep original emissive properties
          mesh.material.emissive.copy(grayColor);
          mesh.material.emissiveIntensity = 0.8;
        }
      }
    });

    const animDuration = 2;
    const proceduralProgress = Math.min(1, t / animDuration);

    const transitionStart = 10;
    const transitionEnd = 80;
    const centerScrollProgress = Math.min(
      1,
      Math.max(
        0,
        (camera.position.z - transitionStart) /
          (transitionEnd - transitionStart)
      )
    );

    solidCenterMaterial.opacity = proceduralProgress * centerScrollProgress;
    wireframeCenterMaterial.opacity =
      proceduralProgress * (1 - centerScrollProgress);

    if (wireframeCenterRef.current) {
      const rotationSpeed = 0.2;
      const effectiveRotation =
        rotationSpeed * delta * (1 - centerScrollProgress);
      wireframeCenterRef.current.rotation.y += effectiveRotation;
    }

    if (solidCenterRef.current && wireframeCenterRef.current) {
      solidCenterRef.current.rotation.copy(wireframeCenterRef.current.rotation);
    }

    edgeRefs.current.forEach((line, i) => {
      if (!line) return;
      const delay = i * 0.02;
      const animDuration = 2;
      const progress = Math.min(1, Math.max(0, (t - delay) / animDuration));
      if (line.material instanceof THREE.Material) {
        line.material.opacity = progress * 0.2;

        // Smooth edge brightness transition based on scroll
        if (line.material instanceof THREE.LineBasicMaterial) {
          // Keep the same gray color
          const grayColor = new THREE.Color(0x727272);
          line.material.color.copy(grayColor);
          line.material.opacity = progress * 0.2;
        }
      }
    });
  });

  return (
    <group ref={group}>
      <mesh
        ref={solidCenterRef}
        position={[0, 0, 0]}
        material={solidCenterMaterial}
        scale={1.5}
      >
        <sphereGeometry args={[1.5, 12, 12]} />
      </mesh>
      <mesh
        ref={wireframeCenterRef}
        position={[0, 0, 0]}
        material={wireframeCenterMaterial}
        scale={1.5}
      >
        <sphereGeometry args={[1.5, 12, 12]} />
      </mesh>

      {randomNodes.map((node, i) => (
        <mesh
          key={i}
          ref={(el) => (randomNodeRefs.current[i] = el)}
          position={node.position}
          material={nodeMaterial}
          scale={0.01}
        >
          <sphereGeometry args={[1.5, 12, 12]} />
        </mesh>
      ))}

      {edges.map(([start, end], i) => {
        const geometry = useMemo(
          () => new THREE.BufferGeometry().setFromPoints([start, end]),
          [start, end]
        );
        return (
          <line
            key={i}
            ref={(el: THREE.Line | null) => (edgeRefs.current[i] = el)}
            geometry={geometry}
            material={edgeMaterial}
          />
        );
      })}
    </group>
  );
}

function CameraController({ onScroll }: { onScroll: (z: number) => void }) {
  const { camera, scene } = useThree();
  const targetZ = useRef(10);
  const targetRotationY = useRef(0);
  const targetPositionX = useRef(0);
  const targetPositionY = useRef(0);
  const isZooming = useRef(false);
  const zoomStartZ = useRef(130);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const zoomSpeed = 0.025;
      const rotationSpeed = 0.02;

      const currentZ = targetZ.current;
      const potentialZ = currentZ + event.deltaY * zoomSpeed;
      const clampedZ = Math.max(10, Math.min(500, potentialZ)); // Increased max to 500

      console.log(
        'Current Z:',
        currentZ,
        'Potential Z:',
        potentialZ,
        'Clamped Z:',
        clampedZ
      );

      const actualDeltaZ = clampedZ - currentZ;

      // Check if we should start zooming
      if (clampedZ > 130 && !isZooming.current) {
        isZooming.current = true;
        zoomStartZ.current = 130;
      }

      // Handle zoom effect
      if (isZooming.current) {
        console.log('ZOOM EFFECT TRIGGERED! Z:', clampedZ);
        // Use scroll wheel delta with small constant for smoother zoom
        const zoomDelta = event.deltaY * 0.07; // Much smaller constant
        const currentTargetZ = targetZ.current;
        const newTargetZ = Math.max(5, currentTargetZ - zoomDelta); // Zoom in by reducing Z

        targetZ.current = newTargetZ;
        targetPositionX.current = 0;
        targetPositionY.current = 0;

        // Disable rotation during zoom
        targetRotationY.current = 0;
        console.log('Zoom delta:', zoomDelta, 'Target Z:', targetZ.current);
      } else {
        // Normal camera behavior
        targetZ.current = clampedZ;
        targetPositionX.current = 0;
        targetPositionY.current = 0;
        // Re-enable rotation for normal scrolling
        targetRotationY.current += actualDeltaZ * rotationSpeed;
      }
    };

    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useFrame(() => {
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      targetZ.current,
      0.05
    );
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      targetPositionX.current,
      0.05
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      targetPositionY.current,
      0.05
    );

    // Only apply rotation when not zooming (Z <= 130)
    if (targetZ.current <= 130) {
      scene.rotation.y = THREE.MathUtils.lerp(
        scene.rotation.y,
        targetRotationY.current,
        0.05
      );
    } else {
      // Lock rotation during zoom
      scene.rotation.y = 0;
    }

    onScroll(camera.position.z);
  });

  return null;
}

const TransitionShader = {
  uniforms: {
    tDiffuse: { value: null },
    progress: { value: 0.0 },
    center: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float progress;
    uniform vec2 center;
    varying vec2 vUv;

    void main() {
      float dist = distance(vUv, center);
      float radius = progress * 1.5;
      
      // Create wave effect
      float wave = sin((dist - radius) * 20.0) * 0.02 * progress;
      float waveStrength = smoothstep(radius - 0.3, radius, dist) * smoothstep(radius + 0.3, radius, dist);
      
      // Add brightness to the wave
      float brightness = wave * waveStrength * 5.0;
      
      // Distort UV coordinates based on wave
      vec2 distortion = normalize(vUv - center) * wave * waveStrength;
      vec2 distortedUv = vUv + distortion;
      
      // Sample the texture with distorted coordinates
      vec4 baseColor = texture2D(tDiffuse, distortedUv);
      
      // Add brightness and glow to the wave area
      vec4 waveColor = vec4(1.0, 1.0, 1.0, 1.0) * brightness * 0.8;
      
      gl_FragColor = baseColor + waveColor;
    }
  `,
};

function Effects({
  isTransitioning,
  onProgress,
}: {
  isTransitioning: boolean;
  onProgress: (progress: number) => void;
}) {
  const { gl, scene, camera } = useThree();
  const composer = useRef<EffectComposer | null>(null);
  const transitionPass = useRef<ShaderPass | null>(null);

  const transitionProgress = useRef(0);
  const transitionStartTime = useRef<number | null>(null);

  useEffect(() => {
    const newComposer = new EffectComposer(gl);
    newComposer.addPass(new RenderPass(scene, camera));
    const newTransitionPass = new ShaderPass(TransitionShader);
    newComposer.addPass(newTransitionPass);
    composer.current = newComposer;
    transitionPass.current = newTransitionPass;
  }, [gl, scene, camera]);

  useFrame((state, delta) => {
    if (isTransitioning && transitionStartTime.current === null) {
      transitionStartTime.current = state.clock.elapsedTime;
    }

    if (transitionStartTime.current !== null) {
      const duration = 2.5;
      const elapsed = state.clock.elapsedTime - transitionStartTime.current;
      transitionProgress.current = Math.min(1.0, elapsed / duration);
    }

    if (transitionPass.current) {
      transitionPass.current.uniforms.progress.value =
        transitionProgress.current;
    }

    composer.current?.render(delta);

    if (onProgress) {
      onProgress(transitionProgress.current);
    }
  }, 1);

  return null;
}

export default function GraphAnimation() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [scrollZ, setScrollZ] = useState(10);
  const TRANSITION_THRESHOLD = 80;

  const handleScroll = (z: number) => {
    setScrollZ(z);
    if (z > TRANSITION_THRESHOLD && !isTransitioning) {
      setIsTransitioning(true);
    }
  };

  const handleTransitionProgress = (progress: number) => {
    setTransitionProgress(progress);
  };

  return (
    <Canvas
      style={{ position: 'fixed', top: 0, left: 0, zIndex: -1 }}
      camera={{ position: [0, 0, 10], fov: 60 }}
    >
      <ambientLight intensity={0.2} color='#202020' />
      <pointLight position={[50, 50, 50]} color='#727272' intensity={1} />
      <GraphNodes
        isTransitioning={isTransitioning}
        transitionProgress={transitionProgress}
        scrollZ={scrollZ}
      />
      <CameraController onScroll={handleScroll} />
      <Effects
        isTransitioning={isTransitioning}
        onProgress={handleTransitionProgress}
      />
    </Canvas>
  );
}
