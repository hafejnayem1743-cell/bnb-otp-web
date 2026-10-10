export async function handleIncomingSMS(request, env) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = request.headers.get("X-SMS-Webhook-Secret");
  if (!env.SMS_WEBHOOK_SECRET || secret !== env.SMS_WEBHOOK_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phone = String(body.phone || body.number || "").trim();
  const sender = String(body.sender || "").trim();
  const message = String(body.message || body.text || "").trim();

  if (!phone || !message) {
    return Response.json(
      { error: "phone and message are required" },
      { status: 400 }
    );
  }

  const number = await env.DB.prepare(
    `SELECT id, number, status
     FROM numbers
     WHERE number = ?
     LIMIT 1`
  ).bind(phone).first();

  if (!number) {
    return Response.json(
      { error: "Authorized number not registered" },
      { status: 404 }
    );
  }

  if (String(number.status).toLowerCase() === "off") {
    return Response.json(
      { error: "Number is disabled" },
      { status: 403 }
    );
  }

  const otpMatch = message.match(/\b\d{4,8}\b/);
  const code = otpMatch ? otpMatch[0] : "";

  const now = Math.floor(Date.now() / 1000);
  const expires = now + 10 * 60;

  await env.DB.prepare(
    `INSERT INTO otps
      (number_id, code, source, status, message, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    Number(number.id),
    code,
    "AUTHORIZED_SMS_WEBHOOK",
    "received",
    message,
    now,
    expires
  ).run();

  await env.DB.prepare(
    `UPDATE numbers
     SET status = 'received', updated_at = ?
     WHERE id = ?`
  ).bind(now, Number(number.id)).run();

  return Response.json({
    ok: true,
    number_id: Number(number.id),
    number: number.number,
    otp: code || null
  });
}
