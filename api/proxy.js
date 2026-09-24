  export default async function handler(req, res) {
  return res.status(200).json({
    targetUrl: process.env.TARGET_URL || null,
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelUrl: process.env.VERCEL_URL || null
  });
}

  const targetUrl = process.env.TARGET_URL;

  if (!targetUrl) {
    return res.status(500).json({
      error: "TARGET_URL is not configured"
    });
  }

  try {
    const destination = new URL(targetUrl);

    // Copiar headers
    const headers = { ...req.headers };

    delete headers.host;
    delete headers["content-length"];

    let body = undefined;

    if (req.body !== undefined && req.body !== null) {
      if (
        typeof req.body === "object" &&
        !(req.body instanceof Buffer)
      ) {
        body = JSON.stringify(req.body);

        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }
      } else {
        body = req.body;
      }
    }

    console.log("=================================");
    console.log("PROXY REQUEST");
    console.log("TARGET:", destination.toString());
    console.log("METHOD:", req.method);
    console.log("HEADERS:", headers);
    console.log("BODY:", body);
    console.log("=================================");

    const response = await fetch(destination.toString(), {
      method: "POST",
      headers,
      body
    });

    const responseText = await response.text();

    console.log("DESTINATION STATUS:", response.status);
    console.log("DESTINATION RESPONSE:", responseText);

    const contentType = response.headers.get("content-type");

    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    return res.status(response.status).send(responseText);

  } catch (error) {

    console.error("=================================");
    console.error("PROXY ERROR");
    console.error("NAME:", error?.name);
    console.error("MESSAGE:", error?.message);
    console.error("CAUSE:", error?.cause);
    console.error("STACK:", error?.stack);
    console.error("=================================");

    return res.status(502).json({
      error: "Bad Gateway",
      message: "Could not forward request",
      details: error?.message,
      errorName: error?.name,
      cause: error?.cause?.message || null,
      code: error?.cause?.code || null
    });
  }
}
