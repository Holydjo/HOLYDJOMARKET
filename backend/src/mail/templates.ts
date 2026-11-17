/**
 * Email layout + helpers. Plain inline-styled HTML (email clients ignore
 * <style> tags) with a text version for every message.
 */
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface Block {
  heading: string;
  lines: string[]; // plain text paragraphs (escaped automatically)
  quote?: string; // a user-written message, shown in a box
  details?: [label: string, value: string][];
  cta?: { label: string; url: string };
}

export function render(b: Block): { html: string; text: string } {
  const details = b.details?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:16px 0">${b.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 0;color:#6d655d;font-size:14px;width:40%">${esc(k)}</td><td style="padding:6px 0;font-size:14px;font-weight:600">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fbf7f1;font-family:Helvetica,Arial,sans-serif;color:#1d1a17">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbf7f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:520px;box-sizing:border-box;background:#ffffff;border:1px solid #ebe3d8;border-radius:20px;padding:24px">
<tr><td>
<p style="margin:0 0 20px;font-weight:800;font-size:16px;letter-spacing:-.2px">HOLYDJO<span style="color:#c8502a"> MARKET</span></p>
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${esc(b.heading)}</h1>
${b.lines.map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${esc(l)}</p>`).join('')}
${b.quote ? `<p style="margin:12px 0;padding:12px 14px;background:#fbf7f1;border-radius:12px;font-size:14px;font-style:italic">« ${esc(b.quote)} »</p>` : ''}
${details}
${b.cta ? `<p style="margin:20px 0 4px"><a href="${esc(b.cta.url)}" style="display:inline-block;background:#c8502a;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${esc(b.cta.label)}</a></p>` : ''}
</td></tr></table>
<p style="font-size:12px;color:#6d655d;margin:16px 0 0">Vous recevez cet email car vous avez un compte HOLYDJO MARKET.</p>
</td></tr></table></body></html>`;

  const text = [
    b.heading,
    '',
    ...b.lines,
    ...(b.quote ? ['', `« ${b.quote} »`] : []),
    ...(b.details?.length ? ['', ...b.details.map(([k, v]) => `${k} : ${v}`)] : []),
    ...(b.cta ? ['', `${b.cta.label} : ${b.cta.url}`] : []),
  ].join('\n');

  return { html, text };
}

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('fr-CA', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'America/Toronto',
  }).format(d);

export const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
