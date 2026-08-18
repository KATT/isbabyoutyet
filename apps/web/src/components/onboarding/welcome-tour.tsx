import { Button } from "@workspace/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@workspace/ui/components/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { useCallback, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";
import { WELCOME_SLIDES } from "./steps";

type WelcomeTourDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished: () => void;
};

export function WelcomeTourDialog(props: WelcomeTourDialogProps) {
  const { t } = useI18n();
  const [api, setApi] = useState<CarouselApi>();
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!api) return () => undefined;
      api.on("select", notify);
      return () => {
        api.off("select", notify);
      };
    },
    [api],
  );
  const index = useSyncExternalStore(
    subscribe,
    () => api?.selectedScrollSnap() ?? 0,
    () => 0,
  );
  const isLast = index >= WELCOME_SLIDES.length - 1;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        props.onOpenChange(open);
        if (!open) {
          props.onFinished();
        }
      }}
    >
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>{t("Welcome tour")}</DialogTitle>
          <DialogDescription>{t("A short overview of how the app works")}</DialogDescription>
        </DialogHeader>

        <Carousel
          key={props.open ? "open" : "closed"}
          setApi={setApi}
          className="w-full"
          opts={{ loop: false }}
        >
          <CarouselContent>
            {WELCOME_SLIDES.map((slide) => {
              const Icon = slide.icon;
              return (
                <CarouselItem key={slide.title}>
                  <div className="flex flex-col gap-4 px-6 pt-8 pb-2">
                    <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-primary/25 to-primary/5 border border-primary/20">
                      <Icon className="size-7 text-primary" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-xl font-bold tracking-tight text-foreground">
                        {t(slide.title)}
                      </h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t(slide.body)}
                      </p>
                    </div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        <div className="flex items-center justify-center gap-1.5 px-6 py-3">
          {WELCOME_SLIDES.map((slide, i) => (
            <button
              key={slide.title}
              type="button"
              aria-label={t("Go to slide {{number}}", { number: i + 1 })}
              className={
                i === index
                  ? "h-1.5 w-6 rounded-full bg-primary transition-all"
                  : "size-1.5 rounded-full bg-muted-foreground/30 transition-all hover:bg-muted-foreground/50"
              }
              onClick={() => api?.scrollTo(i)}
            />
          ))}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              props.onFinished();
              props.onOpenChange(false);
            }}
          >
            {t("Skip")}
          </Button>
          {isLast ? (
            <Button
              onClick={() => {
                props.onFinished();
                props.onOpenChange(false);
              }}
            >
              {t("Let's go")}
            </Button>
          ) : (
            <Button onClick={() => api?.scrollNext()}>{t("Next")}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
