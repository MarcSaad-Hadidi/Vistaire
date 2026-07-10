const MAX_QR_ACCESS_INPUT_LENGTH = 2_048;
const MAX_QR_TOKEN_LENGTH = 800;
const QR_TOKEN_PATTERN = /^[A-Za-z0-9._~-]+$/;

function decodeCanonicalToken(value: string): string | null {
  let token: string;
  try {
    token = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (
    token.length === 0 ||
    token.length > MAX_QR_TOKEN_LENGTH ||
    !QR_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }
  return token;
}

export function extractAdminQrToken(
  input: string,
  requestOrigin: string
): string | null {
  const value = input.trim();
  if (!value || value.length > MAX_QR_ACCESS_INPUT_LENGTH) return null;

  const looksLikePath = value.startsWith("/");
  const looksLikeUrl = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value);
  if (!looksLikePath && !looksLikeUrl) return decodeCanonicalToken(value);

  let url: URL;
  try {
    url = new URL(value, requestOrigin);
  } catch {
    return null;
  }
  if (url.origin !== requestOrigin || url.search || url.hash) return null;
  if (!url.pathname.startsWith("/q/")) return null;

  const encodedToken = url.pathname.slice(3);
  if (!encodedToken || encodedToken.includes("/")) return null;
  return decodeCanonicalToken(encodedToken);
}
