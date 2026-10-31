# Demo Event

Walkable 3D event venue preview (Three.js). Static site: no build step.

- `index.html` is the whole app; the venue and avatar are embedded as `stage.b64.txt` and `avatar.b64.txt`.
- `draco/` holds the Draco decoder used to load the venue model.
- Run locally with any static server (do not open `index.html` via `file://`), for example `npx http-server .`.
- Deployed on Vercel using `vercel.json`.
