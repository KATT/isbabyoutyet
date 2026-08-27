import * as stylex from "@stylexjs/stylex";

import { colors } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  caption: {
    color: colors.mutedForeground,
    fontSize: "0.875rem",
    marginTop: "1rem",
  },
  cell: {
    padding: "0.5rem",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  footer: {
    backgroundColor: `color-mix(in oklab, ${colors.muted} 50%, transparent)`,
    borderTopColor: colors.border,
    borderTopStyle: "solid",
    borderTopWidth: "1px",
    fontWeight: 500,
  },
  head: {
    color: colors.mutedForeground,
    fontWeight: 500,
    height: "2.5rem",
    padding: "0.5rem",
    textAlign: "start",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  root: {
    borderCollapse: "collapse",
    captionSide: "bottom",
    fontSize: "0.875rem",
    width: "100%",
  },
  row: {
    backgroundColor: {
      ":hover": `color-mix(in oklab, ${colors.muted} 50%, transparent)`,
      default: "transparent",
    },
    borderBottomColor: colors.border,
    borderBottomStyle: "solid",
    borderBottomWidth: "1px",
    transition: "background-color 0.1s ease",
  },
  wrapper: {
    overflowX: "auto",
    position: "relative",
    width: "100%",
  },
});

const Table = ({ ...props }: Omit<React.ComponentProps<"table">, "className" | "style">) => {
  const wrapper = stylex.props(styles.wrapper);
  return (
    <div className={wrapper.className} data-slot="table-container" style={wrapper.style}>
      <table {...stylex.props(styles.root)} data-slot="table" {...props} />
    </div>
  );
};

const TableHeader = (props: Omit<React.ComponentProps<"thead">, "className" | "style">) => (
  <thead data-slot="table-header" {...props} />
);

const TableBody = (props: Omit<React.ComponentProps<"tbody">, "className" | "style">) => (
  <tbody data-slot="table-body" {...props} />
);

const TableFooter = ({ ...props }: Omit<React.ComponentProps<"tfoot">, "className" | "style">) => (
  <tfoot {...stylex.props(styles.footer)} data-slot="table-footer" {...props} />
);

const TableRow = ({ ...props }: Omit<React.ComponentProps<"tr">, "className" | "style">) => (
  <tr {...stylex.props(styles.row)} data-slot="table-row" {...props} />
);

const TableHead = ({ ...props }: Omit<React.ComponentProps<"th">, "className" | "style">) => (
  <th {...stylex.props(styles.head)} data-slot="table-head" {...props} />
);

const TableCell = ({ ...props }: Omit<React.ComponentProps<"td">, "className" | "style">) => (
  <td {...stylex.props(styles.cell)} data-slot="table-cell" {...props} />
);

const TableCaption = ({
  ...props
}: Omit<React.ComponentProps<"caption">, "className" | "style">) => (
  <caption {...stylex.props(styles.caption)} data-slot="table-caption" {...props} />
);

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
