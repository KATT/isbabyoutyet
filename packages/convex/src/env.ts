import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { lazyGetter } from "./utils";

const UrlString = Schema.String.check(
  Schema.makeFilter(
    (value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    { description: "SITE_URL must be a valid URL", message: "SITE_URL must be a valid URL" },
  ),
);

export const ConvexEnv = Schema.Struct({
  BETTER_AUTH_SECRET: Schema.NonEmptyString,
  VAPID_PUBLIC_KEY: Schema.NonEmptyString,
  VAPID_PRIVATE_KEY: Schema.NonEmptyString,
  VAPID_SUBJECT: Schema.String.pipe(
    Schema.withDecodingDefault(Effect.succeed("mailto:admin@isbabyoutyet.com")),
  ),
  SITE_URL: UrlString,
});

export type ConvexEnv = typeof ConvexEnv.Type;

export const convexEnv = lazyGetter(() => Schema.decodeUnknownSync(ConvexEnv)(process.env));
