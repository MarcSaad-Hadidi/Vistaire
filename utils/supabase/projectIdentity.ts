type SupabaseProjectIdentityInput = {
  supabaseUrl: string;
  expectedProjectRef?: string;
};

export type SupabaseProjectIdentityResult =
  | { ok: true; projectRef: string }
  | { ok: false; reason: string };

export function validateSupabaseProjectIdentity(
  input: SupabaseProjectIdentityInput
): SupabaseProjectIdentityResult {
  let projectRef = "";
  try {
    const hostname = new URL(input.supabaseUrl).hostname.toLowerCase();
    projectRef = hostname.endsWith(".supabase.co")
      ? hostname.slice(0, -".supabase.co".length)
      : hostname;
  } catch {
    // Return the same safe configuration error below.
  }

  if (!projectRef) {
    return { ok: false, reason: "Supabase project URL is invalid." };
  }
  const expectedProjectRef = input.expectedProjectRef?.trim().toLowerCase();
  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    return {
      ok: false,
      reason: "Supabase project does not match the expected deployment project."
    };
  }
  return { ok: true, projectRef };
}
