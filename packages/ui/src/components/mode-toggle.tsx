import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import * as stylex from "@stylexjs/stylex";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const styles = stylex.create({
  icon: {
    height: "1.2rem",
    width: "1.2rem",
  },
  sun: {
    scale: {
      default: 1,
      ":is(.dark *)": 0,
    },
    rotate: {
      default: "0deg",
      ":is(.dark *)": "-90deg",
    },
    transition: "transform 0.2s ease, scale 0.2s ease",
  },
  moon: {
    position: "absolute",
    scale: {
      default: 0,
      ":is(.dark *)": 1,
    },
    rotate: {
      default: "90deg",
      ":is(.dark *)": "0deg",
    },
    transition: "transform 0.2s ease, scale 0.2s ease",
  },
  srOnly: {
    border: 0,
    clip: "rect(0, 0, 0, 0)",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    padding: 0,
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  },
});

export function ModeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon" shape="pill" />}
            />
          }
        >
          <Sun {...stylex.props(styles.icon, styles.sun)} />
          <Moon {...stylex.props(styles.icon, styles.moon)} />
          <span {...stylex.props(styles.srOnly)}>Toggle theme</span>
        </TooltipTrigger>
        <TooltipContent>Toggle theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
