import { ArrowRight, GearSix, Info } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@workspace/ui/components/item";
import { useEffect, useState } from "react";
import { WelcomeTourDialog } from "@/components/onboarding/welcome-tour";
import { DEMO_WELCOME_SLIDES } from "@/components/onboarding/steps";
import { useI18n } from "@/lib/i18n";

type DemoExperienceProps = {
  kind: "source" | "playground";
  sourceBabyId: string;
  onOpenSettings: () => void;
};

function dismissalKey(sourceBabyId: string) {
  return `demo-onboarding:${sourceBabyId}`;
}

/**
 * Guest-only orientation and persistent ownership/retention notice for demo
 * sources and visitor playgrounds.
 */
export function DemoExperience(props: DemoExperienceProps) {
  const { t } = useI18n();
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(dismissalKey(props.sourceBabyId)) === "done") return;
    setTourOpen(true);
  }, [props.sourceBabyId]);

  function finishTour() {
    localStorage.setItem(dismissalKey(props.sourceBabyId), "done");
  }

  return (
    <>
      <WelcomeTourDialog
        open={tourOpen}
        onOpenChange={setTourOpen}
        onFinished={finishTour}
        slides={DEMO_WELCOME_SLIDES}
      />

      <Item
        variant="outline"
        className="mx-auto mb-8 max-w-4xl border-primary/40 bg-primary/10 shadow-sm"
      >
        <ItemMedia className="size-10 rounded-full bg-primary/15">
          <Info className="size-5 text-primary" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {props.kind === "source"
              ? t("This is a demo source")
              : t("This is your demo playground")}
          </ItemTitle>
          <ItemDescription>
            {props.kind === "source"
              ? t("Change any setting to make a four-day playground copy for this browser.")
              : t(
                  "Only this browser can edit it, and it is removed four days after your last change.",
                )}
          </ItemDescription>
        </ItemContent>
        <ItemActions className="flex-wrap">
          <Button size="sm" variant="outline" onClick={props.onOpenSettings}>
            <GearSix />
            {t("Try settings")}
          </Button>
          <Button
            size="sm"
            render={<Link to="/auth/signup" preload="viewport" />}
            nativeButton={false}
          >
            {t("Create your own")}
            <ArrowRight />
          </Button>
        </ItemActions>
      </Item>
    </>
  );
}
