export const emailBrandCopy = {
  ignore: "If you did not request this, you can safely ignore this email.",
  previewBanner: "Preview deployment — this message is not from production.",
  wordmark: "isbabyoutyet",
} as const;

export const passwordResetCopy = {
  button: "Reset your password",
  heading: "Reset your password",
  ignore: emailBrandCopy.ignore,
  intro: "Someone requested a password reset for your Is Baby Out Yet? account.",
  previewBanner: emailBrandCopy.previewBanner,
  previewText: "Reset your Is Baby Out Yet? password",
  subject: "Reset your Is Baby Out Yet? password",
  wordmark: emailBrandCopy.wordmark,
} as const;

export const verifyEmailCopy = {
  button: "Verify your email",
  heading: "Verify your email",
  ignore: emailBrandCopy.ignore,
  intro: "Confirm this email address for your Is Baby Out Yet? account.",
  previewText: "Verify your Is Baby Out Yet? email",
  subject: "Verify your Is Baby Out Yet? email",
} as const;
