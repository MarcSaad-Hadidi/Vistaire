export type OwnerDishModelUploadQueueState =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "error";

type QueueJob<T> = {
  dishId: string;
  run: () => Promise<T> | T;
  onQueued?: () => void;
  onStart?: () => void;
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
  onSettled?: () => void;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export type OwnerDishModelUploadQueueSnapshot = {
  activeDishId: string;
  pendingDishIds: string[];
};

export function createOwnerDishModelUploadQueue() {
  const pending: Array<QueueJob<unknown>> = [];
  let activeJob: QueueJob<unknown> | null = null;

  function getSnapshot(): OwnerDishModelUploadQueueSnapshot {
    return {
      activeDishId: activeJob?.dishId ?? "",
      pendingDishIds: pending.map((job) => job.dishId)
    };
  }

  function startNext() {
    if (activeJob) return;
    const job = pending.shift();
    if (!job) return;

    activeJob = job;
    job.onStart?.();

    let result: Promise<unknown> | unknown;
    try {
      result = job.run();
    } catch (error) {
      job.onError?.(error);
      job.reject(error);
      job.onSettled?.();
      activeJob = null;
      startNext();
      return;
    }

    Promise.resolve(result)
      .then(
        (value) => {
          job.onSuccess?.(value);
          job.resolve(value);
        },
        (error) => {
          job.onError?.(error);
          job.reject(error);
        }
      )
      .finally(() => {
        job.onSettled?.();
        activeJob = null;
        startNext();
      });
  }

  function enqueue<T>({
    dishId,
    run,
    onQueued,
    onStart,
    onSuccess,
    onError,
    onSettled
  }: {
    dishId: string;
    run: () => Promise<T> | T;
    onQueued?: () => void;
    onStart?: () => void;
    onSuccess?: (value: T) => void;
    onError?: (error: unknown) => void;
    onSettled?: () => void;
  }): Promise<T> {
    onQueued?.();
    return new Promise<T>((resolve, reject) => {
      pending.push({
        dishId,
        run,
        onQueued,
        onStart,
        onSuccess: onSuccess as QueueJob<unknown>["onSuccess"],
        onError,
        onSettled,
        resolve: resolve as QueueJob<unknown>["resolve"],
        reject
      });
      startNext();
    });
  }

  return {
    enqueue,
    getSnapshot
  };
}
