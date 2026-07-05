# DNS-AID publication checklist

Vistaire cannot publish DNS-AID records from this repository. A DNS operator must create and validate the records in the authoritative DNS zone for `vistaire.ca`.

## Proposed records

The DNS-AID draft is still experimental. Use numeric `keyNNNNN` SvcParamKey names for unregistered custom parameters until the draft allocates stable keys.

```dns
_index._agents.vistaire.ca. 3600 IN SVCB 1 www.vistaire.ca. alpn="h2,http/1.1" port=443 mandatory=alpn,port
_a2a._agents.vistaire.ca. 3600 IN SVCB 1 www.vistaire.ca. alpn="h2,http/1.1" port=443 mandatory=alpn,port
```

`_index._agents` points agents to the HTTPS origin that serves `/.well-known/api-catalog`, `/.well-known/agent-skills/index.json`, `/auth.md`, and `/.well-known/mcp/server-card.json`.

`_a2a._agents` is included only as a reserved discovery pointer. Vistaire does not currently expose an A2A transport or backend MCP transport.

## DNSSEC

DNS-AID records should be signed with DNSSEC. Confirm validating resolvers return authenticated data before treating DNS discovery as production-ready.

## Manual DNS actions required

- Confirm the authoritative DNS provider supports SVCB records.
- Publish the records above in the `vistaire.ca` zone.
- Enable or confirm DNSSEC for the public zone.
- Re-run discovery scans after propagation.

## Verification

```bash
dig _index._agents.vistaire.ca SVCB +dnssec
dig _a2a._agents.vistaire.ca SVCB +dnssec
dig @1.1.1.1 _index._agents.vistaire.ca SVCB
dig @8.8.8.8 _index._agents.vistaire.ca SVCB
```

If the DNS provider cannot publish SVCB records, document that limitation in deployment notes and rely on HTTPS Link headers plus `.well-known` discovery until provider support is available.
