import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/utils";
import type {
  BirthJourney,
  Milestone,
  MilestoneRemoveHandler,
  MilestoneVisibility,
} from "@workspace/convex/src/types";
import {
  birthJourneyForVisibility,
  milestoneVisibilityForPreset,
} from "@workspace/convex/src/types";
import { useI18n } from "@/lib/i18n";
import { JOURNEY_OPTION_BY_VALUE, JOURNEY_PRESET_OPTIONS } from "./journey-options";
import { useState } from "react";
import { toast } from "sonner";

type PendingToggleChange = {
  visibility: MilestoneVisibility;
  birthJourney: BirthJourney;
  milestonesToRemove: Milestone[];
};

type JourneyMilestoneEditorProps = {
  birthJourney: BirthJourney;
  laborStarted: string | null;
  wentToHospital: string | null;
  onBirthJourneyChange: (birthJourney: BirthJourney) => void | Promise<void>;
  onMilestoneRemove: MilestoneRemoveHandler | null;
  idPrefix: string;
};

function milestonesToRemoveForVisibility(opts: {
  visibility: MilestoneVisibility;
  laborStarted: string | null;
  wentToHospital: string | null;
}): Milestone[] {
  const milestones: Milestone[] = [];
  if (!opts.visibility.showLabor && opts.laborStarted) {
    milestones.push("labor_started");
  }
  if (!opts.visibility.showHospital && opts.wentToHospital) {
    milestones.push("gone_to_hospital");
  }
  return milestones;
}

export function JourneyMilestoneEditor(props: JourneyMilestoneEditorProps) {
  const { t } = useI18n();
  const visibility = milestoneVisibilityForPreset(props.birthJourney);
  const [pendingChange, setPendingChange] = useState<PendingToggleChange | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function applyBirthJourneyChange(change: PendingToggleChange) {
    setIsSaving(true);
    try {
      for (const milestone of change.milestonesToRemove) {
        if (props.onMilestoneRemove) {
          await props.onMilestoneRemove(milestone);
        }
      }
      await props.onBirthJourneyChange(change.birthJourney);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("Failed to update journey"));
    } finally {
      setIsSaving(false);
      setPendingChange(null);
    }
  }

  function requestVisibilityChange(nextVisibility: MilestoneVisibility) {
    const birthJourney = birthJourneyForVisibility(nextVisibility);
    const milestonesToRemove = milestonesToRemoveForVisibility({
      visibility: nextVisibility,
      laborStarted: props.laborStarted,
      wentToHospital: props.wentToHospital,
    });

    if (milestonesToRemove.length > 0 && props.onMilestoneRemove) {
      setPendingChange({ visibility: nextVisibility, birthJourney, milestonesToRemove });
      return;
    }

    void applyBirthJourneyChange({ visibility: nextVisibility, birthJourney, milestonesToRemove });
  }

  function handlePresetSelect(preset: BirthJourney) {
    if (preset === props.birthJourney) {
      return;
    }
    requestVisibilityChange(milestoneVisibilityForPreset(preset));
  }

  const pendingMilestoneLabels = (pendingChange?.milestonesToRemove ?? [])
    .map((milestone) => {
      if (milestone === "labor_started") {
        return t("Labour started");
      }
      if (milestone === "gone_to_hospital") {
        return t("Gone to hospital");
      }
      return null;
    })
    .filter((label): label is string => label !== null);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("We save this choice for your settings, but we don't show it to anyone.")}
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("Presets")}
        </p>
        <div className="flex flex-wrap gap-2">
          {JOURNEY_PRESET_OPTIONS.map((option) => {
            const selected = props.birthJourney === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={selected ? "default" : "outline"}
                size="sm"
                className={cn("rounded-full font-bold", selected && "pointer-events-none")}
                aria-pressed={selected}
                disabled={isSaving}
                onClick={() => {
                  handlePresetSelect(option.value);
                }}
              >
                {t(option.labelKey)}
              </Button>
            );
          })}
          {props.birthJourney === "custom" ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="rounded-full font-bold pointer-events-none"
              aria-pressed={true}
            >
              {t("Custom")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {t("Milestones visitors see")}
        </p>

        <label
          htmlFor={`${props.idPrefix}-show-labor`}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium">{t("Labour started")}</span>
          <Switch
            id={`${props.idPrefix}-show-labor`}
            checked={visibility.showLabor}
            disabled={isSaving}
            onCheckedChange={(checked) => {
              requestVisibilityChange({ ...visibility, showLabor: checked });
            }}
          />
        </label>

        <label
          htmlFor={`${props.idPrefix}-show-hospital`}
          className="flex items-center justify-between gap-3"
        >
          <span className="text-sm font-medium">{t("Gone to hospital")}</span>
          <Switch
            id={`${props.idPrefix}-show-hospital`}
            checked={visibility.showHospital}
            disabled={isSaving}
            onCheckedChange={(checked) => {
              requestVisibilityChange({ ...visibility, showHospital: checked });
            }}
          />
        </label>

        <label
          htmlFor={`${props.idPrefix}-show-born`}
          className="flex items-center justify-between gap-3 opacity-70"
        >
          <span className="text-sm font-medium">{t("Baby born")}</span>
          <Switch id={`${props.idPrefix}-show-born`} checked={true} disabled={true} />
        </label>
      </div>

      <p className="text-sm text-muted-foreground">
        {t(JOURNEY_OPTION_BY_VALUE[props.birthJourney].descriptionKey)}
      </p>

      <AlertDialog
        open={pendingChange !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingChange(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Remove marked milestones?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMilestoneLabels.length === 1
                ? t(
                    'Turning this off will remove the "{{milestone}}" milestone from your page. Visitors will no longer see it.',
                    { milestone: pendingMilestoneLabels[0] ?? "" },
                  )
                : t(
                    "Turning these off will remove the marked milestones from your page. Visitors will no longer see them.",
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={() => {
                if (pendingChange) {
                  void applyBirthJourneyChange(pendingChange);
                }
              }}
            >
              {t("Remove and continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
