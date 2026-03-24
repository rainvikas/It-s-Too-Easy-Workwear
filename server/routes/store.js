const express = require('express');
const bcrypt = require('bcryptjs');

const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { getStripeClient } = require('../lib/stripe');
const { emitConversationMessage } = require('../realtime/socketHub');

const router = express.Router();

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildOrderNumber = () => {
  const stamp = Date.now().toString().slice(-7);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `ORD-${stamp}${rand}`;
};
const normalizePaymentMethod = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['card', 'bank', 'cash'].includes(normalized)) return normalized;
  return 'card';
};
const buildStoreClientUrl = (req) => {
  const fromEnv = String(process.env.STORE_FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  const origin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (origin && !origin.includes('localhost:4000')) return origin;

  const fallback = String(process.env.STORE_CLIENT_URL || '').trim().replace(/\/+$/, '');
  if (fallback) return fallback;

  return 'http://localhost:5173';
};
const toCurrencyCents = (value) => Math.max(0, Math.round(Number(value || 0) * 100));
const buildStripeLineItems = (items = [], gstAmount = 0) => {
  const lineItems = items.map((item) => ({
    quantity: Math.max(1, Number(item.qty || 1)),
    price_data: {
      currency: 'aud',
      unit_amount: toCurrencyCents(item.price),
      product_data: {
        name: String(item.title || 'Workwear Item').slice(0, 120),
      },
    },
  }));

  if (Number(gstAmount || 0) > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'aud',
        unit_amount: toCurrencyCents(gstAmount),
        product_data: {
          name: 'GST',
        },
      },
    });
  }

  return lineItems;
};

const normalizeEmail = (value = '') => value.trim().toLowerCase();
const objectIdPattern = /^[a-fA-F0-9]{24}$/;
const toIdString = (value = '') => {
  let source = value;
  if (value && typeof value === 'object') {
    source = value._id ?? value.product ?? value.productId ?? value;
  }
  const normalized = String(source || '').trim();
  return objectIdPattern.test(normalized) ? normalized : '';
};
const pickUniqueIds = (values, limit) => {
  if (!Array.isArray(values)) return [];
  const result = [];
  const seen = new Set();
  for (const raw of values) {
    const id = toIdString(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
};
const serializePreferences = (user) => ({
  wishlist: Array.isArray(user.wishlist)
    ? user.wishlist
        .filter((item) => toIdString(item?.product))
        .map((item) => ({
          productId: toIdString(item.product),
          savedPrice: Number(item.savedPrice || 0),
          savedInStock: Boolean(item.savedInStock),
          addedAt: item.addedAt || null,
        }))
    : [],
  recentlyViewed: Array.isArray(user.recentlyViewed)
    ? user.recentlyViewed
        .filter((item) => toIdString(item?.product))
        .map((item) => ({
          productId: toIdString(item.product),
          viewedAt: item.viewedAt || null,
        }))
    : [],
});

const pickSort = (sortBy = 'newest') => {
  if (sortBy === 'priceAsc') return { price: 1, createdAt: -1 };
  if (sortBy === 'priceDesc') return { price: -1, createdAt: -1 };
  if (sortBy === 'nameAsc') return { title: 1 };
  return { createdAt: -1 };
};

const getAuthedUser = async (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ message: 'Authentication required' });
    return null;
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(401).json({ message: 'Invalid session' });
    return null;
  }

  return user;
};

router.get('/products', async (req, res) => {
  try {
    const search = (req.query.search || '').toString().trim();
    const category = (req.query.category || '').toString().trim();
    const sortBy = (req.query.sortBy || 'newest').toString();

    const filter = {};
    if (category && category.toLowerCase() !== 'all') {
      filter.category = category;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ title: regex }, { description: regex }, { sku: regex }, { category: regex }];
    }

    const products = await Product.find(filter).sort(pickSort(sortBy)).lean();
    res.json(products);
  } catch (err) {
    console.error('Error fetching storefront products', err);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error('Error fetching storefront product', err);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

router.get('/config', async (_req, res) => {
  try {
    const stripeEnabled = Boolean(getStripeClient());
    res.json({
      payment: {
        cardEnabled: stripeEnabled,
        defaultMethod: stripeEnabled ? 'card' : 'cash',
        methods: {
          card: stripeEnabled,
          bank: true,
          cash: true,
        },
      },
    });
  } catch (err) {
    console.error('Error loading storefront config', err);
    res.status(500).json({
      payment: {
        cardEnabled: false,
        defaultMethod: 'cash',
        methods: {
          card: false,
          bank: true,
          cash: true,
        },
      },
    });
  }
});

router.get('/reviews', async (req, res) => {
  try {
    const productId = (req.query.productId || '').toString().trim();
    const page = Number.isFinite(Number(req.query.page)) ? Math.max(Number(req.query.page), 1) : 1;
    const limit = Number.isFinite(Number(req.query.limit)) ? Math.min(Math.max(Number(req.query.limit), 1), 30) : 8;

    const filter = { status: 'approved' };
    if (productId) filter.product = productId;

    const [data, total] = await Promise.all([
      Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Review.countDocuments(filter),
    ]);

    res.json({ data, total, page, limit });
  } catch (err) {
    console.error('Error fetching storefront reviews', err);
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

router.post('/reviews', async (req, res) => {
  try {
    const {
      productId,
      customerName,
      customerEmail,
      customerLocation,
      rating,
      reviewText,
    } = req.body;

    if (!productId || !customerName || !reviewText) {
      return res.status(400).json({ message: 'productId, customerName and reviewText are required' });
    }

    const product = await Product.findById(productId).select('title imageUrl').lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const email = normalizeEmail(customerEmail || '');
    let customer = null;
    if (email) {
      customer = await Customer.findOne({ email });
      if (!customer) {
        customer = await Customer.create({
          name: customerName,
          email,
          address: customerLocation || '',
          status: 'active',
        });
      }
    }

    const normalizedRating = Number(rating);
    const safeRating = Number.isFinite(normalizedRating)
      ? Math.max(1, Math.min(5, normalizedRating))
      : 5;

    const review = await Review.create({
      product: product._id,
      productName: product.title,
      productImageUrl: product.imageUrl || '',
      customer: customer?._id || null,
      customerName,
      customerLocation: customerLocation || customer?.address || '',
      rating: safeRating,
      reviewText,
      status: 'pending',
    });

    res.status(201).json({
      message: 'Review submitted successfully and is pending approval.',
      data: review,
    });
  } catch (err) {
    console.error('Error submitting storefront review', err);
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { customer, items, paymentMethod, notes, clientMeta } = req.body;
    const normalizedPaymentMethod = normalizePaymentMethod(paymentMethod);

    if (!customer?.name || !customer?.email) {
      return res.status(400).json({ message: 'Customer name and email are required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const requested = items
      .map((item) => ({ productId: item.productId, qty: Number(item.qty) || 0 }))
      .filter((item) => item.productId && item.qty > 0);

    if (!requested.length) {
      return res.status(400).json({ message: 'Invalid items payload' });
    }

    const productIds = requested.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productById = new Map(products.map((product) => [String(product._id), product]));

    const orderItems = [];
    let total = 0;

    for (const reqItem of requested) {
      const product = productById.get(String(reqItem.productId));
      if (!product) {
        return res.status(400).json({ message: 'One or more products are unavailable' });
      }
      if ((product.quantity || 0) < reqItem.qty) {
        return res.status(400).json({ message: `Insufficient stock for ${product.title}` });
      }
      const lineTotal = Number(product.price || 0) * reqItem.qty;
      total += lineTotal;
      orderItems.push({
        productId: product._id,
        title: product.title,
        price: Number(product.price || 0),
        qty: reqItem.qty,
        imageUrl: product.imageUrl || '',
      });
    }

    const email = normalizeEmail(customer.email);
    let customerDoc = await Customer.findOne({ email });
    if (!customerDoc) {
      customerDoc = await Customer.create({
        name: customer.name,
        email,
        phone: customer.phone || '',
        address: customer.address || '',
        status: 'active',
      });
    } else {
      customerDoc.name = customer.name || customerDoc.name;
      customerDoc.phone = customer.phone || customerDoc.phone;
      customerDoc.address = customer.address || customerDoc.address;
      customerDoc.status = 'active';
    }

    customerDoc.orderCount = Number(customerDoc.orderCount || 0) + 1;
    if (normalizedPaymentMethod !== 'card') {
      customerDoc.purchasesTotal = Number(customerDoc.purchasesTotal || 0) + Number(total || 0);
    }
    await customerDoc.save();

    const order = await Order.create({
      orderNumber: buildOrderNumber(),
      customer: customerDoc._id,
      customerName: customerDoc.name,
      customerEmail: customerDoc.email,
      items: orderItems,
      total,
      paymentStatus: 'Unpaid',
      paymentMethod: normalizedPaymentMethod,
      paymentProvider: normalizedPaymentMethod === 'card' ? 'stripe' : 'manual',
      status: normalizedPaymentMethod === 'cash' ? 'Shipping' : 'Pending Payment',
      trackingId: `TRK-${Math.floor(Math.random() * 900000 + 100000)}`,
      origin: String(clientMeta?.origin || ''),
      destination: customer.address || customerDoc.address || '',
      courierName: String(clientMeta?.courierName || ''),
      eta: String(clientMeta?.eta || ''),
      paymentCurrency: 'AUD',
      clientMeta: clientMeta || {},
    });

    if (normalizedPaymentMethod !== 'card') {
      for (const reqItem of requested) {
        const product = productById.get(String(reqItem.productId));
        product.quantity = Math.max(0, Number(product.quantity || 0) - reqItem.qty);
        product.inStock = product.quantity > 0;
        product.status = product.quantity > 0 ? 'available' : 'out-of-stock';
        await product.save();
      }
    }

    const summary = {
      subtotal: Number(total.toFixed(2)),
      gst: Number((total * 0.1).toFixed(2)),
      totalWithGst: Number((total * 1.1).toFixed(2)),
    };

    if (normalizedPaymentMethod === 'card') {
      const stripe = getStripeClient();
      if (!stripe) {
        await Order.findByIdAndDelete(order._id);
        customerDoc.orderCount = Math.max(0, Number(customerDoc.orderCount || 0) - 1);
        await customerDoc.save();
        return res.status(503).json({
          message: 'Online card payments are not configured yet. Please choose Bank Transfer or Cash on Delivery.',
        });
      }

      const storeClientUrl = buildStoreClientUrl(req);
      const successParams = new URLSearchParams({
        checkout: 'success',
        order: order.orderNumber,
      });
      const cancelParams = new URLSearchParams({
        checkout: 'cancelled',
        order: order.orderNumber,
      });
      const successUrl = `${storeClientUrl}/?${successParams.toString()}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${storeClientUrl}/?${cancelParams.toString()}`;

      try {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          customer_email: customerDoc.email,
          payment_method_types: ['card'],
          line_items: buildStripeLineItems(orderItems, total * 0.1),
          metadata: {
            orderId: String(order._id),
            orderNumber: order.orderNumber,
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
        });

        order.stripeCheckoutSessionId = session.id;
        await order.save();

        if (notes) {
          const existing = await Conversation.findOne({ customer: customerDoc._id });
          if (existing) {
            existing.messages.push({
              sender: 'customer',
              text: `Order note (${order.orderNumber}): ${String(notes)}`,
              sentAt: new Date(),
            });
            existing.lastMessageText = `Order note (${order.orderNumber}): ${String(notes)}`;
            existing.lastMessageAt = new Date();
            existing.unreadForAdmin = Number(existing.unreadForAdmin || 0) + 1;
            await existing.save();
          }
        }

        return res.status(201).json({
          message: 'Redirecting to secure card checkout',
          order,
          summary,
          checkoutUrl: session.url,
          requiresRedirect: true,
        });
      } catch (err) {
        await Order.findByIdAndDelete(order._id);
        customerDoc.orderCount = Math.max(0, Number(customerDoc.orderCount || 0) - 1);
        await customerDoc.save();
        throw err;
      }
    }

    if (notes) {
      const existing = await Conversation.findOne({ customer: customerDoc._id });
      if (existing) {
        existing.messages.push({
          sender: 'customer',
          text: `Order note (${order.orderNumber}): ${String(notes)}`,
          sentAt: new Date(),
        });
        existing.lastMessageText = `Order note (${order.orderNumber}): ${String(notes)}`;
        existing.lastMessageAt = new Date();
        existing.unreadForAdmin = Number(existing.unreadForAdmin || 0) + 1;
        await existing.save();
      }
    }

    res.status(201).json({
      message: 'Order placed successfully',
      order,
      summary,
    });
  } catch (err) {
    console.error('Error placing storefront order', err);
    res.status(500).json({ message: 'Failed to place order' });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const email = normalizeEmail((req.query.email || '').toString());
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const orders = await Order.find({ customerEmail: email }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error('Error fetching customer orders', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
});

router.get('/orders/me', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const email = normalizeEmail(user.email || '');
    if (!email) return res.status(400).json({ message: 'No email is linked to this account' });

    const orders = await Order.find({ customerEmail: email }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error('Error fetching signed-in customer orders', err);
    res.status(500).json({ message: 'Failed to fetch your orders' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    res.json({
      id: user._id,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      country: user.country || '',
      address: user.address || '',
      avatarUrl: user.avatarUrl || '',
    });
  } catch (err) {
    console.error('Error loading store profile', err);
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const oldEmail = normalizeEmail(user.email || '');
    const nextName = (req.body?.name ?? user.name ?? '').toString().trim();
    const nextEmail = normalizeEmail((req.body?.email ?? user.email ?? '').toString());

    if (!nextName || !nextEmail) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    if (nextEmail !== oldEmail) {
      const exists = await User.findOne({ email: nextEmail, _id: { $ne: user._id } }).select('_id').lean();
      if (exists) return res.status(409).json({ message: 'Email already in use' });
    }

    user.name = nextName;
    user.email = nextEmail;
    user.phone = (req.body?.phone ?? '').toString().trim();
    user.country = (req.body?.country ?? '').toString().trim();
    user.address = (req.body?.address ?? '').toString().trim();
    await user.save();

    await Promise.all([
      Customer.updateMany(
        { email: oldEmail },
        {
          $set: {
            email: nextEmail,
            name: user.name,
            phone: user.phone || '',
            address: user.address || '',
          },
        }
      ),
      Conversation.updateMany(
        { customerEmail: oldEmail },
        { $set: { customerEmail: nextEmail, customerName: user.name } }
      ),
      Order.updateMany(
        { customerEmail: oldEmail },
        { $set: { customerEmail: nextEmail, customerName: user.name } }
      ),
    ]);

    res.json({
      message: 'Profile updated',
      user: {
        id: user._id,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        country: user.country || '',
        address: user.address || '',
        avatarUrl: user.avatarUrl || '',
      },
    });
  } catch (err) {
    console.error('Error updating store profile', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

router.get('/preferences', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const wishlistIds = Array.isArray(user.wishlist) ? user.wishlist.map((item) => toIdString(item?.product)).filter(Boolean) : [];
    const viewedIds = Array.isArray(user.recentlyViewed)
      ? user.recentlyViewed.map((item) => toIdString(item?.product)).filter(Boolean)
      : [];
    const uniqueIds = [...new Set([...wishlistIds, ...viewedIds])];

    if (uniqueIds.length) {
      const availableProducts = await Product.find({ _id: { $in: uniqueIds } }).select('_id').lean();
      const availableSet = new Set(availableProducts.map((product) => String(product._id)));
      const nextWishlist = (Array.isArray(user.wishlist) ? user.wishlist : []).filter((item) => availableSet.has(toIdString(item?.product)));
      const nextViewed = (Array.isArray(user.recentlyViewed) ? user.recentlyViewed : []).filter((item) =>
        availableSet.has(toIdString(item?.product))
      );
      if (nextWishlist.length !== (user.wishlist || []).length || nextViewed.length !== (user.recentlyViewed || []).length) {
        user.wishlist = nextWishlist;
        user.recentlyViewed = nextViewed;
        await user.save();
      }
    }

    res.json(serializePreferences(user));
  } catch (err) {
    console.error('Error loading store preferences', err);
    res.status(500).json({ message: 'Failed to load preferences' });
  }
});

router.put('/preferences', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const wishlistIds = pickUniqueIds(req.body?.wishlist, 24);
    const viewedIds = pickUniqueIds(req.body?.recentlyViewed, 24);
    const requestedIds = [...new Set([...wishlistIds, ...viewedIds])];

    const products = requestedIds.length
      ? await Product.find({ _id: { $in: requestedIds } }).select('_id price quantity status').lean()
      : [];
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const existingWishlistMap = new Map(
      (Array.isArray(user.wishlist) ? user.wishlist : [])
        .map((item) => [toIdString(item?.product), item])
        .filter(([id]) => Boolean(id))
    );
    const existingViewedMap = new Map(
      (Array.isArray(user.recentlyViewed) ? user.recentlyViewed : [])
        .map((item) => [toIdString(item?.product), item])
        .filter(([id]) => Boolean(id))
    );

    user.wishlist = wishlistIds
      .filter((id) => productMap.has(id))
      .map((id) => {
        const existing = existingWishlistMap.get(id);
        const product = productMap.get(id);
        const inStockNow =
          Number(product?.quantity || 0) > 0 || String(product?.status || '').toLowerCase() !== 'out-of-stock';
        return {
          product: id,
          savedPrice: existing ? Number(existing.savedPrice || 0) : Number(product?.price || 0),
          savedInStock: existing ? Boolean(existing.savedInStock) : inStockNow,
          addedAt: existing?.addedAt || new Date(),
        };
      });

    user.recentlyViewed = viewedIds
      .filter((id) => productMap.has(id))
      .map((id) => {
        const existing = existingViewedMap.get(id);
        return {
          product: id,
          viewedAt: existing?.viewedAt || new Date(),
        };
      });

    await user.save();
    res.json({
      message: 'Preferences updated',
      ...serializePreferences(user),
    });
  } catch (err) {
    console.error('Error updating store preferences', err);
    res.status(500).json({ message: 'Failed to update preferences' });
  }
});

router.put('/profile/password', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const oldPassword = (req.body?.oldPassword || '').toString();
    const newPassword = (req.body?.newPassword || '').toString();

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new passwords are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters' });
    }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ message: 'Old password is incorrect' });

    const isSame = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSame) return res.status(400).json({ message: 'New password must be different from old password' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error updating store password', err);
    res.status(500).json({ message: 'Failed to update password' });
  }
});

router.post('/orders/:id/request', async (req, res) => {
  try {
    const user = await getAuthedUser(req, res);
    if (!user) return;

    const email = normalizeEmail(user.email || '');
    const type = (req.body?.type || '').toString().trim().toLowerCase();
    const reason = (req.body?.reason || '').toString().trim();

    if (!['cancel', 'return'].includes(type)) {
      return res.status(400).json({ message: 'Invalid request type' });
    }
    if (!reason) return res.status(400).json({ message: 'Reason is required' });

    const order = await Order.findOne({ _id: req.params.id, customerEmail: email });
    if (!order) return res.status(404).json({ message: 'Order not found for this account' });
    const statusText = String(order.status || '').toLowerCase();

    if (type === 'cancel' && ['completed', 'cancelled', 'returned'].includes(statusText)) {
      return res.status(400).json({ message: 'Cancellation is not available for this order status' });
    }
    if (type === 'return' && (statusText === 'cancelled' || statusText === 'returned')) {
      return res.status(400).json({ message: 'Return is not available for this order status' });
    }
    if (type === 'return' && !['completed', 'delivered'].some((token) => statusText.includes(token))) {
      return res.status(400).json({ message: 'Return requests are available after delivery/completion' });
    }

    if (order.serviceRequest?.status === 'pending') {
      return res.status(409).json({ message: 'A request is already pending for this order' });
    }

    order.serviceRequest = {
      type,
      reason,
      status: 'pending',
      requestedAt: new Date(),
      resolvedAt: null,
      resolution: '',
      resolvedBy: '',
    };
    await order.save();

    let conversation = null;
    if (order.customer) {
      conversation = await Conversation.findOne({ customer: order.customer });
    }

    if (!conversation) {
      const customer = await Customer.findOne({ email }).lean();
      if (customer?._id) {
        conversation = await Conversation.findOne({ customer: customer._id });
      }
    }

    if (!conversation) {
      conversation = await Conversation.create({
        customer: order.customer || null,
        customerName: order.customerName || user.name || 'Customer',
        customerEmail: email,
        customerAvatarUrl: '',
        customerLocation: order.destination || user.address || '',
        customerStatus: 'online',
        unreadForAdmin: 0,
        lastMessageText: '',
        lastMessageAt: new Date(),
        messages: [],
      });
    }

    const messageText = `Order ${order.orderNumber}: ${type === 'cancel' ? 'Cancellation' : 'Return'} request - ${reason}`;
    const sentAt = new Date();

    conversation.messages.push({
      sender: 'customer',
      text: messageText,
      sentAt,
      requestMeta: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        type,
        status: 'pending',
      },
    });
    conversation.lastMessageText = messageText;
    conversation.lastMessageAt = sentAt;
    conversation.customerStatus = 'online';
    conversation.unreadForAdmin = Number(conversation.unreadForAdmin || 0) + 1;
    await conversation.save();

    const emittedMessage = conversation.messages[conversation.messages.length - 1];
    emitConversationMessage(conversation._id, {
      conversationId: String(conversation._id),
      message: emittedMessage,
      preview: {
        _id: conversation._id,
        customer: conversation.customer,
        customerName: conversation.customerName,
        customerEmail: conversation.customerEmail,
        customerAvatarUrl: conversation.customerAvatarUrl,
        customerLocation: conversation.customerLocation,
        customerStatus: conversation.customerStatus,
        unreadForAdmin: conversation.unreadForAdmin,
        lastMessageText: conversation.lastMessageText,
        lastMessageAt: conversation.lastMessageAt,
        totalMessages: conversation.messages?.length || 0,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });

    res.status(201).json({
      message: `${type === 'cancel' ? 'Cancellation' : 'Return'} request submitted. Support will respond in chat.`,
      conversationId: conversation._id,
      orderNumber: order.orderNumber,
      serviceRequest: order.serviceRequest,
    });
  } catch (err) {
    console.error('Error submitting order request', err);
    res.status(500).json({ message: 'Failed to submit request' });
  }
});

router.post('/messages/session', async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    const email = normalizeEmail((req.body?.email || '').toString());
    const location = (req.body?.location || '').toString().trim();

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    let customer = await Customer.findOne({ email });
    if (!customer) {
      customer = await Customer.create({ name, email, address: location || '', status: 'active' });
    }

    let conversation = await Conversation.findOne({ customer: customer._id });
    if (!conversation) {
      const now = new Date();
      conversation = await Conversation.create({
        customer: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerAvatarUrl: customer.avatarUrl || '',
        customerLocation: customer.address || location || '',
        customerStatus: 'online',
        unreadForAdmin: 0,
        lastMessageText: '',
        lastMessageAt: now,
        messages: [],
      });
    }

    res.json({
      conversationId: conversation._id,
      customerName: conversation.customerName,
      customerEmail: conversation.customerEmail,
      messages: conversation.messages || [],
    });
  } catch (err) {
    console.error('Error creating message session', err);
    res.status(500).json({ message: 'Failed to start chat session' });
  }
});

router.get('/messages/:id', async (req, res) => {
  try {
    const email = normalizeEmail((req.query.email || '').toString());
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const conversation = await Conversation.findOne({ _id: req.params.id, customerEmail: email }).lean();
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    res.json({
      conversationId: conversation._id,
      customerName: conversation.customerName,
      messages: conversation.messages || [],
      lastMessageAt: conversation.lastMessageAt,
    });
  } catch (err) {
    console.error('Error fetching customer messages', err);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

router.post('/messages/:id', async (req, res) => {
  try {
    const email = normalizeEmail((req.body?.email || '').toString());
    const text = (req.body?.text || '').toString().trim();

    if (!email || !text) {
      return res.status(400).json({ message: 'Email and text are required' });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, customerEmail: email });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const message = {
      sender: 'customer',
      text,
      sentAt: new Date(),
    };

    conversation.messages.push(message);
    conversation.lastMessageText = text;
    conversation.lastMessageAt = message.sentAt;
    conversation.customerStatus = 'online';
    conversation.unreadForAdmin = Number(conversation.unreadForAdmin || 0) + 1;
    await conversation.save();

    const emittedMessage = conversation.messages[conversation.messages.length - 1];
    emitConversationMessage(conversation._id, {
      conversationId: String(conversation._id),
      message: emittedMessage,
      preview: {
        _id: conversation._id,
        customer: conversation.customer,
        customerName: conversation.customerName,
        customerEmail: conversation.customerEmail,
        customerAvatarUrl: conversation.customerAvatarUrl,
        customerLocation: conversation.customerLocation,
        customerStatus: conversation.customerStatus,
        unreadForAdmin: conversation.unreadForAdmin,
        lastMessageText: conversation.lastMessageText,
        lastMessageAt: conversation.lastMessageAt,
        totalMessages: conversation.messages?.length || 0,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });

    res.status(201).json({ message: emittedMessage });
  } catch (err) {
    console.error('Error sending customer message', err);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

module.exports = router;
