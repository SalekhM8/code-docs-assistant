# White House UI: design-token reference

Source: `/Users/salekhmahmood/Ventures/palmer-clone` (read only). All paths are relative to it. `HD` = `src/components/house3d/`. The landing pages were not used.

**Read this first.** BRIEF.md (lines 402, 414) describes a "near black navy" night scene with an orb in every figure. **The code does not do that.**
- The house is a warm, cream, daytime palette. A comment says it is "taken from the dast. films" brand (`HD/model.ts:13`).
- No figure has an orb. `Person.tsx` is block-built and shows its department colour only in the **tie** (`HD/Person.tsx:33,140-141`).
- The orb idea is spread across a few things: lit room windows, room edge strips, board dots, state signs and a courier.
- No bloom or postprocessing is imported (`HD/House3D.tsx:4-7`). Glow comes from emissive materials and `toneMapped={false}`.
- `globals.css :root` (`src/app/globals.css:3-12`) is a site-wide white/black/#0066CC set, shared with the landing pages. The house uses none of it except the reduced-motion rule. House colours are inline constants in `model.ts`.

## 1. Colours

**Brand constants `C`** (`HD/model.ts:14-25`)
| token | hex | used for (file:line) |
|---|---|---|
| surface | `#faf3ee` | cards, labels, sheets (`HD/House3D.tsx:99`, `HD/FloorScene.tsx:561`) |
| cream | `#f4e8de` | inputs, output cards, fade between places, studio floor (`HD/House3D.tsx:1180,898,618`; `HD/FloorScene.tsx:678`) |
| light | `#f6e7dd` | floor-scene background (`HD/FloorScene.tsx:661`) |
| panel | `#ecd5c6` | dividers/borders, selected room row, idle label border (`HD/House3D.tsx:873,509`; `HD/FloorScene.tsx:562`) |
| blush | `#e8c7b5` | ghost-button border, sheet grab handle, input border (`HD/House3D.tsx:228,211,1180`) |
| clay | `#d98e76` | corridor runner edge (`HD/FloorScene.tsx:84`) |
| coral | `#e55d40` | headline full stop, Chief's tie (`HD/House3D.tsx:109`; `HD/Interior.tsx:162`) |
| terracotta | `#b03a2a` | eyebrow labels, log kind, "New for you" border (`HD/House3D.tsx:101,995,796`) |
| burgundy | `#6a1a18` | corridor runner, curtains (`HD/FloorScene.tsx:83`; `HD/Interior.tsx:24`) |
| ink | `#1a0e0b` | primary text, primary button, user chat bubble, focus ring (`HD/House3D.tsx:227,1125,1179`) |

**Text levels**
- ink `#1a0e0b` is the primary text colour.
- `#33271f` is body text in approvals and call lists (`HD/Approvals.tsx:115`; `HD/CallList.tsx:408`).
- `#4a3b34` is secondary body text (`HD/House3D.tsx:789,837`).
- `#7a6a62` is muted text: meta, timestamps, idle (`HD/model.ts:47`; `HD/House3D.tsx:216,993`).
- `#8a7a72` is the "no score" tone (`HD/CallList.tsx:210`).
- `#a4561c` is warning/notice text (`HD/House3D.tsx:1186`; `HD/Instructions.tsx:13,17`).
- `#3a5a8c` means "waiting for engineering" (`HD/Instructions.tsx:16`).

**State colours.** They mean the same thing everywhere (`HD/model.ts:42-53,116-121`).
| state | fill | text on cream (`STATE_TEXT`) | tint panel |
|---|---|---|---|
| waiting (needs you) | AMBER `#F5A300` | `#8a5200` | `#FFF3D6`, border 1.5px AMBER (`HD/House3D.tsx:826`) |
| failed | RED `#E0352B` | `#a8231b` | `#FDE5E2`, border 1.5px RED (`HD/House3D.tsx:855`) |
| done | GREEN `#27A567` | `#1c7046` | none (green is also the "Resume" button, `HD/House3D.tsx:690`) |
| idle | department colour | `#7a6a62` | none |
| working / handoff | department colour | ink | none |

`stateColor()` returns amber, red or green for those three states, and the department colour for every other state (`HD/model.ts:116-121`).

Call-list scores use their own tones: `#B3261E` below 40, `#B26A00` below 70, `#1c7046` otherwise (`HD/CallList.tsx:210`).

**Department colours** (`HD/model.ts:29-37`)
- Data `#2F8FE8`
- Ads `#8B6CF0`
- Creative `#E8559F`
- Customer Relations `#16B5A6`
- Engineering `#5E6B85`
- Research `#C98A1A`
- Outreach `#E55D40`

**Dark values that exist in the code**
- `#0B0D12`: loader background (`HD/HouseLoader.tsx:8`, with text `white/70`) and the live board at opacity 0.82 (`HD/Interior.tsx:169`).
- `#10151D`: room-window glass base (`HD/WhiteHouse.tsx:219`).
- `#2A1A12`: Oval Office background (`HD/House3D.tsx:545`).
- Scrim: `rgba(26,14,11,0.45)` (`HD/House3D.tsx:1032`).

**Rule breaks in decorative greens.** `#3DDC97` appears on wall screens and server racks (`HD/FloorScene.tsx:144,229,304`). The patrol drones use `#3BA7FF #FF6AC1 #35E0D0 #A78BFA` (`HD/WhiteHouse.tsx:947-950`). Do not copy these: the green breaks "green = done only".

## 2. Typography

**How the fonts load**
- **Serif:** Fraunces via `next/font/google`, weights 300 and 400, normal and italic, `display: swap`, CSS variable `--font-fraunces` (`src/lib/fonts.ts:4-10`). It is applied only to the house through `src/app/house/layout.tsx:4`.
- **Sans:** Inter, `--font-inter`, weights 400/500/600/700, loaded in the root layout (`src/app/layout.tsx:13-18,90`).
- Stacks:
  - `SERIF = "var(--font-fraunces), Georgia, serif"` (`HD/model.ts:26`)
  - `SANS = "var(--font-inter), ui-sans-serif, system-ui, sans-serif"` (`HD/model.ts:27`)
- **Mono:** no web font is loaded. The code uses `ui-monospace, monospace` at 500 12–12.5px for times, ids and commands (`HD/House3D.tsx:812,993`; `HD/Approvals.tsx:108`), and at `500 0.92em` for inline code (`HD/Markdown.tsx:13`).

**Type scale** (CSS `font` shorthand: weight size/line-height family)
| role | value | where |
|---|---|---|
| Headline | Serif 300, 30px default (20 / 26–28 / 38), /1.05, ls -0.03em, coral "." after | `HD/House3D.tsx:105-111,626,780` |
| Serif titles | Serif 300 17–22px, /1.1–1.3, ls -0.01 to -0.02em | `HD/House3D.tsx:798,834,901`; `HD/Instructions.tsx:98` |
| Chief answer | Serif 300 21px (18 on phone) /1.3, ls -0.015em | `HD/House3D.tsx:1131` |
| Markdown h1/h2 | Serif 300 34 / 28px /1.1, ls -0.03em | `HD/Markdown.tsx:38` |
| Eyebrow | Sans 600 10.5px/1.4, ls 0.22em, uppercase, terracotta | `HD/House3D.tsx:102` |
| Meta caps | Sans 600 10.5px, ls 0.16em, uppercase, `#7a6a62` ("As of …") | `HD/House3D.tsx:1110,1130` |
| Floor tag | Sans 600 9–10px, ls 0.18–0.2em | `HD/House3D.tsx:498,726`; `HD/WhiteHouse.tsx:886` |
| State "Now" | Sans 600 17px/1.2 in `STATE_TEXT` colour | `HD/House3D.tsx:785` |
| Body | Sans 400 14–15.5px, /1.45–1.6 | `HD/House3D.tsx:789`; `HD/Markdown.tsx:113` |
| Button | Sans 600 14px/1 (13 on small pills) | `HD/House3D.tsx:227` |
| Label pill | Sans 600 12.5–13px/1 | `HD/FloorScene.tsx:568`; `HD/WhiteHouse.tsx:235` |
| Chat input | Sans 400 16px/1 (16px avoids iOS zoom) | `HD/House3D.tsx:1180` |

Counters use the `tabular-nums` class (`HD/House3D.tsx:679`).

## 3. Spacing, radius, borders

**Radius**
- Card: 22px (`HD/House3D.tsx:99`).
- Pills and buttons: 999 (`HD/House3D.tsx:227`).
- Labels and floor tags: 14px (`HD/FloorScene.tsx:563`; `HD/House3D.tsx:722`).
- Sections: `rounded-2xl` (16px) (`HD/House3D.tsx:796`).
- List items: `rounded-xl` (12px) (`HD/Approvals.tsx:95`).
- Score keys: `rounded-lg` (`HD/House3D.tsx:934`).
- Code: 5px (`HD/Markdown.tsx:13`).
- Dot: radius equal to its size.

**Borders**
- Default: 1.5px (`HD/House3D.tsx:228,826`).
- 1px in instruction cards, call-list boxes and table rows (`HD/Instructions.tsx:91`; `HD/Markdown.tsx:76`).
- 3px on the score ring (`HD/CallList.tsx:398`).
- Dividers: `border-b` / `border-t` in `C.panel` (`HD/House3D.tsx:992,1006`).

**Sizes**
- Buttons: min-height 46 (primary/ghost), then 44, 42, 40 and 38 for smaller ones. Padding `0 20px` (primary), `0 18px` (ghost), `0 14px` (small) (`HD/House3D.tsx:227-228,632,909,977`).
- Panel padding: `px-5 pb-4 pt-1 md:p-6` (`HD/House3D.tsx:774`).
- Label padding: `8px 10px 9px`, label width 132 (`HD/FloorScene.tsx:556-560`). Pill padding: `6px 12px` and `8px 16px` (`HD/WhiteHouse.tsx:229,796`).
- Desktop sheet: `absolute bottom-5 right-5 top-[84px] w-[420px]`, or `w-[440px]` when wide (`HD/House3D.tsx:161`).
- Phone sheet: `inset-x-2 bottom-2`. Snap heights: min 74, mid 42% of host height, full = host height − 150 (at least 260). Grab handle 44×5, colour blush (`HD/House3D.tsx:168,191,211`).
- Dots: 7–12px; 9 by default (`HD/House3D.tsx:114`).

## 4. Shadows and glows

**CSS shadows**
- Card: `0 1px 0 rgba(26,14,11,0.08), 0 14px 40px rgba(26,14,11,0.16)` (`HD/House3D.tsx:99`).
- Room label: `0 2px 0 rgba(26,14,11,0.12)` (`HD/FloorScene.tsx:565`).
- Floor tag (phone): `0 6px 18px rgba(26,14,11,0.18)` (`HD/House3D.tsx:722`).
- Focus: `focus:ring-2 focus:ring-[#1a0e0b]` (`HD/House3D.tsx:952,1179`).

**3D glow.** There is no bloom; brightness comes from emissive materials and `toneMapped={false}`.
- Room window: `color="#10151D" emissive={stateColor} emissiveIntensity` from 0.22 to 2.4, roughness 0.3 (`HD/WhiteHouse.tsx:219`). See section 6.
- Warm windows: `#3A2E1C`, emissive `#FFC878` at 0.55 (`HD/WhiteHouse.tsx:41`).
- Lamps: `#FFE2A6`, emissive `#FFD27A` at 2.2 (`HD/WhiteHouse.tsx:52`) and 2 (`HD/Interior.tsx:125`).
- Door light: pointLight `#FFD27A`, intensity 24, or 60 on hover (`HD/WhiteHouse.tsx:768`).
- State-coloured meshes use `meshBasicMaterial … toneMapped={false}`, so they render at full brightness. This covers the room edge, signs, board dots and courier (`HD/FloorScene.tsx:380,480`; `HD/Interior.tsx:178`; `HD/WhiteHouse.tsx:271`).
- Courier trail: `<Trail width={2.2} length={7} attenuation={(w) => w * w}>` (`HD/WhiteHouse.tsx:269`).

## 5. Motion

**UI transitions** (Motion for React, imported from `motion/react`, `HD/House3D.tsx:6`)
| what | values | trigger |
|---|---|---|
| Desktop sheet | x 40→0, opacity 0→1, 0.22s, ease `[0.2, 0.7, 0.1, 1]` (exit reverses) | open a room or the Oval (`HD/House3D.tsx:156-159`) |
| Phone sheet | height spring `stiffness: 330, damping: 34`; `duration: 0` while dragging | snap or drag (`HD/House3D.tsx:189`) |
| Place change | cream overlay, opacity 0.16s; scene swaps after 170ms | going to another scene (`HD/House3D.tsx:618,403-407`) |
| Reader | scrim opacity 0.16s; article y 16→0, 0.2s, same ease | open an output (`HD/House3D.tsx:1036,1042-1044`) |
| Chat answer | opacity 0→1, y 8→0, 0.2s | a new Chief message (`HD/House3D.tsx:1129`) |
| Stopped banner | opacity with y −8→0, default transition | Stop pressed (`HD/House3D.tsx:699-701`) |
| Camera | `k = 1 - Math.exp(-dt * 6)` lerp | location change, pointer parallax (`HD/House3D.tsx:89`) |
| Grounds | OrbitControls `autoRotateSpeed 0.35`, `enableDamping` | until the user drags (`HD/House3D.tsx:605-608`) |
| Sim tick | every 1000ms, skipped while `document.hidden` | (`HD/model.ts:249-251`) |
| Courier | duration `max(1.1, length/22)` s along a quadratic Bezier | handoff (`HD/WhiteHouse.tsx:251-257`) |
| Document hop | 1.1s smoothstep `k*k*(3-2k)`, arc height `sin(kπ)*1.4` | handoff on a floor (`HD/FloorScene.tsx:585-591`) |
| Person poses | idle / typing / wave / cheer / slump / talk, per state; smoothing 0.22 per frame | (`HD/FloorScene.tsx:403`; `HD/Person.tsx:63-119`) |
| Beacon | scale `1 + (sin(3t)+1)*0.35` | always, unless stopped (`HD/WhiteHouse.tsx:467`) |

**Reduced motion**
- `useReducedMotion()` (`HD/House3D.tsx:266`) feeds `still = reduced || stopped` (`HD/House3D.tsx:337`).
- With `still`, people freeze (`t=0`, `k=1`; `HD/Person.tsx:64,104`). Screens and props hold a fixed frame (`HD/FloorScene.tsx:151,214`). The waiting edge stops pulsing (`HD/FloorScene.tsx:435`).
- Reduced motion also stops couriers (`HD/model.ts:170`), turns off auto-rotate (`HD/House3D.tsx:605`), skips the scene fade (`HD/House3D.tsx:399`), makes sheets fade only or jump (`HD/House3D.tsx:156,189`), and drops the article slide (`HD/House3D.tsx:1042`).
- The global CSS rule cuts every animation and transition to 0.001ms (`src/app/globals.css:71-78`).
- The frame loop stops off screen: `frameloop={paused ? "never" : "always"}` (`HD/House3D.tsx:541`).
- **Gap:** `RoomWindow` never receives `still`, so the window pulse and flicker keep running under reduced motion (`HD/WhiteHouse.tsx:184-195`). The `Sign` bob and spin (`HD/FloorScene.tsx:366-371`) also ignore it.

## 6. The "orb" as built

What exists in the code:
- **(a) Room window glow.** A plane `room.w+0.5 × room.h+0.5` with dark glass and a state-coloured emissive. This is the main brightness signal (`HD/WhiteHouse.tsx:209-220`).
- **(b) Room front-edge strip.** A box 0.26 high (`HD/FloorScene.tsx:478-481`).
- **(c) Live-board dots.** Spheres of radius 0.13 (`HD/Interior.tsx:176-178`).
- **(d) Floating sign.** `!` for waiting/failed, a tick for done (`HD/FloorScene.tsx:364-401`).
- **(e) Courier.** A 0.5 box with a trail, white from the Chief or the department colour (`HD/WhiteHouse.tsx:248-276`; `HD/model.ts:211,230`).

Key lines:
```ts
// HD/WhiteHouse.tsx:184-195  (window glow, runs every frame)
m.emissive.lerp(target, 0.12);                       // colour eases toward stateColor
let k = 0.22;                                        // idle
if (state === "working" || state === "handoff") k = 1.5 + Math.sin(t * 7 + room.pos[0]) * 0.25;
if (state === "waiting") k = 1.5 + Math.sin(t * 5) * 0.9;
if (state === "done") k = 1.9;
if (state === "failed") k = Math.sin(t * 9) > 0 ? 1.8 : 0.5;
m.emissiveIntensity += ((hover ? k + 0.6 : k) - m.emissiveIntensity) * 0.15;
// HD/FloorScene.tsx:435-436  (room edge)
const pulse = state === "waiting" && !still ? 0.55 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 3)) : 1;
edge.current.opacity = (state === "idle" ? 0.35 : 1) * pulse;
// HD/Interior.tsx:176-178  (board)  scale={lit ? 1 : 0.6} … opacity={lit ? 1 : 0.4}
```

| state | colour | window intensity | rhythm | edge | other |
|---|---|---|---|---|---|
| idle | department | 0.22 steady | none | opacity 0.35 | board dot 0.6× size, 0.4 opacity; pose idle |
| working / handoff | department | 1.25–1.75 | sine 7 rad/s, period about 0.90s, phase offset by room x | 1 | screens animate; pose typing / talk |
| waiting | AMBER | 0.6–2.4 | sine 5 rad/s, period about 1.26s | 0.55–1.0, \|sin 3t\|, period about 1.05s | `!` sign; pill label always shown (`HD/WhiteHouse.tsx:222`); pose wave |
| done | GREEN | 1.9 steady (no flash curve) | holds for 2 sim ticks (about 2–3s), then idle (`HD/model.ts:240-241`) | 1 | tick sign; pose cheer |
| failed | RED | square wave 1.8 / 0.5 | `sin(9t)>0`, period about 0.70s | 1 | `!` sign; label shown; stays until `acknowledge` (`HD/model.ts:281-287`); pose slump |

Hover adds +0.6 intensity (`HD/WhiteHouse.tsx:194`) and turns the edge white (`HD/FloorScene.tsx:480`). The 0.12 and 0.15 easing factors are per frame, not tied to `dt`.

## 7. Reusable 2D components

All of these are inline style objects; there are no CSS classes.
- **`card`**: surface background, ink text, radius 22, the card shadow (`HD/House3D.tsx:99`). It is the base for every panel; pills use the same object with `borderRadius: 999`.
- **`Eyebrow`**: 600 10.5px, ls 0.22em, uppercase, terracotta (`HD/House3D.tsx:101-103`).
- **`Headline`**: Serif 300, ls -0.03em, coral full stop (`HD/House3D.tsx:105-112`).
- **`Dot`**: an inline-block circle (`HD/House3D.tsx:114-116`).
- **`Sheet`**: a side card on desktop and a 3-snap bottom sheet on phones (`HD/House3D.tsx:124-225`).
- **Buttons:**
  - `btnPrimary`: ink background, surface text, pill shape, min-height 46.
  - `btnGhost`: transparent, 1.5px blush border, or `borderColor: C.ink` for more contrast (`HD/House3D.tsx:227-228`).
  - Selected toggle: ink background with surface text (`HD/House3D.tsx:481`; `HD/CallList.tsx:366`).
- **Status counter pill**: Working, Needs you and Failed, each with a coloured dot and the label kept as text (`HD/House3D.tsx:679-689`).
- **State callouts**: amber `#FFF3D6` and red `#FDE5E2` blocks, `rounded-2xl p-4`, with a 1.5px state border (`HD/House3D.tsx:826,855`).
- **Room label card**: 132 wide, radius 14, a department dot plus the state text in `STATE_TEXT` (`HD/FloorScene.tsx:554-573`).
- **Chat**:
  - User bubble: `self-end rounded-2xl px-4 py-2.5`, ink background, 500 15px, max width 85% (`HD/House3D.tsx:1125`).
  - Chief reply: "As of" meta line, then a Serif 300 21px answer, then room chips as ghost pills (`HD/House3D.tsx:1129-1146`).
  - Input: `min-h-12 rounded-full px-4`, cream background, 1.5px blush border (`HD/House3D.tsx:1179-1180`).
  - Suggestion chips: ghost, 40px, 13px text (`HD/House3D.tsx:1156`).
- **Log row**: `grid-cols-[64px_1fr]` with a mono time and an uppercase terracotta kind (`HD/House3D.tsx:992-995`).
- **Markdown**: h3 styled as an eyebrow; tables with a 1.5px ink head rule, 1px panel row rules and tabular numbers (`HD/Markdown.tsx:42,65,76`).

## 8. Proposed mapping: 2D chat for a code-docs assistant

This section is a proposal. Every value in it is taken from the sections above. Amber, red and green keep their meanings only: amber = needs the user, red = failed, green = done. Searching, reading and answering are all "working", so they use the accent colour.

```css
:root {                         /* light = what the house actually uses */
  --bg: #f6e7dd; --surface: #faf3ee; --surface-2: #f4e8de; --line: #ecd5c6; --line-strong: #e8c7b5;
  --text: #1a0e0b; --text-2: #4a3b34; --text-dim: #7a6a62; --eyebrow: #b03a2a; --mark: #e55d40;
  --accent: #2F8FE8;            /* one dept colour (Data) as the assistant's identity: a choice, not in code */
  --amber: #F5A300; --amber-text: #8a5200; --amber-tint: #FFF3D6;
  --red: #E0352B;   --red-text: #a8231b;   --red-tint: #FDE5E2;
  --green: #27A567; --green-text: #1c7046;
  --orb-core: #10151D;          /* window glass */
  --glow-card: 0 1px 0 rgba(26,14,11,.08), 0 14px 40px rgba(26,14,11,.16);
  --glow-label: 0 2px 0 rgba(26,14,11,.12);
  --scrim: rgba(26,14,11,.45);
  --ease: cubic-bezier(.2,.7,.1,1); --dur-panel: .22s; --dur-fade: .16s; --dur-msg: .2s;
  --r-card: 22px; --r-label: 14px; --r-block: 16px; --r-item: 12px; --border: 1.5px;
  --font-serif: var(--font-fraunces), Georgia, serif;
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;
}
/* optional dark, from the only dark values in the house: bg #0B0D12, surface #10151D, warm #2A1A12 */
```

Tailwind v4 (the repo uses `@theme inline`, `src/app/globals.css:14`):

```css
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-line: var(--line); --color-text: var(--text); --color-text-dim: var(--text-dim);
  --color-accent: var(--accent); --color-amber: var(--amber); --color-red: var(--red); --color-green: var(--green);
  --font-serif: var(--font-serif); --font-sans: var(--font-sans); --font-mono: var(--font-mono);
  --radius-card: 22px; --radius-label: 14px; --shadow-card: var(--glow-card); --ease-house: var(--ease);
}
```

**Orb recipe.** `--i` holds the house's emissive intensity on its 0–2.4 range; glow size and core brightness scale from it.

```css
.orb { --c: var(--accent); --i: .22; width: 28px; aspect-ratio: 1; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%,
    color-mix(in srgb, #fff calc(var(--i) * 25%), var(--c)) 0 18%, var(--c) 55%,
    color-mix(in srgb, var(--c) 45%, var(--orb-core)) 100%);
  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--c) 40%, transparent),
    0 0 calc(var(--i) * 10px) calc(var(--i) * 2px) color-mix(in srgb, var(--c) 55%, transparent);
  opacity: calc(.4 + var(--i) / 4); }  /* idle about 0.46, like the board dot's 0.4 */
@property --i { syntax: "<number>"; inherits: true; initial-value: .22; }
.orb[data-state="idle"]      { --i: .22; }
.orb[data-state="searching"] { animation: work .9s ease-in-out infinite; }          /* 1.5±0.25 at 7 rad/s */
.orb[data-state="reading"]   { animation: work 1.8s ease-in-out infinite; }         /* proposal: same curve, half speed */
.orb[data-state="answering"] { --i: 1.5; animation: work .9s ease-in-out infinite; } /* proposal: plus text streaming next to it */
.orb[data-state="waiting"]   { --c: var(--amber); animation: wait 1.26s ease-in-out infinite; } /* 0.6–2.4 at 5 rad/s */
.orb[data-state="done"]      { --c: var(--green); --i: 1.9; }   /* hold about 2s, then return to idle (model.ts:240) */
.orb[data-state="failed"]    { --c: var(--red); animation: fail .7s steps(1) infinite; }      /* 1.8 / 0.5 square wave */
@keyframes work { 0%,100% { --i: 1.25 } 50% { --i: 1.75 } }
@keyframes wait { 0%,100% { --i: .6 }  50% { --i: 2.4 } }
@keyframes fail { 0% { --i: 1.8 } 50% { --i: .5 } }
.orb { transition: --i .25s var(--ease), background-color .25s; }  /* stands in for the per-frame lerps (0.12 / 0.15) */
@media (prefers-reduced-motion: reduce) { .orb { animation: none !important; }
  .orb[data-state="waiting"] { --i: 1.5 } .orb[data-state="failed"] { --i: 1.8 } } /* fixes the house's gap */
```

Rules carried over from the house:
- Always put a text label next to the orb, coloured with the matching `-text` token (`STATE_LABEL`, `HD/model.ts:55-62`; BRIEF.md:420).
- Use an amber `--amber-tint` callout for "needs your input" and a red `--red-tint` callout for failures.
- Do not use decorative greens.
