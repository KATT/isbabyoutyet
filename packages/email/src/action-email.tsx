import { Button, Section, Text } from "react-email";
import { EmailLayout } from "./layout";
import { emailTheme } from "./theme";

export type ActionEmailProps = {
  button: string;
  heading: string;
  ignore: string;
  intro: string;
  previewText: string;
  subjectPrefix: string;
  url: string;
};

export function ActionEmail(props: ActionEmailProps) {
  return (
    <EmailLayout previewText={props.previewText} showPreviewBanner={props.subjectPrefix !== ""}>
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
          {props.heading}
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
          {props.intro}
        </Text>
        {/*
          React Email's Button defaults to max-width: 100%. Email clients treat
          that as content-box, so padding plus the 6px pop-shadow overflows the
          card. Override the max-width and size the CTA to its label.
        */}
        <Text style={{ margin: "0", textAlign: "center" }}>
          <Button
            href={props.url}
            style={{
              backgroundColor: emailTheme.primary,
              borderRadius: emailTheme.radiusPill,
              boxShadow: emailTheme.popShadow,
              color: emailTheme.primaryForeground,
              display: "inline-block",
              fontFamily: emailTheme.fontFamily,
              fontSize: "16px",
              fontWeight: 800,
              lineHeight: "24px",
              maxWidth: "none",
              padding: "14px 24px",
              textAlign: "center",
              textDecoration: "none",
              width: "auto",
            }}
          >
            {props.button}
          </Button>
        </Text>
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
          {props.ignore}
        </Text>
      </Section>
    </EmailLayout>
  );
}
