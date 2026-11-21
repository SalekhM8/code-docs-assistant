# Design tokens

Source: the author's White House app. The house UI lives in `~/Ventures/palmer-clone/src/components/house3d` (`HD/` below), and its design brief is in `white-house/BRIEF.md`. `docs/design/source-notes.md` has the extraction, with a file and line for every value. Only the house UI was used; the same repo's marketing pages copy a third-party site and were ignored.

Every value below lives in one file, `apps/web/src/app/theme.css`. The orb is in `apps/web/src/app/orb.css`.

## What the source actually is

The house brief describes a near-black navy night scene, but the built house is a warm, cream, daytime palette (`HD/model.ts:13-25`). Section 8 says to read the real source, so the tokens follow the code, not the brief.

## Colour

| Token | Value | Source | Used for here |
| --- | --- | --- | --- |
| `--bg` | `#f6e7dd` | `C.light`, `HD/FloorScene.tsx:661` | page background |
| `--surface` | `#faf3ee` | `C.surface`, `HD/House3D.tsx:99` | panels, cards, code viewer |
| `--surface-2` | `#f4e8de` | `C.cream`, `HD/House3D.tsx:1180` | inputs, hover, quiet fills |
| `--line` | `#ecd5c6` | `C.panel`, `HD/House3D.tsx:873` | dividers, borders |
| `--line-strong` | `#e8c7b5` | `C.blush`, `HD/House3D.tsx:228` | input and ghost-button borders |
| `--text` | `#1a0e0b` | `C.ink` | primary text, primary button, focus ring |
| `--text-2` | `#4a3b34` | `HD/House3D.tsx:789` | secondary text |
| `--text-dim` | `#7a6a62` | `HD/model.ts:47` | meta, timestamps |
| `--eyebrow` | `#b03a2a` | `C.terracotta`, `HD/House3D.tsx:101` | eyebrow labels |
| `--mark` | `#e55d40` | `C.coral`, `HD/House3D.tsx:109` | headline full stop |
| `--accent` | `#2f8fe8` | Data department, `HD/model.ts:29` | the assistant: orb, live steps, citation chips |
| `--amber` / `-text` / `-tint` | `#f5a300` / `#8a5200` / `#fff3d6` | `HD/model.ts:42-53`, `HD/House3D.tsx:826` | needs you: nothing found, stopped |
| `--red` / `-text` / `-tint` | `#e0352b` / `#a8231b` / `#fde5e2` | same | failed: errors, invalid citations |
| `--green` / `-text` | `#27a567` / `#1c7046` | same | done: repo ready, answer finished |

Amber, red and green mean only "needs you", "failed" and "done", as in the house. The house's decorative greens (`#3DDC97`) are not used. Choosing Data blue for the assistant is my decision; the code has no assistant colour.

## Type

- Serif: Fraunces 300 with italic, via `next/font` (`src/lib/fonts.ts:4-10`). Used for headlines with a coral full stop (`HD/House3D.tsx:105-111`), at -0.03em letter spacing.
- Sans: Inter 400 to 700 (`src/app/layout.tsx:13-18`), for all UI and answer text.
- Mono: `ui-monospace`. The house loads no mono web font (`HD/House3D.tsx:812`).
- Eyebrow: Sans 600, 10.5px, 0.22em spacing, uppercase, terracotta (`HD/House3D.tsx:102`).
- Body 14 to 15px with 1.5 to 1.6 line height (`HD/Markdown.tsx:113`). The composer is 16px so iOS does not zoom (`HD/House3D.tsx:1180`).
- Answers are Sans 15px, not the house's 21px Serif (`HD/House3D.tsx:1131`). Code answers hold lists, identifiers and code, which read better in a smaller sans.

## Shape and depth

- Radius: cards 22px, sections 16px, list items 12px, labels 14px, buttons and pills fully round, inline code 5px (`HD/House3D.tsx:99,227,796`; `HD/Markdown.tsx:13`).
- Borders: 1.5px by default (`HD/House3D.tsx:228`).
- Card shadow: `0 1px 0 rgba(26,14,11,.08), 0 14px 40px rgba(26,14,11,.16)` (`HD/House3D.tsx:99`). Label shadow: `0 2px 0 rgba(26,14,11,.12)`.
- Scrim: `rgba(26,14,11,.45)` (`HD/House3D.tsx:1032`), used behind the trace drawer and the mobile code sheet.

## Motion

| Token | Value | House use (source) | Here |
| --- | --- | --- | --- |
| `--ease-house` | `cubic-bezier(.2,.7,.1,1)` | side sheet (`HD/House3D.tsx:156-159`) | panels, drawer |
| `--dur-panel` | 0.22s | side sheet slide | code viewer and trace drawer |
| `--dur-fade` | 0.16s | scene and scrim fade | scrims |
| `--dur-msg` | 0.2s, y 8 to 0 | new Chief message (`HD/House3D.tsx:1129`) | a finished answer settling in; streamed text itself never animates |

Reduced motion follows the house's global rule (`src/app/globals.css:71-78`): animations and transitions are cut to 0.001ms. This app also stills the orb, which the house misses (`HD/WhiteHouse.tsx:184-195` never receives `still`).

## The orb

In the house, the state glow is a room window: a dark glass core (`#10151D`) with a state-coloured emissive whose intensity follows the state (`HD/WhiteHouse.tsx:184-195`):

- idle 0.22
- working 1.5 ± 0.25 at 7 rad/s
- done a steady 1.9
- failed a square wave between 1.8 and 0.5 at 9 rad/s

Here the orb is CSS. A radial gradient goes from a white highlight, through the state colour, to the dark core. The glow's spread and opacity are driven by an animatable `--i` custom property on the same 0 to 2.4 scale, so the house's curves carry over:

| Assistant state | Set by | Colour | `--i` |
| --- | --- | --- | --- |
| idle | no request in flight | accent | 0.22 |
| searching | `status: searching` (a search or symbol lookup started) | accent | 1.25 to 1.75, 0.9s |
| reading | `status: reading` (`read_file` started) | accent | 1.25 to 1.75, 1.8s |
| answering | `status: answering` (the first text delta arrived) | accent | 1.25 to 1.75, 0.9s |
| done | `done` event | green | 1.9, held 2s then idle |
| failed | `error` event, or a failed message | red | 1.8 / 0.5 square wave |

A text label is always next to the orb, and the live steps list beside it names each search and file as it happens. Colour and motion are never the only signal (BRIEF.md:418-420).

## The floor (3D)

The house's floor view (`HD/FloorScene.tsx`, `HD/Person.tsx`) is reused through `@react-three/fiber` and `@react-three/drei`, at the house's versions. `Person` is copied as is; the room, its furniture, the wall screen, the tick and exclamation signs, the corridor runner and the lights are adapted in `apps/web/src/components/scene/floor-scene.tsx`.

| House | Here | State it shows |
| --- | --- | --- |
| A floor | The home page: one room per repo | Indexing (typing, screen lit), Failed (slumped, red sign), Ready (still) |
| A floor | Inside a repo: one room per top-level folder (up to six; hidden folders and the rest share "Everything else") | Searched (typing), Reading (front edge pulses), Cited (green tick) |
| The Chief of Staff | The assistant, coral tie, orb over their head | Walks to the folder of the newest step that touched a file; afterwards stands by the first cited folder |
| Room-window glow (`HD/WhiteHouse.tsx:184-195`) | The orb over the assistant | Same intensity curves as the CSS orb |
| Stacked floors | More than three rooms stack into two storeys; the assistant takes the lift | Layout only |

Rules kept: people and screens move only while their room has work in flight (the house's always-walking corridor figure and idle sway are not used); reduced motion stills everything and the assistant moves instantly; the camera eases to its frame without pointer parallax. The floor is framed in the gap between the 320px Places column and the 420px side panel (the house's sizes), loads lazily after the panels, and is dropped below 1280px or if WebGL is unavailable.

The chrome copies `HD/House3D.tsx`: the title card (Fraunces 27px with the coral full stop, terracotta eyebrow), the Places card (Fraunces 19px rows, the selected row in ink, rooms as dot + name + state), the breadcrumb pill, the counts pill (Working / Ready / Failed here, as the house's Working / Needs you / Failed), one dark action pill (Stop answering while an answer streams), the side panel (eyebrow, Fraunces 34px headline, ghost-pill suggestions, cream input with a dark Ask button), "As of" time labels, and the bottom hint pill.
