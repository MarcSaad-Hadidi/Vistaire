import {
  AGENT_DISCOVERY_CACHE_CONTROL,
  MARKDOWN_CONTENT_TYPE,
  buildAuthMarkdown,
  markdownTokenEstimate
} from "@/lib/agent-discovery";

export const dynamic = "force-static";

export function GET() {
  const markdown = buildAuthMarkdown();

  return new Response(markdown, {
    headers: {
      "Cache-Control": AGENT_DISCOVERY_CACHE_CONTROL,
      "Content-Type": MARKDOWN_CONTENT_TYPE,
      "x-markdown-tokens": markdownTokenEstimate(markdown)
    }
  });
}
