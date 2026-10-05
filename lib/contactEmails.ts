export const CONTACT_EMAIL = "contact@vistaire.ca";

export type ContactEmailData = {
  name: string;
  email: string;
  restaurant: string;
  message: string;
  locale: "fr" | "en";
};

const INK = "#111211";
const PANEL = "#1a1c19";
const CREAM = "#fff7ea";
const CHAMPAGNE = "#e8cf9b";
const MUTED = "#cbbb9f";
const BORDER = "#3f4038";
const BODY_FONT = "Arial, Helvetica, sans-serif";
const DISPLAY_FONT = "Georgia, 'Times New Roman', serif";
const WRAP = "overflow-wrap:anywhere;word-wrap:break-word;word-break:break-word;";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    };
    return entities[character];
  });
}

function content(value: string) {
  // Explicit break opportunities also protect table widths in older email clients.
  return value.split(/(\s+)/).map((part) => {
    if (/^\s+$/.test(part)) return escapeHtml(part);
    const characters = Array.from(part);
    const chunks = [];
    for (let index = 0; index < characters.length; index += 28) {
      chunks.push(escapeHtml(characters.slice(index, index + 28).join("")));
    }
    return chunks.join("&#8203;");
  }).join("").replace(/\r\n|\r|\n/g, "<br>");
}

function subject(value: string) {
  return value.replace(/[\r\n\u0000-\u001f\u007f\u2028\u2029]+/g, " ").trim();
}

function mailto(email: string) {
  return escapeHtml(`mailto:${encodeURIComponent(email).replace(/%40/g, "@")}`);
}

function eyebrow(label: string) {
  return `<p class="email-champagne" style="margin:0 0 12px;color:${CHAMPAGNE};font-family:${BODY_FONT};font-size:12px;line-height:18px;font-weight:bold;letter-spacing:1.5px;">${escapeHtml(label)}</p>`;
}

function paragraph(html: string, margin = "0 0 18px") {
  return `<p class="email-cream" style="margin:${margin};color:${CREAM};font-family:${BODY_FONT};font-size:16px;line-height:26px;${WRAP}">${html}</p>`;
}

function button(label: string, email: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;max-width:100%;"><tr><td class="email-button" bgcolor="${CHAMPAGNE}" style="color:${INK};background-color:${CHAMPAGNE};border:1px solid ${CHAMPAGNE};border-radius:24px;mso-padding-alt:14px 24px;text-align:center;"><a href="${mailto(email)}" style="display:inline-block;padding:14px 24px;color:${INK};font-family:${BODY_FONT};font-size:14px;line-height:20px;font-weight:bold;text-decoration:none;">${escapeHtml(label)}</a></td></tr></table>`;
}

function messageBlock(label: string, message: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-panel" bgcolor="${PANEL}" style="width:100%;table-layout:fixed;background-color:${PANEL};border:1px solid ${BORDER};border-collapse:separate;border-radius:12px;"><tr><td class="email-panel" bgcolor="${PANEL}" style="background-color:${PANEL};color:${CREAM};padding:24px;${WRAP}">${eyebrow(label)}${paragraph(content(message), "0")}</td></tr></table>`;
}

function shell(locale: "fr" | "en", preview: string, title: string, body: string) {
  const english = locale === "en";
  // Both OS modes use the dark inline palette; the declared schemes enable our explicit dark overrides.
  return `<!DOCTYPE html>
<html lang="${locale === "en" ? "en-CA" : "fr-CA"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escapeHtml(title)}</title>
<style>:root{color-scheme:light dark;supported-color-schemes:light dark;}body{margin:0;padding:0;}table{mso-table-lspace:0pt;mso-table-rspace:0pt;}a{color:${CHAMPAGNE};} @media screen and (min-width:600px){.email-pad{padding-left:44px!important;padding-right:44px!important;}}@media (prefers-color-scheme:dark){.email-ink{background-color:${INK}!important;color:${CREAM}!important;}.email-panel{background-color:${PANEL}!important;color:${CREAM}!important;}.email-button{background-color:${CHAMPAGNE}!important;color:${INK}!important;}.email-cream{color:${CREAM}!important;}.email-champagne{color:${CHAMPAGNE}!important;}.email-muted{color:${MUTED}!important;}.email-button a{color:${INK}!important;}}
</style></head>
<body class="email-ink" bgcolor="${INK}" style="margin:0;padding:0;width:100%;background-color:${INK};color:${CREAM};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;color:${INK};max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-ink" bgcolor="${INK}" style="width:100%;background-color:${INK};border-collapse:collapse;"><tr><td class="email-ink" bgcolor="${INK}" align="center" style="background-color:${INK};color:${CREAM};padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td class="email-ink" bgcolor="${INK}" style="background-color:${INK};color:${CREAM};"><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-ink" bgcolor="${INK}" style="width:100%;max-width:600px;table-layout:fixed;background-color:${INK};border:1px solid ${BORDER};border-collapse:separate;border-spacing:0;border-radius:18px;">
<tr><td bgcolor="${INK}" class="email-ink email-pad" background="https://www.vistaire.ca/images/email/vistaire-dining-header.jpg" style="background-color:${INK};color:${CREAM};padding:24px;border-bottom:1px solid ${BORDER};background-image:url('https://www.vistaire.ca/images/email/vistaire-dining-header.jpg');background-size:cover;background-position:center;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;max-width:100%;"><tr><td class="email-ink" bgcolor="${INK}" style="background-color:${INK};color:${CREAM};padding:14px 18px;"><a class="email-champagne" href="https://www.vistaire.ca${english ? "/en" : "/"}" style="color:${CHAMPAGNE};font-family:${DISPLAY_FONT};font-size:36px;line-height:40px;letter-spacing:-1px;text-decoration:none;">Vistaire</a><p class="email-cream" style="margin:7px 0 0;color:${CREAM};font-family:${BODY_FONT};font-size:12px;line-height:18px;">${english ? "Premium digital menus" : "Carte digitale premium"}</p></td></tr></table></td></tr>
<tr><td bgcolor="${INK}" class="email-ink email-pad" style="background-color:${INK};color:${CREAM};padding:36px 24px 40px;${WRAP}">${body}</td></tr>
<tr><td bgcolor="${INK}" class="email-ink email-pad" style="background-color:${INK};color:${CREAM};padding:28px 24px 32px;border-top:1px solid ${BORDER};"><p class="email-champagne" style="margin:0 0 14px;color:${CHAMPAGNE};font-family:${DISPLAY_FONT};font-size:22px;line-height:29px;">${english ? "Make them crave the first bite." : "Donnez envie avant la première bouchée."}</p><p class="email-muted" style="margin:0;color:${MUTED};font-family:${BODY_FONT};font-size:13px;line-height:22px;">${english ? "Montreal, Quebec" : "Montréal, Québec"}<br><a class="email-cream" href="mailto:${CONTACT_EMAIL}" style="color:${CREAM};text-decoration:underline;">${CONTACT_EMAIL}</a></p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

export function renderContactEmails(data: ContactEmailData, submittedAt: string) {
  const english = data.locale === "en";
  const sourcePath = english ? "/en/book-a-call" : "/prendre-rendez-vous";
  const date = new Date(submittedAt);
  const submittedLabel = Number.isNaN(date.getTime())
    ? submittedAt
    : `${date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "")} UTC`;
  const internalSubject = subject(`Nouvelle demande Vistaire — ${data.restaurant}`);
  const confirmationSubject = english
    ? "Vistaire — We received your request"
    : "Vistaire — Votre demande a bien été reçue";

  const internalBody = `${eyebrow("NOUVELLE DEMANDE")}
<h1 class="email-cream" style="margin:0 0 24px;color:${CREAM};font-family:${DISPLAY_FONT};font-size:34px;line-height:41px;font-weight:normal;${WRAP}">${content(data.restaurant)}</h1>
${eyebrow("VOTRE INTERLOCUTEUR")}
${paragraph(`<strong>${content(data.name)}</strong><br><a class="email-champagne" href="${mailto(data.email)}" style="color:${CHAMPAGNE};text-decoration:underline;${WRAP}">${content(data.email)}</a>`, "0 0 28px")}
${messageBlock("SON MESSAGE", data.message)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;"><tr><td class="email-ink" bgcolor="${INK}" style="background-color:${INK};color:${CREAM};padding:28px 0;">${button("Répondre au restaurateur", data.email)}</td></tr></table>
<p class="email-muted email-rule" style="margin:0;padding-top:22px;border-top:1px solid ${BORDER};color:${MUTED};font-family:${BODY_FONT};font-size:13px;line-height:22px;${WRAP}">Langue de la demande : <strong class="email-cream" style="color:${CREAM};">${english ? "EN" : "FR"}</strong><br>Source : ${escapeHtml(sourcePath)}<br>Envoyé le : ${content(submittedLabel)}</p>`;

  const confirmationBody = `${eyebrow(english ? "REQUEST RECEIVED" : "DEMANDE BIEN REÇUE")}
<h1 class="email-cream" style="margin:0 0 24px;color:${CREAM};font-family:${DISPLAY_FONT};font-size:34px;line-height:41px;font-weight:normal;">${english ? "A conversation.<br>A menu that feels like you." : "Un échange.<br>Une carte à votre image."}</h1>
${paragraph(`${english ? "Hello" : "Bonjour"} ${content(data.name)},`)}
${paragraph(english ? `Thank you for telling us about <strong>${content(data.restaurant)}</strong>. We have received your request.` : `Merci de nous avoir parlé de <strong>${content(data.restaurant)}</strong>. Nous avons bien reçu votre demande.`)}
${paragraph(english ? "Our team will get back to you to discuss your menu, the experience you want to offer and arrange a call." : "Notre équipe reviendra vers vous pour parler de votre carte, de l’expérience que vous souhaitez offrir et convenir d’un échange.", "0 0 32px")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;table-layout:fixed;border-collapse:collapse;"><tr><td class="email-ink" bgcolor="${INK}" style="background-color:${INK};color:${CREAM};padding:24px 0 20px;border-top:1px solid ${BORDER};${WRAP}">${eyebrow(english ? "YOUR RESTAURANT" : "VOTRE RESTAURANT")}<h2 class="email-cream" style="margin:0 0 8px;color:${CREAM};font-family:${DISPLAY_FONT};font-size:25px;line-height:32px;font-weight:normal;${WRAP}">${content(data.restaurant)}</h2><p class="email-muted" style="margin:0;color:${MUTED};font-family:${BODY_FONT};font-size:14px;line-height:22px;${WRAP}">${content(data.email)}</p></td></tr></table>
${messageBlock(english ? "YOUR MESSAGE" : "VOTRE MESSAGE", data.message)}
${paragraph(english ? "A detail to add before we speak? Write to us directly." : "Un détail à ajouter avant notre échange ? Écrivez-nous directement.", "28px 0 18px")}
${button(english ? "Contact Vistaire" : "Écrire à Vistaire", CONTACT_EMAIL)}
<p class="email-muted" style="margin:24px 0 0;color:${MUTED};font-family:${BODY_FONT};font-size:13px;line-height:22px;">${english ? "The Vistaire team" : "L’équipe Vistaire"}</p>`;

  return {
    internal: {
      subject: internalSubject,
      html: shell("fr", `Une nouvelle demande pour ${data.restaurant}.`, internalSubject, internalBody),
      text: ["VISTAIRE · Carte digitale premium", "", "NOUVELLE DEMANDE", data.restaurant, "", `Nom : ${data.name}`, `Courriel : ${data.email}`, "", "Message :", data.message, "", `Répondre : ${data.email}`, `Langue de la demande : ${english ? "EN" : "FR"}`, `Source : ${sourcePath}`, `Envoyé le : ${submittedAt}`, "", CONTACT_EMAIL].join("\n")
    },
    confirmation: {
      subject: confirmationSubject,
      html: shell(data.locale, english ? `Your request for ${data.restaurant} has been received.` : `Votre demande pour ${data.restaurant} a bien été reçue.`, confirmationSubject, confirmationBody),
      text: english
        ? ["VISTAIRE · Premium digital menus", "", "REQUEST RECEIVED", "A conversation. A menu that feels like you.", "", `Hello ${data.name},`, "", `Thank you for telling us about ${data.restaurant}. We have received your request.`, "Our team will get back to you to discuss your menu, the experience you want to offer and arrange a call.", "", "YOUR RESTAURANT", data.restaurant, data.email, "", "YOUR MESSAGE", data.message, "", "A detail to add before we speak? Write to us directly.", CONTACT_EMAIL, "", "The Vistaire team", "Montreal, Quebec"].join("\n")
        : ["VISTAIRE · Carte digitale premium", "", "DEMANDE BIEN REÇUE", "Un échange. Une carte à votre image.", "", `Bonjour ${data.name},`, "", `Merci de nous avoir parlé de ${data.restaurant}. Nous avons bien reçu votre demande.`, "Notre équipe reviendra vers vous pour parler de votre carte, de l’expérience que vous souhaitez offrir et convenir d’un échange.", "", "VOTRE RESTAURANT", data.restaurant, data.email, "", "VOTRE MESSAGE", data.message, "", "Un détail à ajouter avant notre échange ? Écrivez-nous directement.", CONTACT_EMAIL, "", "L’équipe Vistaire", "Montréal, Québec"].join("\n")
    }
  };
}

// Incoming messages have no verified locale or restaurant details.
export function renderInboundAcknowledgement(): { html: string; text: string } {
  const body = `${eyebrow("MESSAGE BIEN REÇU")}
<h1 class="email-cream" style="margin:0 0 24px;color:${CREAM};font-family:${DISPLAY_FONT};font-size:34px;line-height:41px;font-weight:normal;">Merci de nous avoir écrit.</h1>
${paragraph("Nous avons bien reçu votre message. Notre équipe vous répondra directement dans cette conversation.")}
<div class="email-rule" lang="en-CA" style="padding-top:24px;border-top:1px solid ${BORDER};">
${eyebrow("MESSAGE RECEIVED")}
${paragraph("Thank you for writing to us.")}
${paragraph("We have received your message. Our team will reply directly in this conversation.", "0 0 24px")}</div>
${button("Écrire à Vistaire / Contact Vistaire", CONTACT_EMAIL)}`;
  return {
    html: shell("fr", "Nous avons bien reçu votre message. / We have received your message.", "Vistaire — Message reçu / Message received", body),
    text: ["VISTAIRE", "", "Merci de nous avoir écrit. Nous avons bien reçu votre message. Notre équipe vous répondra directement dans cette conversation.", "", "Thank you for writing to us. We have received your message. Our team will reply directly in this conversation.", "", CONTACT_EMAIL].join("\n")
  };
}
