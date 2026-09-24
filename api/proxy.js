
export default async function handler(req, res) {
  // Solo aceptamos POST
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
    // Capturar query parameters
    const query = new URLSearchParams(req.query || {});

    const destination = new URL(targetUrl);

    query.forEach((value, key) => {
      destination.searchParams.set(key, value);
    });

    // Copiar headers recibidos
    const headers = { ...req.headers };

    // Estos headers no deben reenviarse directamente
    delete headers.host;
    delete headers["content-length"];

    // El body de Vercel normalmente ya viene parseado.
    let body;

    if (req.body !== undefined && req.body !== null) {
      if (
        typeof req.body === "object" &&
        !(req.body instanceof Buffer)
      ) {
        body = JSON.stringify(req.body);

        headers["content-type"] =
          headers["content-type"] || "application/json";
      } else {
        body = req.body;
      }
    }

    // Retransmitir solicitud
    const response = await fetch(destination.toString(), {
      method: "POST",
      headers,
      body
    });

    // Intentar conservar el tipo de respuesta
    const contentType = response.headers.get("content-type");

    if (contentType) {
      res.setHeader("content-type", contentType);
    }

    const responseText = await response.text();

    return res.status(response.status).send(responseText);

  } catch (error) {
    console.error("Proxy error:", error);

    return res.status(502).json({
      error: "Bad Gateway",
      message: "Could not forward request",
      details: error.message
    });
  }
}
