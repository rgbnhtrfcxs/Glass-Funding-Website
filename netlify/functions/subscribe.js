const axios = require("axios");

exports.handler = async (event) => {
  // Prevent non-POST requests from crashing
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // Prevent empty body from being parsed
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  const { email } = JSON.parse(event.body);

  if (!email) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Email is required" }),
    };
  }

  try {
    await axios.post(
      "https://api.brevo.com/v3/contacts",
      {
        email,
        listIds: [3], // ✅ your Brevo waitlist ID
        updateEnabled: true,
      },
      {
        headers: {
          "api-key": process.env.BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Subscribed!" }),
    };
  } catch (error) {
    console.error("Brevo API error:", error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.response?.data || "Unknown error",
      }),
    };
  }
};
