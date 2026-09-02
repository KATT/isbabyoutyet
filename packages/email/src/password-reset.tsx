import { Button, Section, Text } from "react-email";
import { passwordResetCopy } from "./copy";
import { EmailLayout } from "./layout";
import { emailTheme } from "./theme";

export type PasswordResetEmailProps = {
  resetUrl: string;
  subjectPrefix: string;
};

export function PasswordResetEmail(props: PasswordResetEmailProps) {
  return (
    <EmailLayout
      previewText={passwordResetCopy.previewText}
      showPreviewBanner={props.subjectPrefix !== ""}
    >
      <Section
        style={{
          backgroundColor: emailTheme.card,
          border: `2px solid ${emailTheme.border}`,
          borderRadius: emailTheme.radiusCard,
          boxShadow: emailTheme.popShadow,
          padding: "32px 24px",
        }}
      >
        <Text
          style={{
            fontSize: "36px",
            lineHeight: "40px",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          ✉️
        </Text>
        <Text
          style={{
            color: emailTheme.foreground,
            fontFamily: emailTheme.fontFamily,
            fontSize: "24px",
            fontWeight: 900,
            lineHeight: "32px",
            margin: "0 0 12px",
            textAlign: "center",
          }}
        >
          {passwordResetCopy.heading}
        </Text>
        <Text
          style={{
            color: emailTheme.mutedForeground,
            fontFamily: emailTheme.fontFamily,
            fontSize: "16px",
            fontWeight: 500,
            lineHeight: "24px",
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          {passwordResetCopy.intro}
        </Text>
        <Button
          href={props.resetUrl}
          style={{
            backgroundColor: emailTheme.primary,
            borderRadius: emailTheme.radiusPill,
            boxShadow: emailTheme.popShadow,
            color: emailTheme.primaryForeground,
            display: "block",
            fontFamily: emailTheme.fontFamily,
            fontSize: "16px",
            fontWeight: 800,
            lineHeight: "24px",
            padding: "14px 24px",
            textAlign: "center",
            textDecoration: "none",
            width: "100%",
          }}
        >
          {passwordResetCopy.button}
        </Button>
        <Text
          style={{
            color: emailTheme.mutedForeground,
            fontFamily: emailTheme.fontFamily,
            fontSize: "14px",
            lineHeight: "22px",
            margin: "24px 0 0",
            textAlign: "center",
          }}
        >
          {passwordResetCopy.ignore}
        </Text>
      </Section>
    </EmailLayout>
  );
}
