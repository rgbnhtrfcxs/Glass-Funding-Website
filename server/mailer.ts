type MailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  templateId?: number;
  params?: Record<string, unknown>;
};

function parseFrom(from: string | undefined) {
  if (!from) return {};
  const match = from.match(/^(.*)<(.+@.+)>$/);
  if (match) {
    return { email: match[2].trim(), name: match[1].trim() };
  }
  return { email: from.trim() };
}

/**
 * Best-effort mailer. If nodemailer is not installed or SMTP env is missing,
 * we just log to console so requests are not blocked.
 */
export async function sendMail({ to, subject, text, html, from, templateId, params }: MailArgs) {
  const brevoKey = process.env.BREVO_API_KEY;
  if (templateId && brevoKey) {
    try {
      const sender = parseFrom(from || process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@glass.demo");
      console.log("[mailer] Sending via Brevo template", { to, templateId });
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": brevoKey,
        },
        body: JSON.stringify({
          to: [{ email: to }],
          templateId,
          params,
          sender,
        }),
      });
      if (!brevoRes.ok) {
        const text = await brevoRes.text();
        console.error("[mailer] Brevo send failed", brevoRes.status, text);
      } else {
        console.log("[mailer] Brevo send ok", { to, templateId });
        return;
      }
    } catch (error) {
      console.error("[mailer] Brevo template send failed; falling back to SMTP", error);
    }
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromAddr = from || process.env.MAIL_FROM || user || "no-reply@glass.demo";

  // If we don't have SMTP config, log and return silently.
  if (!host || !user || !pass) {
    console.warn("[mailer] SMTP not configured; logging instead", { to, subject, text });
    return;
  }

  let nodemailer: typeof import("nodemailer");
  try {
    nodemailer = await import("nodemailer");
  } catch (error) {
    console.error("[mailer] nodemailer not installed; logging instead", error);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    console.log("[mailer] Sending via SMTP", { to, host, port, from: fromAddr });
    await transporter.sendMail({
      from: fromAddr,
      to,
      subject,
      text,
      html,
    });
    console.log("[mailer] SMTP send ok", { to });
  } catch (error) {
    console.error("[mailer] failed to send; logging instead", error);
  }
}
