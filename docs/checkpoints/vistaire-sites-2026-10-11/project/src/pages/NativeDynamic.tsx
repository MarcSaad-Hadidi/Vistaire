import { lazy, Suspense, type ComponentType } from "react";
export default function dynamic(
  load: () => Promise<ComponentType>,
  options?: { loading?: ComponentType },
) {
  const Component = lazy(() =>
    load().then((defaultExport) => ({ default: defaultExport })),
  );
  return function LazyPublicComponent(props: Record<string, unknown>) {
    const Loading = options?.loading;
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <Component {...props} />
      </Suspense>
    );
  };
}
