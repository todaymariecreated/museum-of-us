const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    throw new Error(
      'Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables. Set them in Vercel → Project → Settings → Environment Variables.'
    );
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

// Sends a buyer their brand new museum's private edit link right after a
// Gumroad purchase. Kept in its own file so the webhook doesn't need to
// know or care how the email actually gets sent - swap this out later
// (Resend, Postmark, whatever) without touching the fulfillment logic.
async function sendGiftEmail({ to, editUrl }) {
  const senderName = process.env.GIFT_SENDER_NAME || 'Museum of Us';
  const bcc = process.env.GIFT_BCC_EMAIL || undefined;

  const text =
    'Your very own Museum of Us is ready.\n\n' +
    'Open it, add your photos and notes, and it is yours to keep:\n' +
    editUrl +
    '\n\n' +
    'Save this link. It is the only way to edit your museum, and it is private to you.';

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; color: #3a1712;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">Your Museum of Us is ready</h1>
      <p style="line-height: 1.5;">Open it, add your photos and notes. It's yours to keep.</p>
      <p style="margin: 28px 0;">
        <a href="${editUrl}" style="background:#3a1712;color:#f6efdf;padding:12px 22px;border-radius:4px;text-decoration:none;display:inline-block;">Open your museum</a>
      </p>
      <p style="font-size: 13px; color: #7a6a55; line-height: 1.5;">
        Save this link. It is the only way to edit your museum, and it is private to you.
      </p>
    </div>
  `;

  await getTransporter().sendMail({
    from: `"${senderName}" <${process.env.GMAIL_USER}>`,
    to,
    bcc,
    subject: 'Your Museum of Us is ready',
    text,
    html,
  });
}

module.exports = { sendGiftEmail };
