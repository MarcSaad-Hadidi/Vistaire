"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { CONTACT_PHONE_DISPLAY } from "@/lib/seo";
import styles from "./VistaireRendezVousPreview.module.css";

type ContactField = "name" | "email" | "restaurant" | "message";

type ContactFormValues = Record<ContactField, string>;

type ContactFormErrors = Partial<Record<ContactField, string>>;

type SubmitState = "idle" | "error" | "sending" | "success" | "serverError";

const initialValues: ContactFormValues = {
  name: "",
  email: "",
  restaurant: "",
  message: ""
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const contactEmail = "contact@vistaire.ca";

const contactCopy = {
  fr: {
    success:
      "Votre demande a bien été envoyée. Nous vous répondrons rapidement à l'adresse indiquée.",
    serverError:
      "L'envoi n'a pas fonctionné pour le moment. Vous pouvez écrire directement à contact@vistaire.ca.",
    statusError: "Veuillez corriger les champs indiqués.",
    sending: "Envoi de votre demande...",
    nameRequired: "Indiquez votre nom.",
    emailRequired: "Indiquez votre courriel.",
    emailInvalid: "Indiquez un courriel valide.",
    restaurantRequired: "Indiquez le nom du restaurant.",
    messageRequired: "Ajoutez un message.",
    messageShort: "Ajoutez quelques détails sur votre projet.",
    subject: "Rendez-vous Vistaire",
    mailGreeting: "Bonjour Vistaire,",
    mailIntro:
      "Je souhaite planifier un rendez-vous pour discuter de Vistaire.",
    name: "Nom",
    email: "Courriel",
    restaurant: "Restaurant",
    region: "Région: Montréal / Québec",
    phone: "Téléphone Vistaire",
    message: "Message",
    company: "Entreprise",
    submit: "Envoyer la demande",
    sendingButton: "Envoi en cours...",
    sentButton: "Demande envoyée",
    directContact: "Contact direct",
    note: "Votre demande est transmise directement à l'équipe Vistaire."
  },
  en: {
    success:
      "Your request has been sent. We will reply quickly at the email address provided.",
    serverError:
      "The form is not sending right now. You can write directly to contact@vistaire.ca.",
    statusError: "Please correct the highlighted fields.",
    sending: "Sending your request...",
    nameRequired: "Enter your name.",
    emailRequired: "Enter your email.",
    emailInvalid: "Enter a valid email.",
    restaurantRequired: "Enter the restaurant name.",
    messageRequired: "Add a message.",
    messageShort: "Add a few details about your project.",
    subject: "Vistaire call",
    mailGreeting: "Hello Vistaire,",
    mailIntro: "I would like to schedule a call to discuss Vistaire.",
    name: "Name",
    email: "Email",
    restaurant: "Restaurant",
    region: "Region: Montreal / Quebec",
    phone: "Vistaire phone",
    message: "Message",
    company: "Company",
    submit: "Send request",
    sendingButton: "Sending...",
    sentButton: "Request sent",
    directContact: "Direct contact",
    note: "Your request is sent directly to the Vistaire team."
  }
} as const satisfies Record<Locale, Record<string, string>>;

function normalizeValues(values: ContactFormValues): ContactFormValues {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    restaurant: values.restaurant.trim(),
    message: values.message.trim()
  };
}

function validateContactForm(
  values: ContactFormValues,
  locale: Locale
): ContactFormErrors {
  const errors: ContactFormErrors = {};
  const copy = contactCopy[locale];

  if (!values.name) {
    errors.name = copy.nameRequired;
  }

  if (!values.email) {
    errors.email = copy.emailRequired;
  } else if (!emailPattern.test(values.email)) {
    errors.email = copy.emailInvalid;
  }

  if (!values.restaurant) {
    errors.restaurant = copy.restaurantRequired;
  }

  if (!values.message) {
    errors.message = copy.messageRequired;
  } else if (values.message.length < 10) {
    errors.message = copy.messageShort;
  }

  return errors;
}

function buildMailtoHref(values: ContactFormValues, locale: Locale): string {
  const copy = contactCopy[locale];
  const subject = `${copy.subject} - ${values.restaurant}`;
  const body = [
    copy.mailGreeting,
    "",
    copy.mailIntro,
    "",
    `${copy.name}: ${values.name}`,
    `${copy.email}: ${values.email}`,
    `${copy.restaurant}: ${values.restaurant}`,
    copy.region,
    `${copy.phone}: ${CONTACT_PHONE_DISPLAY}`,
    "",
    `${copy.message}:`,
    values.message
  ].join("\n");

  return `mailto:${contactEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}

function buildSubmissionSignature(values: ContactFormValues, company: string) {
  return JSON.stringify([
    values.name,
    values.email,
    values.restaurant,
    values.message,
    company.trim()
  ]);
}

function getErrorId(field: ContactField): string {
  return `contact-${field}-error`;
}

function getFieldId(field: ContactField): string {
  return `contact-${field}`;
}

export function VistaireContactForm({ locale = "fr" }: { locale?: Locale }) {
  const copy = contactCopy[locale];
  const [values, setValues] = useState<ContactFormValues>(initialValues);
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<ContactFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [successfulSubmissionSignature, setSuccessfulSubmissionSignature] =
    useState<string | null>(null);
  const submitInFlightRef = useRef(false);
  const submittedSignatureRef = useRef<string | null>(null);

  const updateField =
    (field: ContactField) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value;

      submittedSignatureRef.current = null;
      setSuccessfulSubmissionSignature(null);
      setValues((current) => ({
        ...current,
        [field]: nextValue
      }));
      setErrors((current) => {
        if (!current[field]) return current;

        const nextErrors = { ...current };
        delete nextErrors[field];
        return nextErrors;
      });
      if (submitState !== "idle") {
        setSubmitState("idle");
      }
    };

  const submitContactRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitInFlightRef.current || submitState === "sending") return;

    const normalizedValues = normalizeValues(values);
    const trimmedCompany = company.trim();
    const submissionSignature = buildSubmissionSignature(
      normalizedValues,
      trimmedCompany
    );

    if (
      submittedSignatureRef.current === submissionSignature ||
      successfulSubmissionSignature === submissionSignature
    ) {
      return;
    }

    const nextErrors = validateContactForm(normalizedValues, locale);
    const firstInvalidField = Object.keys(nextErrors)[0] as
      | ContactField
      | undefined;

    setValues(normalizedValues);
    setErrors(nextErrors);

    if (firstInvalidField) {
      setSubmitState("error");

      const invalidElement =
        event.currentTarget.elements.namedItem(firstInvalidField);
      if (invalidElement instanceof HTMLElement) {
        invalidElement.focus();
      }

      return;
    }

    submitInFlightRef.current = true;
    setSubmitState("sending");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...normalizedValues,
          company: trimmedCompany,
          locale
        })
      });
      const result = (await response
        .json()
        .catch(() => null)) as { ok?: boolean } | null;

      if (!response.ok || !result?.ok) {
        throw new Error("Contact request failed");
      }

      submittedSignatureRef.current = submissionSignature;
      setSuccessfulSubmissionSignature(submissionSignature);
      setSubmitState("success");
    } catch {
      setSubmitState("serverError");
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const statusMessages: Record<SubmitState, string> = {
    idle: "",
    error: copy.statusError,
    sending: copy.sending,
    success: copy.success,
    serverError: copy.serverError
  };
  const statusMessage = statusMessages[submitState];
  const fallbackHref = buildMailtoHref(normalizeValues(values), locale);
  const isSending = submitState === "sending";
  const isSuccessLocked =
    submitState === "success" &&
    successfulSubmissionSignature ===
      buildSubmissionSignature(normalizeValues(values), company);

  return (
    <form
      aria-busy={isSending}
      className={styles.contactForm}
      noValidate
      onSubmit={submitContactRequest}
    >
      <div className={styles.formField}>
        <label className={styles.srOnly} htmlFor={getFieldId("name")}>
          {copy.name}
        </label>
        <input
          aria-describedby={errors.name ? getErrorId("name") : undefined}
          aria-invalid={errors.name ? "true" : undefined}
          autoComplete="name"
          id={getFieldId("name")}
          name="name"
          onChange={updateField("name")}
          placeholder={copy.name}
          required
          type="text"
          value={values.name}
        />
        {errors.name ? (
          <p className={styles.fieldError} id={getErrorId("name")}>
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className={styles.formField}>
        <label className={styles.srOnly} htmlFor={getFieldId("email")}>
          {copy.email}
        </label>
        <input
          aria-describedby={errors.email ? getErrorId("email") : undefined}
          aria-invalid={errors.email ? "true" : undefined}
          autoComplete="email"
          id={getFieldId("email")}
          name="email"
          onChange={updateField("email")}
          placeholder={copy.email}
          required
          type="email"
          value={values.email}
        />
        {errors.email ? (
          <p className={styles.fieldError} id={getErrorId("email")}>
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className={styles.formField}>
        <label className={styles.srOnly} htmlFor={getFieldId("restaurant")}>
          {copy.restaurant}
        </label>
        <input
          aria-describedby={
            errors.restaurant ? getErrorId("restaurant") : undefined
          }
          aria-invalid={errors.restaurant ? "true" : undefined}
          autoComplete="organization"
          id={getFieldId("restaurant")}
          name="restaurant"
          onChange={updateField("restaurant")}
          placeholder={copy.restaurant}
          required
          type="text"
          value={values.restaurant}
        />
        {errors.restaurant ? (
          <p className={styles.fieldError} id={getErrorId("restaurant")}>
            {errors.restaurant}
          </p>
        ) : null}
      </div>

      <div className={styles.formField}>
        <label className={styles.srOnly} htmlFor={getFieldId("message")}>
          {copy.message}
        </label>
        <textarea
          aria-describedby={errors.message ? getErrorId("message") : undefined}
          aria-invalid={errors.message ? "true" : undefined}
          id={getFieldId("message")}
          name="message"
          onChange={updateField("message")}
          placeholder={copy.message}
          required
          rows={4}
          value={values.message}
        />
        {errors.message ? (
          <p className={styles.fieldError} id={getErrorId("message")}>
            {errors.message}
          </p>
        ) : null}
      </div>

      <div aria-hidden="true" className={styles.honeypot}>
        <label htmlFor="contact-company">{copy.company}</label>
        <input
          autoComplete="off"
          id="contact-company"
          name="company"
          onChange={(event) => {
            submittedSignatureRef.current = null;
            setSuccessfulSubmissionSignature(null);
            setCompany(event.target.value);
            if (submitState !== "idle") {
              setSubmitState("idle");
            }
          }}
          tabIndex={-1}
          type="text"
          value={company}
        />
      </div>

      <button
        className={styles.submitButton}
        disabled={isSending || isSuccessLocked}
        type="submit"
      >
        {isSending
          ? copy.sendingButton
          : isSuccessLocked
            ? copy.sentButton
            : copy.submit}
      </button>

      <p
        className={styles.formStatus}
        aria-live="polite"
        role={
          submitState === "error" || submitState === "serverError"
            ? "alert"
            : "status"
        }
      >
        {statusMessage}
      </p>
      <p className={styles.formNote}>
        {submitState === "serverError" ? (
          <>
            {copy.directContact} : <a href={fallbackHref}>{contactEmail}</a>.
          </>
        ) : (
          copy.note
        )}
      </p>
    </form>
  );
}
