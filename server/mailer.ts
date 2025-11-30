type MailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Best-effort mailer. If nodemailer is not installed or SMTP env is missing,
 * we just log to console so requests are not blocked.
 */
export async function sendMail({ to, subject, text, html }: MailArgs) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user || "no-reply@glass.demo";

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
    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error("[mailer] failed to send; logging instead", error);
  }
}
