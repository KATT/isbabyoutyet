import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/baby/$publicId/")({
  component: BabyPageIndex,
});

function BabyPageIndex() {
  return null;
}
