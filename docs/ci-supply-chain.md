# CI supply-chain controls

This document records the controls that are intentionally versioned in the
repository. It is a change log, not a claim that every external scanner is
available in every local checkout.

## GitHub Actions

All external actions in the checked-in workflows use a full 40-character commit
SHA. The human-readable release comments are kept beside each reference so a
Dependabot update can be reviewed without treating a mutable tag as an input.
Dependabot checks the GitHub Actions ecosystem weekly (`.github/dependabot.yml`).

Current immutable action inventory (checked 2026-08-03):

| Repository | Human release | Commit SHA | Update mechanism |
| --- | --- | --- | --- |
| `actions/checkout` | v4.4.0 | `11d5960a326750d5838078e36cf38b85af677262` | Dependabot GitHub Actions PR |
| `actions/setup-node` | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` | Dependabot GitHub Actions PR |
| `actions/upload-artifact` | v4.6.0 | `65c4c4a1ddee5b72f698fdd19549f0f0fb45cf08` | Dependabot GitHub Actions PR |
| `actions/download-artifact` | v4.3.0 | `d3f86a106a0bac45b974a628896c90dbdf5c8093` | Dependabot GitHub Actions PR |
| `github/codeql-action` | v4 | `bce182f857edf1feab116e9795a3393d21977282` | Dependabot GitHub Actions PR + CodeQL review |

The CodeQL workflow grants `security-events: write` only to the analysis job and
publishes SARIF through the CodeQL action. A future baseline for historical
alerts must contain the alert identifier, justification, owner, tracking issue,
and an expiry date; no such baseline is asserted by this PR.

## PostgreSQL service image

App CI uses the PostgreSQL 17.10 multi-platform index, pinned to:

```text
postgres:17.10@sha256:a426e44bac0b759c95894d68e1a0ac03ecc20b619f498a91aae373bf06d8508d
```

The digest was checked against the Docker Hub `postgres:17.10` index on
2026-08-03. A dependency update should verify the replacement digest and the
PostgreSQL contract suite in the same change. Dependabot does not update an
arbitrary service-image digest automatically, so this remains a documented
manual update until an image-update owner is assigned.

## npm audit baseline

The current lockfile has integrity metadata for all 666 installed packages, but
the audit report still contains high-severity advisories. This PR does not run
`npm audit fix --force` and does not silently change production dependencies.
Remediation belongs in a separate dependency PR. The follow-up gate should
compare the current report with an expiring advisory baseline and fail only on a
new high/critical advisory; each baseline entry must include its advisory ID,
affected path, owner, issue, reason, and expiry date.

## Fork safety

The bounded PR graph fetch receives the read-only GitHub token only when the PR
head repository is the same repository. Fork PRs intentionally skip that fetch,
fall back to the classifier's exhaustive policy, and never pass a token to
PR-modifiable graph code. No workflow uses `pull_request_target`, and no
deployment smoke workflow exposes a protected Vercel secret to PR code.

## Local tool availability

`actionlint`, `zizmor`, and Docker were not installed in the validation
environment used for this change. Their absence is a residual verification gap,
not a reason to claim those scans passed.
