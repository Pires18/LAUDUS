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
  isAdmin: boolean,
  actualReportsUsed = 0
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
      // Admin tem cota ilimitada, mas a CONTAGEM precisa refletir o uso real
      // (gravado em reportsUsedThisMonth a cada laudo gerado — engine.ts) em
      // vez de ficar travada em 0.
      reportsUsed: actualReportsUsed,
      reportsQuota: 9999,
      reportsRemaining: Math.max(0, 9999 - actualReportsUsed),
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

  // Add-ons só valem com assinatura ativa (ou em past_due, mesma tolerância
  // usada em canGenerateReport abaixo) — sem essa checagem, uma assinatura
  // CANCELADA mantinha acesso aos módulos de add-on para sempre, porque
  // `addons` só é limpo no cancelamento (ver api/abacatepay-cancel.ts) como
  // higiene de dados, não como o mecanismo de bloqueio em si.
  const addonsUsable = isActive || isPastDue;
  const addons: SubscriptionAddon[] = sub.addons || [];
  const hasCalculators = addonsUsable && addons.includes('calculators');
  const hasPacs = addonsUsable && addons.includes('pacs');
  const hasAppointments = addonsUsable && addons.includes('appointments');
  const hasClinics = addonsUsable && addons.includes('clinics');

  const reportsUsed = sub.reportsUsedThisMonth ?? 0;
  const reportsQuota = sub.reportsQuota ?? 100;
  const isUnlimited = reportsQuota === 0 || reportsQuota >= 9999;
  const reportsRemaining = isUnlimited ? 999999 : Math.max(0, reportsQuota - reportsUsed);
  const canGenerateReport = (isActive || isPastDue) && (isUnlimited || reportsRemaining > 0);

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

      const adminReportsUsed = userData.reportsUsedThisMonth ?? 0;

      const isUserAdmin = userData.role === 'admin' || isAdmin;
      const motorProEnabled = userData.motorProEnabled === true;
      const subscriptionId = userData.subscriptionId as string | undefined;

      if (!subscriptionId) {
        // Se for admin, geramos um objeto de assinatura vitalícia virtual para ele ver o card vitalício no perfil
        if (isUserAdmin) {
          const virtualSub: Subscription = {
            id: 'admin_lifetime',
            userId: uid,
            userEmail: email,
            plan: 'base',
            addons: [],
            status: 'active',
            lifetime: true,
            paymentMethod: 'manual',
            currentPeriodStart: Date.now(),
            currentPeriodEnd: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000, // 100 anos
            reportsUsedThisMonth: adminReportsUsed,
            reportsQuota: 9999,
            clinicsQuota: 9999,
            lastResetAt: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setState({
            loading: false,
            subscription: virtualSub,
            ...deriveState(virtualSub, true, true, adminReportsUsed),
          });
          return;
        }

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

        const finalSub = isUserAdmin ? { ...sub, lifetime: true } : sub;

        setState({
          loading: false,
          subscription: finalSub,
          ...deriveState(finalSub, motorProEnabled, isUserAdmin, finalSub.reportsUsedThisMonth),
        });
      } catch {
        setState({ ...DEFAULT_STATE, loading: false });
      }
    });

    return () => unsubUser();
  }, []);

  return state;
}
