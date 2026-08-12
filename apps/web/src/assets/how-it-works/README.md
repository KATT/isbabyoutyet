# The "Show Me How It Works" homepage video

Everything for the homepage demo video lives in this folder:

- `how-it-works.mp4` — the video (phone-portrait, H.264, no audio, ~1–3 MB)
- `poster.jpg` — poster frame (the final feed view)
- `.gitattributes` — both binaries are stored in **Git LFS**
- this README — shot list + regeneration recipe

## How the assets are wired up

The homepage (`apps/web/src/routes/index.tsx`) `import`s both files as Vite
assets — no `public/` folder involved:

```tsx
import howItWorksVideo from "@/assets/how-it-works/how-it-works.mp4";
import howItWorksPoster from "@/assets/how-it-works/poster.jpg";
```

Vite fingerprints them into `dist/assets/` with long-lived cache headers, and
a missing/renamed file is a **build error** instead of a silent 404.

### Git LFS

The binaries are LFS pointers in git. Two things to know:

- **Vercel**: Git LFS must be enabled once per project (Settings → Git →
  Git LFS), then redeploy. `scripts/build-web.mjs` guards against forgetting
  this: if the mp4 is still an un-hydrated LFS pointer at build time, the
  build fails with a clear message rather than shipping a broken video.
- **Locally**: `git lfs install` once per machine; clone/pull hydrates
  automatically after that.

## When to re-record

**Re-record whenever the baby-page UX changes** (status card, "Post update"
dialog, timeline feed, encouragement form, nav bar) so the homepage never
demos a stale UI. Keep it **mobile-first**: record a phone-portrait browser
window (~380–440 px wide — the nav bar sits fixed at the BOTTOM below the
`md` breakpoint) and crop to page content only.

## What the video shows (shot list)

A scripted three-act walkthrough on a real deployment, using a freshly
created baby with a due date a few days out. The owner posts via the
**"Post update" button in the fixed nav bar**, which opens the composer
dialog.

**Act 1 — the owner keeps everyone posted** (owner window)

1. The page in its "Not yet" state: hero, status card, due-date countdown.
2. "Post update" → type a message ("Getting close now — bags are packed! 🎒")
   → post. The status card shows it under "Latest from the family" — a status
   update without a status change.
3. Same flow for a photo update ("Bump photo, week 39!" + photo; the file
   picker is cut in editing). The feed shows "New photo" + "Page photo"
   badges.

**Act 2 — family & friends cheer you on** (visitor view, incognito window)

4. The same page as a visitor: no "Post update"/settings in the bar, the
   "Get Notifications" subscribe button visible. (The permission prompt is
   cut — incognito auto-denies it, which looks broken on camera.)
5. The visitor sends an encouragement as "Aunt Meg": "Good luck!! You've got
   this ❤️". It appears at the top of the merged timeline.

**Act 3 — the big moment** (owner, then visitor)

6. Back in the owner window (Aunt Meg's message has appeared live), the owner
   posts "It's happening!! Off to the hospital soon 🚨" marking **Labour
   started**. The current cut shows the RESULT (montage cut): the status card
   flipped with the message and a "Sending notification…" toast.
7. The visitor's view of the flipped "Labour started" status, then a slow
   scroll of the feed: milestone update with badge → Aunt Meg's encouragement
   → the bump photo → the first text update. End on the feed view.

## How to regenerate

Produced by a Cursor cloud agent; the same recipe works for a human with a
screen recorder, or ask an agent to "re-record the homepage how-it-works
video following apps/web/src/assets/how-it-works/README.md".

1. **Environment**: a Vercel preview deployment of the branch under test
   (previews are seeded — log in with the demo credentials from
   `packages/convex/src/seedCredentials.ts`). Create a fresh baby so the page
   starts empty. Have a pleasant bump photo ready for the upload step.
2. **Recording**: capture EACH ACT as its own short clip of a phone-portrait
   browser window (~400×850), acting out the shot list at a calm pace —
   pause ~2 s on every meaningful state change. Use a **separate incognito
   window** for the visitor acts, positioned/sized identically. Gotchas
   learned the hard way:
   - **Screen recorders with auto-zoom ruin single-take footage**: window
     switches, OS file dialogs, and dialog opens make the framing jump. Record
     one window per clip, do the file picking BETWEEN clips (stage the dialog
     with the photo preview before hitting record), and expect the first ~5 s
     of each clip to be zoom-warped — plan a still hold at the start and trim
     it. The recorder also fades to black at the end of each clip: trim ~2 s
     off every tail.
   - **Hide the Vercel toolbar first** (the floating dark circle on preview
     deployments — click it → "Hide Toolbar"), or it hovers over the page.
   - Visit the page in the incognito window BEFORE recording; previews
     sometimes show a bot check on first anonymous visit.
   - Chrome's autofill dropdown loves the encouragement name field; press
     Escape, or expect to cut the moment in editing.
   - Native datetime inputs are fumble-prone on camera; if a milestone is
     marked, leave the "When did it happen?" field untouched.
3. **Editing** (ffmpeg): cut the boring/ugly bits — OS file picker, window
   setup, denied-permission toasts, typing fumbles, recorder shutdown frames.
   Crop to the page content of the portrait window, keep portrait dimensions
   (target ~720×1280-ish, even numbers). Encode each kept segment separately
   (single decode per segment — one giant filter graph OOMs small machines),
   then join with the concat demuxer:

   ```sh
   # per kept segment (re-measure the crop rect from a frame of YOUR capture)
   ffmpeg -ss <start> -to <end> -i raw.mp4 \
     -vf "crop=<w>:<h>:<x>:<y>,scale=720:-2" \
     -an -r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 24 segN.mp4

   # join + web-optimize
   printf "file 'seg1.mp4'\n..." > concat.txt
   ffmpeg -f concat -safe 0 -i concat.txt -c copy -movflags +faststart \
     apps/web/src/assets/how-it-works/how-it-works.mp4

   # poster: a warm frame near the end (final feed view)
   ffmpeg -ss <t> -i apps/web/src/assets/how-it-works/how-it-works.mp4 \
     -frames:v 1 -q:v 3 apps/web/src/assets/how-it-works/poster.jpg
   ```

4. **QA before shipping**: watch the cut end to end — no OS dialogs/browser
   chrome/desktop visible, no failure toasts, no typing fumbles, no dead time
   over ~5 s, ends on the feed view (not a black frame), total under ~100 s,
   file ~1–3 MB. Update this README if the shot list changed.

<!-- v3: re-recorded 2026-08-12, mobile-first portrait (~62 s), assembled from per-act clips -->
