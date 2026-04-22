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
import { Switch } from "@workspace/ui/components/switch";
import { format } from "date-fns";
import {
  Activity,
  Baby,
  Calendar,
  Camera,
  CheckCircle,
  Hospital,
  MessageSquare,
  MessageSquarePlus,
  Palette,
} from "lucide-react";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { AnimatePresence, motion } from "framer-motion";
import {
  getCurrentStatus,
  getStatusLabel,
  getStatusMessage,
  type BabyData,
  type BabyUpdateHandler,
} from "@workspace/convex/src/types";
import {
  ClearCurrentStatusButton,
  DueDateEditor,
  NameEditor,
  PhotoUploader,
  PostUpdateEditor,
  StatusDateEditor,
  ThemeSelector,
} from "./editors";
import { formatDate, getRelativeTime, parseDate, THEME_OPTIONS } from "./utils";

type SettingsPanelProps = {
  baby: BabyData;
  babyId?: Id<"baby">;
  photoUrl?: string | null;
  onUpdate: BabyUpdateHandler;
  isOpen: boolean;
};

export function SettingsPanel({ baby, babyId, photoUrl, onUpdate, isOpen }: SettingsPanelProps) {
  const status = getCurrentStatus(baby);
  const currentStatusMessage = getStatusMessage(baby, status.type);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <ItemGroup className="">
            <Item>
              <ItemMedia variant="icon">
                <MessageSquarePlus className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Updates</ItemTitle>
                <ItemDescription>
                  Share news with visitors and optionally change the current status.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <PostUpdateEditor baby={baby} onUpdate={onUpdate} />
              </ItemActions>
            </Item>

            <ItemSeparator />

            <Item>
              <ItemMedia variant="icon">
                {status.type === "not_yet" ? (
                  <Baby className="w-4 h-4" />
                ) : status.type === "labor_started" ? (
                  <Activity className="w-4 h-4" />
                ) : status.type === "gone_to_hospital" ? (
                  <Hospital className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Current status</ItemTitle>
                <ItemDescription>
                  {getStatusLabel(status.type)}
                  {"date" in status
                    ? ` · ${formatDate(status.date)} (${getRelativeTime(status.date)})`
                    : ""}
                </ItemDescription>
                {currentStatusMessage && (
                  <ItemDescription className="text-foreground">
                    {currentStatusMessage}
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                {"date" in status && (
                  <StatusDateEditor
                    status={status.type}
                    currentDate={status.date}
                    onUpdate={onUpdate}
                  />
                )}
                <ClearCurrentStatusButton baby={baby} onUpdate={onUpdate} />
              </ItemActions>
            </Item>

            <ItemSeparator />

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

            <ItemSeparator />

            {/* Photo - only show when babyId is available (not in preview mode) */}
            {babyId && (
              <>
                <Item>
                  <ItemMedia variant="icon">
                    <Camera className="w-4 h-4" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>Baby Photo</ItemTitle>
                    <ItemDescription>{photoUrl ? "Photo uploaded" : "No photo"}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {photoUrl && (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-border mr-2">
                        <img
                          src={photoUrl}
                          alt="Baby"
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <PhotoUploader babyId={babyId} photoUrl={photoUrl ?? null} />
                  </ItemActions>
                </Item>
                <ItemSeparator />
              </>
            )}

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
