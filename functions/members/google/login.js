export async function onRequest(context) {
  const { request, env } = context;

  // The member must already be logged into the website.
  const memberSession = getCookie(request, "member_session");

  if (!memberSession) {
    return Response.redirect(
      new URL("/members/login", request.url).toString(),
      302
    );
  }

  const state = crypto.randomUUID();

  // Sign the state so the callback can verify that it came from us.
  const signature = await sign(state, env.GOOGLE_STATE_SECRET);

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
    "https://www.googleapis.com/auth/drive.readonly"
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

  return new Response(null, {
    status: 302,
    headers: {
      Location: googleUrl.toString(),

      // Store the state temporarily in an HttpOnly cookie.
      "Set-Cookie":
        `google_oauth_state=${signedState}; ` +
        "Path=/members/google; " +
        "Max-Age=600; " +
        "HttpOnly; Secure; SameSite=Lax",
    },
  });
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