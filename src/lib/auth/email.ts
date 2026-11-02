import { randomInt } from 'node:crypto';

export const CODE_TTL_SECONDS = 10 * 60;

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

type SendParams = { identifier: string; token: string; url: string; expires: Date; provider: { apiKey?: string; from?: string } };

/** Emails the 6-digit code plus a one-tap link. Without a Resend key (local dev only) it prints them instead. */
export async function sendCode({ identifier: to, token: code, url, provider }: SendParams) {
  if (!provider.apiKey) {
    console.log(`\n[sign-in] Code for ${to}: ${code}\n[sign-in] Or open: ${url}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: provider.from,
      to,
      subject: `${code} is your Master Dashboard sign-in code`,
      html: html(code, url),
      text: `Your Master Dashboard sign-in code is ${code}.\n\nOr sign in with this link: ${url}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function html(code: string, url: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#0d0d0d;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#f2f1ea">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#1a1a19;border:1px solid #2c2c2a;border-radius:16px">
      <tr><td style="padding:32px 28px">
        <div style="font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#4fd8e6">Master Dashboard</div>
        <h1 style="margin:10px 0 6px;font-size:24px">Your sign-in code</h1>
        <p style="margin:0 0 22px;color:#c3c2b7;font-size:15px;line-height:1.5">Enter this code on the sign-in page. It expires in 10 minutes.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:.3em;text-align:center;background:#0e1213;border:1px solid #11404d;border-radius:12px;padding:16px 0;color:#bff6fb">${code}</div>
        <p style="margin:24px 0 12px;color:#c3c2b7;font-size:15px">Or sign in with one tap:</p>
        <a href="${esc(url)}" style="display:inline-block;background:#4fd8e6;color:#062226;font-weight:600;font-size:15px;text-decoration:none;border-radius:999px;padding:12px 22px">Sign in to Master Dashboard</a>
        <p style="margin:28px 0 0;color:#8f8e86;font-size:12px;line-height:1.5">If you didn't ask for this code, you can ignore this email. Nobody can sign in without it.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}
