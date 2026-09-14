export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // User cancelled or Google returned an OAuth error.
  if (error) {
    return new Response(
      `<h1>Google Sign-In Cancelled</h1>
       <p>You can close this page and try again.</p>
       <p><a href="/members/">Back to Members Area</a></p>`,
      {
        status: 400,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      }
    );
  }

  if (!code || !returnedState) {
    return new Response(
      "Missing Google OAuth response.",
      { status: 400 }
    );
  }

  // Check the OAuth state cookie.
  const stateCookie = getCookie(
    request,
    "google_oauth_state"
  );

  if (!stateCookie || stateCookie !== returnedState) {
    return new Response(
      "Invalid OAuth state.",
      { status: 403 }
    );
  }

  // Verify the state signature.
  const stateParts = returnedState.split(".");

  if (stateParts.length !== 2) {
    return new Response(
      "Invalid OAuth state.",
      { status: 403 }
    );
  }

  const [state, signature] = stateParts;

  const validState = await verifySignature(
    state,
    signature,
    env.GOOGLE_STATE_SECRET
  );

  if (!validState) {
    return new Response(
      "Invalid OAuth state signature.",
      { status: 403 }
    );
  }

  // Exchange Google's authorization code for tokens.
  const tokenResponse = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri:
          "https://allstarcamanava.org/members/google/callback",
        grant_type: "authorization_code",
      }),
    }
  );

  if (!tokenResponse.ok) {
    return new Response(
      "Google token exchange failed.",
      { status: 502 }
    );
  }

  const tokens = await tokenResponse.json();

  if (!tokens.access_token) {
    return new Response(
      "Google did not return an access token.",
      { status: 502 }
    );
  }

  /*
   * For this first version, store the access token in a
   * short-lived HttpOnly cookie.
   *
   * The access token normally expires after about one hour.
   * We will improve the token/session handling after the
   * basic Google connection is confirmed.
   */
  const maxAge = Math.min(
    Number(tokens.expires_in || 3600),
    3600
  );

  const googleAccessCookie =
    `google_access_token=${encodeURIComponent(tokens.access_token)}; ` +
    `Path=/members; ` +
    `Max-Age=${maxAge}; ` +
    "HttpOnly; Secure; SameSite=Lax";

  const clearStateCookie =
    "google_oauth_state=; " +
    "Path=/members/google; " +
    "Max-Age=0; " +
    "HttpOnly; Secure; SameSite=Lax";

    const headers = new Headers();

    headers.set("Location", "/members/");
    headers.append("Set-Cookie", googleAccessCookie);
    headers.append("Set-Cookie", clearStateCookie);

    return new Response(null, {
    status: 302,
    headers,
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

async function verifySignature(value, signature, secret) {
  const expected = await sign(value, secret);

  return timingSafeEqual(signature, expected);
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