export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  /* ========================================
     Google OAuth Error
     ======================================== */

  if (error) {
    return new Response(
      `<h1>Google Sign-In Cancelled</h1>
       <p>You can close this page and try again.</p>
       <p><a href="/members/login">Back to Members Login</a></p>`,
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

  /* ========================================
     Verify OAuth State Cookie
     ======================================== */

  const stateCookie = getCookie(
    request,
    "google_oauth_state"
  );

  if (!stateCookie) {
    return new Response(
      "DEBUG: google_oauth_state cookie is missing.",
      { status: 403 }
    );
  }

  if (decodeURIComponent(stateCookie) !== returnedState) {
    return new Response(
      "DEBUG: google_oauth_state cookie exists, but does not match returned state.",
      { status: 403 }
    );
  }

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

  /* ========================================
     Exchange Authorization Code
     ======================================== */

  const tokenResponse = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
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

  /* ========================================
     Get Authenticated Google Account
     ======================================== */

  const userResponse = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization:
          `Bearer ${tokens.access_token}`,
      },
    }
  );

  if (!userResponse.ok) {
    return new Response(
      "Unable to verify the Google account.",
      { status: 502 }
    );
  }

  const googleUser = await userResponse.json();

  const googleEmail =
    typeof googleUser.email === "string"
      ? googleUser.email.trim().toLowerCase()
      : "";

  const emailVerified =
    googleUser.email_verified === true;

  if (!googleEmail || !emailVerified) {
    return new Response(
      `<h1>Google Account Not Verified</h1>
       <p>The Google account could not be verified.</p>
       <p><a href="/members/login">Back to Members Login</a></p>`,
      {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      }
    );
  }

  /* ========================================
     Check Approved Google Accounts
     ======================================== */

  const allowedEmails = (
    env.GOOGLE_ALLOWED_EMAILS || ""
  )
    .split(",")
    .map((email) =>
      email.trim().toLowerCase()
    )
    .filter(Boolean);

  if (!allowedEmails.includes(googleEmail)) {
    return new Response(
      `<h1>Access Denied</h1>
       <p>
         This Google account is not authorized
         to access the Members Area.
       </p>
       <p>
         Please use an approved member account.
       </p>
       <p>
         <a href="/members/login">
           Back to Members Login
         </a>
       </p>`,
      {
        status: 403,
        headers: {
          "Content-Type": "text/html; charset=UTF-8",
        },
      }
    );
  }

  /* ========================================
     Create Member Session
     ======================================== */

  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        username: env.MEMBER_USERNAME,
        google_email: googleEmail,
        exp: Date.now() + 8 * 60 * 60 * 1000,
      })
    )
  );

  const memberSignature = await sign(
    payload,
    env.MEMBER_PASSWORD
  );

  const memberSession =
    `${payload}.${memberSignature}`;

  /* ========================================
     Store Google Access Token
     ======================================== */

  const maxAge = Math.min(
    Number(tokens.expires_in || 3600),
    3600
  );

  const googleAccessCookie =
    `google_access_token=${encodeURIComponent(
      tokens.access_token
    )}; ` +
    `Path=/members; ` +
    `Max-Age=${maxAge}; ` +
    "HttpOnly; Secure; SameSite=Lax";

  /* ========================================
     Clear OAuth State Cookie
     ======================================== */

  const clearStateCookie =
    "google_oauth_state=; " +
    "Path=/members/google; " +
    "Max-Age=0; " +
    "HttpOnly; Secure; SameSite=Lax";

  /* ========================================
     Set Sessions and Redirect
     ======================================== */

  const headers = new Headers();

  headers.set(
    "Location",
    "/members/"
  );

  headers.append(
    "Set-Cookie",
    `member_session=${memberSession}; ` +
      "Path=/members; " +
      "Max-Age=28800; " +
      "HttpOnly; Secure; SameSite=Lax"
  );

  headers.append(
    "Set-Cookie",
    googleAccessCookie
  );

  headers.append(
    "Set-Cookie",
    clearStateCookie
  );

  return new Response(null, {
    status: 302,
    headers,
  });
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
   Signature Verification
   ======================================== */

async function verifySignature(
  value,
  signature,
  secret
) {
  const expected =
    await sign(value, secret);

  return timingSafeEqual(
    signature,
    expected
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