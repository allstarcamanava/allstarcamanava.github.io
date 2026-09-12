// Protect the Members area with a Cloudflare Pages session
export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Anything outside /members/ remains public
  if (!url.pathname.startsWith("/members")) {
    return context.next();
  }

  // The login page itself must remain accessible
  if (url.pathname === "/members/login") {
    return context.next();
  }

  // Allow logout endpoint
  if (url.pathname === "/members/logout") {
    return context.next();
  }

  const session = getCookie(context.request, "member_session");

  if (!session) {
    return redirectToLogin(url);
  }

  const valid = await verifySession(
    session,
    context.env.MEMBER_USERNAME,
    context.env.MEMBER_PASSWORD
  );

  if (!valid) {
    return redirectToLogin(url);
  }

  return context.next();
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");

    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}

function redirectToLogin(url) {
  const loginUrl = new URL("/members/login", url.origin);

  // Remember where the visitor wanted to go
  loginUrl.searchParams.set(
    "next",
    url.pathname + url.search
  );

  return Response.redirect(loginUrl.toString(), 302);
}

async function verifySession(session, username, password) {
  const parts = session.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [payload, signature] = parts;

  let decoded;

  try {
    decoded = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
          c => c.charCodeAt(0)
        )
      )
    );
  } catch {
    return false;
  }

  // Session expires after 8 hours
  if (!decoded.exp || Date.now() > decoded.exp) {
    return false;
  }

  if (decoded.username !== username) {
    return false;
  }

  const expectedSignature = await sign(
    payload,
    password
  );

  return timingSafeEqual(signature, expectedSignature);
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

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}