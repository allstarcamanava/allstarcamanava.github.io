export async function onRequest(context) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/members/login",
      "Set-Cookie":
        "member_session=; Path=/members; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
    },
  });
}