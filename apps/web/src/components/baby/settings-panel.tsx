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
import { format } from "date-fns";
import {
  Baby,
  CalendarHeart,
  ChatCircle,
  Confetti,
  Heartbeat,
  Hospital,
  Palette,
  Trash,
  Users,
} from "@phosphor-icons/react";
import type { BabyData, BabyUpdateHandler } from "@workspace/convex/src/types";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { DueDateEditor, NameEditor, StatusDateEditor, ThemeSelector } from "./editors";
import { CoParentsSettings } from "./co-parents-settings";
import { formatDate, getRelativeTime, parseDate, THEME_OPTIONS } from "./utils";

type SettingsPanelProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Owner-only soft delete. Omitted on the preview page. */
  onDelete?: () => void | Promise<void>;
  /** When set, shows the co-parents section (real baby pages only). */
  coParents?: {
    babyId: Id<"baby">;
    isOwner: boolean;
  };
};

/**
 * Owner settings: page metadata and corrections. Marking milestones and
 * posting photos happens through the "Post update" composer; milestone rows
 * here appear once marked, for correcting their date. Unmarking a milestone
 * is done by deleting its update in the timeline.
 */
export function SettingsPanel({
  baby,
  onUpdate,
  open,
  onOpenChange,
  onDelete,
  coParents,
}: SettingsPanelProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[min(90vh,40rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <ItemGroup>
          {/* Baby Name */}
          <Item>
            <ItemMedia variant="icon">
              <Baby className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Baby Name</ItemTitle>
              <ItemDescription>{baby.name}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <NameEditor baby={baby} onUpdate={onUpdate} />
            </ItemActions>
          </Item>

          <ItemSeparator />

          {/* Due Date */}
          <Item>
            <ItemMedia variant="icon">
              <CalendarHeart className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Due Date</ItemTitle>
              <ItemDescription>{format(parseDate(baby.dueDate), "MMMM d, yyyy")}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <DueDateEditor baby={baby} onUpdate={onUpdate} />
            </ItemActions>
          </Item>

          {/* Marked milestones: correct their date here; mark new ones via
              the "Post update" composer, unmark by deleting the timeline
              update */}
          {baby.laborStarted && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Heartbeat className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Labour started</ItemTitle>
                  <ItemDescription>
                    {formatDate(baby.laborStarted)} ({getRelativeTime(baby.laborStarted)})
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusDateEditor
                    baby={baby}
                    status="labor_started"
                    currentDate={baby.laborStarted}
                    onUpdate={onUpdate}
                  />
                </ItemActions>
              </Item>
            </>
          )}

          {baby.wentToHospital && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Hospital className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Gone to hospital</ItemTitle>
                  <ItemDescription>
                    {formatDate(baby.wentToHospital)} ({getRelativeTime(baby.wentToHospital)})
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusDateEditor
                    baby={baby}
                    status="gone_to_hospital"
                    currentDate={baby.wentToHospital}
                    onUpdate={onUpdate}
                  />
                </ItemActions>
              </Item>
            </>
          )}

          {baby.babyBorn && (
            <>
              <ItemSeparator />
              <Item>
                <ItemMedia variant="icon">
                  <Confetti className="w-4 h-4" />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>Baby born</ItemTitle>
                  <ItemDescription>
                    {formatDate(baby.babyBorn)} ({getRelativeTime(baby.babyBorn)})
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <StatusDateEditor
                    baby={baby}
                    status="born"
                    currentDate={baby.babyBorn}
                    onUpdate={onUpdate}
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
              <ItemTitle>Theme</ItemTitle>
              <ItemDescription>
                {THEME_OPTIONS.find((t) => t.value === baby.theme)?.label || "Default"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <ThemeSelector baby={baby} onUpdate={onUpdate} />
            </ItemActions>
          </Item>

          <ItemSeparator />

          {/* Encouragements */}
          <Item>
            <ItemMedia variant="icon">
              <ChatCircle className="w-4 h-4" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Encouragements</ItemTitle>
              <ItemDescription>
                {baby.encouragementsDisabled ? "Form disabled" : "Visitors can send messages"}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                checked={!baby.encouragementsDisabled}
                onCheckedChange={(checked) => onUpdate({ encouragementsDisabled: !checked })}
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
                    <ItemTitle>Co-parents</ItemTitle>
                    <ItemDescription>
                      {coParents.isOwner
                        ? "People who can post updates and change settings"
                        : "Others who can manage this page with you"}
                    </ItemDescription>
                  </div>
                  <CoParentsSettings babyId={coParents.babyId} isOwner={coParents.isOwner} />
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
                  <ItemTitle>Delete page</ItemTitle>
                  <ItemDescription>Hide this baby page from everyone</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {baby.name}&apos;s page?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The page will disappear from your dashboard and the public link will stop
                          working. Only you (the owner) can do this.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={() => {
                            void onDelete();
                          }}
                        >
                          Delete page
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
