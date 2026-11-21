"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { SceneRoom } from "@/lib/floor";
import type { OrbState } from "@/lib/live-answer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FloorScene, layoutOf, ROOM_W, STOREY_H } from "./floor-scene";

/** Screen pixels covered by the floating panels; the floor is framed in the gap between them. */
export interface Insets {
  left: number;
  right: number;
}

const FOV = 38;
const TAN = Math.tan((FOV * Math.PI) / 360);

/**
 * The house's wide floor camera (FloorScene.tsx floorCamera), framing the floor between the
 * side panels. With two storeys it fits whichever of width or height is tighter.
 */
function frame(rooms: number, size: { width: number; height: number }, insets: Insets) {
  const { cols, rows } = layoutOf(rooms);
  const aspect = size.width / size.height;
  const width = cols * ROOM_W + 1.5;
  const height = rows * STOREY_H + 3;
  const frac = Math.max(0.25, (size.width - insets.left - insets.right) / size.width);
  // The top bar and hint pill take about 0.2 of the height.
  const dist = Math.max(12, width / 2 / (TAN * aspect * frac), height / 2 / (TAN * 0.8));
  const unitsPerPx = (2 * dist * TAN * aspect) / size.width;
  const x = -((insets.left - insets.right) / 2) * unitsPerPx;
  const lookY = (rows * STOREY_H) / 2 - 0.6;
  const pxPerUnit = size.height / (2 * TAN * (dist + 8));
  return {
    pos: new THREE.Vector3(x, lookY + 3.3 + dist * 0.12, dist + 1),
    look: new THREE.Vector3(x, lookY, -3.2),
    labelScale: Math.max(0.62, Math.min(1, (ROOM_W * pxPerUnit - 8) / 140)),
  };
}

/** Eases the camera to its frame when the floor or the window changes; no pointer parallax, so nothing moves on its own. */
function Rig({ target, still }: { target: { pos: THREE.Vector3; look: THREE.Vector3 }; still: boolean }) {
  const look = useRef<THREE.Vector3 | null>(null);
  useFrame(({ camera }, dt) => {
    const k = still || !look.current ? 1 : 1 - Math.exp(-dt * 6);
    look.current ??= target.look.clone();
    camera.position.lerp(target.pos, k);
    look.current.lerp(target.look, k);
    camera.lookAt(look.current);
  });
  return null;
}

interface StageProps {
  rooms: SceneRoom[];
  assistantRoomId: string | null;
  orb: OrbState;
  insets: Insets;
  onSelect: (id: string) => void;
}

function Scene({ rooms, assistantRoomId, orb, insets, onSelect, still, layer }: StageProps & { still: boolean; layer: HTMLElement }) {
  const size = useThree((s) => s.size);
  const f = useMemo(() => frame(rooms.length, size, insets), [rooms.length, size, insets]);
  return (
    <>
      <Rig target={f} still={still} />
      <FloorScene rooms={rooms} assistantRoomId={assistantRoomId} orb={orb} still={still} labelScale={f.labelScale} layer={layer} onSelect={onSelect} />
    </>
  );
}

/** Default export so the shell loads three.js lazily, after the panels and chat are interactive. */
export default function Stage(props: StageProps) {
  const still = useMediaQuery("(prefers-reduced-motion: reduce)");
  // Room labels render into their own layer above the canvas, as in the house, so React owns their nodes cleanly.
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  return (
    <div className="absolute inset-0" aria-hidden>
      <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]} camera={{ position: [0, 9, 40], fov: FOV, near: 0.5, far: 1200 }}>
        {layer && <Scene {...props} still={still} layer={layer} />}
      </Canvas>
      <div ref={setLayer} className="pointer-events-none absolute inset-0 z-10 overflow-hidden" />
    </div>
  );
}
