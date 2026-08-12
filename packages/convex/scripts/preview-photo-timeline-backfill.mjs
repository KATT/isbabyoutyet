#!/usr/bin/env node
/**
 * Read-only prod preview for photo timeline backfill.
 *
 * Usage:
 *   CONVEX_DEPLOY_KEY='prod:…' pnpm --filter @workspace/convex preview:photo-timeline -- alma
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const publicId = args[0] ?? "alma";
const deployKey = process.env.CONVEX_DEPLOY_KEY;
if (!deployKey) {
  console.error("Set CONVEX_DEPLOY_KEY to a read-only prod deploy key.");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const convexDir = path.resolve(scriptDir, "..");
const env = { ...process.env, CONVEX_DEPLOY_KEY: deployKey };

function convexRun(args) {
  return execFileSync("pnpm", ["exec", "convex", "run", ...args], {
    cwd: convexDir,
    env,
    encoding: "utf8",
  }).trim();
}

function convexData(tableArgs) {
  const out = execFileSync("pnpm", ["exec", "convex", "data", ...tableArgs, "--format", "json"], {
    cwd: convexDir,
    env,
    encoding: "utf8",
  });
  return JSON.parse(out);
}

const babyQuery = `
const slug = ${JSON.stringify(publicId)};
let baby = await ctx.db.query("baby").withIndex("by_publicId", q => q.eq("publicId", slug)).first();
if (!baby) {
  const history = await ctx.db.query("babyPublicIdHistory").withIndex("by_publicId", q => q.eq("publicId", slug)).order("desc").first();
  if (history) baby = await ctx.db.get(history.babyId);
}
if (!baby) return { error: "Baby not found", publicIdFilter: slug };

const feedPhotoIds = new Set(
  (await ctx.db.query("updates").withIndex("by_babyId", q => q.eq("babyId", baby._id)).collect())
    .flatMap(u => u.photoId ? [u.photoId] : []),
);

const currentPhoto = baby.photoId
  ? {
      photoId: baby.photoId,
      postedAt: (await ctx.db.system.get(baby.photoId))?._creationTime ?? null,
      alreadyInFeed: feedPhotoIds.has(baby.photoId),
      photoUrl: await ctx.storage.getUrl(baby.photoId),
    }
  : null;

return {
  publicIdFilter: slug,
  baby: { name: baby.name, publicId: baby.publicId, id: baby._id },
  currentPhoto,
};
`.trim();

const babyInfo = JSON.parse(convexRun(["--inline-query", babyQuery]));
if (babyInfo.error) {
  console.error(babyInfo.error);
  process.exit(1);
}

const history = convexData(["history", "--component", "babyAuditLog", "--order", "asc"]);
const raw = history.filter((entry) => entry.id === babyInfo.baby.id && !entry.isDeleted);
const auditChanges = [];
let previousPhotoId = null;
for (const entry of raw) {
  const doc = entry.doc ?? {};
  const photoId = doc.photoId;
  if (!photoId || photoId === previousPhotoId) continue;
  auditChanges.push({
    auditTs: entry.ts,
    photoId,
    thumbnailId: doc.thumbnailId ?? null,
  });
  previousPhotoId = photoId;
}

const storageRows = convexData(["_storage", "--order", "asc"]);
const storageById = new Map(storageRows.map((row) => [row._id, row]));

const feedPhotoIds = new Set();
const updates = convexData(["updates"]);
for (const update of updates) {
  if (update.babyId === babyInfo.baby.id && update.photoId) {
    feedPhotoIds.add(update.photoId);
  }
}

const plans = auditChanges.map((change) => {
  const meta = storageById.get(change.photoId);
  const storageExists = !!meta;
  const postedAt = meta?._creationTime ?? change.auditTs;
  return {
    babyName: babyInfo.baby.name,
    publicId: babyInfo.baby.publicId,
    photoId: change.photoId,
    postedAt,
    alreadyInFeed: feedPhotoIds.has(change.photoId),
    storageExists,
    photoUrl:
      babyInfo.currentPhoto?.photoId === change.photoId ? babyInfo.currentPhoto.photoUrl : null,
  };
});

// Resolve URLs for audit photos via inline query (storage.getUrl)
for (const plan of plans) {
  if (plan.photoUrl || !plan.storageExists) continue;
  const url = JSON.parse(
    convexRun([
      "--inline-query",
      `return await ctx.storage.getUrl(${JSON.stringify(plan.photoId)});`,
    ]),
  );
  plan.photoUrl = url;
}

const preview = {
  ...babyInfo,
  totalAuditPhotos: plans.length,
  pendingInjections: plans.filter((plan) => !plan.alreadyInFeed && plan.storageExists),
  alreadyInFeed: plans.filter((plan) => plan.alreadyInFeed),
  missingStorage: plans.filter((plan) => !plan.storageExists),
  plans,
};

function formatWhen(ms) {
  if (ms == null) return "unknown";
  return new Date(ms).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function renderSection(title, rows) {
  if (rows.length === 0) return `### ${title}\n\n_None._\n`;
  const lines = rows.map((row, index) => {
    const img = row.photoUrl ? `\n\n![${row.publicId} photo ${index + 1}](${row.photoUrl})` : "";
    return [
      `${index + 1}. **${row.babyName}** (\`${row.publicId}\`)`,
      `   - Photo: \`${row.photoId}\``,
      `   - Timeline slot: ${formatWhen(row.postedAt)}`,
      img,
    ].join("\n");
  });
  return `### ${title}\n\n${lines.join("\n\n")}\n`;
}

const currentPhotoSection = preview.currentPhoto
  ? `## Current page photo (from \`baby.photoId\`)

- Photo: \`${preview.currentPhoto.photoId}\`
- Uploaded: ${formatWhen(preview.currentPhoto.postedAt)}
- In timeline feed: ${preview.currentPhoto.alreadyInFeed ? "yes" : "no — would be injected by `backfillBabyTimeline`"}
${preview.currentPhoto.photoUrl ? `\n![Current page photo](${preview.currentPhoto.photoUrl})` : ""}
`
  : "";

const markdown = `# Photo timeline backfill preview — \`${publicId}\`

Generated against production for **${preview.baby.name}** (\`${preview.baby.publicId}\`).

Slug \`${publicId}\` resolves via \`babyPublicIdHistory\` when it is not the current \`publicId\`.

The audit log (\`babyAuditLog\`) records \`baby\` table writes from **2026-01-23** onward.
Each distinct \`photoId\` in that history becomes a timeline photo update at the storage
file's upload time. Photos deleted by the legacy replace-on-upload flow cannot be recovered.

## Summary

| Metric | Count |
| --- | ---: |
| Audit-log photo changes | ${preview.totalAuditPhotos} |
| **Would inject** (new timeline rows) | ${preview.pendingInjections.length} |
| Already in feed | ${preview.alreadyInFeed.length} |
| Unrecoverable (audit entry but blob gone) | ${preview.missingStorage.length} |

${currentPhotoSection}
${renderSection("Would inject on deploy (`backfillHistoricalPhotosFromAuditLog`)", preview.pendingInjections)}
${renderSection("Already in timeline (no-op)", preview.alreadyInFeed)}
${renderSection("Unrecoverable (audit entry but blob gone)", preview.missingStorage)}

## Full audit-log photo timeline

${
  preview.plans.length === 0
    ? "_No audit-log photo history for this baby. Photos uploaded before 2026-01-23 (when the audit log started) are not recorded; only the surviving blob remains (see current page photo above). That photo was already backfilled into the timeline during the timeline migration._"
    : preview.plans
        .map(
          (row, index) =>
            `${index + 1}. ${formatWhen(row.postedAt)} — \`${row.photoId}\`${row.alreadyInFeed ? " _(already in feed)_" : row.storageExists ? " _(would inject)_" : " _(blob missing)_"}`,
        )
        .join("\n")
}
`;

const outPath = path.resolve(
  scriptDir,
  "../../../docs/previews",
  `${publicId.replace(/[^a-z0-9-]/gi, "-").toLowerCase()}-photo-timeline-backfill.md`,
);
writeFileSync(outPath, markdown, "utf8");

console.log(markdown);
console.error(`\nWrote ${outPath}`);
