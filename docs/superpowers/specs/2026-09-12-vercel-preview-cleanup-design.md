# Automated Vercel Preview Cleanup Design

## Goal

Automatically remove obsolete Vistaire **Preview** deployments from Vercel after pull requests are closed or merged, while making it structurally impossible for the cleanup path to delete a Production deployment.

## Scope

This change is infrastructure-only. It adds a GitHub Actions workflow, a small Node.js cleanup script, and focused contract/unit tests.

It does not modify application runtime code, routes, Supabase behavior, public assets, 3D/AR assets, Git LFS policy, or Vercel Production deployment behavior.

## Triggers

The cleanup workflow has three entry points:

1. `pull_request` with `types: [closed]` on `main` to schedule cleanup after a PR is merged or closed.
2. A nightly `schedule` sweep to catch stale Preview deployments missed by the close-trigger path.
3. `workflow_dispatch` for manual dry-run or apply.

Automatic destructive runs wait until the deployment is at least **60 minutes old** before deletion.

## Safety model

The cleanup is fail-closed.

A deployment is eligible for deletion only when every required fact is known and proves it is a Preview deployment belonging to the configured Vistaire Vercel project.

Never delete when any of these are true:

- deployment target is `production`;
- deployment metadata is incomplete or ambiguous;
- deployment belongs to another project/team;
- deployment is younger than the 60-minute grace period;
- the matching GitHub pull request is still open and this is its latest Preview deployment;
- GitHub/Vercel API classification cannot be completed successfully.

Automatic cleanup may delete:

- Preview deployments attached to a merged or closed PR after the grace period;
- older superseded Preview deployments for an open PR, while preserving the latest Preview for that PR;
- stale Preview deployments for branches with no open PR, after the grace period;
- obsolete Preview deployments in terminal states such as `ERROR`, `CANCELED`, or `BLOCKED`, subject to the same ownership and grace-period checks.

The workflow never cancels an active build as part of cleanup. It only deletes deployments already returned by Vercel's deployment listing endpoint and classified as safe to remove.

## Authentication and permissions

GitHub permissions remain read-only (`contents: read`, `pull-requests: read`).

Vercel credentials are supplied only through GitHub repository secrets/variables:

- `VERCEL_TOKEN` secret;
- `VERCEL_TEAM_ID` variable or secret;
- `VERCEL_PROJECT_ID` variable or secret.

The workflow does not execute untrusted PR code with `VERCEL_TOKEN`. The destructive job runs from the trusted workflow revision on the default branch after merge/close or on schedule/manual dispatch.

## Data flow

The Node.js script:

1. fetches Vercel deployments for the configured project/team;
2. filters out all non-Preview deployments before any deletion decision;
3. reads Git metadata from each deployment (`githubCommitRef`, `githubCommitSha`, and related metadata when present);
4. queries GitHub for open PRs and maps branch/head SHA to active PRs;
5. groups deployments by branch/PR and identifies the latest Preview to preserve for each open PR;
6. applies the 60-minute grace period;
7. emits a deterministic decision report with `keep`/`delete` plus reason for every candidate;
8. in dry-run, performs no DELETE requests;
9. in apply mode, calls Vercel's official `DELETE /v13/deployments/{id}` only for candidates already classified `delete`.

If any required API call fails, the script exits non-zero before destructive execution.

## Manual mode

`workflow_dispatch` supports `mode` with `dry-run` (default) and `apply`.

Manual `apply` requires an explicit confirmation input. This is separate from the user's approval to add the automation and prevents accidental destructive runs from the Actions UI.

## Observability

Each run writes a GitHub Actions step summary containing counts for:

- inspected deployments;
- kept Production/non-Preview deployments;
- kept active/latest Preview deployments;
- grace-period holds;
- delete candidates;
- successful deletions;
- failed deletions.

The summary must not print `VERCEL_TOKEN` or other credentials.

## Testing

Focused tests cover the safety-critical classification behavior:

1. Production targets are never deletable, including malformed/ambiguous metadata cases.
2. Closed-PR and stale orphan Preview deployments become delete candidates only after the 60-minute grace period.
3. The latest Preview of each open PR is preserved while older superseded Previews may be removed.
4. Dry-run never invokes the delete operation.
5. Workflow contract verifies trusted triggers, read-only GitHub permissions, secret handling, schedule/manual mode, and explicit apply confirmation.

Repository validation remains `assets:check`, `lfs:check`, `lint`, `typecheck`, `build`, focused Node tests, Workflow Security, CodeQL, Asset Policy, and App CI.

## Rollout

The PR ships the automation but does not manually delete any existing Vercel deployments during implementation. After merge, the next eligible automatic run may delete Preview deployments according to the approved rules above. Production deployments remain out of scope and protected by the classifier.
