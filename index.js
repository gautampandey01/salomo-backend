const express = require("express");
const Stripe = require("stripe");
const cors = require("cors");
require("dotenv").config();

const app = express();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const CLIENT_URL = process.env.CLIENT_URL || "https://projapani.vercel.app";

if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
  console.error("⚠️ Missing Stripe keys in .env file!");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

app.use(
  cors({
    origin: [
      CLIENT_URL,
      "http://localhost:3000",
      "http://localhost:5002",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
  })
);
app.use(express.json());

// Quick endpoint to expose publishable key to client
app.get("/config", (_req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY });
});

// Create checkout session
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { summary } = req.body || {};
    const descParts = [];
    if (summary?.menu) descParts.push(`Menu: ${summary.menu}`);
    if (summary?.area) descParts.push(`Area: ${summary.area}`);
    if (summary?.date || summary?.time)
      descParts.push(`When: ${summary?.date || ""} ${summary?.time || ""}`.trim());
    if (summary?.budget) descParts.push(`Budget: ¥${summary.budget}`);
    const description =
      descParts.join(" / ") || "SALOMO match fee (details not provided)";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: 500,
            product_data: {
              name: "SALOMO Match Fee",
              description,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${CLIENT_URL}/cancel`,
      metadata: summary || {},
    });

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("[stripe] create session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ New endpoint: retrieve checkout session details
app.get("/checkout-session/:id", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.id, {
      expand: ["customer_details", "line_items"],
    });
    res.json(session);
  } catch (err) {
    console.error("Error retrieving checkout session:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
