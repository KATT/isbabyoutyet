const EMAIL_API_ORIGIN = "https://api.cloudflare.com/client/v4";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export async function sendPasswordResetEmail(options: { recipient: string; resetUrl: string }) {
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = requireEnv("CLOUDFLARE_EMAIL_API_TOKEN");
  const from = requireEnv("EMAIL_FROM");
  const response = await fetch(
    `${EMAIL_API_ORIGIN}/accounts/${encodeURIComponent(accountId)}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: options.recipient,
        from,
        subject: "Reset your Is Baby Out Yet? password",
        text: [
          "Someone requested a password reset for your Is Baby Out Yet? account.",
          "",
          `Reset your password: ${options.resetUrl}`,
          "",
          "If you did not request this, you can safely ignore this email.",
        ].join("\n"),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudflare Email Service rejected the message (${response.status})`);
  }
}
