let stripeClient = null;

const getStripeSecretKey = () => String(process.env.STRIPE_SECRET_KEY || '').trim();
const getStripeWebhookSecret = () => String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();

const getStripeClient = () => {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;
  if (stripeClient) return stripeClient;
  const Stripe = require('stripe');
  stripeClient = new Stripe(secretKey);
  return stripeClient;
};

module.exports = {
  getStripeClient,
  getStripeSecretKey,
  getStripeWebhookSecret,
};
