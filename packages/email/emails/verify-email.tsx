import { VerifyEmail } from "../src/verify-email";
import type { VerifyEmailProps } from "../src/verify-email";

export default function VerifyEmailPreview(props: VerifyEmailProps) {
  return <VerifyEmail subjectPrefix={props.subjectPrefix} verifyUrl={props.verifyUrl} />;
}

VerifyEmailPreview.PreviewProps = {
  subjectPrefix: "",
  verifyUrl: "https://isbabyoutyet.com/api/auth/verify-email?token=preview",
};
