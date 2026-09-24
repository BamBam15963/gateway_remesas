
import { Agent } from "undici";

const insecureAgent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

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
    const headers = { ...req.headers };

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

    console.log("TARGET:", targetUrl);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
      dispatcher: insecureAgent
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
    console.error("PROXY ERROR:", error);
    console.error("CAUSE:", error?.cause);

    return res.status(502).json({
      error: "Bad Gateway",
      message: "Could not forward request",
      details: error?.message,
      code: error?.cause?.code || null
    });
  }
}
