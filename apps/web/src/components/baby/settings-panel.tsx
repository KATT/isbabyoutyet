import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@workspace/ui/components/item";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { Switch } from "@workspace/ui/components/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Baby,
  CalendarHeart,
  ChatCircle,
  Confetti,
  Heartbeat,
  Hospital,
  Palette,
  Translate,
  Trash,
  Users,
} from "@phosphor-icons/react";
import { getMilestonePolicy } from "@workspace/convex/src/types";
import type { BabyData, BabyUpdateHandler } from "@workspace/convex/src/types";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { InitiatedConvexQuery, PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { DueDateEditor, NameEditor, StatusDateEditor, ThemeSelector } from "./editors";
import { CoParentsSettings } from "./co-parents-settings";
import { formatDate, formatDueDate, getRelativeTime, THEME_OPTIONS } from "./utils";
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from "@workspace/convex/src/i18n";
import { getLanguageName, useI18n } from "@/lib/i18n";

type SettingsPanelProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileLocale: SupportedLocale;
  /** Owner-only soft delete. Null on the preview page / for co-parents. */
  onDelete: (() => void | Promise<void>) | null;
  /** Null on the preview page (no real baby id). */
  coParents: {
    babyId: Id<"baby">;
    isOwner: boolean;
    listing:
      | PreloadedConvexQuery<typeof api.coParents.listForBaby>
      | InitiatedConvexQuery<typeof api.coParents.listForBaby>;
  } | null;
};

/**
 * Owner settings: page metadata and corrections. Marking milestones and
 * posting photos happens through the "Post update" composer; milestone rows
 * here appear once marked, for correcting their date. Unmarking a milestone
 * is done by deleting its update in the timeline.
 */
export function SettingsPanel(props: SettingsPanelProps) {
  const { locale, t } = useI18n();
  const inheritedLocale = props.profileLocale;
  const onDelete = props.onDelete;
  const coParents = props.coParents;
  const milestonePolicy = getMilestonePolicy(props.baby);
  const canEditMilestoneVisibility = coParents === null || coParents.isOwner;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("Settings")}</DialogTitle>
        </DialogHeader>
        <ItemGroup>
          {/* Baby Name */}
          <Item>
            <ItemMedia variant="icon">
              <Baby className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t("Baby Name")}</ItemTitle>
              <ItemDescription>{props.baby.name}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <NameEditor baby={props.baby} onUpdate={props.onUpdate} />
            </ItemActions>
          </Item>

          <ItemSeparator />

          {/* Due Date */}
          <Item>
            <ItemMedia variant="icon">
              <CalendarHeart className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t("Due Date")}</ItemTitle>
              <ItemDescription>{formatDueDate(props.baby.dueDate, locale)}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <DueDateEditor baby={props.baby} onUpdate={props.onUpdate} />
            </ItemActions>
          </Item>

          {canEditMilestoneVisibility && (
            <>
              <ItemSeparator />
              <Item variant="default" className="items-start">
                <ItemMedia variant="icon">
                  <Heartbeat className="w-4 h-4" />
                </ItemMedia>
                <ItemContent className="gap-3">
                  <div>
                    <ItemTitle>{t("Milestones visitors can see")}</ItemTitle>
                    <ItemDescription>
                      {milestonePolicy.visibilityLocked
                        ? t(
                            "These choices are locked because the hospital or birth milestone has been marked.",
                          )
                        : t(
                            "You can change these until the hospital or birth milestone is marked. They only affect what visitors see.",
                          )}{" "}
                      {t("Baby born is always shown.")}
                    </ItemDescription>
                  </div>
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold" htmlFor="show-labour-milestone">
                        {t("Show labour milestone")}
                      </label>
                      <Switch
                        id="show-labour-milestone"
                        checked={milestonePolicy.visibility.showLabor}
                        disabled={milestonePolicy.visibilityLocked}
                        onCheckedChange={(checked) =>
                          props.onUpdate({
                            milestoneVisibility: {
                              showLabor: checked,
                              showHospital: milestonePolicy.visibility.showHospital,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <label className="text-sm font-semibold" htmlFor="show-hospital-milestone">
                        {t("Show hospital milestone")}
                      </label>
                      <Switch
                        id="show-hospital-milestone"
                        checked={milestonePolicy.visibility.showHospital}
                        disabled={milestonePolicy.visibilityLocked}
                        onCheckedChange={(checked) =>
                          props.onUpdate({
                            milestoneVisibility: {
                              showLabor: milestonePolicy.visibility.showLabor,
                              showHospital: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </ItemContent>
              </Item>
            </>
          )}

          {/* Marked milestones: correct their date here; mark new ones via
              the "Post update" composer, unmark by deleting the timeline
              update */}
          {milestonePolicy.isVisible("labor_started") && props.baby.laborStarted && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Heartbeat className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t("Labour started")}</ItemTitle>
                  <ItemDescription>
                    {formatDate(props.baby.laborStarted, locale)} (
                    {getRelativeTime(props.baby.laborStarted, locale)})
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusDateEditor
                    baby={props.baby}
                    status="labor_started"
                    currentDate={props.baby.laborStarted}
                    onUpdate={props.onUpdate}
                  />
                </ItemActions>
              </Item>
            </>
          )}

          {milestonePolicy.isVisible("gone_to_hospital") && props.baby.wentToHospital && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Hospital className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t("Gone to hospital")}</ItemTitle>
                  <ItemDescription>
                    {formatDate(props.baby.wentToHospital, locale)} (
                    {getRelativeTime(props.baby.wentToHospital, locale)})
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusDateEditor
                    baby={props.baby}
                    status="gone_to_hospital"
                    currentDate={props.baby.wentToHospital}
                    onUpdate={props.onUpdate}
                  />
                </ItemActions>
              </Item>
            </>
          )}

          {props.baby.babyBorn && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Confetti className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t("Baby born")}</ItemTitle>
                  <ItemDescription>
                    {formatDate(props.baby.babyBorn, locale)} (
                    {getRelativeTime(props.baby.babyBorn, locale)})
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusDateEditor
                    baby={props.baby}
                    status="born"
                    currentDate={props.baby.babyBorn}
                    onUpdate={props.onUpdate}
                  />
                </ItemActions>
              </Item>
            </>
          )}

          <ItemSeparator />

          {/* Theme */}
          <Item>
            <ItemMedia variant="icon">
              <Palette className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t("Theme")}</ItemTitle>
              <ItemDescription>
                {t(
                  THEME_OPTIONS.find((theme) => theme.value === props.baby.theme)?.labelKey ??
                    "Default",
                )}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ThemeSelector baby={props.baby} onUpdate={props.onUpdate} />
            </ItemActions>
          </Item>

          <ItemSeparator />

          <Item>
            <ItemMedia variant="icon">
              <Translate />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t("Language")}</ItemTitle>
              <ItemDescription>
                {t("All visitors see this page in {{language}}.", {
                  language: getLanguageName(props.baby.locale ?? inheritedLocale, locale),
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Select
                value={props.baby.locale ?? "inherit"}
                onValueChange={(value) => {
                  if (value === "inherit") {
                    void props.onUpdate({ locale: null });
                  } else if (typeof value === "string" && isSupportedLocale(value)) {
                    void props.onUpdate({ locale: value });
                  }
                }}
              >
                <SelectTrigger aria-label={t("Language")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value="inherit">
                      {t("Use my profile language ({{language}})", {
                        language: getLanguageName(inheritedLocale, locale),
                      })}
                    </SelectItem>
                    {SUPPORTED_LOCALES.map((supportedLocale) => (
                      <SelectItem key={supportedLocale} value={supportedLocale}>
                        {getLanguageName(supportedLocale, locale)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ItemActions>
          </Item>

          <ItemSeparator />

          {/* Encouragements */}
          <Item>
            <ItemMedia variant="icon">
              <ChatCircle className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{t("Encouragements")}</ItemTitle>
              <ItemDescription>
                {props.baby.encouragementsDisabled
                  ? t("Form disabled")
                  : t("Visitors can send messages")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={!props.baby.encouragementsDisabled}
                onCheckedChange={(checked) => props.onUpdate({ encouragementsDisabled: !checked })}
                aria-label={t("Encouragements")}
              />
            </ItemActions>
          </Item>

          {coParents && (
            <>
              <ItemSeparator />
              <Item variant="default" className="items-start">
                <ItemMedia variant="icon">
                  <Users className="w-4 h-4" />
                </ItemMedia>
                <ItemContent className="gap-3">
                  <div>
                    <ItemTitle>{t("Co-parents")}</ItemTitle>
                    <ItemDescription>
                      {coParents.isOwner
                        ? t("People who can post updates and change settings")
                        : t("Others who can manage this page with you")}
                    </ItemDescription>
                  </div>
                  <CoParentsSettings
                    babyId={coParents.babyId}
                    isOwner={coParents.isOwner}
                    listing={coParents.listing}
                  />
                </ItemContent>
              </Item>
            </>
          )}

          {onDelete && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Trash className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{t("Delete page")}</ItemTitle>
                  <ItemDescription>{t("Hide this baby page from everyone")}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="destructive" size="sm">
                          {t("Delete")}
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t("Delete {{name}}'s page?", { name: props.baby.name })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t(
                            "The page will disappear from your dashboard and the public link will stop working. Only you (the owner) can do this.",
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => {
                            void onDelete();
                          }}
                        >
                          {t("Delete page")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </ItemActions>
              </Item>
            </>
          )}
        </ItemGroup>
      </DialogContent>
    </Dialog>
  );
}
