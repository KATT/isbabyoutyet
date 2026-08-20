import { SettingsPanel } from "@/components/baby/settings-panel";
import { MILESTONE_FIELDS } from "@workspace/convex/src/types";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { preserveScroll } from "@/lib/scroll-restoration";
import {
  previewBabyFromSearch,
  previewSearchWithoutSettings,
  Route as PreviewRoute,
} from "./route";

export const Route = createFileRoute("/preview/settings")({
  component: PreviewSettingsPage,
});

export function PreviewSettingsPage() {
  const { locale } = useI18n();
  const search = PreviewRoute.useSearch();
  const navigate = useNavigate({ from: "/preview/settings" });
  const birthJourney = search.birthJourney ?? "labor";
  const baby = previewBabyFromSearch(search);

  return (
    <SettingsPanel
      baby={baby}
      birthJourney={birthJourney}
      onUpdate={(update) => {
        void navigate({
          search: {
            ...search,
            ...update,
          },
          replace: true,
          ...preserveScroll,
        });
      }}
      onMilestoneRedate={(milestone, occurredAt) => {
        void navigate({
          search: {
            ...search,
            [MILESTONE_FIELDS[milestone].date]: occurredAt,
          },
          replace: true,
          ...preserveScroll,
        });
      }}
      onMilestoneRemove={(milestone) => {
        void navigate({
          search: {
            ...search,
            [MILESTONE_FIELDS[milestone].date]: null,
          },
          replace: true,
          ...preserveScroll,
        });
      }}
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          void navigate({
            to: "/preview",
            search: previewSearchWithoutSettings(search),
            replace: true,
            ...preserveScroll,
          });
        }
      }}
      profileLocale={locale}
      onDelete={null}
      coParents={null}
    />
  );
}
