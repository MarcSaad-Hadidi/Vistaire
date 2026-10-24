import { createVideoPlaybackController } from "./videoPlayback.js";

// Decode only while the surface is visible. Wake WebGL on decoded frames,
// rather than keeping its render loop alive between video frames.
export function createVideoSurfaceController(
  video,
  {
    onFrame = () => {},
    onPoster = () => {},
    onBlocked = () => {},
    onError = () => {},
    onSource = () => {},
  } = {},
) {
  const playback = createVideoPlaybackController(video);
  let active = false,
    disposed = false,
    source = "",
    decoded = false;
  let frameRequest,
    generation = 0;
  video.muted = video.defaultMuted = true;
  video.loop = video.playsInline = true;
  video.preload = "none";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  const poster = () => {
    decoded = false;
    onPoster();
  };
  const cancelFrame = () => {
    generation++;
    if (frameRequest != null) video.cancelVideoFrameCallback?.(frameRequest);
    frameRequest = undefined;
  };
  const present = () => {
    if (disposed || !active || video.paused || video.readyState < 2) return;
    decoded = true;
    onFrame();
  };
  const requestFrame = () => {
    if (
      disposed ||
      !active ||
      frameRequest != null ||
      !video.requestVideoFrameCallback
    )
      return;
    const epoch = generation;
    frameRequest = video.requestVideoFrameCallback(() => {
      if (disposed || epoch !== generation) return;
      frameRequest = undefined;
      present();
      requestFrame();
    });
  };
  const play = () => {
    if (!active || disposed) return;
    requestFrame();
    const request = playback.play();
    request?.then(() => {
      if (!active || disposed) return;
      if (playback.getState().blocked) {
        poster();
        onBlocked();
      } else requestFrame();
    });
  };
  const playing = () => {
    if (!active || disposed) {
      video.pause();
      return;
    }
    if (video.requestVideoFrameCallback) requestFrame();
    else present();
  };
  const timeUpdate = () => {
    if (!video.requestVideoFrameCallback) present();
  };
  const error = () => {
    poster();
    onError(video.error);
  };
  const events = {
    playing,
    timeupdate: timeUpdate,
    pause: poster,
    waiting: poster,
    stalled: poster,
    emptied: poster,
    error,
  };
  for (const [name, listener] of Object.entries(events))
    video.addEventListener(name, listener);
  const pause = () => {
    active = false;
    cancelFrame();
    if (!video.paused) video.pause();
    playback.reset();
    poster();
  };
  return {
    update(shouldPlay, nextSource) {
      if (disposed) return;
      if (!shouldPlay) {
        if (active || !video.paused) pause();
        return;
      }
      if (source !== nextSource) {
        pause();
        playback.reset();
        source = nextSource;
        video.src = source;
        video.defaultPlaybackRate = video.playbackRate = 1;
        video.load();
        onSource(source);
      }
      active = true;
      play();
    },
    retry() {
      if (active && playback.getState().blocked) {
        playback.reset();
        play();
      }
    },
    pause,
    getState: () => ({ active, decoded, source, ...playback.getState() }),
    dispose() {
      pause();
      disposed = true;
      playback.reset();
      for (const [name, listener] of Object.entries(events))
        video.removeEventListener(name, listener);
      video.removeAttribute("src");
      video.load();
    },
  };
}
