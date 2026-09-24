export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST requests are supported"
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

    const headers = { ...req.headers };

    // No reenviar estos headers porque corresponden
    // a la conexión original con Vercel.
    delete headers.host;
    delete headers["content-length"];

    let body;

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
    console.error(error);
    console.error("CAUSE:", error?.cause);
    console.error("=================================");

    return res.status(502).json({
      error: "Bad Gateway",
      message: "Could not forward request",
      details: error?.message,
      code: error?.cause?.code || null
    });
  }
}
