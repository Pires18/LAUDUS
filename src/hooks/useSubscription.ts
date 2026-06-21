import { useEffect, useState } from 'react';
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
  motorProEnabled: boolean;
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
  motorProEnabled: false,
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
  if (isAdmin) {
    return {
      isActive: true,
      isTrialing: false,
      isPastDue: false,
      isCanceled: false,
      hasCalculators: true,
      hasPacs: true,
      motorProEnabled: true,
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
      motorProEnabled: false,
      reportsUsed: 0,
      reportsQuota: 100,
      reportsRemaining: 0,
      canGenerateReport: false,
      clinicsQuota: 5,
      trialDaysLeft: 0,
    };
  }

  const now = Date.now();
  const isTrialing = sub.status === 'trialing' && !!sub.trialEndsAt && sub.trialEndsAt > now;
  const isActive = sub.status === 'active' || isTrialing;
  const isPastDue = sub.status === 'past_due';
  const isCanceled = sub.status === 'canceled' || sub.status === 'paused';

  const addons: SubscriptionAddon[] = sub.addons || [];
  const hasCalculators = addons.includes('calculators');
  const hasPacs = addons.includes('pacs');

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
    motorProEnabled,
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
