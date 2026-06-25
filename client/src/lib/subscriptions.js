export const PLAN_DEFINITIONS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    monthly: 1500,
    yearly: 15000,
    limits: { users: 2, branches: 1, products: 500 },
    features: [
      'Basic POS functionality',
      'Cash and card checkout',
      'Customer database (up to 500)',
      'Standard sales tracking',
      'Email support',
    ],
  },
  professional: {
    key: 'professional',
    name: 'Professional',
    monthly: 3500,
    yearly: 35000,
    limits: { users: 5, branches: 3, products: 5000 },
    features: [
      'Advanced inventory management',
      'M-Pesa checkout',
      'Split payments',
      'Customer database (up to 5,000)',
      'Comprehensive reporting and analytics',
      'Priority email support',
    ],
  },
  enterprise: {
    key: 'enterprise',
    name: 'Enterprise',
    monthly: 7500,
    yearly: 75000,
    limits: { users: 'Unlimited', branches: 'Unlimited', products: 'Unlimited' },
    features: [
      'Everything in Professional',
      'Unlimited users and products',
      'Custom roles and permissions',
      'Full API access and webhooks',
      'Dedicated account support',
      'White-label readiness',
    ],
  },
};

export function getPlanPrice(planKey, billingCycle = 'monthly') {
  const plan = PLAN_DEFINITIONS[planKey];
  if (!plan) return 0;
  return billingCycle === 'yearly' ? plan.yearly : plan.monthly;
}

export function formatPlanLimit(value) {
  return value === 'Unlimited' ? 'Unlimited' : value.toLocaleString('en-KE');
}
