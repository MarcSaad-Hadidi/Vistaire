# DNS-AID publication checklist

Manual DNS action required: Vistaire cannot publish DNS-AID records from this repository. A DNS operator must create and validate the records in the authoritative DNS zone for `www.vistaire.ca`, which is the canonical public origin currently defined by `lib/seo.ts`.

## Target domain

- Canonical origin: `https://www.vistaire.ca`
- DNS-AID namespaces checked by the scanner: `_agents.www.vistaire.ca` and `_agents.vistaire.ca`
- HTTP discovery endpoint: `https://www.vistaire.ca/.well-known/agent-skills/index.json`
- Auth guidance endpoint: `https://www.vistaire.ca/auth.md`

## Proposed records

The DNS-AID draft is still experimental. Use RFC 9460 ServiceMode records, not AliasMode. The HTTPS RR is an SVCB-compatible record for HTTPS origins. Use numeric `keyNNNNN` SvcParamKey names for unregistered custom parameters until the draft allocates stable keys. The endpoint/path parameter is therefore documented below as an operator decision, not as a made-up stable registry value.

```dns
; Proposed only. Not published by this repository.
_index._agents.vistaire.ca. 3600 IN HTTPS 1 www.vistaire.ca. alpn="h2,http/1.1" port=443 mandatory=alpn,port
_index._agents.vistaire.ca. 3600 IN SVCB 1 www.vistaire.ca. alpn="h2,http/1.1" port=443 mandatory=alpn,port
_index._agents.www.vistaire.ca. 3600 IN HTTPS 1 www.vistaire.ca. alpn="h2,http/1.1" port=443 mandatory=alpn,port
_index._agents.www.vistaire.ca. 3600 IN SVCB 1 www.vistaire.ca. alpn="h2,http/1.1" port=443 mandatory=alpn,port
```

The apex records match the organization-domain query `_index._agents.vistaire.ca`. The `www` records match URL-host scanners that query `_index._agents.www.vistaire.ca`. Both point agents to the canonical HTTPS endpoint that serves `/.well-known/api-catalog`, `/.well-known/agent-skills/index.json`, `/auth.md`, and `/.well-known/mcp/server-card.json`.

If the DNS operator chooses to add a DNS-AID endpoint/path SvcParam before IANA registration, use the provider-supported unknown-key form, for example `keyNNNNN="/.well-known/agent-skills/index.json"`, and record the chosen experimental-use key, owner, reason, and rollback plan in the DNS change ticket. Do not document that experimental key as a DNS-AID standard.

Do not publish `_a2a._agents.www.vistaire.ca` yet. Vistaire does not currently expose an A2A transport or backend MCP transport, so publishing an A2A record would overstate production capabilities.

## DNSSEC

DNS-AID records should be signed with DNSSEC. If TLSA records are added later, DNSSEC signing is required for those TLSA assertions. Confirm validating resolvers return authenticated data before treating DNS discovery as production-ready.

## Manual DNS actions required

- Confirm the authoritative DNS provider supports HTTPS and SVCB records with `alpn`, `port`, `mandatory`, and experimental `keyNNNNN` parameters.
- Publish the `_index._agents.vistaire.ca` and `_index._agents.www.vistaire.ca` records above in the `vistaire.ca` zone.
- Enable or confirm DNSSEC for the public zone.
- Re-run discovery scans after propagation.
- If the DNS provider cannot publish SVCB-compatible records or unknown `keyNNNNN` parameters, document the provider limitation and keep HTTP `.well-known` discovery as the public fallback.

## Verification

```bash
dig HTTPS _index._agents.www.vistaire.ca +dnssec +multi
dig SVCB _index._agents.www.vistaire.ca +dnssec +multi
dig HTTPS _index._agents.vistaire.ca +dnssec +multi
dig SVCB _index._agents.vistaire.ca +dnssec +multi
dig HTTPS _a2a._agents.www.vistaire.ca +dnssec
dig HTTPS _a2a._agents.vistaire.ca +dnssec
dig @1.1.1.1 HTTPS _index._agents.www.vistaire.ca +dnssec +multi
dig @1.1.1.1 HTTPS _index._agents.vistaire.ca +dnssec +multi
dig @8.8.8.8 HTTPS _index._agents.www.vistaire.ca +dnssec +multi
dig @8.8.8.8 HTTPS _index._agents.vistaire.ca +dnssec +multi
dig HTTPS _index._agents.www.vistaire.ca +dnssec +adflag
dig HTTPS _index._agents.vistaire.ca +dnssec +adflag
dig +dnssec DNSKEY vistaire.ca
dig +dnssec DS vistaire.ca
```

The `_a2a` command should return no production A2A record until Vistaire has a real A2A endpoint. The `_index` commands should show the HTTPS/SVCB ServiceMode target `www.vistaire.ca`, `alpn`, and the endpoint path parameter after manual DNS publication.

Run the external readiness scan only after DNS publication:

```bash
curl -sS https://isitagentready.com/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.vistaire.ca"}'
```

Require `checks.discoverability.dnsAid.status` to be `pass` before claiming DNS-AID is live.
