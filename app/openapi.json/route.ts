import {
  AGENT_DISCOVERY_CACHE_CONTROL,
  buildOpenApiDocument
} from "@/lib/agent-discovery";

export const dynamic = "force-static";

export function GET() {
  return Response.json(buildOpenApiDocument(), {
    headers: {
      "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL,
      "Content-Type": "application/openapi+json; charset=utf-8"
    }
  });
}
