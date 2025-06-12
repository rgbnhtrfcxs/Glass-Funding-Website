const axios = require("axios");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing request body" }),
    };
  }

  const { name, email, message } = JSON.parse(event.body);

  if (!name || !email || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Name, email, and message are required" }),
    };
  }

  try {
    const brevoRes = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Glass Contact Form",
          email: "no-reply@glass-funding.com", // ✅ must be verified in Brevo
        },
        to: [
          {
            email: "contact@glass-funding.com", // ✅ your real inbox
            name: "Glass Team",
          },
        ],
        subject: "📩 New Contact Form Submission",
        htmlContent: `
          <h2>New Message from Glass Contact Form</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong><br>${message}</p>
        `,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_SMTP_KEY, // 🔒 Hardcoded for testing only
        },
      }
    );

    if (!brevoRes.data.messageId) {
      console.error("Unexpected Brevo response:", brevoRes.data);
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "Email not accepted by Brevo",
          details: brevoRes.data,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Email sent successfully!" }),
    };
  } catch (error) {
    console.error("Brevo SMTP error:", error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to send email",
        details: error.response?.data || error.message,
      }),
    };
  }
};
