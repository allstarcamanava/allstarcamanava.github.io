export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);

  const next = getSafeNext(
    url.searchParams.get("next")
  );

  const state = crypto.randomUUID();

  const signature = await sign(
    state,
    env.GOOGLE_STATE_SECRET
  );

  const signedState = `${state}.${signature}`;

  const googleUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth"
  );

  googleUrl.searchParams.set(
    "client_id",
    env.GOOGLE_CLIENT_ID
  );

  googleUrl.searchParams.set(
    "redirect_uri",
    "https://allstarcamanava.org/members/google/callback"
  );

  googleUrl.searchParams.set(
    "response_type",
    "code"
  );

  googleUrl.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/drive.readonly"
  );

  googleUrl.searchParams.set(
    "access_type",
    "offline"
  );

  googleUrl.searchParams.set(
    "prompt",
    "consent"
  );

  googleUrl.searchParams.set(
    "state",
    signedState
  );

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: googleUrl.toString(),
      "Set-Cookie":
        `google_oauth_state=${encodeURIComponent(
          signedState
        )}; ` +
        "Path=/; " +
        "Max-Age=600; " +
        "HttpOnly; Secure; SameSite=None",
    },
  });

  return response;
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

  return base64UrlEncode(
    new Uint8Array(signature)
  );
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