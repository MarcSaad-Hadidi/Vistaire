export type TranslationProviderName = "azure" | "mock";

export type TranslationProviderStatus = {
  configured: boolean;
  provider: TranslationProviderName | "none";
  reason?: string;
};

export type TextTranslator = {
  provider: TranslationProviderName;
  translateTexts(args: {
    texts: string[];
    fromLocale: string;
    toLocale: string;
  }): Promise<string[]>;
};

function normalizeProvider(value: string | undefined): TranslationProviderName | "none" {
  const provider = value?.trim().toLowerCase();
  if (provider === "azure") return "azure";
  if (provider === "mock") return "mock";
  return "none";
}

export function resolveTranslationProviderStatus(
  env: NodeJS.ProcessEnv = process.env
): TranslationProviderStatus {
  const provider = normalizeProvider(env.TRANSLATION_PROVIDER);
  if (provider === "none") {
    return {
      configured: false,
      provider: "none",
      reason: "TRANSLATION_PROVIDER n'est pas configure."
    };
  }
  if (provider === "mock") return { configured: true, provider };

  const missing = [
    ["AZURE_TRANSLATOR_KEY", env.AZURE_TRANSLATOR_KEY],
    ["AZURE_TRANSLATOR_ENDPOINT", env.AZURE_TRANSLATOR_ENDPOINT],
    ["AZURE_TRANSLATOR_REGION", env.AZURE_TRANSLATOR_REGION]
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    return {
      configured: false,
      provider,
      reason: `Configuration Azure Translator incomplete: ${missing.join(", ")}.`
    };
  }

  return { configured: true, provider };
}

function azureLanguage(locale: string): string {
  const normalized = locale.trim();
  if (/^zh-hans$/i.test(normalized)) return "zh-Hans";
  if (/^zh-hant$/i.test(normalized)) return "zh-Hant";
  return normalized.split("-")[0]?.toLowerCase() || normalized.toLowerCase();
}

function azureEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export function getServerTranslator(
  env: NodeJS.ProcessEnv = process.env
): TextTranslator | null {
  const status = resolveTranslationProviderStatus(env);
  if (!status.configured) return null;

  if (status.provider === "mock") {
    return {
      provider: "mock",
      async translateTexts({ texts, toLocale }) {
        return texts.map((text) => `[${toLocale}] ${text}`);
      }
    };
  }

  return {
    provider: "azure",
    async translateTexts({ texts, fromLocale, toLocale }) {
      if (texts.length === 0) return [];

      const endpoint = azureEndpoint(env.AZURE_TRANSLATOR_ENDPOINT ?? "");
      const url = new URL(`${endpoint}/translate`);
      url.searchParams.set("api-version", "3.0");
      url.searchParams.set("from", azureLanguage(fromLocale));
      url.searchParams.set("to", azureLanguage(toLocale));
      url.searchParams.set("textType", "plain");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Ocp-Apim-Subscription-Key": env.AZURE_TRANSLATOR_KEY ?? "",
          "Ocp-Apim-Subscription-Region": env.AZURE_TRANSLATOR_REGION ?? ""
        },
        body: JSON.stringify(texts.map((text) => ({ text })))
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Azure Translator a retourne ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`
        );
      }

      const payload = (await response.json()) as Array<{
        translations?: Array<{ text?: unknown }>;
      }>;
      return texts.map((text, index) => {
        const translated = payload[index]?.translations?.[0]?.text;
        return typeof translated === "string" && translated.trim()
          ? translated.trim()
          : text;
      });
    }
  };
}
