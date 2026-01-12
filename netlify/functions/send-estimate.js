const buildEmailHtml = ({ title, rows }) => {
  const detailRows = rows
    .map((row) => `<tr><td style="padding:6px 0;font-weight:600;">${row.label}</td><td style="padding:6px 0;">${row.value}</td></tr>`)
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0b1f2a;">
      <h2 style="margin:0 0 12px;font-size:22px;">${title}</h2>
      <table style="width:100%;border-collapse:collapse;">${detailRows}</table>
      <p style="margin:16px 0 0;color:#4a606c;">Final pricing depends on load size, timing, and site access.</p>
    </div>
  `;
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { email, pickup, delivery, distanceKm, duration, estimate } = payload || {};

  if (!email || !pickup || !delivery || !estimate) {
    return { statusCode: 400, body: "Missing required fields" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ESTIMATE_FROM;
  const notifyTo = process.env.ESTIMATE_NOTIFY_TO;

  if (!apiKey || !from || !notifyTo) {
    return { statusCode: 500, body: "Missing email configuration" };
  }

  const estimateRows = [
    { label: "From", value: pickup },
    { label: "To", value: delivery },
    { label: "Distance", value: distanceKm ? `${distanceKm} km` : "N/A" },
    { label: "Time", value: duration || "N/A" },
    { label: "Minimum estimate", value: estimate }
  ];

  const userEmail = {
    from,
    to: [email],
    subject: "Your JML Hotshots estimate",
    html: buildEmailHtml({
      title: "Your estimate is ready",
      rows: estimateRows
    })
  };

  const notifyEmail = {
    from,
    to: [notifyTo],
    reply_to: email,
    subject: "New estimate generated",
    html: buildEmailHtml({
      title: "New estimate generated",
      rows: [{ label: "Customer email", value: email }, ...estimateRows]
    })
  };

  const sendEmail = async (message) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
  };

  try {
    await sendEmail(userEmail);
    await sendEmail(notifyEmail);
    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "OK"
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "Email send failed"
    };
  }
};
