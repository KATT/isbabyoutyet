export {
  CONVEX_INFINITE_QUERY_KEY,
  convexInfiniteQuery,
  convexInfiniteQueryFn,
  registerConvexInfiniteQueryClient,
  type PaginatedQueryReference,
  type PaginationArgs,
} from "./convexInfiniteQuery.js";

export type {
  PreloadedConvexInfiniteQuery,
  PreloadedConvexQuery,
  QueryReference,
} from "./handles.js";

export { getConvexQueryPreloader } from "./preloader.js";
export { preloadedConvexQueryOptions, usePreloadedConvexQuery } from "./usePreloadedConvexQuery.js";
export { useLiveConvexInfinitePages } from "./useLiveConvexInfinitePages.js";
export { usePreloadedConvexInfiniteQuery } from "./usePreloadedConvexInfiniteQuery.js";
