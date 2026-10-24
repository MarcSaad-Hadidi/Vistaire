import { useState, type FormEvent } from "react";
import styles from "./VistaireRendezVousPreview.module.css";
type Field = "name" | "email" | "restaurant" | "message";
type Values = Record<Field, string>;
export function VistaireContactForm({
  locale = "fr",
}: {
  locale?: "fr" | "en";
}) {
  const english = locale === "en";
  const [values, setValues] = useState<Values>({
    name: "",
    email: "",
    restaurant: "",
    message: "",
  });
  const [errors, setErrors] = useState<Partial<Values>>({});
  const [prepared, setPrepared] = useState(false);
  const labels: Values = english
    ? {
        name: "Name",
        email: "Email",
        restaurant: "Restaurant",
        message: "Message",
      }
    : {
        name: "Nom",
        email: "Courriel",
        restaurant: "Restaurant",
        message: "Message",
      };
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim()]),
  ) as Values;
  const mailto = `mailto:contact@vistaire.ca?subject=${encodeURIComponent(`${english ? "Vistaire call" : "Rendez-vous Vistaire"} — ${normalized.restaurant}`)}&body=${encodeURIComponent(`${english ? "Hello Vistaire," : "Bonjour Vistaire,"}\n\n${labels.name}: ${normalized.name}\n${labels.email}: ${normalized.email}\n${labels.restaurant}: ${normalized.restaurant}\n\n${normalized.message}`)}`;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Partial<Values> = {};
    for (const field of ["name", "email", "restaurant", "message"] as Field[])
      if (!normalized[field])
        next[field] = english
          ? `Enter ${labels[field].toLowerCase()}.`
          : `Indiquez ${labels[field].toLowerCase()}.`;
    if (
      normalized.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)
    )
      next.email = english
        ? "Enter a valid email."
        : "Indiquez un courriel valide.";
    if (normalized.message && normalized.message.length < 10)
      next.message = english
        ? "Add a few details about your project."
        : "Ajoutez quelques détails sur votre projet.";
    setErrors(next);
    setValues(normalized);
    setPrepared(!Object.keys(next).length);
    const invalid = Object.keys(next)[0];
    if (invalid)
      (event.currentTarget.elements.namedItem(invalid) as HTMLElement)?.focus();
  };
  return (
    <form className={styles.contactForm} noValidate onSubmit={submit}>
      {(["name", "email", "restaurant", "message"] as Field[]).map((field) => (
        <div className={styles.formField} key={field}>
          <label htmlFor={`contact-${field}`}>{labels[field]}</label>
          {field === "message" ? (
            <textarea
              id={`contact-${field}`}
              name={field}
              required
              rows={4}
              value={values[field]}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={
                errors[field] ? `contact-${field}-error` : undefined
              }
              onChange={(event) => {
                setValues({ ...values, [field]: event.target.value });
                setPrepared(false);
              }}
            />
          ) : (
            <input
              id={`contact-${field}`}
              name={field}
              type={field === "email" ? "email" : "text"}
              autoComplete={
                field === "name"
                  ? "name"
                  : field === "email"
                    ? "email"
                    : "organization"
              }
              required
              value={values[field]}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={
                errors[field] ? `contact-${field}-error` : undefined
              }
              onChange={(event) => {
                setValues({ ...values, [field]: event.target.value });
                setPrepared(false);
              }}
            />
          )}
          {errors[field] && (
            <p id={`contact-${field}-error`} className={styles.fieldError}>
              {errors[field]}
            </p>
          )}
        </div>
      ))}
      <button type="submit" className={styles.submitButton}>
        {english ? "Prepare my request" : "Préparer ma demande"} ↗
      </button>
      <p
        className={styles.formStatus}
        role={Object.keys(errors).length ? "alert" : "status"}
      >
        {prepared
          ? english
            ? "Your email is ready. Open your email app to send it; no request has been sent yet."
            : "Votre courriel est prêt. Ouvrez votre messagerie pour l’envoyer ; aucune demande n’a encore été transmise."
          : Object.keys(errors).length
            ? english
              ? "Please correct the highlighted fields."
              : "Veuillez corriger les champs indiqués."
            : ""}
      </p>
      {prepared && (
        <a className={styles.submitButton} href={mailto}>
          {english ? "Open the prepared email" : "Ouvrir le courriel préparé"} ↗
        </a>
      )}
      <p className={styles.formNote}>
        {english
          ? "This preview prepares an email. You can also use the official form."
          : "Cet aperçu prépare un courriel. Vous pouvez aussi utiliser le formulaire officiel."}{" "}
        <a
          href={`https://www.vistaire.ca${english ? "/en/book-a-call" : "/prendre-rendez-vous"}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {english ? "Official form" : "Formulaire officiel"} ↗
        </a>
      </p>
    </form>
  );
}
