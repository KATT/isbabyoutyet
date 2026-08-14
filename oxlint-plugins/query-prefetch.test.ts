import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";
import plugin from "./query-prefetch.mjs";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "tsx" } },
});

tester.run("no-convex-query-hooks", plugin.rules["no-convex-query-hooks"], {
  valid: [
    `import { useMutation } from "convex/react";`,
    `import { useQuery } from "@tanstack/react-query";`,
  ],
  invalid: [
    {
      code: `import { useQuery } from "convex/react";`,
      errors: [{ messageId: "banned" }],
    },
    {
      code: `import { usePaginatedQuery } from "convex/react";`,
      errors: [{ messageId: "banned" }],
    },
  ],
});

tester.run("require-preloaded-query-options", plugin.rules["require-preloaded-query-options"], {
  valid: [
    `import { useSuspenseQuery } from "@tanstack/react-query";
     import { preloadedQueryOptions } from "@workspace/query-prefetch";
     useSuspenseQuery(preloadedQueryOptions(factory, handle));`,
    `import { useQuery } from "@tanstack/react-query";
     useQuery({ queryKey: ["ios"], queryFn: () => true });`,
    `import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
     import { preloadedInfiniteQueryOptions } from "@workspace/query-prefetch";
     useSuspenseInfiniteQuery(preloadedInfiniteQueryOptions(factory, handle));`,
  ],
  invalid: [
    {
      code: `import { useSuspenseQuery } from "@tanstack/react-query";
       useSuspenseQuery(profileGet());`,
      errors: [{ messageId: "requirePreloaded" }],
    },
    {
      code: `import { useSuspenseQuery } from "@tanstack/react-query";
       useSuspenseQuery(onboardingGetMine());`,
      errors: [{ messageId: "requirePreloaded" }],
    },
  ],
});

tester.run("use-loader-preloads", plugin.rules["use-loader-preloads"], {
  valid: [
    `import { allKeyed, getQueryPreloader, preloadedQueryOptions } from "@workspace/query-prefetch";
     import { useSuspenseQuery } from "@tanstack/react-query";
     const Route = createFileRoute("/x")({
       loader: async (opts) => {
         const preloader = getQueryPreloader(opts.context.queryClient);
         return await allKeyed({
           profile: preloader.ensureQueryData(profileGet),
         });
       },
       component: function Page() {
         const loaderData = Route.useLoaderData();
         useSuspenseQuery(preloadedQueryOptions(profileGet, loaderData.profile));
         return null;
       },
     });`,
    `const Route = createFileRoute("/x")({
       loader: async (opts) => {
         const preloader = getQueryPreloader(opts.context.queryClient);
         const profile = await preloader.ensureQueryData(profileGet);
         return { profile };
       },
       component: function Page() {
         return <Child profile={Route.useLoaderData().profile} />;
       },
     });`,
  ],
  invalid: [
    {
      code: `const Route = createFileRoute("/x")({
         loader: async (opts) => {
           const preloader = getQueryPreloader(opts.context.queryClient);
           const profile = await preloader.ensureQueryData(profileGet);
           return { profile };
         },
         component: function Page() {
           return null;
         },
       });`,
      errors: [{ messageId: "unused", data: { key: "profile" } }],
    },
  ],
});
