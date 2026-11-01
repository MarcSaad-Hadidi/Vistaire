# Vistaire restaurant studio integration

Goal: integrate approved public dashboard v28 into the protected restaurant admin of PR #296, preserving its existing immersive public redesign.

1. Replace the three existing admin presentations with one authenticated four-destination studio (overview, analysis, dishes, planning). Keep existing QR authorization, tenant/menu selection, privacy thresholds and mutation revalidation. Preserve a recoverable, non-served snapshot of the previous presentation.
2. Port the approved quiet light/dark visual system, KindUI charts, direct mobile navigation, adjacent selection actions, combined dish statistics/availability and accessible dialogs. All numbers come from the existing server-side event reads; unavailable evidence remains unavailable.
3. Add real local PDF/Excel/CSV/JSON downloads for the authorized dataset, with safe text serialization. Scheduling persistence requires a separately approved additive RPC/migration, without applying production changes.
4. Verify the affected pure contracts, authenticated/local fixture browser flows, mobile 390/430, desktop, interrupted dialogs and failed mutations, then lint/typecheck/build/assets/LFS. Review the final scoped diff and publish to the same PR through the verified marc connection with an expected-head lease.

Non-goals: no merge, intentional production deployment, production migration execution, real account/data modifications, new infrastructure, changes to unrelated landing/3D/public assets.

Completion evidence: exact remote SHA, checks actually run, archive hash, matching authenticated UI/browser evidence, remaining backend or environment limits explicitly documented. No synthetic demo Model, fixed clock, fake local mutation, iframe or public statistics route may ship as production data.
