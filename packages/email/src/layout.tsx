import type { ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Section, Tailwind, Text } from "react-email";
import { emailBrandCopy } from "./copy";
import { emailTailwindConfig, emailTheme } from "./theme";

export type EmailLayoutProps = {
  children: ReactNode;
  previewText: string;
  showPreviewBanner: boolean;
};

export function EmailLayout(props: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Tailwind config={emailTailwindConfig}>
        <Head />
        <Preview>{props.previewText}</Preview>
        <Body
          style={{
            backgroundColor: emailTheme.background,
            fontFamily: emailTheme.fontFamily,
            margin: "0",
            padding: "32px 16px",
          }}
        >
          {props.showPreviewBanner ? (
            <Section
              style={{
                backgroundColor: emailTheme.accent,
                borderRadius: emailTheme.radiusPill,
                margin: "0 auto 24px",
                maxWidth: "420px",
                padding: "8px 16px",
              }}
            >
              <Text
                style={{
                  color: emailTheme.foreground,
                  fontFamily: emailTheme.fontFamily,
                  fontSize: "13px",
                  fontWeight: 800,
                  margin: "0",
                  textAlign: "center",
                }}
              >
                {emailBrandCopy.previewBanner}
              </Text>
            </Section>
          ) : null}
          <Container style={{ margin: "0 auto", maxWidth: "420px" }}>
            <Section style={{ marginBottom: "24px", textAlign: "center" }}>
              <Text
                style={{
                  backgroundColor: emailTheme.card,
                  border: `2px solid ${emailTheme.border}`,
                  borderRadius: emailTheme.radiusPill,
                  color: emailTheme.foreground,
                  display: "inline-block",
                  fontFamily: emailTheme.fontFamily,
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  margin: "0",
                  padding: "6px 16px 6px 8px",
                }}
              >
                <span
                  style={{
                    backgroundColor: emailTheme.primarySoft,
                    borderRadius: emailTheme.radiusPill,
                    color: emailTheme.primary,
                    display: "inline-block",
                    fontSize: "14px",
                    lineHeight: "28px",
                    marginRight: "8px",
                    textAlign: "center",
                    width: "28px",
                  }}
                >
                  👶
                </span>
                {emailBrandCopy.wordmark}
              </Text>
            </Section>
            {props.children}
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
