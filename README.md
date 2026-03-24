# It’s Too Easy Workwear

Full-stack ecommerce project with separate user and admin clients and a Node/Express API.

## Project Structure
- `client-user/`: customer-facing frontend
- `client-admin/`: admin dashboard
- `server/`: API server
- `uploads/`: uploaded assets

## Getting Started
1. Install dependencies:
   `npm install`
2. Start the API:
   `npm run dev:server`
3. Start the user app:
   `npm run dev:user`
4. Start the admin app:
   `npm run dev:admin`

## Scripts
- `dev:server`: run API with nodemon
- `start:server`: run API with node
- `dev:user`: start user frontend
- `build:user`: build user frontend
- `preview:user`: preview user build
- `dev:admin`: start admin frontend
- `build:admin`: build admin frontend
- `preview:admin`: preview admin build

## Environment
Create a `.env` file in the project root for server configuration.

### Stripe (Online Card Payments)
Add these variables to enable Stripe Checkout:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STORE_FRONTEND_URL=http://localhost:5173
```

If these are missing, the site still works and automatically falls back to non-card methods (Bank Transfer/COD).

Webhook endpoint:

```text
POST /api/store/stripe/webhook
```

For local testing with Stripe CLI:

```bash
stripe listen --forward-to localhost:4000/api/store/stripe/webhook
```
# It-s-Too-Easy-Workwear
