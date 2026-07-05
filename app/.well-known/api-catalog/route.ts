import {
  AGENT_DISCOVERY_CACHE_CONTROL,
  LINKSET_CONTENT_TYPE,
  buildApiCatalog,
  buildHomeAgentLinkHeader
} from "@/lib/agent-discovery";

export const dynamic = "force-static";

export function GET() {
  return Response.json(buildApiCatalog(), {
    headers: {
      "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL,
      "Content-Type": LINKSET_CONTENT_TYPE,
      Link: buildHomeAgentLinkHeader()
    }
  });
}

export function HEAD() {
  return new Response(null, {
    headers: {
      "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL,
      "Content-Type": LINKSET_CONTENT_TYPE,
      Link: buildHomeAgentLinkHeader()
    }
  });
}
