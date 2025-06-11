const axios = require("axios");

exports.handler = async (event) => {
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
          "api-key": process.env.BREVO_API_KEY, // ✅ pulled from Netlify env
          "Content-Type": "application/json",
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Subscribed!" }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.response?.data || "Unknown error" }),
    };
  }
};
