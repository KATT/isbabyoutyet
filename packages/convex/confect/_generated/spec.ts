import { GroupSpec, Spec } from "@confect/core";
import baby from "../baby.spec";
import babyThumbnails from "../babyThumbnails.spec";
import betterAuth from "../betterAuth.spec";
import encouragements from "../encouragements.spec";
import migrations from "../migrations.spec";
import pushNotifications from "../pushNotifications.spec";
import pushSubscriptions from "../pushSubscriptions.spec";
import seed from "../seed.spec";
import timeline from "../timeline.spec";
import updates from "../updates.spec";

const spec: Spec.Spec<
  | GroupSpec.NamedAt<typeof baby, "baby">
  | GroupSpec.NamedAt<typeof babyThumbnails, "babyThumbnails">
  | GroupSpec.NamedAt<typeof betterAuth, "betterAuth">
  | GroupSpec.NamedAt<typeof encouragements, "encouragements">
  | GroupSpec.NamedAt<typeof migrations, "migrations">
  | GroupSpec.NamedAt<typeof pushNotifications, "pushNotifications">
  | GroupSpec.NamedAt<typeof pushSubscriptions, "pushSubscriptions">
  | GroupSpec.NamedAt<typeof seed, "seed">
  | GroupSpec.NamedAt<typeof timeline, "timeline">
  | GroupSpec.NamedAt<typeof updates, "updates">
> = Spec.make()
  .addAt("baby", baby)
  .addAt("babyThumbnails", babyThumbnails)
  .addAt("betterAuth", betterAuth)
  .addAt("encouragements", encouragements)
  .addAt("migrations", migrations)
  .addAt("pushNotifications", pushNotifications)
  .addAt("pushSubscriptions", pushSubscriptions)
  .addAt("seed", seed)
  .addAt("timeline", timeline)
  .addAt("updates", updates);

export default spec;
