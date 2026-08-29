# AGENTS.md - Vistaire

## Purpose

Complete the current task with the minimal sufficient production-ready solution.

* Prohibit unnecessary over-engineering.
* Planning may be rigorous and exhaustive, but execution must remain lightweight and focused.
* Designs, abstractions, compatibility layers, infrastructure, and tests that cannot prove their necessity are not added by default.
* Prefer one clean root-cause fix over accumulated patches.
* Do not solve hypothetical future requirements unless the user explicitly asks for them.
* Minimal does not mean incomplete: all stated acceptance criteria, required safety checks, and repository-mandated validations still apply.
* When minimalism conflicts with correctness, data integrity, security, explicit user requirements, or repository policy, correctness and safety take priority.

## Product Standard

* Vistaire is a premium restaurant menu experience, not a generic SaaS app.
* Work mobile-first. Check 390px and 430px widths before expanding to desktop.
* Preserve the current premium restaurant direction: food-first visuals, warm dark surfaces, cream/champagne accents, restrained motion, and clear French restaurant copy.
* Do not make broad visual rewrites without evidence from a bug, a failing test, DevTools, measurable performance data, or an explicit design request.
* Keep the menu, dish detail pages, and restaurant value proposition central.
* Do not turn Vistaire into a cold dashboard, POS, reservation system, or generic SaaS mockup unless explicitly asked.

## Decision Priority

When instructions appear to conflict, apply them in this order:

1. Explicit user instructions for the current task.
2. Safety, data integrity, secrets, production protection, and irreversible-operation rules.
3. This `AGENTS.md` and repository-specific policies.
4. Current acceptance criteria and verified product behavior.
5. Minimal implementation and anti-over-engineering principles.
6. Optional cleanup, refactoring, architectural improvements, or future-proofing.

Never use "minimal implementation" as justification for skipping a required acceptance criterion, security requirement, repository check, or validation.

## Workflow

### 1. Inspect Before Modifying

Understand the requirements and current implementation before changing code.

Before the first code modification:

* Read the relevant repository structure.
* Read this `AGENTS.md`.
* Read any more specific `AGENTS.md` or repository instructions that apply to the files being touched.
* Identify the package manager from the actual lockfile.
* Inspect `package.json` and relevant scripts rather than assuming commands exist.
* Check the current Git branch and working tree.
* Read the relevant implementation directly.
* Use repository search to locate code, but do not substitute search snippets, filenames, or guesses for reading the authoritative implementation.
* Understand the current behavior before attempting to change it.
* For bugs, identify the root cause rather than only treating the visible symptom.

Do not modify code first and infer the intent afterward.

### 2. Restate The Task

After sufficient read-only inspection and before the first modification, explicitly establish:

* What the user actually wants.
* Goals.
* Non-goals.
* Acceptance criteria.
* Exact scope for this task.
* Areas that must not be changed.
* What evidence will count as completion.

Do not silently expand the task.

### 3. Produce A Minimal Plan

Create a short implementation plan before editing.

The plan must identify:

* The smallest likely change.
* The files or areas expected to be touched.
* Existing behavior that must remain intact.
* Required validation.
* Important risks.
* Anything deliberately left unchanged.

Planning can use deep reasoning.

Execution should favor the simplest correct implementation that satisfies the plan.

### 4. Reasoning Discipline

* Use stronger reasoning for requirement analysis, root-cause analysis, architecture decisions, risk identification, and final review.
* For straightforward implementation, prefer normal focused execution rather than repeatedly reopening architectural questions.
* If the environment supports model delegation, lighter execution models may be used for mechanical implementation or validation where correctness is not compromised.
* Do not keep maximum reasoning or heavyweight orchestration active merely because it is available.
* Do not trade correctness, security, or evidence quality for lower reasoning cost.

### 5. Scope Discipline

During implementation, continuously check whether each change is necessary for an accepted requirement.

Stop and reduce the solution if implementation starts doing any of the following without demonstrated necessity:

* Adding abstractions.
* Adding frameworks.
* Adding configuration layers.
* Adding new architectural patterns.
* Designing for hypothetical future use.
* Adding compatibility systems for behavior not required by the task.
* Maintaining two implementations when one clean implementation can replace the problem.
* Adding duplicate data flows.
* Modifying unrelated files.
* Refactoring neighboring modules "while already here."
* Expanding the test system.
* Creating new infrastructure merely to make the solution appear more complete.

When a clean root-cause fix can remove the need for historical patches, prefer that fix.

Do not create complexity to preserve complexity.

## Git Workflow

* Before Git modifications, run `git status --short --branch`.
* Fetch the latest remote state with `git fetch origin` before deciding the correct base.
* Never work directly on `main` or `master`.
* For a new task, start from the latest clean `origin/main` and create one clean working branch.
* Do not stack new work on feature branches unless the user explicitly asks.
* For the direct continuation of an existing task or PR, verify and continue the existing task branch instead of creating another branch.
* Confirm the base with `git merge-base HEAD origin/main` when branch ancestry matters.
* Do not start new work from an old, dirty, stacked, or stale feature branch.
* If previous work is useful only as reference, inspect it and reconstruct the required solution from a clean base rather than stacking unrelated history.
* Do not discard, reset, restore over, reformat, or clean up existing user work unless the user explicitly asks.
* Keep each PR focused on one objective.
* Split unrelated product work, asset work, SEO work, infrastructure work, and setup work into separate PRs.
* Stop and report before editing if:

  * The current branch is already ahead with unrelated work.
  * The intended diff crosses unrelated product domains.
  * A setup-only task would touch runtime pages, public media, demo data, SEO runtime, or 3D assets.

Do not use destructive Git commands as cleanup shortcuts.

## Subagents And Parallel Work

Begin with one main thread.

Do not create multiple agents, threads, or worktrees merely to make the process look more thorough.

For focused tasks:

* Prefer one implementation thread.
* Use subagents only when they provide clear value.
* Avoid parallel work when the same files or behavior would be touched.

For large or genuinely separable tasks:

* First inspect and decompose the problem.
* Split work only when concerns are materially independent.
* Give each subagent or worktree clear ownership, scope, limits, and validation responsibilities.
* Avoid overlapping file ownership.
* The main agent owns integration.
* The main agent must verify subagent findings rather than accepting them automatically.
* Use review/red-team subagents when risk or scope justifies them.

Useful roles may include:

* Repository/scope analysis.
* `AGENTS.md` policy review.
* CI.
* Documentation.
* Package scripts.
* Asset policy.
* Vercel/deployment safety.
* UX/UI.
* Mobile performance.
* Accessibility.
* SEO/GEO.
* DevTools/browser QA.
* Security/risk review.
* 3D/AR.
* Cleanup.
* Final review.

If real subagents are unavailable, simulate the separation through clearly scoped stages with evidence.

Do not parallelize work that can be completed more safely and simply in one thread.

## Skills And Tooling

* Use only the skills, tools, MCP servers, or workflows that materially help complete or validate the current task.
* Do not install heavy process tooling merely to perform a small task.
* Do not introduce a dependency, testing framework, build tool, or repository-level workflow simply because the environment supports it.
* Prefer existing project capabilities.
* Use repository inspection, browser tooling, tests, DevTools, and deployment tooling proactively when they provide relevant evidence.

## Assets And LFS

* Do not add large, raw, generated, review, or source media assets to Git.
* Existing large files on `main` are grandfathered exceptions, not precedent.
* Never force-add ignored asset folders such as:

  * `3D Plat/`
  * `3D photo/`
  * `asset-review/`
  * `assets/3d/source/`
  * `assets/3d/work/`
  * raw video output
* Do not add wildcard Git LFS rules.
* No broad `*.glb`, `*.usdz`, `*.mp4`, or similar `filter=lfs` patterns.
* Any LFS or large-asset exception requires:

  * an explicit policy update,
  * an owner,
  * a reason,
  * maximum allowed bytes,
  * a checksum.
* Public runtime assets must not require Git LFS.
* Reference `docs/repo-asset-policy.md` instead of duplicating asset thresholds or allowlists.
* Do not modify `public/models`, `public/videos`, `public/frames`, `3D Plat`, or `3D photo` unless the task explicitly requires it.

## Implementation Guardrails

* Prefer small, evidence-backed changes.
* Follow established Next.js App Router, React, Tailwind, TypeScript, and local helper patterns.
* Preserve existing routes unless the task explicitly requires changing them.
* Preserve existing data contracts unless the task explicitly requires changing them.
* Preserve mobile performance.
* Preserve existing auth, analytics, SEO, AR, and asset flows unless evidence proves the existing approach cannot satisfy the requirement.
* Do not add dependencies unless their necessity is clear and validation proves they work.
* Avoid broad refactors unrelated to the root cause.
* Avoid hackish fixes.
* Do not invent functionality that has not been verified or requested.
* Do not delete production code, public assets, data, or source drops as cleanup without explicit approval.
* Keep setup-only PRs limited to instructions, documentation, templates, CI, and package scripts.
* Do not place internal instructions under `public/`, because files there are served to users.

Prefer:

`existing pattern -> minimal modification -> verification`

over:

`new abstraction -> migration layer -> compatibility layer -> duplicate path -> future-proof architecture`

unless the latter is demonstrably necessary.

## Failure Modes

Actively guard against these failure modes:

1. Failing to understand the real user intent and only fixing a visible surface symptom.
2. Piling historical patches, compatibility layers, dual tracks, duplicates, or branches onto a problem that has one clean root-cause fix.
3. Over-designing for rare or hypothetical cases and increasing everyday maintenance cost.
4. Using extensive reasoning but starting from incorrect assumptions or incorrect evidence.
5. Guessing implementation behavior instead of reading the relevant code.
6. Treating repository search results as a substitute for inspecting the actual implementation.
7. Using "add tests" as justification to add abstraction, expand scope, or redesign unrelated systems.
8. Creating architecture for requirements the user never requested.
9. Treating green tests as proof that unnecessary additional work should continue.
10. Making a large diff because a small diff did not look sufficiently sophisticated.

## Action Boundaries

### Before Modification

Before the first modification, confirm:

* Actual user outcome.
* Current scope.
* Explicit non-goals.
* Acceptance criteria.
* What will count as verified completion.

Read-only inspection needed to establish these facts may happen before this restatement.

### Irreversible Operations

Any genuinely irreversible or high-risk destructive operation requires explicit user confirmation with a confirmation codeword supplied by the user.

Examples include:

* Force-pushing or rewriting shared Git history.
* Permanently deleting production data.
* Destructive production database migrations.
* Deleting production resources.
* Permanently deleting required assets without recovery.
* Rotating, revoking, or deleting secrets or credentials.
* Destructive infrastructure operations.
* Any operation whose previous state cannot reasonably be reconstructed.

If an irreversible operation becomes necessary and no confirmation codeword has been provided, do not execute it.

A wrong codeword or unrelated reply does not count as confirmation.

### Reversible / Read-Only Operations

The following do not require the irreversible-operation confirmation codeword by default:

* Reading files.
* Repository search.
* Viewing logs.
* Viewing Git status, history, diffs, or branches.
* Fetching remote Git metadata.
* Running tests.
* Running lint, typecheck, builds, or repository validation scripts.
* Browser inspection.
* Generating plans.
* Read-only analysis.
* Creating a normal task branch.
* Switching branches when it does not overwrite or discard working-tree changes.
* Moving task-generated files into a repository-local backup location when explicitly useful and when doing so does not alter production behavior.

`git reset --hard`, destructive `git clean`, overwriting `git restore`, forced checkout, or any equivalent command that discards user work is not permitted merely because Git operations are theoretically reversible.

## Testing Philosophy

Tests exist to verify required behavior, not to create the appearance of completeness.

Tests for the current task are not responsible for:

* Filling historical coverage gaps.
* Redesigning the project's test architecture.
* Testing unrelated modules.
* Preparing for hypothetical future features.

Repository-mandated validation commands must still be run when applicable.

### Testing Order

1. Identify the behavior changed by the task.
2. Find existing tests covering that behavior.
3. Run the relevant existing tests first.
4. If existing tests provide sufficient regression protection, do not add redundant tests.
5. Add a new test only when:

   * the task changes behavior that existing tests cannot detect, or
   * the user explicitly requests new tests.

### New Test Limits

When new tests are required:

* Cover the smallest useful main path.
* Add one key failure/regression path only when it provides materially different protection.
* Normally prefer no more than one primary test and one critical failure/regression test for a focused behavioral change.
* Exceed that number only when distinct acceptance criteria, security boundaries, data isolation requirements, or materially different behaviors cannot otherwise be verified.
* Do not expand test scope merely for completeness.
* Do not fill unrelated module coverage.
* Do not introduce a new test framework, tool, infrastructure layer, or directory architecture for a focused task.
* Do not create large snapshot suites.
* Do not create broad parameterized matrices unless the actual requirement depends on those cases.
* Do not create a new broad end-to-end suite for a focused change.
* Existing E2E infrastructure may and should still be used when relevant.
* Do not test hypothetical boundaries outside the task.
* Do not modify tests first and then complicate production behavior simply to satisfy the tests.
* Green tests are a stopping signal when acceptance criteria are met, not an invitation to keep abstracting.

Before adding any new test, answer:

* Which accepted requirement does this test verify?
* If this test is removed, can existing tests still detect the regression?
* Does this test provide materially different protection?
* Is the test disproportionately more complex than the production change?

If test code becomes significantly more complicated than the behavior it protects, treat that as a warning signal and simplify either the test or the implementation unless the complexity is demonstrably necessary.

## Validation

Identify the package manager from the lockfile before executing package commands.

This repository currently uses npm, but verify the actual lockfile rather than relying only on this statement.

Default checks for applicable code/setup changes:

* `npm run assets:check`
* `npm run lfs:check`
* `npm run lint`
* `npm run build`

Also:

* Run `npm run typecheck` when that script actually exists.
* Run targeted `node --test tests/*.test.mjs` for touched logic when applicable.
* Run relevant existing tests for changed behavior.
* Run `npm run test:e2e` for changed critical routes when the script exists and the environment is stable.
* Do not invent commands that are not defined in the repository.
* If a required check cannot run, report:

  * the exact command,
  * the exact blocker,
  * what remains unverified,
  * the residual risk.

Validation should prove the change, not expand the project.

## Browser QA

Before confirming functional frontend or UI behavior, inspect the application in Chrome DevTools or an equivalent browser automation environment capable of providing the required evidence.

For affected routes, verify as applicable:

* Route loads successfully.
* Expected user interaction works.
* No unexpected console errors.
* No relevant hydration/runtime errors.
* Network has no unexplained relevant 404/500 requests.
* Required assets load correctly.
* No obvious duplicate or unnecessary requests introduced by the change.
* Mobile viewport has no horizontal overflow.
* Layout works at 390px.
* Layout works at 430px.
* Desktop remains sane where relevant.
* No obvious performance regression.
* Media loading behavior remains appropriate.

For 3D/AR work:

* Verify GLB/USDZ files are not fetched before user intent unless an existing approved preload path explains it.
* Inspect relevant network behavior.
* Check for obvious 3D runtime errors.
* Do not claim real iPhone Quick Look validation unless tested on an actual compatible Apple device.
* Do not claim real Android Scene Viewer validation unless tested on an actual compatible Android device.

A screenshot alone is not sufficient evidence for console, Network, hydration, or request behavior.

## Model Division Of Labor

Where the environment supports model selection or delegated agents:

* Requirement clarification: stronger reasoning.
* Root-cause analysis: stronger reasoning.
* Solution review: stronger reasoning.
* Risk/security review: stronger reasoning where relevant.
* Mechanical code changes: normal or lighter execution model when appropriate.
* Running tests and repetitive validation: lighter execution model when appropriate.
* Final integration judgment: stronger reasoning.

Do not lower reasoning when doing so would compromise correctness.

If an execution agent starts:

* stacking architecture,
* creating compatibility systems,
* expanding scope,
* adding large test suites,
* adding speculative future support,
* or touching unrelated modules,

stop implementation and return to the minimal plan.

## Cleanup

Before final reporting:

* Run `git status --short`.
* Inspect the final diff.
* Confirm only expected files changed.
* Remove task-generated files that should not ship, including as applicable:

  * `.next`
  * `test-results`
  * `playwright-report`
  * unnecessary screenshots
  * unnecessary videos
  * unnecessary traces
  * temporary files
  * debug scripts
  * draft files
  * unused mocks
* Remove debug `console.log` statements.
* Remove `debugger` statements.
* Verify no `.env` file or secret was added.
* Verify no generated heavy asset was accidentally added.
* Do not delete pre-existing user files merely because they appear unused.

Cleanup must remove artifacts generated by the current task, not become an unrelated repository cleanup project.

## Pre-Completion Checklist

Before declaring the task complete, verify:

* [ ] The real user intent was understood.
* [ ] Goals were identified.
* [ ] Non-goals were identified.
* [ ] Acceptance criteria were identified.
* [ ] Relevant implementation code was read directly.
* [ ] Root cause was identified for bugs where applicable.
* [ ] The solution is the minimal sufficient solution, not the maximal solution.
* [ ] Only the minimum justified files were modified.
* [ ] No unrelated architecture was added.
* [ ] No speculative future design was added.
* [ ] No unnecessary compatibility path or duplicate implementation was added.
* [ ] Existing relevant tests were prioritized.
* [ ] No tests were added for unrelated or unrequested scenarios.
* [ ] Any new tests have a direct acceptance-criteria justification.
* [ ] No new testing dependency or infrastructure was introduced without demonstrated necessity.
* [ ] Required repository validation commands were run where applicable.
* [ ] Browser QA was completed where functional UI/frontend behavior changed.
* [ ] Relevant console and Network behavior was checked.
* [ ] Mobile behavior was checked at 390px and 430px where relevant.
* [ ] Final diff is appropriately small and focused.
* [ ] No temporary/debug/generated junk remains.
* [ ] No secrets or unintended heavy assets were added.
* [ ] `git status --short` was reviewed.
* [ ] Anything that could not be verified is explicitly reported.
* [ ] Residual risks are explicitly reported.
* [ ] The PR remains within its intended scope.
* [ ] No extra construction was added merely to make the work look more complete.

## Final Reporting

The final report must include:

* What was changed.
* Why each changed file was necessary.
* Root cause when the task involved a bug.
* Validation commands actually executed.
* Test results.
* Browser/DevTools QA performed.
* Checks skipped and exact reasons.
* Cleanup performed.
* Residual risks.
* Confirmation that the diff stayed within scope.

Do not claim a validation passed unless it was actually executed and observed.

Do not claim functionality was tested on a device, browser, deployment, or external service that was not actually tested.

## General Principles

Understand first. Modify second.

Confirm intent, define acceptance, then implement the smallest solution that fully satisfies it.

Prefer direct code inspection over inference.

Prefer root-cause correction over patch accumulation.

Prefer existing architecture over new architecture.

Prefer existing tests over new tests when they already prove the behavior.

Designs that cannot prove necessity are not done by default.

Tests that cannot prove necessity are not added by default.

Complexity must justify itself.
