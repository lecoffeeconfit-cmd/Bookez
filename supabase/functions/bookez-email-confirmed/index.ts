const projectDeepLink = 'bookez://auth/callback';

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const page = ({ code, error }: { code: string; error: string }) => {
  const hasCode = Boolean(code);
  const safeCode = JSON.stringify(code).replaceAll('<', '\\u003c');
  const deepLink = hasCode ? `${projectDeepLink}?code=${encodeURIComponent(code)}` : projectDeepLink;
  const heading = error ? 'We could not verify that link.' : hasCode ? 'You’re verified.' : 'Your link is ready.';
  const copy = error
    ? 'This confirmation link may have expired. Request a new one from Bookez and try again.'
    : hasCode
      ? 'Your email is confirmed. We’re opening Bookez so you can start writing.'
      : 'Open Bookez to finish signing in.';
  const buttonLabel = error ? 'Return to Bookez' : 'Open Bookez';
  const statusClass = error ? 'error' : 'success';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escapeHtml(heading)} · Bookez</title>
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Avenir Next", "Segoe UI", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; color: #202956; background: linear-gradient(145deg, #f7f5ff 0%, #eef6ff 52%, #fff5ec 100%); overflow: hidden; }
      body::before, body::after { content: ""; position: fixed; border-radius: 999px; pointer-events: none; }
      body::before { width: 360px; height: 360px; top: -170px; right: -100px; background: rgba(204, 194, 255, .44); }
      body::after { width: 300px; height: 300px; bottom: -150px; left: -110px; background: rgba(186, 225, 255, .48); }
      main { position: relative; z-index: 1; display: grid; place-items: center; min-height: 100vh; padding: 24px; }
      .card { width: min(100%, 440px); padding: 42px 34px 36px; text-align: center; background: rgba(255,255,255,.82); border: 1px solid rgba(255,255,255,.9); border-radius: 32px; box-shadow: 0 24px 70px rgba(49, 55, 111, .15); backdrop-filter: blur(18px); }
      .brand { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 38px; font-size: 15px; font-weight: 800; letter-spacing: .23em; }
      .mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 12px; color: white; background: #222c62; font-size: 18px; letter-spacing: 0; box-shadow: 0 8px 18px rgba(34,44,98,.22); }
      .status { display: grid; place-items: center; width: 82px; height: 82px; margin: 0 auto 22px; border-radius: 28px; color: #222c62; background: #e9f8ec; font-size: 38px; font-weight: 700; }
      .status.error { background: #fff0ec; }
      h1 { margin: 0; font-size: clamp(30px, 8vw, 42px); line-height: 1.04; letter-spacing: -.05em; }
      p { margin: 16px auto 0; max-width: 330px; color: #737ba2; font-size: 16px; line-height: 1.55; }
      a { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 54px; margin-top: 30px; padding: 0 25px; border-radius: 17px; color: white; background: #8582e8; box-shadow: 0 12px 24px rgba(133,130,232,.28); font-size: 15px; font-weight: 800; text-decoration: none; }
      .hint { margin-top: 18px; color: #a0a3bb; font-size: 12px; }
      @media (max-width: 420px) { .card { padding: 34px 24px 30px; } }
    </style>
  </head>
  <body>
    <main>
      <section class="card" aria-live="polite">
        <div class="brand"><span class="mark">✦</span><span>BOOKEZ</span></div>
        <div class="status ${statusClass}">${error ? '!' : '✓'}</div>
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(copy)}</p>
        <a id="open-bookez" href="${escapeHtml(deepLink)}">${escapeHtml(buttonLabel)} <span aria-hidden="true">→</span></a>
        <div class="hint">If Bookez does not open automatically, tap the button above.</div>
      </section>
    </main>
    <script>
      const code = ${safeCode};
      const deepLink = ${JSON.stringify(deepLink).replaceAll('<', '\\u003c')};
      if (code) window.setTimeout(() => { window.location.href = deepLink; }, 850);
    </script>
  </body>
</html>`;
};

Deno.serve((request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const error = url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? '';
  return new Response(page({ code, error }), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
      'referrer-policy': 'no-referrer',
    },
  });
});
