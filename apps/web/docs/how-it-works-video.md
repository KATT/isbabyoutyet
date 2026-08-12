# The "Show Me How It Works" homepage video

Embedded on the homepage (`apps/web/src/routes/index.tsx`, the "Show Me How It
Works" card). Assets:

- `apps/web/public/how-it-works.mp4` — 1280×720, H.264, ~92 s, no audio, ~1.6 MB
- `apps/web/public/how-it-works-poster.jpg` — poster frame (the final feed view)

**Re-record this video whenever the baby-page UX changes** (status card,
composer, timeline feed, encouragement form) so the homepage never demos a
stale UI.

## What the video shows (shot list)

A scripted three-act walkthrough on a real deployment, using a baby named
"Nora" with a due date ~5 days out:

**Act 1 — the owner keeps everyone posted** (owner window)

1. The page in its "Not yet" state: hero, status card, due-date countdown.
2. The owner types "Getting close now — bags are packed! 🎒" in the
   "Post an update" composer and posts. Scroll to the top: the status card now
   shows the message under "Latest from the family" — a status update without
   a status change.
3. The owner posts "Bump photo, week 39!" with a photo attached (the file
   picker is cut in editing). The photo update appears in the feed with
   "New photo" + "Page photo" badges.

**Act 2 — family & friends cheer you on** (visitor view, incognito window)

4. The same page as a visitor: no composer, the "Get Notifications" subscribe
   button visible on the status card. (The actual permission prompt is cut —
   incognito auto-denies it, which looks broken on camera.)
5. The visitor sends an encouragement as "Aunt Meg": "Good luck!! You've got
   this ❤️". It appears at the top of the merged timeline, above the owner's
   updates.

**Act 3 — the big moment** (owner, then visitor)

6. Back in the owner window, Aunt Meg's message has appeared live. The owner
   types "It's happening!! Off to the hospital soon 🚨", selects the
   "Labour started" milestone chip (hint text + "Post & mark" button shown),
   and posts.
7. The status card flips to "Labour started" with the message; the progress
   indicator advances.
8. The visitor window shows the flipped status live (real-time sync), then
   slowly scrolls the feed: milestone update with badge → Aunt Meg's
   encouragement → the pinned bump photo → the first text update. The video
   ends on this feed view.

## How it was produced (and how to regenerate it)

The original was produced by a Cursor cloud agent; the same recipe works for a
human with a screen recorder, or ask an agent to "re-record the homepage
how-it-works video following apps/web/docs/how-it-works-video.md".

1. **Environment**: a Vercel preview deployment of the branch under test (each
   PR branch gets its own seeded Convex preview). Sign in with a throwaway
   test account, create a fresh baby ("Nora", due ~5 days out) so the page
   starts empty. Have a pleasant bump photo file ready for the upload step.
2. **Recording**: one continuous screen recording of a maximized browser
   window (recorded at 1920×1200 here), acting out the shot list above at a
   calm pace — pause ~2 s on every meaningful state change. Use a **separate
   incognito window** for the visitor acts so the owner session stays logged
   in and the two windows demonstrate the real-time sync in Act 3.
3. **Editing** (ffmpeg): cut the boring/ugly bits — OS file picker, incognito
   window setup, the denied notification-permission toast, any typing
   fumbles, and the recorder's shutdown frames at the tail. Crop away browser
   chrome/desktop so only page content remains, then scale to 720p. Encode
   each kept segment separately (single decode per segment — do NOT build one
   giant filter graph that decodes the source once per segment; that OOMs
   small machines), then join with the concat demuxer:

   ```sh
   # per kept segment (adjust -ss/-to; crop rect fits a 1920x1200 capture
   # of a maximized Chrome window — re-measure from a frame if that changes)
   ffmpeg -ss <start> -to <end> -i raw.mp4 \
     -vf "crop=1780:1000:56:132,scale=1280:720" \
     -an -r 24 -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 24 segN.mp4

   # join + web-optimize
   printf "file 'seg1.mp4'\n..." > concat.txt
   ffmpeg -f concat -safe 0 -i concat.txt -c copy -movflags +faststart \
     apps/web/public/how-it-works.mp4

   # poster: a warm frame near the end (final feed view)
   ffmpeg -ss <t> -i apps/web/public/how-it-works.mp4 -frames:v 1 -q:v 3 \
     apps/web/public/how-it-works-poster.jpg
   ```

4. **QA before shipping**: watch the cut end to end and check — no OS
   dialogs/browser chrome/desktop visible, no failure toasts, no typing
   fumbles, no dead time over ~5 s, ends on the feed view (not a black
   frame), total under ~100 s, file size ~1–3 MB. Update this document if the
   shot list changed.

<!-- v1: initial cut recorded 2026-08-12 on the timeline-stack preview -->
