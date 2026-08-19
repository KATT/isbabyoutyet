# Rhythm Game Prototype

This placeholder-named product explores a four-lane rhythm game without using
Spotify or another streaming platform. Its charts are generated in the browser
from bundled, redistributable music.

## Workspace

- `web/` — `@rhythm-game/web`, a standalone Vite application on port 3001

From the repository root:

```sh
pnpm --filter @rhythm-game/web dev
```

The application has no backend or environment variables. If the product later
needs either, add them inside this product rather than coupling them to Baby
Outlet.

## Music

The prototype includes three tracks by Kevin MacLeod under Creative Commons
Attribution licenses. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
before redistributing the application or its audio assets.
