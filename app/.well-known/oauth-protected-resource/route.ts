import {
  AGENT_DISCOVERY_CACHE_CONTROL,
  buildOauthProtectedResourceMetadata
} from "@/lib/agent-discovery";

export const dynamic = "force-static";

export function GET() {
  return Response.json(buildOauthProtectedResourceMetadata(), {
    headers: {
      "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
