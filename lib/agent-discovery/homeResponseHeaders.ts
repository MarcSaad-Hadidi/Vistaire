export const HOME_AGENT_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</.well-known/agent-skills/index.json>; rel="service-desc"; type="application/json"',
  '</.well-known/mcp/server-card.json>; rel="service-desc"; type="application/json"',
  '</auth.md>; rel="service-doc"; type="text/markdown"',
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"'
].join(", ");

export function buildHomeAgentLinkHeader(): string {
  return HOME_AGENT_LINK_HEADER;
}
