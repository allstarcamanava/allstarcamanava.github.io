export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (!url.pathname.startsWith("/members")) {
    return context.next();
  }

  /* ========================================
     Public Members Routes
     ======================================== */

  if (url.pathname === "/members/login") {
    return context.next();
  }

  if (url.pathname === "/members/logout") {
    return context.next();
  }

  /* ========================================
     Google OAuth Routes
     ======================================== */

  if (
    url.pathname === "/members/google/login" ||
    url.pathname === "/members/google/callback"
  ) {
    return context.next();
  }

  /* ========================================
     Member Session Check
     ======================================== */

  const session = getCookie(
    context.request,
    "member_session"
  );

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


/* ========================================
   Cookie Helper
   ======================================== */

function getCookie(request, name) {
  const cookieHeader =
    request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  const cookies =
    cookieHeader.split(";");

  for (const cookie of cookies) {
    const [key, ...value] =
      cookie.trim().split("=");

    if (key === name) {
      return value.join("=");
    }
  }

  return null;
}


/* ========================================
   Login Redirect
   ======================================== */

function redirectToLogin(url) {
  const loginUrl =
    new URL("/members/login", url.origin);

  loginUrl.searchParams.set(
    "next",
    url.pathname + url.search
  );

  return Response.redirect(
    loginUrl.toString(),
    302
  );
}


/* ========================================
   Session Verification
   ======================================== */

async function verifySession(
  session,
  username,
  password
) {
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
          atob(
            payload
              .replace(/-/g, "+")
              .replace(/_/g, "/")
          ),
          c => c.charCodeAt(0)
        )
      )
    );
  } catch {
    return false;
  }

  if (
    !decoded.exp ||
    Date.now() > decoded.exp
  ) {
    return false;
  }

  if (decoded.username !== username) {
    return false;
  }

  const expectedSignature =
    await sign(payload, password);

  return timingSafeEqual(
    signature,
    expectedSignature
  );
}


/* ========================================
   HMAC Signature
   ======================================== */

async function sign(value, secret) {
  const key =
    await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(value)
    );

  return base64UrlEncode(
    new Uint8Array(signature)
  );
}


/* ========================================
   Base64 URL Encoding
   ======================================== */

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


/* ========================================
   Timing-Safe Comparison
   ======================================== */

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return result === 0;
}