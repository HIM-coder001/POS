import { useState, useEffect } from 'react';
import { PageLayout } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const PLANS = [
  { 
    key: 'starter',      
    name: 'Starter',      
    monthly: 1500,
    users: 2,
    branches: 1,
    products: 500,
    features: ['Basic POS functionality', 'Standard sales tracking', 'Customer database (up to 500)', 'Basic email support', 'End-of-day reports']
  },
  { 
    key: 'professional', 
    name: 'Professional', 
    monthly: 3500,
    users: 5,
    branches: 3,
    products: 5000,
    features: ['Advanced inventory management', 'Comprehensive reporting & analytics', 'Customer database (up to 5000)', 'Priority email & chat support', 'M-Pesa integration', 'Multi-register support']
  },
  { 
    key: 'enterprise',   
    name: 'Enterprise',   
    monthly: 7500,
    users: 'Unlimited',
    branches: 'Unlimited',
    products: 'Unlimited',
    features: ['All Professional features', 'Custom user roles & permissions', 'Full API access & webhooks', 'Dedicated account manager', 'White-labelling capabilities', '24/7 Phone support']
  },
];

export default function Plans() {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [currentPlan, setCurrentPlan]   = useState(null);
  const [currentStatus, setCurrentStatus] = useState('none');
  const [selecting, setSelecting]       = useState(null);

  useEffect(() => {
    api.get('/settings')
      .then(({ data }) => {
        setCurrentPlan(data.subscriptionPlan || null);
        setCurrentStatus(data.subscriptionStatus || 'none');
      })
      .catch(() => {
        // silently ignore — UI degrades gracefully
      });
  }, []);

  const getPrice   = (monthly) => billingCycle === 'yearly' ? monthly * 10 : monthly;
  const getSavings = (monthly) => monthly * 2;

  const handleSelectPlan = async (plan) => {
    if (user?.role !== 'admin') return;
    setSelecting(plan.key);
    try {
      await api.put('/settings', {
        subscriptionPlan: plan.key,
        subscriptionBillingCycle: billingCycle,
      });
      setCurrentPlan(plan.key);
      setCurrentStatus('active');
      toast.success(`Switched to ${plan.name} plan`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setSelecting(null);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <PageLayout title="Subscription Plans" subtitle="Choose the plan that fits your business">

      {/* Overdue notice banner */}
      {currentStatus === 'overdue' && (
        <div className="mb-lg rounded-lg bg-error/10 border border-error/30 px-lg py-md flex items-center gap-sm text-error font-semibold text-body-sm">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          Your subscription is overdue. Please update your plan to restore full access.
        </div>
      )}

      {/* Billing cycle toggle: Monthly / Yearly */}
      <div className="flex items-center justify-center gap-sm mb-xl">
        <button
          onClick={() => setBillingCycle('monthly')}
          disabled={!isAdmin}
          title={!isAdmin ? 'Admin access required' : undefined}
          className={`px-lg py-sm rounded-full text-body-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            billingCycle === 'monthly'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          disabled={!isAdmin}
          title={!isAdmin ? 'Admin access required' : undefined}
          className={`px-lg py-sm rounded-full text-body-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            billingCycle === 'yearly'
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          Yearly <span className="text-xs ml-xs opacity-80">Save 2 months</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {PLANS.map(plan => {
          const isActive = plan.key === currentPlan && currentStatus !== 'none';
          return (
            <div
              key={plan.key}
              className={`card p-xl flex flex-col gap-md transition-all ${
                isActive ? 'ring-2 ring-primary bg-primary/[0.04]' : ''
              }`}
            >
              <h3 className="text-title-md font-bold text-on-surface">{plan.name}</h3>
              <div className="text-headline-sm font-black text-primary">
                KES {getPrice(plan.monthly).toLocaleString('en-KE')}
                <span className="text-body-sm font-normal text-on-surface-variant">
                  {billingCycle === 'monthly' ? '/mo' : '/yr'}
                </span>
              </div>
              {billingCycle === 'yearly' && (
                <p className="text-body-sm text-success font-semibold">
                  Save KES {getSavings(plan.monthly).toLocaleString('en-KE')}
                </p>
              )}
              {isActive && (
                <span className="text-body-sm font-semibold text-primary">Current plan</span>
              )}
              
              <div className="space-y-[10px] my-md flex-1">
                <div className="flex items-center gap-[8px]">
                  <span className="material-symbols-outlined icon-fill text-primary/80 flex-shrink-0" style={{fontSize:'18px'}}>group</span>
                  <span className="text-body-sm text-on-surface font-medium">{plan.users} Users</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <span className="material-symbols-outlined icon-fill text-primary/80 flex-shrink-0" style={{fontSize:'18px'}}>storefront</span>
                  <span className="text-body-sm text-on-surface font-medium">{plan.branches} {plan.branches === 1 ? 'Branch' : 'Branches'}</span>
                </div>
                <div className="flex items-center gap-[8px]">
                  <span className="material-symbols-outlined icon-fill text-primary/80 flex-shrink-0" style={{fontSize:'18px'}}>inventory_2</span>
                  <span className="text-body-sm text-on-surface font-medium">{plan.products} Products</span>
                </div>
                <div className="border-t border-black/[0.05] my-sm" />
                <div className="space-y-[10px]">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-start gap-[8px]">
                      <span className="material-symbols-outlined icon-fill text-emerald-500 flex-shrink-0 mt-[2px]" style={{fontSize:'16px'}}>check_circle</span>
                      <span className="text-body-sm text-on-surface leading-tight">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                className="btn-primary mt-auto justify-center flex items-center gap-xs"
                disabled={!isAdmin || selecting !== null}
                title={!isAdmin ? 'Admin access required' : undefined}
                onClick={() => handleSelectPlan(plan)}
              >
                {selecting === plan.key ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Updating…
                  </>
                ) : (
                  'Select Plan'
                )}
              </button>
            </div>
          );
        })}
      </div>
    </PageLayout>
  );
}
