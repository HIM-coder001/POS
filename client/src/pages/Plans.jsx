import { useEffect, useMemo, useRef, useState } from 'react';
import { PageLayout } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { PLAN_DEFINITIONS, getPlanPrice, formatPlanLimit } from '../lib/subscriptions';

export default function Plans() {
  const { user } = useAuth();
  const { settings, refreshSettings, loaded } = useSettings();
  const isAdmin = user?.role === 'admin';

  const [billingCycle, setBillingCycle] = useState(null);
  const [selectedPlanKey, setSelectedPlanKey] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentState, setPaymentState] = useState('idle'); // idle | waiting | success | failed | cancelled | timeout
  const [countdown, setCountdown] = useState(60);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  const pollRef = useRef(null);
  const timerRef = useRef(null);
  const terminalRef = useRef(null);
  const checkoutRequestIdRef = useRef('');

  const currentPlanKey = settings.subscriptionPlan || null;
  const currentStatus = settings.subscriptionStatus || 'none';
  const currentPaymentStatus = settings.subscriptionPaymentStatus || 'none';

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const effectiveBillingCycle = billingCycle || settings.subscriptionBillingCycle || 'monthly';
  const effectivePlanKey = selectedPlanKey || settings.subscriptionPlan || 'starter';
  const selectedPlan = PLAN_DEFINITIONS[effectivePlanKey] || PLAN_DEFINITIONS.starter;
  const paymentAmount = useMemo(
    () => getPlanPrice(effectivePlanKey, effectiveBillingCycle),
    [effectivePlanKey, effectiveBillingCycle]
  );

  const stopPaymentPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const activatePlan = async (receiptRef) => {
    const activationPayload = {
      subscriptionPlan: effectivePlanKey,
      subscriptionBillingCycle: effectiveBillingCycle,
      subscriptionStatus: 'active',
      subscriptionPaymentStatus: 'paid',
      subscriptionPaymentRef: receiptRef || checkoutRequestIdRef.current,
      subscriptionPaymentPhone: phoneNumber,
      subscriptionPaymentAmount: paymentAmount,
      subscriptionPaidAt: new Date().toISOString(),
    };

    await api.put('/settings', activationPayload);
    await refreshSettings();
    setPaymentState('success');
    setMessage(`${selectedPlan.name} plan activated successfully.`);
    toast.success(`${selectedPlan.name} plan activated`);
  };

  const handleStatus = async (status, desc = '') => {
    if (terminalRef.current) return;

    if (status === 'success') {
      terminalRef.current = 'success';
      stopPaymentPolling();
      try {
        const requestId = checkoutRequestIdRef.current;
        const { data } = await api.get(`/mpesa/status/${requestId}`);
        await activatePlan(data.mpesaRef || requestId);
      } catch {
        await activatePlan(checkoutRequestIdRef.current);
      }
    } else if (status === 'cancelled') {
      terminalRef.current = 'cancelled';
      stopPaymentPolling();
      setPaymentState('cancelled');
      setCountdown(0);
      setMessage('Payment was cancelled by the customer.');
      toast.error('Payment cancelled');
    } else if (status === 'failed') {
      terminalRef.current = 'failed';
      stopPaymentPolling();
      setPaymentState('failed');
      setCountdown(0);
      setMessage(desc || 'Payment failed.');
      toast.error(desc || 'Payment failed');
    } else if (status === 'timeout') {
      terminalRef.current = 'timeout';
      stopPaymentPolling();
      setPaymentState('timeout');
      setCountdown(0);
      setMessage('Payment request timed out.');
      toast.error('Payment request timed out');
    }
  };

  const handlePayNow = async () => {
    if (!isAdmin) return;
    if (!phoneNumber) return toast.error('Enter the phone number to receive the M-Pesa prompt');

    setSending(true);
    setMessage('');

    try {
      const orderId = `SUB-${effectivePlanKey.toUpperCase()}-${Date.now()}`;
      const { data } = await api.post('/mpesa/stk-push', {
        phone: phoneNumber,
        amount: paymentAmount,
        orderId,
      });

      checkoutRequestIdRef.current = data.checkoutRequestId;
      terminalRef.current = null;
      setPaymentState('waiting');
      setCountdown(60);
      setSending(false);
      toast.success('M-Pesa prompt sent. Complete the payment on the phone.');

      let remaining = 60;
      timerRef.current = setInterval(async () => {
        if (terminalRef.current) {
          stopPaymentPolling();
          return;
        }

        remaining -= 1;
        setCountdown(remaining);

        if (remaining <= 0) {
          await handleStatus('timeout', 'Payment request timed out.');
          stopPaymentPolling();
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          if (terminalRef.current) return;
          const requestId = checkoutRequestIdRef.current || data.checkoutRequestId;
          const { data: statusData } = await api.get(`/mpesa/status/${requestId}`);
          await handleStatus(statusData.status, statusData.resultDesc);
        } catch {
          // keep polling
        }
      }, 3000);
    } catch (err) {
      setSending(false);
      setPaymentState('failed');
      setMessage(err.response?.data?.message || 'Failed to send the payment prompt.');
      toast.error(err.response?.data?.message || 'Failed to send the payment prompt');
    }
  };

  const handleCancelPayment = () => {
    terminalRef.current = 'cancelled';
    stopPaymentPolling();
    checkoutRequestIdRef.current = '';
    setPaymentState('cancelled');
    setCountdown(0);
    setSending(false);
    setMessage('Payment request cancelled.');
  };

  const isLocked = currentStatus !== 'active';

  return (
    <PageLayout title="Subscription Plans" subtitle="Choose a plan, pay, and unlock the app">
      <div className="space-y-xl">
        {isLocked && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-lg py-md text-amber-900">
            <div className="flex items-start gap-sm">
              <span className="material-symbols-outlined mt-[2px]">lock</span>
              <div>
                <p className="font-bold">Subscription required</p>
                <p className="text-sm">
                  Your access is locked until a plan is paid and activated.
                  {currentPaymentStatus === 'pending' ? ' A payment is currently pending.' : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-gutter">
          <div className="space-y-md">
            <div className="flex items-center justify-center gap-sm">
                <button
                onClick={() => setBillingCycle('monthly')}
                disabled={!isAdmin || paymentState === 'waiting' || sending}
                className={`px-lg py-sm rounded-full text-body-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  effectiveBillingCycle === 'monthly'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                Monthly
              </button>
                <button
                onClick={() => setBillingCycle('yearly')}
                disabled={!isAdmin || paymentState === 'waiting' || sending}
                className={`px-lg py-sm rounded-full text-body-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  effectiveBillingCycle === 'yearly'
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                Yearly <span className="text-xs ml-xs opacity-80">Save 2 months</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {Object.values(PLAN_DEFINITIONS).map((plan) => {
                const isCurrent = plan.key === currentPlanKey && currentStatus === 'active';
                const isSelected = plan.key === effectivePlanKey;
                return (
                  <button
                    key={plan.key}
                    type="button"
                    onClick={() => {
                      setSelectedPlanKey(plan.key);
                      setMessage('');
                      if (paymentState === 'success') setPaymentState('idle');
                    }}
                    disabled={!isAdmin || paymentState === 'waiting' || sending}
                    className={`text-left card p-xl flex flex-col gap-md transition-all disabled:opacity-80 disabled:cursor-not-allowed ${
                      isSelected ? 'ring-2 ring-primary bg-primary/[0.04]' : ''
                    } ${isCurrent ? 'border-primary/30' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-sm">
                      <h3 className="text-title-md font-bold text-on-surface">{plan.name}</h3>
                      {isCurrent && <span className="text-xs font-bold text-primary">Current</span>}
                    </div>

                    <div className="text-headline-sm font-black text-primary">
                      KES {getPlanPrice(plan.key, effectiveBillingCycle).toLocaleString('en-KE')}
                      <span className="text-body-sm font-normal text-on-surface-variant">
                        {effectiveBillingCycle === 'monthly' ? '/mo' : '/yr'}
                      </span>
                    </div>

                    {effectiveBillingCycle === 'yearly' && (
                      <p className="text-body-sm text-success font-semibold">
                        Save KES {plan.monthly * 2}
                      </p>
                    )}

                    <div className="space-y-[10px] my-md">
                      <div className="flex items-center gap-[8px]">
                        <span className="material-symbols-outlined icon-fill text-primary/80 flex-shrink-0" style={{ fontSize: '18px' }}>group</span>
                        <span className="text-body-sm text-on-surface font-medium">{formatPlanLimit(plan.limits.users)} Users</span>
                      </div>
                      <div className="flex items-center gap-[8px]">
                        <span className="material-symbols-outlined icon-fill text-primary/80 flex-shrink-0" style={{ fontSize: '18px' }}>storefront</span>
                        <span className="text-body-sm text-on-surface font-medium">{formatPlanLimit(plan.limits.branches)} Branches</span>
                      </div>
                      <div className="flex items-center gap-[8px]">
                        <span className="material-symbols-outlined icon-fill text-primary/80 flex-shrink-0" style={{ fontSize: '18px' }}>inventory_2</span>
                        <span className="text-body-sm text-on-surface font-medium">{formatPlanLimit(plan.limits.products)} Products</span>
                      </div>
                    </div>

                    <div className="border-t border-black/[0.05] pt-md space-y-[10px]">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-[8px]">
                          <span className="material-symbols-outlined icon-fill text-emerald-500 flex-shrink-0 mt-[2px]" style={{ fontSize: '16px' }}>check_circle</span>
                          <span className="text-body-sm text-on-surface leading-tight">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <span className="btn-primary mt-auto justify-center">
                      {isCurrent ? 'Active plan' : 'Select plan'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-xl space-y-lg">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-on-surface-variant/60 font-bold">Payment</p>
              <h3 className="text-title-lg font-black text-on-surface mt-xs">
                Pay to activate {selectedPlan.name}
              </h3>
              <p className="text-sm text-on-surface-variant mt-xs">
                Payment goes through your configured M-Pesa business account and then the selected plan is activated immediately after confirmation.
              </p>
            </div>

            <div className="rounded-2xl bg-surface-container-low p-lg space-y-sm">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Plan</span>
                <span className="font-semibold text-on-surface">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Billing</span>
                <span className="font-semibold text-on-surface capitalize">{effectiveBillingCycle}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Amount</span>
                <span className="font-semibold text-primary">KES {paymentAmount.toLocaleString('en-KE')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Current</span>
                <span className="font-semibold text-on-surface capitalize">
                  {currentStatus}
                  {currentPlanKey ? ` · ${currentPlanKey}` : ''}
                </span>
              </div>
            </div>

            <div>
              <label className="label">Phone number to receive the M-Pesa prompt</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0712345678"
                className="input font-mono"
                disabled={!isAdmin || paymentState === 'waiting'}
              />
            </div>

            {paymentState === 'waiting' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-lg space-y-sm">
                <div className="flex items-center gap-sm text-emerald-700">
                  <span className="material-symbols-outlined">smartphone</span>
                  <p className="font-bold">Waiting for payment confirmation</p>
                </div>
                <p className="text-sm text-emerald-800">
                  Check {phoneNumber} and enter your PIN. The request expires in {countdown}s.
                </p>
                <div className="flex items-center gap-sm">
                  <button onClick={handleCancelPayment} className="btn-secondary text-xs py-sm">Cancel</button>
                </div>
              </div>
            )}

            {paymentState === 'success' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-lg">
                <p className="font-bold text-emerald-700">Plan activated successfully</p>
                <p className="text-sm text-emerald-800 mt-xs">{message}</p>
              </div>
            )}

            {(paymentState === 'failed' || paymentState === 'cancelled' || paymentState === 'timeout') && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-lg">
                <p className="font-bold text-red-700 capitalize">{paymentState}</p>
                <p className="text-sm text-red-800 mt-xs">{message}</p>
              </div>
            )}

            {currentPaymentStatus === 'pending' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-lg">
                <p className="font-bold text-amber-800">Pending payment on the last selected plan</p>
                <p className="text-sm text-amber-900 mt-xs">Complete the payment prompt or retry if it timed out.</p>
              </div>
            )}

              <button
              type="button"
              onClick={handlePayNow}
              disabled={!isAdmin || sending || paymentState === 'waiting'}
              className="btn-primary w-full justify-center"
            >
              {sending ? 'Sending prompt...' : paymentState === 'waiting' ? `Waiting ${countdown}s` : 'Pay & Activate'}
            </button>

            {!isAdmin && (
              <p className="text-xs text-on-surface-variant">
                Only admins can change plans or send payment prompts.
              </p>
            )}

            {loaded && (
              <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-lg text-sm text-on-surface-variant">
                <p className="font-bold text-on-surface mb-xs">Why these limits matter</p>
                <p>
                  Starter is for small shops, Professional adds M-Pesa and growth features, and Enterprise removes the seat and product ceilings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
