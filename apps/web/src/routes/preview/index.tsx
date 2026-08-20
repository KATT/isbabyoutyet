import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/preview/")({
  component: PreviewPageIndex,
});

function PreviewPageIndex() {
  return null;
}
