import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import * as stylex from "@stylexjs/stylex";
import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useRef } from "react";

import { colors, radius } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  chip: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    color: colors.secondaryForeground,
    display: "inline-flex",
    fontSize: "0.75rem",
    gap: "0.25rem",
    height: "1.375rem",
    paddingInlineEnd: "0.25rem",
    paddingInlineStart: "0.5rem",
  },
  chipRemove: {
    alignItems: "center",
    backgroundColor: { ":hover": colors.accent, default: "transparent" },
    border: 0,
    borderRadius: radius.sm,
    color: colors.mutedForeground,
    cursor: "pointer",
    display: "inline-flex",
    height: "1rem",
    justifyContent: "center",
    padding: 0,
    width: "1rem",
  },
  chips: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: {
      ":focus-within": colors.ring,
      default: colors.input,
    },
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.25rem",
    minHeight: "2.25rem",
    paddingBlock: "0.25rem",
    paddingInline: "0.5rem",
    width: "100%",
  },
  chipsInput: {
    backgroundColor: "transparent",
    border: 0,
    color: colors.foreground,
    flex: 1,
    fontSize: "0.875rem",
    minWidth: "4rem",
    outline: "none",
  },
  clear: {
    alignItems: "center",
    backgroundColor: "transparent",
    border: 0,
    color: colors.mutedForeground,
    cursor: "pointer",
    display: "inline-flex",
    insetInlineEnd: "0.5rem",
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
  },
  content: {
    backgroundColor: colors.popover,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    color: colors.popoverForeground,
    maxHeight: "min(var(--available-height), 20rem)",
    minWidth: "var(--anchor-width)",
    opacity: 1,
    outline: "none",
    overflowY: "auto",
    padding: "0.25rem",
    transformOrigin: "var(--transform-origin)",
    transition: "opacity 0.15s ease-in-out",
    width: "var(--anchor-width)",
    zIndex: 50,
  },
  contentHidden: { opacity: 0 },
  empty: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    paddingBlock: "1.5rem",
    textAlign: "center",
  },
  separator: {
    backgroundColor: colors.border,
    height: "1px",
    marginBlock: "0.25rem",
    marginInline: "-0.25rem",
  },
  groupLabel: {
    color: colors.mutedForeground,
    fontSize: "0.75rem",
    fontWeight: 500,
    paddingBlock: "0.375rem",
    paddingInline: "0.5rem",
  },
  input: {
    "::placeholder": { color: colors.mutedForeground },
    backgroundColor: "transparent",
    borderColor: {
      ":focus-visible": colors.ring,
      default: colors.input,
    },
    borderRadius: radius.md,
    borderStyle: "solid",
    borderWidth: "1px",
    boxShadow: {
      ":focus-visible": `0 0 0 3px color-mix(in oklab, ${colors.ring} 50%, transparent)`,
      default: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    },
    color: colors.foreground,
    fontSize: "0.875rem",
    height: "2.25rem",
    outline: "none",
    paddingInlineEnd: "2rem",
    paddingInlineStart: "0.75rem",
    width: "100%",
  },
  inputWrap: {
    position: "relative",
    width: "100%",
  },
  item: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: radius.sm,
    color: colors.popoverForeground,
    cursor: "default",
    display: "flex",
    fontSize: "0.875rem",
    gap: "0.5rem",
    outline: "none",
    paddingBlock: "0.375rem",
    paddingInlineEnd: "2rem",
    paddingInlineStart: "0.5rem",
    position: "relative",
    userSelect: "none",
  },
  itemHighlighted: {
    backgroundColor: colors.accent,
    color: colors.accentForeground,
  },
  itemIndicator: {
    alignItems: "center",
    display: "flex",
    height: "0.875rem",
    insetInlineEnd: "0.5rem",
    justifyContent: "center",
    position: "absolute",
    width: "0.875rem",
  },
  list: {
    overflowY: "auto",
  },
  trigger: {
    alignItems: "center",
    backgroundColor: "transparent",
    border: 0,
    color: colors.mutedForeground,
    cursor: "pointer",
    display: "inline-flex",
    insetInlineEnd: "0.5rem",
    justifyContent: "center",
    padding: 0,
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
  },
});

const useComboboxAnchor = () => useRef<HTMLDivElement | null>(null);

const Combobox = ComboboxPrimitive.Root;

const ComboboxValue = ComboboxPrimitive.Value;

const ComboboxTrigger = ({ children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Trigger>, "className">) => (
  <ComboboxPrimitive.Trigger
    {...stylex.props(styles.trigger)}
    data-slot="combobox-trigger"
    {...props}
  >
    {children ?? <ChevronsUpDownIcon size={16} />}
  </ComboboxPrimitive.Trigger>
);

const ComboboxClear = ({ children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Clear>, "className">) => (
  <ComboboxPrimitive.Clear
    {...stylex.props(styles.clear)}
    data-slot="combobox-clear"
    {...props}
  >
    {children ?? <XIcon size={16} />}
  </ComboboxPrimitive.Clear>
);

const ComboboxInput = ({ showTrigger = true,
  showClear = false,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Input>, "className"> & {
  showTrigger?: boolean;
  showClear?: boolean;
}) => {
  const wrap = stylex.props(styles.inputWrap);
  return (
    <div className={wrap.className} style={wrap.style}>
      <ComboboxPrimitive.Input
        {...stylex.props(styles.input)}
        data-slot="combobox-input"
        {...props}
      />
      {showClear ? <ComboboxClear /> : null}
      {showTrigger && !showClear ? <ComboboxTrigger /> : null}
    </div>
  );
};

const ComboboxChips = ({ ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Chips>, "className">) => (
  <ComboboxPrimitive.Chips
    {...stylex.props(styles.chips)}
    data-slot="combobox-chips"
    {...props}
  />
);

const ComboboxChip = ({ children,
  showRemove = true,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Chip>, "className"> & {
  showRemove?: boolean;
}) => {
  const remove = stylex.props(styles.chipRemove);
  return (
    <ComboboxPrimitive.Chip
      {...stylex.props(styles.chip)}
      data-slot="combobox-chip"
      {...props}
    >
      {children}
      {showRemove ? (
        <ComboboxPrimitive.ChipRemove
          className={remove.className}
          data-slot="combobox-chip-remove"
          style={remove.style}
        >
          <XIcon size={12} />
        </ComboboxPrimitive.ChipRemove>
      ) : null}
    </ComboboxPrimitive.Chip>
  );
};

const ComboboxChipsInput = ({ ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Input>, "className">) => (
  <ComboboxPrimitive.Input
    {...stylex.props(styles.chipsInput)}
    data-slot="combobox-chips-input"
    {...props}
  />
);

const ComboboxContent = ({ side = "bottom",
  sideOffset = 6,
  align = "start",
  anchor,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Popup>, "className"> & {
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  anchor?: React.ComponentProps<typeof ComboboxPrimitive.Positioner>["anchor"];
}) => (
  <ComboboxPrimitive.Portal>
    <ComboboxPrimitive.Positioner
      align={align}
      anchor={anchor}
      side={side}
      sideOffset={sideOffset}
      style={{ zIndex: 50 }}
    >
      <ComboboxPrimitive.Popup
        className={(state) =>
          stylex.props(
            styles.content,
            (state.transitionStatus === "starting" || state.transitionStatus === "ending") &&
              styles.contentHidden
          ).className
        }
        data-slot="combobox-content"
        {...props}
      />
    </ComboboxPrimitive.Positioner>
  </ComboboxPrimitive.Portal>
);

const ComboboxList = ({ ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.List>, "className">) => (
  <ComboboxPrimitive.List
    {...stylex.props(styles.list)}
    data-slot="combobox-list"
    {...props}
  />
);

const ComboboxItem = ({ children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Item>, "className">) => {
  const indicator = stylex.props(styles.itemIndicator);
  return (
    <ComboboxPrimitive.Item
      className={(state) =>
        stylex.props(
          styles.item,
          state.highlighted && styles.itemHighlighted
        ).className
      }
      data-slot="combobox-item"
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className={indicator.className} style={indicator.style}>
        <CheckIcon size={16} />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
};

const ComboboxGroup = (props: React.ComponentProps<typeof ComboboxPrimitive.Group>) => (
  <ComboboxPrimitive.Group data-slot="combobox-group" {...props} />
);

const ComboboxCollection = (props: React.ComponentProps<typeof ComboboxPrimitive.Collection>) => (
  <ComboboxPrimitive.Collection {...props} />
);

const ComboboxSeparator = (
  props: Omit<React.ComponentProps<"div">, "className" | "style">,
) => (
  <div
    {...stylex.props(styles.separator)}
    data-slot="combobox-separator"
    {...props}
  />
);

const ComboboxGroupLabel = ({ ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.GroupLabel>, "className" | "style">) => (
  <ComboboxPrimitive.GroupLabel
    {...stylex.props(styles.groupLabel)}
    data-slot="combobox-group-label"
    {...props}
  />
);

const ComboboxEmpty = ({ ...props
}: Omit<React.ComponentProps<typeof ComboboxPrimitive.Empty>, "className" | "style">) => (
  <ComboboxPrimitive.Empty
    {...stylex.props(styles.empty)}
    data-slot="combobox-empty"
    {...props}
  />
);

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxGroupLabel as ComboboxLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
};
