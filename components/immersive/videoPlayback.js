// pause()/load() can reject an in-flight play() with AbortError. That is an
// interruption, not a refusal of autoplay. Source changes invalidate old work.
export function createVideoPlaybackController(video) {
  let pending = false;
  let blocked = false;
  let generation = 0;
  return {
    play() {
      if (!video.paused || pending || blocked) return;
      const requestGeneration = generation;
      pending = true;
      let request;
      try {
        request = video.play();
      } catch (error) {
        request = Promise.reject(error);
      }
      return Promise.resolve(request)
        .catch((error) => {
          if (
            requestGeneration === generation &&
            error.name === "NotAllowedError"
          )
            blocked = true;
        })
        .finally(() => {
          if (requestGeneration === generation) pending = false;
        });
    },
    reset() {
      generation++;
      pending = false;
      blocked = false;
    },
    getState: () => ({ pending, blocked, generation }),
  };
}
