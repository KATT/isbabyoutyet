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
  Confetti,
  Heartbeat,
  Hospital,
  Palette,
  Translate,
  Trash,
  Users,
} from "@phosphor-icons/react";
import type {
  BabyData,
  BabyUpdateHandler,
  BirthJourney,
  MilestoneRedateHandler,
  MilestoneRemoveHandler,
} from "@workspace/convex/src/types";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import {
  DueDateEditor,
  JourneyEditor,
  NameEditor,
  StatusDateEditor,
  ThemeSelector,
} from "./editors";
import { CoParentsSettings } from "./co-parents-settings";
import { formatDate, formatDueDate, getRelativeTime, getThemeOption } from "./utils";
import {
  SUPPORTED_LOCALES,
  isSupportedLocale,
  type SupportedLocale,
} from "@workspace/convex/src/i18n";
import { getLanguageName, useI18n } from "@/lib/i18n";
import { JOURNEY_OPTION_BY_VALUE } from "./journey-options";
import type { ReactNode } from "react";
import * as stylex from "@stylexjs/stylex";
import { colors, radius, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";

const styles = stylex.create({
  sectionShell: {
    backgroundColor: `color-mix(in oklab, ${colors.card} 50%, transparent)`,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: "solid",
    borderWidth: "1px",
    overflow: "hidden",
  },
  sectionTitle: {
    paddingInline: spacing.s0_5,
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s5,
  },
});

type SettingsPanelProps = {
  baby: BabyData;
  birthJourney: BirthJourney;
  onUpdate: BabyUpdateHandler;
  onMilestoneRedate: MilestoneRedateHandler;
  onMilestoneRemove: MilestoneRemoveHandler;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after open/close animations finish (used for route-driven close). */
  onOpenChangeComplete: ((open: boolean) => void) | null;
  profileLocale: SupportedLocale;
  /** Owner-only soft delete. Null on the preview page / for co-parents. */
  onDelete: (() => void | Promise<void>) | null;
  /** Null on the preview page (no real baby id). */
  coParents: {
    babyId: Id<"baby">;
    isOwner: boolean;
    listing: PreloadedConvexQuery<typeof api.coParents.listForBaby>;
  } | null;
};

function SettingsSection(props: { title: string; children: ReactNode }) {
  return (
    <Stack gap="s2">
      <div {...stylex.props(styles.sectionTitle)}>
        <Text as="h3" size="xs" weight="bold" tone="muted">
          {props.title}
        </Text>
      </div>
      <div {...stylex.props(styles.sectionShell)}>
        <ItemGroup>{props.children}</ItemGroup>
      </div>
    </Stack>
  );
}

function BabyLanguageSelect(props: {
  value: SupportedLocale | null | undefined;
  inheritedLocale: SupportedLocale;
  onUpdate: BabyUpdateHandler;
}) {
  const { locale, t } = useI18n();
  const inheritLabel = t("Use my profile language ({{language}})", {
    language: getLanguageName(props.inheritedLocale, locale),
  });
  const languageItems = [
    { value: "inherit", label: inheritLabel },
    ...SUPPORTED_LOCALES.map((supportedLocale) => ({
      value: supportedLocale,
      label: getLanguageName(supportedLocale, locale),
    })),
  ];

  return (
    <Select
      items={languageItems}
      value={props.value ?? "inherit"}
      onValueChange={(value) => {
        if (value === "inherit") {
          void props.onUpdate({ locale: null });
        } else if (typeof value === "string" && isSupportedLocale(value)) {
          void props.onUpdate({ locale: value });
        }
      }}
    >
      <SelectTrigger aria-label={t("Language")} size="sm">
        <SelectValue />
      </SelectTrigger>
      {/* Wider than the capped trigger so long inherit labels are not clipped */}
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {languageItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

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
  const journeyOption = JOURNEY_OPTION_BY_VALUE[props.birthJourney];
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      onOpenChangeComplete={props.onOpenChangeComplete ?? undefined}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Settings")}</DialogTitle>
        </DialogHeader>
        <div {...stylex.props(styles.body)}>
          <SettingsSection title={t("Page details")}>
            <Item>
              <ItemMedia variant="icon">
                <Baby size={16} />
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

            <Item>
              <ItemMedia variant="icon">
                <CalendarHeart size={16} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t("Due Date")}</ItemTitle>
                <ItemDescription>
                  {props.baby.dueDateDisplayMode === "message" ? (
                    props.baby.publicDueDateText?.trim() ? (
                      t("Visitors see “{{text}}”.", { text: props.baby.publicDueDateText })
                    ) : (
                      t("Due date hidden from visitors.")
                    )
                  ) : (
                    <>
                      {props.baby.dueDate ? formatDueDate(props.baby.dueDate, locale) : ""} ·{" "}
                      {t("Visitors see the exact date and countdown.")}
                    </>
                  )}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <DueDateEditor baby={props.baby} onUpdate={props.onUpdate} />
              </ItemActions>
            </Item>
          </SettingsSection>

          <SettingsSection title={t("Birth journey")}>
            <Item>
              <ItemMedia variant="icon">
                <Heartbeat size={16} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t("Journey")}</ItemTitle>
                <ItemDescription>{t(journeyOption.descriptionKey)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <JourneyEditor birthJourney={props.birthJourney} onUpdate={props.onUpdate} />
              </ItemActions>
            </Item>

            {/* Marked milestones: correct their date here; mark new ones via
              the "Post update" composer, unmark by deleting the timeline
              update */}
            {props.baby.laborStarted && (
              <>
                <ItemSeparator />
                <Item>
                  <ItemMedia variant="icon">
                    <Heartbeat size={16} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{t("Labour started")}</ItemTitle>
                    <ItemDescription>
                      {formatDate(props.baby.laborStarted, {
                        locale,
                        timeZone: props.baby.timeZone,
                      })}{" "}
                      ({getRelativeTime(props.baby.laborStarted, locale)})
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusDateEditor
                      baby={props.baby}
                      status="labor_started"
                      currentDate={props.baby.laborStarted}
                      onRedate={props.onMilestoneRedate}
                      onRemove={props.onMilestoneRemove}
                    />
                  </ItemActions>
                </Item>
              </>
            )}

            {props.baby.wentToHospital && (
              <>
                <ItemSeparator />
                <Item>
                  <ItemMedia variant="icon">
                    <Hospital size={16} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{t("Gone to hospital")}</ItemTitle>
                    <ItemDescription>
                      {formatDate(props.baby.wentToHospital, {
                        locale,
                        timeZone: props.baby.timeZone,
                      })}{" "}
                      ({getRelativeTime(props.baby.wentToHospital, locale)})
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusDateEditor
                      baby={props.baby}
                      status="gone_to_hospital"
                      currentDate={props.baby.wentToHospital}
                      onRedate={props.onMilestoneRedate}
                      onRemove={props.onMilestoneRemove}
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
                    <Confetti size={16} />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{t("Baby born")}</ItemTitle>
                    <ItemDescription>
                      {formatDate(props.baby.babyBorn, {
                        locale,
                        timeZone: props.baby.timeZone,
                      })}{" "}
                      ({getRelativeTime(props.baby.babyBorn, locale)})
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusDateEditor
                      baby={props.baby}
                      status="born"
                      currentDate={props.baby.babyBorn}
                      onRedate={props.onMilestoneRedate}
                      onRemove={props.onMilestoneRemove}
                    />
                  </ItemActions>
                </Item>
              </>
            )}
          </SettingsSection>

          <SettingsSection title={t("Appearance")}>
            <Item>
              <ItemMedia variant="icon">
                <Palette size={16} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t("Theme")}</ItemTitle>
                <ItemDescription>
                  {t(getThemeOption(props.baby.theme)?.labelKey ?? "Mango")}
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
                <BabyLanguageSelect
                  value={props.baby.locale}
                  inheritedLocale={inheritedLocale}
                  onUpdate={props.onUpdate}
                />
              </ItemActions>
            </Item>
          </SettingsSection>

          {coParents && (
            <SettingsSection title={t("Access")}>
              <Item variant="default">
                <ItemMedia variant="icon">
                  <Users size={16} />
                </ItemMedia>
                <ItemContent>
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
            </SettingsSection>
          )}

          {onDelete && (
            <SettingsSection title={t("Danger zone")}>
              <Item>
                <ItemMedia variant="icon">
                  <Trash size={16} />
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
            </SettingsSection>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
