"use client";

import { useEffect } from "react";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE_DISPLAY,
  DEFAULT_SITE_DESCRIPTION
} from "@/lib/seo";

type WebMcpTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input?: unknown) => unknown;
};

type ModelContext = {
  registerTool?: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal }
  ) => void | Promise<void>;
  provideContext?: (
    context: Record<string, unknown>,
    options?: { signal?: AbortSignal }
  ) => void | Promise<void>;
};

function getModelContext(): ModelContext | null {
  const candidate = (navigator as Navigator & { modelContext?: unknown }).modelContext;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as ModelContext;
}

function publicUrl(path: string) {
  return new URL(path, window.location.origin).toString();
}

function safeTools(): WebMcpTool[] {
  return [
    {
      name: "get_site_summary",
      description: "Return a concise public summary of Vistaire.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => ({
        name: "Vistaire",
        description: DEFAULT_SITE_DESCRIPTION,
        links: {
          homepage: publicUrl("/"),
          demo: publicUrl("/demo"),
          contact: publicUrl("/prendre-rendez-vous")
        }
      })
    },
    {
      name: "get_public_menu_links",
      description: "Return safe public menu and demo links.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => ({
        links: [
          { label: "Menu demo", url: publicUrl("/demo") },
          { label: "Menu digital restaurant", url: publicUrl("/menu-digital-restaurant") },
          { label: "Menu QR code restaurant", url: publicUrl("/menu-qr-code-restaurant") },
          { label: "Menu 3D AR restaurant", url: publicUrl("/menu-3d-ar-restaurant") }
        ]
      })
    },
    {
      name: "get_contact_options",
      description: "Return public Vistaire contact options without submitting forms.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => ({
        email: CONTACT_EMAIL,
        phone: CONTACT_PHONE_DISPLAY,
        bookingUrl: publicUrl("/prendre-rendez-vous")
      })
    },
    {
      name: "get_pricing_summary",
      description: "Return public pricing page links for Vistaire.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute: () => ({
        summary:
          "Vistaire publishes pricing context on its public pricing pages; exact commercial terms should be confirmed with Vistaire.",
        links: [
          { label: "Tarifs", url: publicUrl("/tarifs-menu-digital-restaurant") },
          { label: "Pricing", url: publicUrl("/en/pricing-digital-restaurant-menu") }
        ]
      })
    },
    {
      name: "open_booking_cta",
      description: "Return or open the public booking page when explicitly requested.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          open: {
            type: "boolean",
            description: "Set true only when the user explicitly wants to open the page."
          }
        }
      },
      execute: (input?: unknown) => {
        const bookingUrl = publicUrl("/prendre-rendez-vous");
        const shouldOpen =
          input &&
          typeof input === "object" &&
          !Array.isArray(input) &&
          (input as { open?: unknown }).open === true;

        if (shouldOpen) window.location.assign(bookingUrl);
        return { bookingUrl, opened: shouldOpen };
      }
    }
  ];
}

export function WebMcpProvider() {
  useEffect(() => {
    const modelContext = getModelContext();
    if (!modelContext) return;

    const abortController = new AbortController();

    if (typeof modelContext.provideContext === "function") {
      void modelContext.provideContext(
        {
          site: "Vistaire",
          description: DEFAULT_SITE_DESCRIPTION,
          discovery: {
            apiCatalog: publicUrl("/.well-known/api-catalog"),
            auth: publicUrl("/auth.md"),
            agentSkills: publicUrl("/.well-known/agent-skills/index.json")
          }
        },
        { signal: abortController.signal }
      );
    }

    if (typeof modelContext.registerTool === "function") {
      for (const tool of safeTools()) {
        void modelContext.registerTool(tool, { signal: abortController.signal });
      }
    }

    return () => abortController.abort();
  }, []);

  return null;
}
