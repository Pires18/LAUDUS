import { useEffect, useState } from 'react';
import { logger } from '../utils/logger';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firestore, auth } from '../lib/firebase';
import { Subscription, SubscriptionAddon } from '../types';
import { ADMIN_EMAIL } from '../config/constants';

export interface SubscriptionState {
  loading: boolean;
  subscription: Subscription | null;
  isActive: boolean;
  isTrialing: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  hasCalculators: boolean;
  hasPacs: boolean;
  hasAppointments: boolean;
  hasClinics: boolean;
  motorProEnabled: boolean;
  motorOptions: ('lite' | 'pro')[];
  reportsUsed: number;
  reportsQuota: number;
  reportsRemaining: number;
  canGenerateReport: boolean;
  clinicsQuota: number;
  trialDaysLeft: number;
}

const DEFAULT_STATE: SubscriptionState = {
  loading: true,
  subscription: null,
  isActive: false,
  isTrialing: false,
  isPastDue: false,
  isCanceled: false,
  hasCalculators: false,
  hasPacs: false,
  hasAppointments: false,
  hasClinics: false,
  motorProEnabled: false,
  motorOptions: ['lite'],
  reportsUsed: 0,
  reportsQuota: 100,
  reportsRemaining: 100,
  canGenerateReport: true,
  clinicsQuota: 5,
  trialDaysLeft: 0,
};

function deriveState(
  sub: Subscription | null,
  motorProEnabled: boolean,
  isAdmin: boolean
): Omit<SubscriptionState, 'loading' | 'subscription'> {
  const now = Date.now();
  const isTrialing = sub ? (sub.status === 'trialing' && !!sub.trialEndsAt && sub.trialEndsAt > now) : false;
  const proEnabled = motorProEnabled || isTrialing;
  const motorOptions: ('lite' | 'pro')[] = (isAdmin || proEnabled) ? ['lite', 'pro'] : ['lite'];

  if (isAdmin) {
    return {
      isActive: true,
      isTrialing: false,
      isPastDue: false,
      isCanceled: false,
      hasCalculators: true,
      hasPacs: true,
      hasAppointments: true,
      hasClinics: true,
      motorProEnabled: true,
      motorOptions,
      reportsUsed: 0,
      reportsQuota: 9999,
      reportsRemaining: 9999,
      canGenerateReport: true,
      clinicsQuota: 9999,
      trialDaysLeft: 0,
    };
  }

  if (!sub) {
    return {
      isActive: false,
      isTrialing: false,
      isPastDue: false,
      isCanceled: false,
      hasCalculators: false,
      hasPacs: false,
      hasAppointments: false,
      hasClinics: false,
      motorProEnabled: proEnabled,
      motorOptions,
      reportsUsed: 0,
      reportsQuota: 100,
      reportsRemaining: 0,
      canGenerateReport: false,
      clinicsQuota: 5,
      trialDaysLeft: 0,
    };
  }

  // Plano vitalício: sempre ativo, nunca expira nem é cancelado por período.
  const isLifetime = sub.lifetime === true;
  const isActive = isLifetime || sub.status === 'active' || isTrialing;
  const isPastDue = !isLifetime && sub.status === 'past_due';
  const isCanceled = !isLifetime && (sub.status === 'canceled' || sub.status === 'paused');

  const addons: SubscriptionAddon[] = sub.addons || [];
  const hasCalculators = addons.includes('calculators');
  const hasPacs = addons.includes('pacs');
  const hasAppointments = addons.includes('appointments');
  const hasClinics = addons.includes('clinics');

  const reportsUsed = sub.reportsUsedThisMonth ?? 0;
  const reportsQuota = sub.reportsQuota ?? 100;
  const reportsRemaining = Math.max(0, reportsQuota - reportsUsed);
  const canGenerateReport = (isActive || isPastDue) && reportsRemaining > 0;

  const trialDaysLeft = isTrialing && sub.trialEndsAt
    ? Math.max(0, Math.ceil((sub.trialEndsAt - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isActive: isActive || isPastDue,
    isTrialing,
    isPastDue,
    isCanceled,
    hasCalculators,
    hasPacs,
    hasAppointments,
    hasClinics,
    motorProEnabled: proEnabled,
    motorOptions,
    reportsUsed,
    reportsQuota,
    reportsRemaining,
    canGenerateReport,
    clinicsQuota: sub.clinicsQuota ?? 5,
    trialDaysLeft,
  };
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    const email = auth.currentUser?.email || '';
    if (!uid) {
      setState({ ...DEFAULT_STATE, loading: false });
      return;
    }

    const isAdmin = !!ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const userRef = doc(firestore, 'users', uid);

    const unsubUser = onSnapshot(userRef, async (userSnap) => {
      if (!userSnap.exists()) {
        setState({ ...DEFAULT_STATE, loading: false });
        return;
      }

      const userData = userSnap.data();

      if (userData.role === 'admin') {
        setState({
          ...DEFAULT_STATE,
          loading: false,
          ...deriveState(null, true, true),
        });
        return;
      }

      if (isAdmin) {
        setState({
          ...DEFAULT_STATE,
          loading: false,
          ...deriveState(null, true, true),
        });
        return;
      }

      const motorProEnabled = userData.motorProEnabled === true;
      const subscriptionId = userData.subscriptionId as string | undefined;

      if (!subscriptionId) {
        // Verifica se ainda está no trial (14 dias a partir da criação da conta)
        const createdAt = userData.createdAt as number | undefined;
        if (createdAt) {
          const trialEndsAt = createdAt + 14 * 24 * 60 * 60 * 1000;
          if (Date.now() < trialEndsAt) {
            const trialSub: Subscription = {
              id: 'trial',
              userId: uid,
              userEmail: email,
              plan: 'base',
              addons: [],
              status: 'trialing',
              paymentMethod: 'manual',
              currentPeriodStart: createdAt,
              currentPeriodEnd: trialEndsAt,
              trialEndsAt,
              reportsUsedThisMonth: userData.reportsUsedThisMonth ?? 0,
              reportsQuota: 100,
              clinicsQuota: 5,
              tokenQuotaLite: 0,
              tokenQuotaPro: 0,
              lastResetAt: createdAt,
              createdAt,
              updatedAt: createdAt,
            };
            setState({
              loading: false,
              subscription: trialSub,
              ...deriveState(trialSub, motorProEnabled, false),
            });
            return;
          }
        }
        setState({ ...DEFAULT_STATE, loading: false, ...deriveState(null, motorProEnabled, false) });
        return;
      }

      try {
        const subRef = doc(firestore, 'subscriptions', subscriptionId);
        const subSnap = await getDoc(subRef);
        if (!subSnap.exists()) {
          setState({ ...DEFAULT_STATE, loading: false, ...deriveState(null, motorProEnabled, false) });
          return;
        }
        const sub = { id: subSnap.id, ...subSnap.data() } as Subscription;

        // O contador de uso do doc do USUÁRIO é a fonte de verdade (o espelho
        // na assinatura é best-effort). Prefere o maior para nunca regredir.
        const userUsed = userData.reportsUsedThisMonth;
        if (typeof userUsed === 'number') {
          sub.reportsUsedThisMonth = Math.max(userUsed, sub.reportsUsedThisMonth ?? 0);
        }

        // Reset check
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (sub.lastResetAt && Date.now() > sub.lastResetAt + thirtyDays) {
          auth.currentUser?.getIdToken().then((idToken) =>
            fetch('/api/reset-monthly-reports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
              body: JSON.stringify({ userId: uid, subscriptionId: sub.id }),
            })
          ).catch((err) => logger.error('Erro ao resetar laudos mensais:', err));
        }

        setState({
          loading: false,
          subscription: sub,
          ...deriveState(sub, motorProEnabled, false),
        });
      } catch {
        setState({ ...DEFAULT_STATE, loading: false });
      }
    });

    return () => unsubUser();
  }, []);

  return state;
}
