import {
  AGENT_DISCOVERY_CACHE_CONTROL,
  MARKDOWN_CONTENT_TYPE,
  findAgentSkill
} from "@/lib/agent-discovery";

export const dynamic = "force-static";

export function GET() {
  const skill = findAgentSkill("/.well-known/agent-skills/public-menu/SKILL.md");

  return new Response(skill?.content ?? "", {
    headers: {
      "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL,
      "Content-Type": MARKDOWN_CONTENT_TYPE
    }
  });
}
