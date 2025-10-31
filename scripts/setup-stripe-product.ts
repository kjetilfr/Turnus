// scripts/setup-stripe-product.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
})

async function setupProduct() {
  try {
    console.log('Creating Stripe product...')
    
    // Create product
    const product = await stripe.products.create({
      name: 'Turnus-Hjelp Pro',
      description: 'Automatiske lovsjekkar for turnusplanar',
    })

    console.log('✓ Product created:', product.id)

    // Create price (49 NOK per month)
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: 4900, // 49.00 NOK (in øre)
      currency: 'nok',
      recurring: {
        interval: 'month',
      },
    })

    console.log('✓ Price created:', price.id)
    console.log('\n📋 Add these to your .env.local:\n')
    console.log(`STRIPE_PRODUCT_ID=${product.id}`)
    console.log(`STRIPE_PRICE_ID=${price.id}`)
    console.log('\n✅ Setup complete!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

setupProduct()