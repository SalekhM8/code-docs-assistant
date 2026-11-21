# Phase 10: The White House UI

After review, the author asked for the UI to look like the White House itself, not only use its tokens, and chose the full 3D version.

1. Reuse the house's `FloorScene` and `Person` (three.js through react-three-fiber and drei, at the house's versions). Repos are rooms on the home floor; inside a repo, top-level folders are rooms (six at most, two storeys past three).
2. The assistant is the Chief of Staff in the corridor with the orb over their head. It walks to the folder of the newest step that touched a file, and afterwards stands by the first cited folder. Steps carry `paths` from the api for this.
3. Room states come only from real state: indexing jobs, live steps (Searched, Reading) and the last answer's valid citations (Cited). Idle rooms are still; reduced motion stills everything.
4. The chrome copies `House3D.tsx`: title card, Places card, breadcrumb and counts pills, a dark action pill, the side panel for the chat, the hint pill. The code viewer opens over the floor.
5. The floor loads lazily, is skipped below 1280px, and falls back to the plain background without WebGL.
6. Tests: unit tests for the folder and state logic, the browser test updated for the new layout.
