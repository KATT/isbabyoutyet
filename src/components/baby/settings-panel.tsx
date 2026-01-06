import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
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
import { AnimatePresence, motion } from "framer-motion";
import { getCurrentStatus, type BabyData, type BabyUpdateHandler } from "./types";
import {
  BabyBornMessageEditor,
  HospitalMessageEditor,
  DueDateEditor,
  NameEditor,
  StatusDateEditor,
  StatusUpdateButton,
  ThemeSelector,
} from "./editors";
import { formatDate, getRelativeTime, parseDate, THEME_OPTIONS } from "./utils";

type SettingsPanelProps = {
  baby: BabyData;
  onUpdate: BabyUpdateHandler;
  isOpen: boolean;
};

export function SettingsPanel({ baby, onUpdate, isOpen }: SettingsPanelProps) {
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
            <Item>
              <ItemMedia variant="icon">
                <Activity className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Labour started</ItemTitle>
                {baby.laborStarted && (
                  <ItemDescription>
                    {formatDate(baby.laborStarted)} ({getRelativeTime(baby.laborStarted)})
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                {baby.laborStarted && (
                  <StatusDateEditor
                    baby={baby}
                    status="labor_started"
                    currentDate={baby.laborStarted}
                    onUpdate={onUpdate}
                  />
                )}
                <StatusUpdateButton
                  baby={baby}
                  status="labor_started"
                  currentStatus={baby.laborStarted}
                  label="Labour started"
                  icon={<Activity className="w-4 h-4" />}
                  isNextState={status.type === "not_yet"}
                  onUpdate={onUpdate}
                />
              </ItemActions>
            </Item>

            <ItemSeparator />

            {/* Gone to hospital */}
            <Item>
              <ItemMedia variant="icon">
                <Hospital className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Gone to hospital</ItemTitle>
                {baby.wentToHospital && (
                  <ItemDescription>
                    {formatDate(baby.wentToHospital)} ({getRelativeTime(baby.wentToHospital)})
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                {baby.wentToHospital && (
                  <StatusDateEditor
                    baby={baby}
                    status="gone_to_hospital"
                    currentDate={baby.wentToHospital}
                    onUpdate={onUpdate}
                  />
                )}
                <StatusUpdateButton
                  baby={baby}
                  status="gone_to_hospital"
                  currentStatus={baby.wentToHospital}
                  label="Gone to hospital"
                  icon={<Hospital className="w-4 h-4" />}
                  isNextState={status.type === "labor_started"}
                  onUpdate={onUpdate}
                />
              </ItemActions>
            </Item>

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
            <Item>
              <ItemMedia variant="icon">
                <CheckCircle className="w-4 h-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Baby born</ItemTitle>
                {baby.babyBorn && (
                  <ItemDescription>
                    {formatDate(baby.babyBorn)} ({getRelativeTime(baby.babyBorn)})
                  </ItemDescription>
                )}
              </ItemContent>
              <ItemActions>
                {baby.babyBorn && (
                  <StatusDateEditor
                    baby={baby}
                    status="born"
                    currentDate={baby.babyBorn}
                    onUpdate={onUpdate}
                  />
                )}
                <StatusUpdateButton
                  baby={baby}
                  status="born"
                  currentStatus={baby.babyBorn}
                  label="Baby born"
                  icon={<CheckCircle className="w-4 h-4" />}
                  isNextState={status.type === "gone_to_hospital"}
                  onUpdate={onUpdate}
                />
              </ItemActions>
            </Item>

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
