import * as stylex from "@stylexjs/stylex";
import { DEMO_ACCOUNTS } from "@workspace/convex/src/seedCredentials";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { Box } from "@workspace/ui-patterns/components/box";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

const styles = stylex.create({
  shell: {
    backgroundColor: `color-mix(in oklab, ${colors.muted} 40%, transparent)`,
    borderColor: colors.border,
    borderRadius: "1rem",
    borderStyle: "dashed",
    borderWidth: "2px",
    marginBottom: spacing.s5,
    width: "100%",
  },
});

/**
 * Preview/local-only picker of seeded test accounts. The parent prefills and
 * submits the auth form. Pass `enabled` from `hasDemoLogin` at the call site.
 */
export function DemoAccountPicker(props: {
  onPrefill: (account: (typeof DEMO_ACCOUNTS)[number]) => void;
  enabled: boolean;
}) {
  if (!props.enabled) return null;

  return (
    <div {...stylex.props(styles.shell)}>
      <Box pad="s3" fullWidth>
        <Stack gap="s1_5" fullWidth>
          <label htmlFor="demo-account-picker">
            <Text as="span" size="xs" weight="extrabold" tone="muted">
              Test account
            </Text>
          </label>
          <NativeSelect
            id="demo-account-picker"
            fullWidth
            defaultValue=""
            onChange={(event) => {
              const account = DEMO_ACCOUNTS.find(
                (item) => item.email === event.currentTarget.value,
              );
              if (!account) return;
              props.onPrefill(account);
            }}
          >
            <NativeSelectOption value="" disabled>
              Choose a test account…
            </NativeSelectOption>
            {DEMO_ACCOUNTS.map((account) => (
              <NativeSelectOption key={account.email} value={account.email}>
                {account.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Stack>
      </Box>
    </div>
  );
}
