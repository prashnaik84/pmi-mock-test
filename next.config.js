/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Stripe webhook raw body parsing
  api: {
    bodyParser: false,
  },
};

module.exports = nextConfig;
