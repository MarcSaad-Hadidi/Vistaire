"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
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
const successMessage =
  "Votre demande a bien \u00e9t\u00e9 envoy\u00e9e. Nous vous r\u00e9pondrons rapidement \u00e0 l'adresse indiqu\u00e9e.";
const serverErrorMessage =
  "L'envoi n'a pas fonctionn\u00e9 pour le moment. Vous pouvez \u00e9crire directement \u00e0 contact@vistaire.ca.";

function normalizeValues(values: ContactFormValues): ContactFormValues {
  return {
    name: values.name.trim(),
    email: values.email.trim(),
    restaurant: values.restaurant.trim(),
    message: values.message.trim()
  };
}

function validateContactForm(values: ContactFormValues): ContactFormErrors {
  const errors: ContactFormErrors = {};

  if (!values.name) {
    errors.name = "Indiquez votre nom.";
  }

  if (!values.email) {
    errors.email = "Indiquez votre courriel.";
  } else if (!emailPattern.test(values.email)) {
    errors.email = "Indiquez un courriel valide.";
  }

  if (!values.restaurant) {
    errors.restaurant = "Indiquez le nom du restaurant.";
  }

  if (!values.message) {
    errors.message = "Ajoutez un message.";
  } else if (values.message.length < 10) {
    errors.message = "Ajoutez quelques détails sur votre projet.";
  }

  return errors;
}

function buildMailtoHref(values: ContactFormValues): string {
  const subject = `Rendez-vous Vistaire - ${values.restaurant}`;
  const body = [
    "Bonjour Vistaire,",
    "",
    "Je souhaite planifier un rendez-vous pour discuter de Vistaire.",
    "",
    `Nom: ${values.name}`,
    `Courriel: ${values.email}`,
    `Restaurant: ${values.restaurant}`,
    "Région: Montréal / Québec",
    `Téléphone Vistaire: ${CONTACT_PHONE_DISPLAY}`,
    "",
    "Message:",
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

export function VistaireContactForm() {
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

    const nextErrors = validateContactForm(normalizedValues);
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
          company: trimmedCompany
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
    error: "Veuillez corriger les champs indiqués.",
    sending: "Envoi de votre demande...",
    success: successMessage,
    serverError: serverErrorMessage
  };
  const statusMessage = statusMessages[submitState];
  const fallbackHref = buildMailtoHref(normalizeValues(values));
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
          Nom
        </label>
        <input
          aria-describedby={errors.name ? getErrorId("name") : undefined}
          aria-invalid={errors.name ? "true" : undefined}
          autoComplete="name"
          id={getFieldId("name")}
          name="name"
          onChange={updateField("name")}
          placeholder="Nom"
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
          Courriel
        </label>
        <input
          aria-describedby={errors.email ? getErrorId("email") : undefined}
          aria-invalid={errors.email ? "true" : undefined}
          autoComplete="email"
          id={getFieldId("email")}
          name="email"
          onChange={updateField("email")}
          placeholder="Courriel"
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
          Restaurant
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
          placeholder="Restaurant"
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
          Message
        </label>
        <textarea
          aria-describedby={errors.message ? getErrorId("message") : undefined}
          aria-invalid={errors.message ? "true" : undefined}
          id={getFieldId("message")}
          name="message"
          onChange={updateField("message")}
          placeholder="Message"
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
        <label htmlFor="contact-company">Entreprise</label>
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
          ? "Envoi en cours..."
          : isSuccessLocked
            ? "Demande envoy\u00e9e"
            : "Envoyer la demande"}
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
            Contact direct : <a href={fallbackHref}>{contactEmail}</a>.
          </>
        ) : (
          "Votre demande est transmise directement \u00e0 l'\u00e9quipe Vistaire."
        )}
      </p>
    </form>
  );
}
