// Cloudflare Pages Function — serve the editor at the root on any deployment host.
//
// This repository is intended to deploy the editor itself. The static marketing
// page remains available as /index.html, but Cloudflare Pages root requests are
// rewritten to /app so *.pages.dev and custom domains behave the same way.
export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  if (url.pathname === "/") {
    // Pages' static asset server canonicalizes app.html to /app, so request the
    // clean path directly and keep the browser address bar at "/".
    url.pathname = "/app";
    return env.ASSETS.fetch(new Request(url, request));
  }

  return next();
}
