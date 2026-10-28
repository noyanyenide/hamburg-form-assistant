import { zodResolver } from '@hookform/resolvers/zod';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import { formSchema } from '../form/schema';
import { STEPS, visibleSteps, type StepId } from '../form/steps';
import { createEmptyForm, mergeWithDefaults, type FormValues } from '../form/types';
import { useI18n } from '../i18n';
import type { FitChecker } from '../pdf/engine';
import { loadPdfAssets } from '../pdf/assets';
import {
  LS_SAVE_ENABLED,
  clearStoredApplication,
  deleteAllData,
  loadDraft,
  loadSignature,
  readPreference,
  requestPersistentStorage,
  saveDraft,
  saveSignature,
  writePreference,
} from '../storage/db';

export type Screen = 'language' | 'welcome' | 'wizard' | 'review' | 'sign' | 'result' | 'privacy';

export interface NavState {
  screen: Screen;
  stepId: StepId;
  /** Set when a step was opened from the review screen ("Edit"). */
  returnToReview: boolean;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'disabled' | 'error';

interface AppContextValue {
  form: UseFormReturn<FormValues>;
  ready: boolean;
  nav: NavState;
  navigate: (next: Partial<NavState>) => void;
  goToStep: (stepId: StepId, returnToReview?: boolean) => void;
  furthestStep: number;
  markReached: (stepId: StepId) => void;
  hasDraft: boolean;
  lastSaved: Date | null;
  saveStatus: SaveStatus;
  saveEnabled: boolean;
  setSaveEnabled: (enabled: boolean) => Promise<void>;
  signature: Uint8Array | null;
  setSignature: (png: Uint8Array | null) => void;
  fitChecker: FitChecker | null;
  ensureFitChecker: () => Promise<FitChecker | null>;
  startOver: () => Promise<void>;
  deleteEverything: () => Promise<void>;
  flushSave: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const SCREENS: readonly Screen[] = ['language', 'welcome', 'wizard', 'review', 'sign', 'result', 'privacy'];
const HISTORY_TAG = 'hh-ae-formhelper';

function isNavState(value: unknown): value is NavState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return SCREENS.includes(v.screen as Screen) && STEPS.some((s) => s.id === v.stepId);
}

const SAVE_DEBOUNCE_MS = 400;

export function AppProvider({ children }: { children: ReactNode }) {
  const { language, resetLanguage } = useI18n();
  const form = useForm<FormValues>({
    defaultValues: createEmptyForm(),
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  });

  const [ready, setReady] = useState(false);
  const [nav, setNav] = useState<NavState>({ screen: language ? 'welcome' : 'language', stepId: STEPS[0].id, returnToReview: false });
  const [furthestStep, setFurthestStep] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveEnabled, setSaveEnabledState] = useState(() => readPreference(LS_SAVE_ENABLED) !== '0');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(saveEnabled ? 'idle' : 'disabled');
  const [signature, setSignatureState] = useState<Uint8Array | null>(null);
  const [fitChecker, setFitChecker] = useState<FitChecker | null>(null);

  const navRef = useRef(nav);
  navRef.current = nav;
  const furthestRef = useRef(furthestStep);
  furthestRef.current = furthestStep;
  const saveEnabledRef = useRef(saveEnabled);
  saveEnabledRef.current = saveEnabled;
  const saveTimer = useRef<number | undefined>(undefined);
  /** Blocks autosave while data is being deleted. */
  const suspended = useRef(false);

  /* ----------------------------- initial load ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [draft, sig] = await Promise.all([loadDraft(), loadSignature()]);
        if (cancelled) return;
        if (draft) {
          form.reset(mergeWithDefaults(draft.values));
          const stepIndex = STEPS.findIndex((s) => s.id === draft.stepId);
          setNav((n) => ({ ...n, stepId: stepIndex >= 0 ? STEPS[stepIndex].id : STEPS[0].id }));
          setFurthestStep(Math.max(0, Math.min(draft.furthestStep ?? 0, STEPS.length - 1)));
          setLastSaved(new Date(draft.updatedAt));
          setHasDraft(true);
        }
        setSignatureState(sig);
      } catch {
        if (!cancelled && saveEnabledRef.current) setSaveStatus('error');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------ persistence ----------------------------- */
  const persist = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    if (!saveEnabledRef.current || suspended.current) return;
    setSaveStatus('saving');
    try {
      const record = await saveDraft({
        values: form.getValues(),
        stepId: navRef.current.stepId,
        furthestStep: furthestRef.current,
      });
      setLastSaved(new Date(record.updatedAt));
      setHasDraft(true);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [form]);

  const scheduleSave = useCallback(() => {
    if (!saveEnabledRef.current || suspended.current) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }, [persist]);

  useEffect(() => {
    if (!ready) return;
    const subscription = form.watch(() => scheduleSave());
    return () => subscription.unsubscribe();
  }, [form, ready, scheduleSave]);

  // Save position changes, and flush pending changes when the page is hidden
  // (mobile browsers may discard background tabs without further notice).
  useEffect(() => {
    if (ready && hasDraft) scheduleSave();
  }, [nav.stepId, furthestStep, ready, hasDraft, scheduleSave]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden' && saveTimer.current !== undefined) void persist();
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, [persist]);

  useEffect(() => {
    if (saveEnabled) void requestPersistentStorage();
  }, [saveEnabled]);

  const setSaveEnabled = useCallback(
    async (enabled: boolean) => {
      setSaveEnabledState(enabled);
      saveEnabledRef.current = enabled;
      writePreference(LS_SAVE_ENABLED, enabled ? '1' : '0');
      if (enabled) {
        setSaveStatus('idle');
        await persist();
        if (signature) await saveSignature(signature).catch(() => setSaveStatus('error'));
      } else {
        window.clearTimeout(saveTimer.current);
        setSaveStatus('disabled');
        await clearStoredApplication().catch(() => undefined);
        setHasDraft(false);
        setLastSaved(null);
      }
    },
    [persist, signature],
  );

  const setSignature = useCallback((png: Uint8Array | null) => {
    setSignatureState(png);
    if (saveEnabledRef.current && !suspended.current) {
      saveSignature(png).catch(() => setSaveStatus('error'));
    }
  }, []);

  /* ------------------------------ navigation ------------------------------ */
  const navigate = useCallback((next: Partial<NavState>) => {
    const merged: NavState = { ...navRef.current, returnToReview: false, ...next };
    setNav(merged);
    window.history.pushState({ tag: HISTORY_TAG, nav: merged }, '');
    window.scrollTo({ top: 0 });
  }, []);

  const goToStep = useCallback(
    (stepId: StepId, returnToReview = false) => navigate({ screen: 'wizard', stepId, returnToReview }),
    [navigate],
  );

  const markReached = useCallback((stepId: StepId) => {
    const index = STEPS.findIndex((s) => s.id === stepId);
    setFurthestStep((f) => Math.max(f, index));
  }, []);

  useEffect(() => {
    window.history.replaceState({ tag: HISTORY_TAG, nav: navRef.current }, '');
    const onPop = (event: PopStateEvent) => {
      const state = (event.state as { tag?: string; nav?: unknown } | null) ?? null;
      if (state?.tag === HISTORY_TAG && isNavState(state.nav)) {
        setNav(state.nav);
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A step can become hidden (e.g. spouse after choosing "single"): fall back to a visible one.
  const values = form.watch();
  useEffect(() => {
    if (nav.screen !== 'wizard') return;
    const visible = visibleSteps(values);
    if (!visible.some((s) => s.id === nav.stepId)) {
      const index = STEPS.findIndex((s) => s.id === nav.stepId);
      const fallback = visible.find((s) => STEPS.indexOf(s) > index) ?? visible[visible.length - 1];
      setNav((n) => ({ ...n, stepId: fallback.id }));
    }
  }, [values, nav.screen, nav.stepId]);

  /* ------------------------------- PDF engine ------------------------------ */
  const fitPromise = useRef<Promise<FitChecker | null> | null>(null);
  const ensureFitChecker = useCallback(() => {
    if (!fitPromise.current) {
      // pdf-lib is loaded on demand to keep the first page load small.
      fitPromise.current = Promise.all([loadPdfAssets(), import('../pdf/engine')])
        .then(([assets, engine]) => engine.createFitChecker(assets))
        .then((checker) => {
          setFitChecker(checker);
          return checker;
        })
        .catch(() => {
          fitPromise.current = null;
          return null;
        });
    }
    return fitPromise.current;
  }, []);

  useEffect(() => {
    if (ready && language) void ensureFitChecker();
  }, [ready, language, ensureFitChecker]);

  /* ------------------------------- deletion ------------------------------- */
  const resetInMemory = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    form.reset(createEmptyForm());
    setSignatureState(null);
    setFurthestStep(0);
    setHasDraft(false);
    setLastSaved(null);
  }, [form]);

  const startOver = useCallback(async () => {
    suspended.current = true;
    try {
      resetInMemory();
      await clearStoredApplication().catch(() => undefined);
    } finally {
      suspended.current = false;
    }
    navigate({ screen: 'wizard', stepId: STEPS[0].id });
  }, [navigate, resetInMemory]);

  const deleteEverything = useCallback(async () => {
    suspended.current = true;
    try {
      resetInMemory();
      await deleteAllData();
    } finally {
      suspended.current = false;
      setSaveEnabledState(true);
      saveEnabledRef.current = true;
      setSaveStatus('idle');
      resetLanguage();
      const fresh: NavState = { screen: 'language', stepId: STEPS[0].id, returnToReview: false };
      setNav(fresh);
      window.history.replaceState({ tag: HISTORY_TAG, nav: fresh }, '');
    }
  }, [resetInMemory, resetLanguage]);

  const value = useMemo<AppContextValue>(
    () => ({
      form,
      ready,
      nav,
      navigate,
      goToStep,
      furthestStep,
      markReached,
      hasDraft,
      lastSaved,
      saveStatus,
      saveEnabled,
      setSaveEnabled,
      signature,
      setSignature,
      fitChecker,
      ensureFitChecker,
      startOver,
      deleteEverything,
      flushSave: persist,
    }),
    [
      form,
      ready,
      nav,
      navigate,
      goToStep,
      furthestStep,
      markReached,
      hasDraft,
      lastSaved,
      saveStatus,
      saveEnabled,
      setSaveEnabled,
      signature,
      setSignature,
      fitChecker,
      ensureFitChecker,
      startOver,
      deleteEverything,
      persist,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      <FormProvider {...form}>{children}</FormProvider>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
