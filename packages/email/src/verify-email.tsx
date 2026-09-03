import { ActionEmail } from "./action-email";
import { verifyEmailCopy } from "./copy";

export type VerifyEmailProps = {
  subjectPrefix: string;
  verifyUrl: string;
};

export function VerifyEmail(props: VerifyEmailProps) {
  return (
    <ActionEmail
      button={verifyEmailCopy.button}
      heading={verifyEmailCopy.heading}
      ignore={verifyEmailCopy.ignore}
      intro={verifyEmailCopy.intro}
      previewText={verifyEmailCopy.previewText}
      subjectPrefix={props.subjectPrefix}
      url={props.verifyUrl}
    />
  );
}
