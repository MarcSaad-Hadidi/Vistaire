export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    // Preserve byte ranges for video playback and Quick Look, while setting
    // explicit media types even if the asset host doesn't parse _headers.
    const pathname = new URL(request.url).pathname;
    const mediaType = /^\/assets\/ar\/[^/]+\.usdz$/.test(pathname)
      ? "model/vnd.usdz+zip"
      : /^\/media\/[^/]+\.mp4$/.test(pathname) ? "video/mp4" : null;
    if (
      response.ok &&
      ["GET", "HEAD"].includes(request.method) &&
      mediaType
    ) {
      const headers = new Headers(response.headers);
      headers.set("Content-Type", mediaType);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
