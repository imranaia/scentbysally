const nodemailer = require("nodemailer");

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
const isConfigured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);

const transporter = isConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  : null;

if (!isConfigured) {
  console.warn(
    "[email] GMAIL_USER/GMAIL_APP_PASSWORD not set in .env - emails will be logged to the console instead of sent."
  );
}

// Fire-and-log: a notification email failing to send should never break the
// request that triggered it (e.g. a password reset should still work even
// if Gmail is down), so callers don't need to await/catch this.
async function sendEmail({ to, subject, html }) {
  if (!isConfigured) {
    console.log(`[email:dev] to=${to} subject="${subject}"\n${html}\n`);
    return;
  }

  try {
    await transporter.sendMail({ from: GMAIL_USER, to, subject, html });
  } catch (err) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, err.message);
  }
}

module.exports = { sendEmail };
