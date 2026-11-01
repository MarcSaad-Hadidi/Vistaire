type AvailabilityRpcName = 'set_admin_dish_manual_availability' | 'set_admin_dish_availability';
type RpcOutcome = { error: { code?: string; message?: string } | null };
/** Rolling-deploy bridge only: never retry auth, database, or conflict failures. */
export async function mutateAvailabilityWithSchedulingFallback<T extends RpcOutcome>(
  call: (name: AvailabilityRpcName) => PromiseLike<T>
): Promise<T> {
  const result = await call('set_admin_dish_manual_availability');
  const missing = result.error &&
    ['PGRST202', '42883'].includes(result.error.code ?? '') &&
    /\bset_admin_dish_manual_availability\b/.test(result.error.message ?? '') &&
    /could not find|does not exist/i.test(result.error.message ?? '');
  // The migration upgrades this original signature as well, so stale API
  // schema caches cannot bypass a persisted schedule's manual override.
  return missing ? call('set_admin_dish_availability') : result;
}
