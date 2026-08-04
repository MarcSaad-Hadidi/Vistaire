# Preview Gate runbook

`Preview Gate` is fail-closed: it is green only when the protected smoke
actually starts and all tests pass. A missing
`VERCEL_AUTOMATION_BYPASS_SECRET`, a skipped test, an inaccessible protected
Preview, or a smoke failure must leave the check red. The workflow checks out
trusted `main`; it never checks out a pull-request ref or executes PR code with
the protected secret.

## One-time administrator setup

An administrator with access to the Vercel project and repository environments
must perform these steps. The secret value must never be pasted into an issue,
workflow log, shell history, or job summary.

1. In Vercel project settings, create or rotate the official Automation Bypass
   Secret for the Vistaire project.
2. In GitHub, open **Settings → Environments → `preview-gate` → Environment
   secrets**, choose **Add secret**, name it exactly
   `VERCEL_AUTOMATION_BYPASS_SECRET`, and paste the value directly into the
   protected form. Do not use a repository-wide secret.
3. Keep deployment protection rules and required reviewers on `preview-gate`.
   Do not grant this secret to pull-request workflows or reusable workflows that
   execute untrusted refs.
4. Confirm the environment is available to the `Preview Gate` workflow only.
   A safe API/CLI check may verify that the secret name exists, but must never
   retrieve or print the value.

For GitHub CLI users, the final write should be performed interactively (the
value is read from standard input and is not echoed):

```bash
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET --env preview-gate --repo MarcSaad-Hadidi/Vistaire
```

The command requires an authenticated administrator; Codex cannot infer that
permission or verify the resulting Vercel/GitHub binding from a local checkout.

## Validation procedure

1. Trigger a new Vercel Preview deployment for the candidate commit.
2. Locate the resulting `deployment_status` event and its `Preview Gate` run.
3. Confirm the run validates the repository, exact deployment SHA, HTTPS
   allowlisted Vercel host, and then executes
   `e2e/preview-smoke.spec.ts` at 390×844 and 430×932.
4. Confirm the summary reports no skipped tests and that the diagnostics
   artifact is absent on success (or contains failure evidence on failure).
5. Record the GitHub run ID and deployment URL in the PR evidence. Do not mark
   the PR ready, or make this check required in branch protection, until a real
   run proves the smoke executed.

## Runtime failure classification

The trusted smoke records structured diagnostics for every failed request. Each
entry keeps the sanitized URL and pathname, method, resource type, navigation
and frame scope, exact failure code, observed prefetch headers, final
classification, and the reason for a benign decision. Cookies, bypass values,
authorization headers, and other sensitive headers are never logged.

Only these cancellations can be reported as benign:

- `net::ERR_ABORTED` for the exact validated-origin path
  `/.well-known/vercel/jwe`;
- a same-origin media request with `net::ERR_ABORTED` after critical media has
  a coherent `currentSrc`, no `MediaError`, `readyState >= HAVE_CURRENT_DATA`,
  and no pending critical request;
- a request with explicit prefetch evidence (`purpose`, `sec-purpose`, or a
  Next Router prefetch header).

Primary navigation, documents, application XHR/fetch without an explicit
prefetch marker, non-aborted failures, HTTP 4xx/5xx responses, out-of-origin
failures, console errors, and page errors remain blocking. A cancelled `/`
request is not treated as prefetch merely because of its pathname. Benign
cancellations are printed with their structured reason so a successful run can
be audited without suppressing real signals.

If the secret cannot be configured, leave `Preview Gate` non-required and treat
the missing run as an explicit external blocker. Do not turn a skipped smoke
into a green gate.


## Bootstrap merge boundary

This bootstrap PR installs the trusted harness on `main`. Because the workflow
deliberately checks out `ref: main`, a Preview Gate smoke cannot be considered
available until this PR is merged. Do not add the Vercel bypass secret before
the trusted harness is present on `main`; keep the environment protected and
the check non-required until a post-merge deployment runs the smoke.
