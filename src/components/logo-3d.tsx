"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { CompanyWordmark } from "@/components/company-wordmark";
import { cn } from "@/lib/utils";

const WORDMARK_SVG = "/df-wordmark.svg";
const TURN_SECONDS = 26;
const LOGO_WIDTH = 46;
const DEPTH_RATIO = 0.06;
const RESTING_TURN = -0.25;
const MAX_FRAME_STEP = 0.1;
const WAKE_DELAY = 0.35;
const WAKE_STAGGER = 0.26;
const WAKE_LETTER_SECONDS = 0.55;
const JUMP_HEIGHT = 2.4;
const CAMERA_FOV = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(3)) * 1.25));
const FLAT_DEPTH = 0.001;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function StudioLighting() {
  const gl = useThree((state) => state.gl);
  const environment = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return texture;
  }, [gl]);
  useEffect(() => () => environment.dispose(), [environment]);
  return <primitive object={environment} attach="environment" />;
}

type Letter = { flat: THREE.ShapeGeometry; solid: THREE.ExtrudeGeometry; step: number };

function splitIntoLetters(shapes: THREE.Shape[]) {
  const spans = shapes
    .map((shape) => {
      const box = new THREE.Box2().setFromPoints(shape.getPoints());
      return { shape, min: box.min.x, max: box.max.x };
    })
    .sort((a, b) => a.min - b.min);
  const letters: { min: number; max: number; shapes: THREE.Shape[] }[] = [];
  for (const span of spans) {
    const host = letters.find((letter) => span.min >= letter.min && span.max <= letter.max);
    if (host) host.shapes.push(span.shape);
    else letters.push({ min: span.min, max: span.max, shapes: [span.shape] });
  }
  return letters.map((letter) => letter.shapes);
}

const easeOutBack = (p: number) => 1 + 2.2 * (p - 1) ** 3 + 1.2 * (p - 1) ** 2;
const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

function Wordmark({ animate, onReady }: { animate: boolean; onReady: () => void }) {
  const svg = useLoader(SVGLoader, WORDMARK_SVG);
  const invalidate = useThree((state) => state.invalidate);
  const turn = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const reported = useRef(false);

  const { letters, scale, wakeSeconds } = useMemo(() => {
    const shapes = svg.paths.flatMap((path) => SVGLoader.createShapes(path));
    const outline = new THREE.ShapeGeometry(shapes);
    outline.computeBoundingBox();
    const box = outline.boundingBox!;
    outline.dispose();
    const width = box.max.x - box.min.x;
    const depth = width * DEPTH_RATIO;
    const bevelThickness = width * 0.004;
    const centreX = (box.min.x + box.max.x) / 2;
    const centreY = (box.min.y + box.max.y) / 2;
    const groups = splitIntoLetters(shapes);
    const built: Letter[] = groups.map((letterShapes, index) => {
      const flat = new THREE.ShapeGeometry(letterShapes);
      flat.translate(-centreX, -centreY, depth / 2 + bevelThickness);
      const solid = new THREE.ExtrudeGeometry(letterShapes, {
        depth,
        bevelEnabled: true,
        bevelThickness,
        bevelSize: width * 0.002,
        bevelSegments: 3,
        curveSegments: 8,
      });
      solid.translate(-centreX, -centreY, -depth / 2);
      return { flat, solid, step: Math.min(index, groups.length - 1 - index) };
    });
    const lastStep = Math.max(...built.map((letter) => letter.step));
    return {
      letters: built,
      scale: LOGO_WIDTH / width,
      wakeSeconds: WAKE_DELAY + lastStep * WAKE_STAGGER + WAKE_LETTER_SECONDS,
    };
  }, [svg]);

  const startRotation = useMemo<[number, number, number]>(() => [0, animate ? 0 : RESTING_TURN, 0], [animate]);

  useEffect(
    () => () =>
      letters.forEach((letter) => {
        letter.flat.dispose();
        letter.solid.dispose();
      }),
    [letters]
  );
  useEffect(() => invalidate(), [animate, invalidate]);

  useFrame((_, delta) => {
    const group = turn.current;
    if (!group) return;
    const step = Math.min(delta, MAX_FRAME_STEP);
    elapsed.current = animate ? elapsed.current + step : wakeSeconds;
    const since = elapsed.current - WAKE_DELAY;
    group.children.forEach((child, index) => {
      const progress = clamp01((since - letters[index].step * WAKE_STAGGER) / WAKE_LETTER_SECONDS);
      const [flat, solid] = child.children as THREE.Mesh[];
      const flatOpacity = 1 - clamp01(progress * 2);
      child.position.y = JUMP_HEIGHT * 4 * progress * (1 - progress);
      child.scale.z = Math.max(FLAT_DEPTH, easeOutBack(progress));
      (flat.material as THREE.MeshBasicMaterial).opacity = flatOpacity;
      flat.visible = flatOpacity > 0;
      solid.visible = progress > 0;
    });
    if (animate && elapsed.current >= wakeSeconds) group.rotation.y += (step * Math.PI * 2) / TURN_SECONDS;
    if (!reported.current) {
      reported.current = true;
      onReady();
    }
  });

  return (
    <group ref={turn} rotation={startRotation}>
      {letters.map((letter, index) => (
        <group key={index} scale={[1, 1, FLAT_DEPTH]}>
          <mesh geometry={letter.flat} scale={[scale, -scale, scale]} renderOrder={1}>
            <meshBasicMaterial color="#FDCC4B" toneMapped={false} transparent depthTest={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={letter.solid} scale={[scale, -scale, scale]} visible={false}>
            <meshPhysicalMaterial
              attach="material-0"
              color="#E8B23A"
              metalness={0.55}
              roughness={0.28}
              clearcoat={1}
              clearcoatRoughness={0.05}
              envMapIntensity={1.6}
              side={THREE.DoubleSide}
            />
            <meshPhysicalMaterial
              attach="material-1"
              color="#5C430F"
              metalness={1}
              roughness={0.38}
              envMapIntensity={0.9}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* The traced CompanyName wordmark (public/df-wordmark.svg) extruded into a
   solid brass sign - lacquered bright faces, darker aged sides so the letters
   stay legible at an angle - and turned a full 360° at a constant speed, so it is solid
   from every angle and reads mirrored from behind. The flat PNG shows until
   the scene is ready, which takes over as the same flat gold letters; they
   then wake two at a time from the outside in, each hopping as it gains depth
   and turns brass, and the turn starts once the middle letter lands. The loop
   pauses while the logo is off screen, and under prefers-reduced-motion the
   letters arrive solid and hold still at a slight angle. */
export function Logo3D({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const frame = useRef<HTMLDivElement>(null);
  const markReady = useMemo(() => () => setReady(true), []);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className={className}>
      <span className="sr-only">Don Fenticas</span>
      <div className="relative aspect-4/1 w-full" aria-hidden="true">
        {!ready && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <CompanyWordmark decorative priority className="w-[92%]" />
          </div>
        )}
        <Canvas
          className={cn("pointer-events-none absolute! inset-x-0 -top-1/8 h-5/4! opacity-0", ready && "opacity-100")}
          camera={{ position: [0, 0, 120], fov: CAMERA_FOV }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          frameloop={onScreen && !reducedMotion ? "always" : "demand"}
        >
          <StudioLighting />
          <ambientLight intensity={0.2} />
          <directionalLight position={[8, 10, 12]} intensity={1.6} />
          <directionalLight position={[-10, -4, 6]} intensity={0.6} color="#ffd98a" />
          <directionalLight position={[0, 6, -14]} intensity={1.4} color="#fff1c9" />
          <Wordmark animate={!reducedMotion} onReady={markReady} />
        </Canvas>
      </div>
    </div>
  );
}
