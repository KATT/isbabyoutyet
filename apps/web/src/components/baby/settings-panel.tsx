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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Switch } from "@workspace/ui/components/switch";
import { format } from "date-fns";
import {
  Activity,
  Baby,
  Calendar,
  CheckCircle,
  Hospital,
  MessageSquare,
  Palette,
} from "lucide-react";
import type { BabyData, BabyUpdateHandler } from "@workspace/convex/src/types";
import { DueDateEditor, NameEditor, StatusDateEditor, ThemeSelector } from "./editors";
import { formatDate, getRelativeTime, parseDate, THEME_OPTIONS } from "./utils";

type SettingsPanelProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Owner settings: page metadata and corrections. Marking milestones and
 * posting photos happens through the "Post update" composer; milestone rows
 * here appear once marked, for correcting their date. Unmarking a milestone
 * is done by deleting its update in the timeline.
 */
export function SettingsPanel({ baby, onUpdate, open, onOpenChange }: SettingsPanelProps) {
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
              <Calendar className="w-4 h-4" />
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
                  <Activity className="w-4 h-4" />
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
                  <CheckCircle className="w-4 h-4" />
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
              <MessageSquare className="w-4 h-4" />
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
        </ItemGroup>
      </DialogContent>
    </Dialog>
  );
}
