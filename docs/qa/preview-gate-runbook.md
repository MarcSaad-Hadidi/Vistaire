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

If the secret cannot be configured, leave `Preview Gate` non-required and treat
the missing run as an explicit external blocker. Do not turn a skipped smoke
into a green gate.


## Bootstrap merge boundary

This bootstrap PR installs the trusted harness on `main`. Because the workflow
deliberately checks out `ref: main`, a Preview Gate smoke cannot be considered
available until this PR is merged. Do not add the Vercel bypass secret before
the trusted harness is present on `main`; keep the environment protected and
the check non-required until a post-merge deployment runs the smoke.
