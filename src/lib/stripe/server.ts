// src/lib/stripe/server.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
  appInfo: {
    name: 'Turnus-Hjelp',
    version: '1.0.0',
  },
})