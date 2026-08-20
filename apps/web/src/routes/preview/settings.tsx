import { SettingsPanel } from "@/components/baby/settings-panel";
import { MILESTONE_FIELDS } from "@workspace/convex/src/types";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
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
          resetScroll: false,
        });
      }}
      onMilestoneRedate={(milestone, occurredAt) => {
        void navigate({
          search: {
            ...search,
            [MILESTONE_FIELDS[milestone].date]: occurredAt,
          },
          replace: true,
          resetScroll: false,
        });
      }}
      onMilestoneRemove={(milestone) => {
        void navigate({
          search: {
            ...search,
            [MILESTONE_FIELDS[milestone].date]: null,
          },
          replace: true,
          resetScroll: false,
        });
      }}
      open={true}
      onOpenChange={(open) => {
        if (!open) {
          void navigate({
            to: "/preview",
            search: previewSearchWithoutSettings(search),
            replace: true,
            resetScroll: false,
          });
        }
      }}
      profileLocale={locale}
      onDelete={null}
      coParents={null}
    />
  );
}
