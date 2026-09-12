export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === "GET") {
    return showLoginPage(url);
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        Allow: "GET, POST",
      },
    });
  }

  const form = await request.formData();

  const username = form.get("username");
  const password = form.get("password");

  if (
    typeof username !== "string" ||
    typeof password !== "string"
  ) {
    return showLoginPage(
      url,
      "Please enter your username and password."
    );
  }

  if (
    username !== env.MEMBER_USERNAME ||
    password !== env.MEMBER_PASSWORD
  ) {
    return showLoginPage(
      url,
      "Incorrect username or password."
    );
  }

  const next = getSafeNext(url.searchParams.get("next"));

  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        username,
        exp: Date.now() + 8 * 60 * 60 * 1000,
      })
    )
  );

  const signature = await sign(
    payload,
    env.MEMBER_PASSWORD
  );

  const session = `${payload}.${signature}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: next,
      "Set-Cookie":
        `member_session=${session}; ` +
        "Path=/members; " +
        "Max-Age=28800; " +
        "HttpOnly; " +
        "Secure; " +
        "SameSite=Lax",
    },
  });
}

function showLoginPage(url, error = "") {
  const next = getSafeNext(url.searchParams.get("next"));

  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Members Area — Rotary E-Club of All Star CAMANAVA</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      font-family: Arial, sans-serif;
      background: #f6fbfb;
      color: #0b2b2e;
    }

    .login-card {
      width: 100%;
      max-width: 430px;
      padding: 42px;
      background: white;
      border: 1px solid #cfeaea;
      border-radius: 16px;
      box-shadow: 0 12px 40px rgba(11, 43, 46, 0.10);
    }

    .brand {
      text-align: center;
      margin-bottom: 30px;
    }

    .brand-mark {
      width: 64px;
      height: 64px;
      margin: 0 auto 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #00cccc;
      color: white;
      font-size: 25px;
      font-weight: 700;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 25px;
    }

    .subtitle {
      margin: 0;
      color: #557174;
      line-height: 1.5;
    }

    label {
      display: block;
      margin: 20px 0 7px;
      font-size: 14px;
      font-weight: 600;
    }

    input {
      width: 100%;
      padding: 13px 14px;
      border: 1px solid #b9dada;
      border-radius: 9px;
      font-size: 16px;
      outline: none;
    }

    input:focus {
      border-color: #00aaaa;
      box-shadow: 0 0 0 3px rgba(0, 204, 204, 0.12);
    }

    button {
      width: 100%;
      margin-top: 26px;
      padding: 14px;
      border: 0;
      border-radius: 9px;
      background: #049393;
      color: white;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }

    button:hover {
      background: #037878;
    }

    .error {
      margin-top: 20px;
      padding: 12px 14px;
      border-radius: 8px;
      background: #fff1f1;
      color: #a12626;
      font-size: 14px;
      line-height: 1.4;
    }

    .footer {
      margin-top: 25px;
      text-align: center;
      color: #718486;
      font-size: 12px;
    }
  </style>
</head>

<body>
  <main class="login-card">
    <div class="brand">
      <div class="brand-mark">R</div>

      <h1>Members Area</h1>

      <p class="subtitle">
        Rotary E-Club of All Star CAMANAVA
      </p>
    </div>

    <form method="POST" action="/members/login?next=${encodeURIComponent(next)}">
      <label for="username">Username</label>

      <input
        id="username"
        name="username"
        type="text"
        autocomplete="username"
        required
        autofocus
      >

      <label for="password">Password</label>

      <input
        id="password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
      >

      <button type="submit">
        Log In
      </button>

      ${errorHtml}
    </form>

    <div class="footer">
      Authorized members only
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function getSafeNext(next) {
  if (
    typeof next !== "string" ||
    !next.startsWith("/") ||
    next.startsWith("//")
  ) {
    return "/members/";
  }

  return next;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}