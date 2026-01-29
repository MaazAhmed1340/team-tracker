import { getUncachableStripeClient } from '../server/stripe/stripeClient';

async function createProducts() {
  console.log('Creating Stripe products for Team Tracker...');
  
  const stripe = await getUncachableStripeClient();

  // Check if product already exists
  const existingProducts = await stripe.products.search({ query: "name:'Team Tracker Per User'" });
  if (existingProducts.data.length > 0) {
    console.log('Product already exists:', existingProducts.data[0].id);
    console.log('Skipping product creation.');
    return;
  }

  // Create the main product - Pay per user model
  const product = await stripe.products.create({
    name: 'Team Tracker Per User',
    description: 'Employee monitoring and time tracking - billed per active user per month',
    metadata: {
      type: 'per_user_subscription',
      features: 'screenshots,time_tracking,activity_monitoring,reports',
    },
  });

  console.log('Created product:', product.id);

  // Create monthly price - $10 per user per month
  const monthlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000, // $10.00 per user
    currency: 'usd',
    recurring: {
      interval: 'month',
      usage_type: 'licensed',
    },
    metadata: {
      plan: 'monthly',
    },
  });

  console.log('Created monthly price:', monthlyPrice.id, '- $10/user/month');

  // Create yearly price - $96 per user per year ($8/month effective)
  const yearlyPrice = await stripe.prices.create({
    product: product.id,
    unit_amount: 9600, // $96.00 per user per year
    currency: 'usd',
    recurring: {
      interval: 'year',
      usage_type: 'licensed',
    },
    metadata: {
      plan: 'yearly',
    },
  });

  console.log('Created yearly price:', yearlyPrice.id, '- $96/user/year');

  console.log('\n✅ Products created successfully!');
  console.log('\nProduct ID:', product.id);
  console.log('Monthly Price ID:', monthlyPrice.id);
  console.log('Yearly Price ID:', yearlyPrice.id);
}

createProducts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error creating products:', error);
    process.exit(1);
  });
