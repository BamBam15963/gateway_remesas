
import https from "https";

/**
 * Gateway Proxy
 *
 * Recibe:
 *   POST /api/proxy
 *
 * Y retransmite a:
 *   process.env.TARGET_URL
 *
 * Características:
 * - Solo acepta POST
 * - Conserva headers
 * - Conserva query parameters
 * - Retransmite el body
 * - HTTPS
 * - No valida temporalmente el certificado SSL del destino
 * - Devuelve al cliente el status y body del servidor destino
 */

export default async function handler(req, res) {

  // ============================================================
  // 1. VALIDAR MÉTODO
  // ============================================================

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed",
      message: "Only POST requests are supported"
    });
  }


  // ============================================================
  // 2. OBTENER URL DE DESTINO
  // ============================================================

  const targetUrl = process.env.TARGET_URL;

  if (!targetUrl) {
    return res.status(500).json({
      error: "Configuration Error",
      message: "TARGET_URL is not configured"
    });
  }


  // ============================================================
  // 3. PROCESAR URL
  // ============================================================

  let url;

  try {
    url = new URL(targetUrl);
  } catch (error) {
    return res.status(500).json({
      error: "Configuration Error",
      message: "TARGET_URL is not a valid URL",
      details: error.message
    });
  }


  // ============================================================
  // 4. VALIDAR HTTPS
  // ============================================================

  if (url.protocol !== "https:") {
    return res.status(500).json({
      error: "Configuration Error",
      message: "TARGET_URL must use HTTPS"
    });
  }


  // ============================================================
  // 5. CAPTURAR HEADERS
  // ============================================================

  const headers = {
    ...req.headers
  };


  // ============================================================
  // 6. ELIMINAR HEADERS QUE NO DEBEMOS REENVIAR
  // ============================================================

  delete headers.host;
  delete headers["content-length"];
  delete headers.connection;


  // ============================================================
  // 7. PROCESAR BODY
  // ============================================================

  let body = "";

  try {

    if (req.body !== undefined && req.body !== null) {

      // JSON / objeto
      if (
        typeof req.body === "object" &&
        !(req.body instanceof Buffer)
      ) {

        body = JSON.stringify(req.body);

        if (!headers["content-type"]) {
          headers["content-type"] = "application/json";
        }

      } else {

        // String / Buffer
        body = req.body;
      }
    }

  } catch (error) {

    console.error("BODY PARSE ERROR:", error);

    return res.status(400).json({
      error: "Invalid Request Body",
      message: error.message
    });
  }


  // ============================================================
  // 8. LOG DE REQUEST
  // ============================================================

  console.log("==============================================");
  console.log("PROXY REQUEST");
  console.log("==============================================");

  console.log("Method:", req.method);
  console.log("Target:", targetUrl);
  console.log("Host:", url.hostname);
  console.log("Port:", url.port || 443);
  console.log("Path:", url.pathname);
  console.log("Query:", url.search);

  console.log("Headers:", headers);

  console.log("Body:", body);

  console.log("==============================================");


  // ============================================================
  // 9. HACER REQUEST AL SERVIDOR DESTINO
  // ============================================================

  try {

    const destinationResponse = await new Promise(
      (resolve, reject) => {

        const request = https.request(
          {
            hostname: url.hostname,

            port: url.port || 443,

            path: `${url.pathname}${url.search}`,

            method: "POST",

            headers: headers,

            /**
             * IMPORTANTE
             *
             * Desactiva la validación del certificado.
             *
             * Esto permite conectarse a servidores que utilizan:
             * - certificados autofirmados
             * - certificados internos
             * - certificados cuyo CN/SAN no coincide con la IP
             *
             * Para producción se recomienda cambiar a true.
             */
            rejectUnauthorized: false,

            /**
             * Timeout de conexión/request.
             */
            timeout: 30000
          },

          (response) => {

            let responseBody = "";


            // ==================================================
            // RECIBIR RESPUESTA
            // ==================================================

            response.on("data", (chunk) => {

              responseBody += chunk.toString();

            });


            // ==================================================
            // REQUEST COMPLETADO
            // ==================================================

            response.on("end", () => {

              resolve({

                statusCode:
                  response.statusCode || 502,

                headers:
                  response.headers || {},

                body:
                  responseBody

              });

            });

          }
        );


        // ======================================================
        // TIMEOUT
        // ======================================================

        request.setTimeout(30000, () => {

          request.destroy(
            new Error(
              "Connection timeout after 30 seconds"
            )
          );

        });


        // ======================================================
        // ERROR DE CONEXIÓN
        // ======================================================

        request.on("error", (error) => {

          reject(error);

        });


        // ======================================================
        // ENVIAR BODY
        // ======================================================

        if (body) {

          request.write(body);

        }


        // ======================================================
        // FINALIZAR REQUEST
        // ======================================================

        request.end();

      }
    );


    // ==========================================================
    // 10. LOG DE RESPUESTA
    // ==========================================================

    console.log("==============================================");
    console.log("DESTINATION RESPONSE");
    console.log("==============================================");

    console.log(
      "Status:",
      destinationResponse.statusCode
    );

    console.log(
      "Headers:",
      destinationResponse.headers
    );

    console.log(
      "Body:",
      destinationResponse.body
    );

    console.log("==============================================");


    // ==========================================================
    // 11. COPIAR CONTENT-TYPE
    // ==========================================================

    const responseContentType =
      destinationResponse.headers["content-type"];

    if (responseContentType) {

      res.setHeader(
        "content-type",
        responseContentType
      );

    }


    // ==========================================================
    // 12. DEVOLVER RESPUESTA AL CLIENTE
    // ==========================================================

    return res
      .status(destinationResponse.statusCode)
      .send(destinationResponse.body);


  } catch (error) {


    // ==========================================================
    // 13. MANEJO DE ERROR
    // ==========================================================

    console.error("==============================================");
    console.error("PROXY ERROR");
    console.error("==============================================");

    console.error("Message:", error.message);
    console.error("Code:", error.code);
    console.error("Name:", error.name);

    console.error("==============================================");


    return res.status(502).json({

      error: "Bad Gateway",

      message:
        "Could not forward request",

      details:
        error.message,

      code:
        error.code || null

    });

  }

}
