const express = require('express');

const Order = require('../models/Order');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { getStripeClient, getStripeWebhookSecret } = require('../lib/stripe');

const router = express.Router();

const toId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const resolvePaidAt = (session) => {
  if (Number.isFinite(Number(session?.created))) return new Date(Number(session.created) * 1000);
  return new Date();
};

const resolveCapturedAmount = (session, order) => {
  const amountTotal = Number(session?.amount_total);
  if (Number.isFinite(amountTotal) && amountTotal >= 0) return Number((amountTotal / 100).toFixed(2));
  return Number((Number(order?.total || 0) * 1.1).toFixed(2));
};

const resolveCapturedCurrency = (session) => {
  const currency = String(session?.currency || 'aud').trim();
  return (currency || 'aud').toUpperCase();
};

const resolveTransactionId = (session) => {
  const paymentIntent =
    typeof session?.payment_intent === 'string' ? session.payment_intent : String(session?.payment_intent?.id || '');
  return paymentIntent || String(session?.id || '');
};

const findOrderForSession = async (session) => {
  const metadataOrderId = String(session?.metadata?.orderId || '').trim();
  if (metadataOrderId) {
    const byMetadata = await Order.findById(metadataOrderId);
    if (byMetadata) return byMetadata;
  }
  const sessionId = String(session?.id || '').trim();
  if (!sessionId) return null;
  return Order.findOne({ stripeCheckoutSessionId: sessionId });
};

const decreaseInventoryForOrder = async (order) => {
  const lines = (Array.isArray(order?.items) ? order.items : [])
    .map((item) => ({
      productId: toId(item?.productId),
      qty: Math.max(1, Number(item?.qty || 1)),
      title: String(item?.title || 'item'),
    }))
    .filter((line) => line.productId);

  if (!lines.length) return { ok: true };

  const products = await Product.find({ _id: { $in: lines.map((line) => line.productId) } });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  for (const line of lines) {
    const product = productMap.get(line.productId);
    if (!product) return { ok: false, reason: `${line.title} was not found.` };
    if (Number(product.quantity || 0) < line.qty) {
      return { ok: false, reason: `Insufficient stock for ${line.title}.` };
    }
  }

  for (const line of lines) {
    const product = productMap.get(line.productId);
    product.quantity = Math.max(0, Number(product.quantity || 0) - line.qty);
    product.inStock = product.quantity > 0;
    product.status = product.quantity > 0 ? 'available' : 'out-of-stock';
    await product.save();
  }

  return { ok: true };
};

const onCheckoutCompleted = async (session) => {
  const order = await findOrderForSession(session);
  if (!order) return;
  if (order.paymentCapturedAt) return;

  const inventory = await decreaseInventoryForOrder(order);
  const paidAt = resolvePaidAt(session);

  order.paymentStatus = 'Paid';
  order.paymentCapturedAt = paidAt;
  order.paymentAmount = resolveCapturedAmount(session, order);
  order.paymentCurrency = resolveCapturedCurrency(session);
  order.paymentTransactionId = resolveTransactionId(session);
  order.paymentProvider = 'stripe';
  order.stripeCheckoutSessionId = String(session?.id || order.stripeCheckoutSessionId || '');

  if (inventory.ok) {
    if (order.status === 'Pending Payment') order.status = 'Shipping';
    order.paymentFailureReason = '';
    if (order.customer) {
      await Customer.findByIdAndUpdate(order.customer, {
        $inc: { purchasesTotal: Number(order.total || 0) },
      });
    }
  } else {
    order.status = 'Cancelled';
    order.paymentFailureReason = `Payment captured but order cannot be fulfilled automatically: ${inventory.reason}`;
  }

  await order.save();
};

const onCheckoutNotCompleted = async (session, reasonText) => {
  const order = await findOrderForSession(session);
  if (!order) return;
  if (order.paymentCapturedAt || order.paymentStatus === 'Paid') return;

  if (order.status === 'Pending Payment') {
    order.status = 'Cancelled';
    if (order.customer) {
      await Customer.findByIdAndUpdate(order.customer, { $inc: { orderCount: -1 } });
    }
  }
  order.paymentFailureReason = reasonText;
  await order.save();
};

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) return res.status(503).send('Stripe is not configured');

  let event;
  try {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = getStripeWebhookSecret();
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString('utf8'));
    }
  } catch (err) {
    console.error('Stripe webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await onCheckoutCompleted(event.data.object);
    }

    if (event.type === 'checkout.session.expired') {
      await onCheckoutNotCompleted(event.data.object, 'Checkout session expired before payment completed.');
    }

    if (event.type === 'checkout.session.async_payment_failed') {
      await onCheckoutNotCompleted(event.data.object, 'Stripe reported a failed payment attempt.');
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handling failed', err);
    res.status(500).send('Webhook handler failed');
  }
});

module.exports = router;
