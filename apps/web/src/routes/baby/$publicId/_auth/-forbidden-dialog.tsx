import { useI18n } from "@/lib/i18n";
import { BabyIcon } from "@phosphor-icons/react";
import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import type { ComponentProps } from "react";

/** Overlay body when a signed-in user cannot manage this baby. */
export function ForbiddenDialog(props: ComponentProps<typeof Dialog>) {
  const { t } = useI18n();
  return (
    <Dialog {...props}>
      <DialogContent
        className="gap-5 rounded-[2rem] border-2 border-border bg-card p-10 text-center pop-shadow sm:max-w-md"
        showCloseButton={false}
      >
        <div className="mx-auto inline-flex size-20 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10">
          <BabyIcon className="size-10 text-primary" />
        </div>
        <DialogHeader className="items-center gap-2 text-center sm:text-center">
          <p className="text-6xl font-black text-foreground">403</p>
          <DialogTitle className="text-2xl font-black text-foreground">
            {t("You can't manage this page")}
          </DialogTitle>
          <DialogDescription className="font-medium text-muted-foreground">
            {t("You're signed in, but you don't have access to manage this baby.")}
          </DialogDescription>
        </DialogHeader>
        <DialogClose
          render={<Button className="rounded-full font-extrabold" size="lg" />}
        >
          {t("Got it")}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
