import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as stylex from "@stylexjs/stylex";


const styles = stylex.create({
  panel: {
    overflow: "hidden",
    transition: "height 0.2s ease-in-out",
  },
  trigger: {
    alignItems: "center",
    background: "none",
    borderWidth: 0,
    color: "inherit",
    cursor: "pointer",
    display: "inline-flex",
    font: "inherit",
    gap: "0.25rem",
    outline: "none",
    padding: 0,
  },
});

const Collapsible = (props: React.ComponentProps<typeof CollapsiblePrimitive.Root>) => (
  <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
);

const CollapsibleTrigger = ({ ...props
}: Omit<React.ComponentProps<typeof CollapsiblePrimitive.Trigger>, "className">) => (
  <CollapsiblePrimitive.Trigger
    data-slot="collapsible-trigger"
    {...stylex.props(styles.trigger)}
    {...props}
  />
);

const CollapsibleContent = ({ ...props
}: Omit<React.ComponentProps<typeof CollapsiblePrimitive.Panel>, "className">) => (
  <CollapsiblePrimitive.Panel
    data-slot="collapsible-content"
    {...stylex.props(styles.panel)}
    {...props}
  />
);

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
