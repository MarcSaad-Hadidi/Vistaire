import { buildLlmsFullText } from "@/lib/agent-discovery/pageMarkdown";
import { AGENT_DISCOVERY_CACHE_CONTROL, MARKDOWN_CONTENT_TYPE } from "@/lib/agent-discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsFullText(), {
    headers: { "Content-Type": MARKDOWN_CONTENT_TYPE, "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL },
  });
}
