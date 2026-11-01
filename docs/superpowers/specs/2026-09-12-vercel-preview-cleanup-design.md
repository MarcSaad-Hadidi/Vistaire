# Automated Vercel Preview Cleanup Design

## Goal

Automatically remove obsolete Vistaire **Preview** deployments from Vercel after pull requests are closed or merged, while making it structurally impossible for the cleanup path to intentionally delete a Production-serving deployment.

## Scope

This change is infrastructure-only. It adds a GitHub Actions workflow, a small dependency-free Node.js cleanup implementation, and focused contract/unit tests.

It does not modify application runtime code, routes, Supabase behavior, public assets, 3D/AR assets, Git LFS policy, or Vercel Production deployment behavior.

## Triggers

The cleanup workflow has three entry points:

1. `pull_request` with `types: [closed]` on `main` to evaluate a PR immediately after merge/close while enforcing the close-time grace period.
2. An **hourly** `schedule` sweep to pick up deployments once their grace period has elapsed and to recover anything missed by the close-trigger path.
3. `workflow_dispatch` for manual dry-run or apply.

A destructive run requires the deployment itself to be at least **60 minutes old**. If the deployment belongs to a closed PR, that PR must also have been closed for at least **60 minutes**. Therefore a long-lived Preview cannot be deleted immediately when its PR closes.

## Safety model

The cleanup is fail-closed.

A deployment is eligible for deletion only when every required fact is known and proves it is a Preview deployment belonging to the configured Vistaire Vercel project.

Never delete when any of these are true:

- deployment target is `production`;
- deployment has a custom/non-Preview target;
- deployment metadata is incomplete or ambiguous, including missing Git branch/SHA;
- deployment belongs to another project;
- deployment is younger than the 60-minute grace period;
- a matching closed PR was closed less than 60 minutes ago;
- a matching closed PR has no trustworthy `closed_at` timestamp;
- deployment is still building/initializing/queued;
- the matching GitHub pull request is still open and this is its latest Preview deployment;
- the deployment is marked as promoted;
- the candidate currently owns any verified Production project domain alias;
- production-domain or deployment-alias inventory cannot be proven before deletion;
- GitHub/Vercel API classification cannot be completed successfully.

Automatic cleanup may delete:

- Preview deployments attached to a merged or closed PR only after both the deployment-age and PR-close grace periods have elapsed;
- older superseded Preview deployments for an open PR, while preserving the latest Preview for that PR;
- stale Preview deployments for branches with no matching open/closed PR, after the deployment-age grace period;
- obsolete Preview deployments in terminal states such as `ERROR`, `CANCELED`, or `BLOCKED`, subject to the same ownership and grace-period checks.

The workflow never cancels an active build as part of cleanup.

### Promotion / current-production protection

Vercel can promote an existing Preview deployment to Production without rebuilding it. Therefore `target === null` is not treated as sufficient proof that a deletion is safe.

Immediately before each DELETE, the cleanup:

1. fetches the project's current verified Production domains;
2. fetches the candidate deployment's currently assigned aliases;
3. refuses deletion if any candidate alias is one of those Production domains;
4. also refuses a candidate explicitly marked as promoted;
5. fails closed if the Production-domain or alias lookup cannot be validated.

This check is performed at write time, after the initial classifier, to reduce stale-classification risk.

## Authentication and permissions

GitHub permissions remain read-only (`contents: read`, `pull-requests: read`).

`VERCEL_TOKEN` is supplied only through the GitHub repository secret of that name. Vistaire's non-secret Vercel team/project identifiers are pinned in the workflow so a token cannot accidentally enumerate another project through runtime input.

The workflow does not execute untrusted PR code with `VERCEL_TOKEN`. It explicitly checks out the repository's trusted default branch before executing the cleanup runner.

## Data flow

The Node.js script:

1. fetches Vercel deployments for the configured project/team;
2. filters out all non-Preview/ambiguous deployments before any deletion decision;
3. requires Git metadata from each candidate (`githubCommitRef`, `githubCommitSha`);
4. queries GitHub for open and closed PRs;
5. preserves the latest Preview for each open PR;
6. enforces the 60-minute deployment-age grace and, for closed PRs, the independent 60-minute `closed_at` grace;
7. emits deterministic `keep`/`delete` reasons;
8. in dry-run, performs no DELETE requests;
9. in apply mode, loads verified Production domains and performs the write-time alias recheck;
10. calls Vercel's official `DELETE /v13/deployments/{id}` only after all guards pass.

If any required API call fails, the script exits non-zero and does not downgrade the failure to a keep/delete guess.

## Manual mode

`workflow_dispatch` supports `mode` with `dry-run` (default) and `apply`.

Manual `apply` requires the exact confirmation phrase `DELETE-VERCEL-PREVIEWS`. Automatic apply is accepted only for `schedule` or a `pull_request` event whose action is `closed`.

## Observability

Each successful run writes a GitHub Actions step summary containing counts for:

- inspected deployments;
- open and closed pull requests inspected;
- classifier delete candidates;
- verified Production domains consulted;
- candidates protected by a current Production alias;
- completed deletions;
- classifier decision reasons.

A failed API read/write fails the job instead of continuing destructively. The summary must not print `VERCEL_TOKEN` or other credentials.

## Testing

Focused tests cover the safety-critical behavior:

1. Production/custom/ambiguous/incomplete/active/young deployments are never deletable.
2. A long-lived Preview from a PR closed less than 60 minutes ago is still protected.
3. Closed-PR and stale orphan Preview deployments become candidates only after the applicable grace period.
4. The latest Preview of each open PR is preserved while older superseded Previews may be removed.
5. Dry-run never invokes DELETE.
6. Manual apply is rejected before API access without the exact phrase.
7. A Preview deployment currently serving a Production domain is protected even when its original target remains Preview/null.
8. Workflow contract verifies trusted triggers, read-only GitHub permissions, secret handling, schedule/manual mode, pinned actions, trusted checkout, and no `pull_request_target`.

Repository validation remains `assets:check`, `lfs:check`, `lint`, `typecheck`, `build`, focused Node tests, Workflow Security, CodeQL, Asset Policy, and App CI.

## Rollout

The PR ships the automation but does not manually delete any existing Vercel deployments during implementation. After merge, eligible automatic runs may delete Preview deployments according to the approved rules above. Production deployments and any deployment that cannot be proven safe remain protected/fail-closed.
