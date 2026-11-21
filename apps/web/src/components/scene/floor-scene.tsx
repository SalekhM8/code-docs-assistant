"use client";

/*
 * One floor of the White House, opened up like a doll's house, adapted from
 * palmer-clone src/components/house3d/FloorScene.tsx. Here each room is a repo
 * (home) or a top-level folder (inside a repo), and the person in the corridor
 * with the orb over their head is the assistant.
 *
 * Motion rule: a person or screen moves only when its room has real work in flight
 * (indexing, or the live answer touching that folder). Idle rooms are still.
 */

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { RoomState, SceneRoom } from "@/lib/floor";
import type { OrbState } from "@/lib/live-answer";
import { Person, type Pose } from "./person";

export const ROOM_W = 8.4;
const D = 7;
const WALL_H = 5;

/* House palette (palmer-clone model.ts). */
const C = { ink: "#1a0e0b", cream: "#f4e8de", panel: "#ecd5c6", surface: "#faf3ee", light: "#f6e7dd", coral: "#e55d40", burgundy: "#6a1a18", clay: "#d98e76" };
const GREEN = "#27A567";
const RED = "#E0352B";
const ACCENT = "#2F8FE8";
const STATE_TEXT: Record<RoomState, string> = { idle: "#7a6a62", working: C.ink, reading: C.ink, done: "#1c7046", failed: "#a8231b" };
const SANS = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";

export function roomX(slot: number, count: number) {
  return (slot - (count - 1) / 2) * ROOM_W;
}

/** Height of one storey: the rooms plus the floor slab of the storey above. */
export const STOREY_H = WALL_H + 1;

/**
 * Up to three rooms sit on one floor; more are stacked into two storeys, a cross-section of
 * the house, so each room stays big enough to read next to the side panels.
 */
export function layoutOf(count: number): { cols: number; rows: number } {
  const n = Math.max(1, count);
  return n <= 3 ? { cols: n, rows: 1 } : { cols: Math.ceil(n / 2), rows: 2 };
}

/** Where room `i` stands: its storey's height and its x, centred along that storey. */
export function roomPos(i: number, count: number): { x: number; y: number; row: number } {
  const { cols, rows } = layoutOf(count);
  const row = Math.floor(i / cols);
  const inRow = Math.min(cols, Math.max(1, count) - row * cols);
  return { x: roomX(i - row * cols, inRow), y: (rows - 1 - row) * STOREY_H, row };
}

const std = (color: string, roughness = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

const M = {
  wall: std("#FBF6EF"),
  wallSide: std("#F1E7DB"),
  skirting: std("#FFFFFF"),
  wood: std("#B98A5E"),
  woodDark: std("#8E6642"),
  slab: std("#E9DCCB"),
  runner: std(C.burgundy),
  runnerEdge: std(C.clay),
  desk: std("#F3ECE2", 0.6),
  metal: std("#2B2623", 0.5, { metalness: 0.4 }),
  screen: new THREE.MeshBasicMaterial({ color: "#16110F" }),
  pot: std("#D9CFC1"),
  leaf: std("#4F8A44"),
  leaf2: std("#6FA552"),
  sky: new THREE.MeshBasicMaterial({ color: "#CFE6FA" }),
  cloud: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
  paper: std("#FFFFFF", 0.7),
  rack: std("#22262E", 0.6),
};

const isActive = (s: RoomState) => s === "working" || s === "reading";
const edgeColor = (room: SceneRoom) => (room.state === "done" ? GREEN : room.state === "failed" ? RED : room.color);
const POSE: Record<RoomState, Pose> = { idle: "idle", working: "typing", reading: "typing", done: "idle", failed: "slump" };

/* ------------------------------ wall screen: lines of code ------------------------ */

function WallScreen({ color, active, still }: { color: string; active: boolean; still: boolean }) {
  const lines = useMemo(
    () => [0, 1, 2, 3, 4, 5].map((i) => ({ y: 0.78 - i * 0.31, w: 1.4 + ((i * 7) % 5) * 0.45, color: i === 4 ? color : C.cream, indent: (i % 3) * 0.3 })),
    [color],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    const t = still || !active ? 1.3 : clock.elapsedTime;
    lines.forEach((_, i) => {
      const g = groups.current[i];
      if (g) g.scale.x = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.9 + i * 0.8));
      const m = mats.current[i];
      if (m) m.opacity = active ? 1 : 0.28;
    });
  });
  return (
    <group position={[0, 3.05, -D + 0.16]}>
      <mesh material={M.metal} position={[0, 0, -0.04]}>
        <boxGeometry args={[4.5, 2.5, 0.1]} />
      </mesh>
      <mesh material={M.screen} position={[0, 0, 0.02]}>
        <planeGeometry args={[4.2, 2.2]} />
      </mesh>
      {lines.map((l, i) => (
        <group key={i} position={[-1.85 + l.indent, l.y, 0.04]}>
          <group ref={(g) => void (groups.current[i] = g)}>
            <mesh position={[l.w / 2, 0, 0]}>
              <planeGeometry args={[l.w, 0.13]} />
              <meshBasicMaterial ref={(m) => void (mats.current[i] = m)} color={l.color} transparent toneMapped={false} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------ furniture (from the house) -------------------------- */

function Plant({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.3, 0]} material={M.pot} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} material={M.leaf} castShadow>
        <boxGeometry args={[0.8, 0.7, 0.8]} />
      </mesh>
      <mesh position={[0.15, 1.5, -0.1]} material={M.leaf2} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
      </mesh>
    </group>
  );
}

/** The house's Research bookshelf, Engineering rack and Data cabinets, in turn. */
function Prop({ kind, color, active, still }: { kind: number; color: string; active: boolean; still: boolean }) {
  const blink = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    blink.current?.children.forEach((c, i) => {
      c.visible = active && !still ? Math.sin(clock.elapsedTime * (3 + (i % 4)) + i) > 0 : i % 3 === 0;
    });
  });
  if (kind === 0) {
    return (
      <group position={[-3.2, 0, -6.2]}>
        <mesh position={[0.5, 1.6, 0]} material={M.woodDark} castShadow>
          <boxGeometry args={[2, 3.2, 0.7]} />
        </mesh>
        {[0.5, 1.3, 2.1, 2.9].map((y, r) =>
          [0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={`${r}${i}`} position={[-0.25 + i * 0.3, y + 0.05, 0.3]} castShadow>
              <boxGeometry args={[0.22, 0.5 + ((i + r) % 3) * 0.06, 0.3]} />
              <meshStandardMaterial color={[color, C.cream, C.burgundy, C.clay][(i + r) % 4] ?? color} roughness={1} />
            </mesh>
          )),
        )}
      </group>
    );
  }
  if (kind === 1) {
    return (
      <group position={[-3.1, 0, -5.6]}>
        <mesh position={[0, 1.5, 0]} material={M.rack} castShadow>
          <boxGeometry args={[1.1, 3, 1]} />
        </mesh>
        <group ref={blink}>
          {Array.from({ length: 15 }, (_, i) => (
            <mesh key={i} position={[-0.33 + (i % 3) * 0.33, 0.5 + Math.floor(i / 3) * 0.5, 0.52]}>
              <boxGeometry args={[0.14, 0.14, 0.04]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
    );
  }
  return (
    <group position={[-3.2, 0, -5.9]}>
      {[0, 1].map((i) => (
        <group key={i} position={[i * 0.95, 0, 0]}>
          <mesh position={[0, 0.8, 0]} material={M.wallSide} castShadow>
            <boxGeometry args={[0.85, 1.6, 0.8]} />
          </mesh>
          {[0.35, 0.85, 1.35].map((y) => (
            <mesh key={y} position={[0, y, 0.42]} material={M.metal}>
              <boxGeometry args={[0.3, 0.06, 0.04]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0.45, 1.75, 0]} material={M.paper} castShadow>
        <boxGeometry args={[0.7, 0.3, 0.5]} />
      </mesh>
    </group>
  );
}

/** The house's floating tick (done) or exclamation mark (failed). Held still: the state is permanent until it changes. */
function Sign({ state }: { state: RoomState }) {
  if (state !== "failed" && state !== "done") return null;
  const color = state === "failed" ? RED : GREEN;
  return (
    <group position={[0, 2.95, -3.5]}>
      {state === "done" ? (
        <>
          <mesh position={[-0.12, -0.05, 0]} rotation={[0, 0, 0.8]}>
            <boxGeometry args={[0.14, 0.34, 0.14]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh position={[0.1, 0.08, 0]} rotation={[0, 0, -0.7]}>
            <boxGeometry args={[0.14, 0.62, 0.14]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.16, 0.5, 0.16]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.24, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshBasicMaterial color={color} toneMapped={false} />
          </mesh>
        </>
      )}
    </group>
  );
}

/* ------------------------------ a room ------------------------------------------------ */

interface RoomProps {
  room: SceneRoom;
  index: number;
  x: number;
  y: number;
  still: boolean;
  labelScale: number;
  layer: HTMLElement;
  onSelect: (id: string) => void;
}

function RoomBox({ room, index, x, y, still, labelScale, layer, onSelect }: RoomProps) {
  const portal = useMemo(() => ({ current: layer }), [layer]);
  const [hover, setHover] = useState(false);
  const edge = useRef<THREE.MeshBasicMaterial>(null);
  const active = isActive(room.state);
  const color = edgeColor(room);

  useFrame(({ clock }) => {
    if (!edge.current) return;
    // Reading pulses the room's front edge, as "waiting" does in the house.
    const pulse = room.state === "reading" && !still ? 0.55 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 3)) : 1;
    edge.current.opacity = (room.state === "idle" ? 0.35 : 1) * pulse;
  });

  return (
    <group
      position={[x, y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "";
        onSelect(room.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh position={[0, -0.1, -D / 2]} material={M.wood} receiveShadow>
        <boxGeometry args={[ROOM_W - 0.3, 0.2, D]} />
      </mesh>
      {[-2.4, -0.8, 0.8, 2.4].map((px) => (
        <mesh key={px} position={[px, 0.005, -D / 2]} material={M.woodDark}>
          <boxGeometry args={[0.04, 0.01, D]} />
        </mesh>
      ))}
      <mesh position={[0, WALL_H / 2, -D]} material={M.wall} receiveShadow>
        <boxGeometry args={[ROOM_W - 0.3, WALL_H, 0.2]} />
      </mesh>
      <mesh position={[0, 0.2, -D + 0.14]} material={M.skirting}>
        <boxGeometry args={[ROOM_W - 0.3, 0.4, 0.1]} />
      </mesh>
      <mesh position={[0, WALL_H - 0.22, -D + 0.13]}>
        <boxGeometry args={[ROOM_W - 0.3, 0.44, 0.08]} />
        <meshStandardMaterial color={room.color} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 0.06]}>
        <boxGeometry args={[ROOM_W - 0.3, 0.26, 0.14]} />
        <meshBasicMaterial ref={edge} color={hover ? "#FFFFFF" : color} transparent toneMapped={false} />
      </mesh>

      <group position={[2.75, 2.9, -D + 0.13]}>
        <mesh material={M.sky}>
          <planeGeometry args={[1.5, 2.1]} />
        </mesh>
        <mesh position={[-0.2, 0.4, 0.01]} material={M.cloud}>
          <planeGeometry args={[0.6, 0.22]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={M.skirting}>
          <boxGeometry args={[0.07, 2.1, 0.05]} />
        </mesh>
        <mesh position={[0, 0, 0.03]} material={M.skirting}>
          <boxGeometry args={[1.5, 0.07, 0.05]} />
        </mesh>
        {[
          [0, 1.1, 1.74, 0.14],
          [0, -1.1, 1.74, 0.14],
          [-0.8, 0, 0.14, 2.3],
          [0.8, 0, 0.14, 2.3],
        ].map(([px = 0, py = 0, w = 1, h = 1], i) => (
          <mesh key={i} position={[px, py, 0.04]} material={M.skirting}>
            <boxGeometry args={[w, h, 0.1]} />
          </mesh>
        ))}
      </group>

      <WallScreen color={room.color} active={active} still={still} />
      <Prop kind={index % 3} color={room.color} active={active} still={still} />
      <Plant pos={[3.3, 0, -1.1]} />

      <mesh position={[0.2, 0.012, -3.1]}>
        <boxGeometry args={[4.4, 0.02, 2.8]} />
        <meshStandardMaterial color={room.color} roughness={1} transparent opacity={0.3} />
      </mesh>
      <group position={[0.2, 0, -2.5]}>
        <mesh position={[0, 1.2, 0]} material={M.desk} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.12, 1.2]} />
        </mesh>
        {[-1.4, 1.4].map((px) => (
          <mesh key={px} position={[px, 0.6, 0]} material={M.metal} castShadow>
            <boxGeometry args={[0.12, 1.2, 0.9]} />
          </mesh>
        ))}
        <mesh position={[0, 1.29, -0.1]} material={M.metal}>
          <boxGeometry args={[0.95, 0.05, 0.62]} />
        </mesh>
        <mesh position={[0, 1.6, 0.26]} rotation={[0.22, 0, 0]} material={M.metal} castShadow>
          <boxGeometry args={[0.95, 0.62, 0.05]} />
        </mesh>
        <mesh position={[0, 1.6, 0.3]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[0.2, 0.2, 0.02]} />
          <meshBasicMaterial color={active ? color : "#6B625C"} toneMapped={false} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-1.05, 1.29 + i * 0.045, 0.05]} rotation={[0, 0.2 * i - 0.2, 0]} material={M.paper}>
            <boxGeometry args={[0.6, 0.04, 0.44]} />
          </mesh>
        ))}
      </group>

      <group position={[0.2, 0, -3.5]} scale={1.3}>
        <Person seed={index + 2} tie={room.color} pose={POSE[room.state]} still={still || !active} />
      </group>
      <Sign state={room.state} />

      <Html portal={portal} position={[0, WALL_H - 0.3, -D + 0.3]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div
          style={{
            width: 140,
            transform: `scale(${labelScale})`,
            transformOrigin: "50% 100%",
            textAlign: "center",
            padding: "8px 10px 9px",
            background: C.surface,
            border: `1.5px solid ${room.state === "idle" ? C.panel : color}`,
            borderRadius: 14,
            color: C.ink,
            boxShadow: "0 2px 0 rgba(26,14,11,0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, font: `600 12.5px/1.2 ${SANS}` }}>
            <span style={{ flex: "none", width: 8, height: 8, borderRadius: 8, background: room.color }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.name}</span>
          </div>
          <div style={{ marginTop: 3, font: `${room.state === "idle" ? 400 : 600} 12px/1.2 ${SANS}`, color: STATE_TEXT[room.state] }}>
            {room.label} · <span style={{ fontWeight: 400, color: "#7a6a62" }}>{room.meta}</span>
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------ the assistant ----------------------------------------- */

/** The house's window-glow curves (WhiteHouse.tsx), applied to the orb over the assistant's head. */
function orbIntensity(state: OrbState, t: number): number {
  if (state === "done") return 1.9;
  if (state === "failed") return Math.sin(t * 9) > 0 ? 1.8 : 0.5;
  if (state === "idle") return 0.22;
  return 1.5 + Math.sin(t * (state === "reading" ? 3.5 : 7)) * 0.25;
}

/** Walks the corridor to the room the answer is working in, with the orb over their head. Changes storey like a lift. */
function Assistant({ target, orb, still }: { target: { x: number; y: number }; orb: OrbState; still: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const [moving, setMoving] = useState(false);
  const working = orb === "searching" || orb === "reading" || orb === "answering";
  const color = orb === "done" ? GREEN : orb === "failed" ? RED : ACCENT;

  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (g) {
      const toward = (from: number, to: number, speed: number) => (still ? to : from + Math.sign(to - from) * Math.min(Math.abs(to - from), dt * speed));
      const dx = target.x - g.position.x;
      g.position.y = toward(g.position.y, target.y - 0.16, 9);
      g.position.x = toward(g.position.x, target.x, 10);
      const nowMoving = Math.abs(target.x - g.position.x) > 0.05 || Math.abs(target.y - 0.16 - g.position.y) > 0.05;
      if (nowMoving !== moving) setMoving(nowMoving);
      const face = Math.abs(dx) > 0.05 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : working ? Math.PI : 0;
      g.rotation.y += (face - g.rotation.y) * (still ? 1 : 0.2);
    }
    if (glow.current) glow.current.emissiveIntensity = still && working ? 1.5 : orbIntensity(orb, clock.elapsedTime);
  });

  const pose: Pose = moving ? "walk" : working ? "talk" : "idle";
  return (
    <group ref={ref} position={[target.x, target.y - 0.16, 1.4]}>
      <group scale={1.3}>
        <Person seed={11} tie={C.coral} pose={pose} still={still || (!moving && !working)} suit="#2B2B31" />
      </group>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.3, 24, 16]} />
        <meshStandardMaterial ref={glow} color={color} emissive={color} emissiveIntensity={0.22} roughness={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** One storey's shell, from the house: slab and corridor runner, walls between rooms, the cornice. */
function Storey({ y, count }: { y: number; count: number }) {
  const width = count * ROOM_W;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -0.3, -1.6]} material={M.slab} castShadow receiveShadow>
        <boxGeometry args={[width + 0.6, y > 0 ? 0.6 : 0.24, D + 4.2]} />
      </mesh>
      <mesh position={[0, -0.17, 1.4]} material={M.runner} receiveShadow>
        <boxGeometry args={[width - 0.4, 0.03, 1.5]} />
      </mesh>
      {[0.62, 2.18].map((z) => (
        <mesh key={z} position={[0, -0.165, z]} material={M.runnerEdge}>
          <boxGeometry args={[width - 0.4, 0.035, 0.07]} />
        </mesh>
      ))}
      {Array.from({ length: count + 1 }, (_, i) => (
        <mesh key={i} position={[(i - count / 2) * ROOM_W, WALL_H / 2, -D / 2]} material={M.wallSide} castShadow receiveShadow>
          <boxGeometry args={[0.3, WALL_H, D + 0.2]} />
        </mesh>
      ))}
      <mesh position={[0, WALL_H + 0.12, -D]} material={M.skirting} castShadow>
        <boxGeometry args={[width + 0.5, 0.24, 0.5]} />
      </mesh>
    </group>
  );
}

/* ------------------------------ the floor --------------------------------------------- */

export interface FloorProps {
  rooms: SceneRoom[];
  assistantRoomId: string | null;
  orb: OrbState;
  still: boolean;
  labelScale: number;
  layer: HTMLElement;
  onSelect: (id: string) => void;
}

export function FloorScene({ rooms, assistantRoomId, orb, still, labelScale, layer, onSelect }: FloorProps) {
  const n = rooms.length;
  const { cols, rows } = layoutOf(n);
  const slot = rooms.findIndex((r) => r.id === assistantRoomId);
  // Unassigned, the assistant waits in the middle of the ground-floor corridor.
  const target = slot >= 0 ? roomPos(slot, n) : { x: 0, y: 0 };
  const storeys = Array.from({ length: rows }, (_, row) => ({ row, count: Math.min(cols, Math.max(1, n) - row * cols), y: (rows - 1 - row) * STOREY_H }));

  return (
    <group>
      <color attach="background" args={[C.light]} />
      <ambientLight intensity={1.25} color="#FFF4E8" />
      <directionalLight
        castShadow
        position={[10, 18 + (rows - 1) * STOREY_H, 14]}
        intensity={1.9}
        color="#FFE9D2"
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={16 + (rows - 1) * STOREY_H}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={C.cream} roughness={1} />
      </mesh>

      {n > 0 ? storeys.map((s) => <Storey key={s.row} y={s.y} count={s.count} />) : <EmptySlab />}

      {rooms.map((room, i) => {
        const p = roomPos(i, n);
        return <RoomBox key={room.id} room={room} index={i} x={p.x} y={p.y} still={still} labelScale={labelScale} layer={layer} onSelect={onSelect} />;
      })}

      <Assistant target={target} orb={orb} still={still} />
    </group>
  );
}

/** No repos yet: just the slab and corridor, waiting for the first room. */
function EmptySlab() {
  return (
    <mesh position={[0, -0.3, -1.6]} material={M.slab} castShadow receiveShadow>
      <boxGeometry args={[ROOM_W + 0.6, 0.24, D + 4.2]} />
    </mesh>
  );
}
