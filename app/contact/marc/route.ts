const VCARD_LINES = [
  "BEGIN:VCARD",
  "VERSION:3.0",
  "N:Saad-Hadidi;Marc;;;",
  "FN:Marc Saad-Hadidi",
  "ORG:Vistaire",
  "TITLE:Founder & CEO",
  "TEL;TYPE=CELL,VOICE:+15147152421",
  "EMAIL;TYPE=INTERNET:contact@vistaire.ca",
  "URL:https://www.vistaire.ca/en",
  "item1.URL:https://ca.linkedin.com/in/marc-saad-hadidi-403042339",
  "item1.X-ABLabel:LinkedIn",
  "END:VCARD",
] as const;

const VCARD = `${VCARD_LINES.join("\r\n")}\r\n`;

export function GET(): Response {
  return new Response(VCARD, {
    status: 200,
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": 'attachment; filename="marc-saad-hadidi.vcf"',
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
