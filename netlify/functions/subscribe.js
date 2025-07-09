const axios = require("axios");

exports.handler = async (event) => {
  console.log("Function triggered");

  if (event.httpMethod !== "POST") {
    console.warn("Invalid HTTP method:", event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!event.body) {
    console.warn("Missing request body");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body);
  } catch (e) {
    console.error("Invalid JSON input:", e);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON format" }),
    };
  }

  const { email, name } = parsed;

  if (!email || !name) {
    console.warn("Missing email or name:", { email, name });
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email and name are required" }),
    };
  }

  try {
    console.log("Sending to Brevo:", { email, name });

    await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email,
        attributes: {
          FIRSTNAME: name,
        },
        listIds: [3],
        updateEnabled: true,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Success");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Subscribed!" }),
    };
  } catch (error) {
    console.error("Brevo API error:", error?.response?.data || error.message || error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error?.response?.data || error.message || "Unknown error",
      }),
    };
  }
};
