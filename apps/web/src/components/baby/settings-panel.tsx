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
  Palette,
} from "lucide-react";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { AnimatePresence, motion } from "framer-motion";
import {
  getCurrentStatus,
  type BabyData,
  type BabyUpdateHandler,
  type Maybe,
} from "@workspace/convex/src/types";
import {
  BabyBornMessageEditor,
  HospitalMessageEditor,
  LaborStartedMessageEditor,
  DueDateEditor,
  NameEditor,
  PhotoUploader,
  StatusDateEditor,
  StatusUpdateButton,
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

type StatusSettingsItemProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  status: "labor_started" | "gone_to_hospital" | "born";
  currentDate: Maybe<string>;
  label: string;
  icon: React.ReactNode;
  isNextState: boolean;
};

function StatusSettingsItem(props: StatusSettingsItemProps) {
  return (
    <Item>
      <ItemMedia variant="icon">{props.icon}</ItemMedia>
      <ItemContent>
        <ItemTitle>{props.label}</ItemTitle>
        {props.currentDate && (
          <ItemDescription>
            {formatDate(props.currentDate)} ({getRelativeTime(props.currentDate)})
          </ItemDescription>
        )}
      </ItemContent>
      <ItemActions>
        {props.currentDate && (
          <StatusDateEditor
            baby={props.baby}
            status={props.status}
            currentDate={props.currentDate}
            onUpdate={props.onUpdate}
          />
        )}
        <StatusUpdateButton
          baby={props.baby}
          status={props.status}
          currentStatus={props.currentDate}
          label={props.label}
          icon={props.icon}
          isNextState={props.isNextState}
          onUpdate={props.onUpdate}
        />
      </ItemActions>
    </Item>
  );
}

function PhotoSettingsItem(props: { babyId: Id<"baby">; photoUrl?: string | null }) {
  return (
    <Item>
      <ItemMedia variant="icon">
        <Camera className="w-4 h-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Baby Photo</ItemTitle>
        <ItemDescription>{props.photoUrl ? "Photo uploaded" : "No photo"}</ItemDescription>
      </ItemContent>
      <ItemActions>
        {props.photoUrl && (
          <div className="w-8 h-8 rounded-full overflow-hidden border border-border mr-2">
            <img
              src={props.photoUrl}
              alt="Baby"
              width={64}
              height={64}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <PhotoUploader babyId={props.babyId} photoUrl={props.photoUrl ?? null} />
      </ItemActions>
    </Item>
  );
}

export function SettingsPanel({ baby, babyId, photoUrl, onUpdate, isOpen }: SettingsPanelProps) {
  const status = getCurrentStatus(baby);

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

            <ItemSeparator />

            {/* Status Updates */}
            {/* Labour started */}
            <StatusSettingsItem
              baby={baby}
              onUpdate={onUpdate}
              status="labor_started"
              currentDate={baby.laborStarted}
              label="Labour started"
              icon={<Activity className="w-4 h-4" />}
              isNextState={status.type === "not_yet"}
            />

            <ItemSeparator />
            <Item>
              <ItemMedia variant="icon">
                <Activity className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Labour Message</ItemTitle>
                <ItemDescription>{baby.laborStartedMessage || "Default message"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <LaborStartedMessageEditor baby={baby} onUpdate={onUpdate} />
              </ItemActions>
            </Item>

            <ItemSeparator />

            {/* Gone to hospital */}
            <StatusSettingsItem
              baby={baby}
              onUpdate={onUpdate}
              status="gone_to_hospital"
              currentDate={baby.wentToHospital}
              label="Gone to hospital"
              icon={<Hospital className="w-4 h-4" />}
              isNextState={status.type === "labor_started"}
            />

            <ItemSeparator />
            <Item>
              <ItemMedia variant="icon">
                <Hospital className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Hospital Message</ItemTitle>
                <ItemDescription>{baby.hospitalMessage || "Default message"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <HospitalMessageEditor baby={baby} onUpdate={onUpdate} />
              </ItemActions>
            </Item>

            <ItemSeparator />

            {/* Baby born */}
            <StatusSettingsItem
              baby={baby}
              onUpdate={onUpdate}
              status="born"
              currentDate={baby.babyBorn}
              label="Baby born"
              icon={<CheckCircle className="w-4 h-4" />}
              isNextState={status.type === "gone_to_hospital"}
            />

            {/* Baby Born Message */}
            <Item>
              <ItemMedia variant="icon">
                <CheckCircle className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Baby Born Message</ItemTitle>
                <ItemDescription>{baby.babyBornMessage || "Default message"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <BabyBornMessageEditor baby={baby} onUpdate={onUpdate} />
              </ItemActions>
            </Item>

            <ItemSeparator />

            {/* Photo - only show when babyId is available (not in preview mode) */}
            {babyId && (
              <>
                <PhotoSettingsItem babyId={babyId} photoUrl={photoUrl} />
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
