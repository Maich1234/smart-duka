import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BusinessType =
  | 'retail'
  | 'water'
  | 'agrovet'
  | 'electronics'
  | 'boutique'
  | 'pharmacy'
  | 'hardware'
  | 'supermarket'
  | 'restaurant'
  | 'other';

export type ProductRange = 'under50' | '50to200' | '200to1000' | 'over1000';

export interface OnboardingAnswers {
  businessType: BusinessType | null;
  productRange: ProductRange | null;
  paymentMethods: string[];
  struggles: string[];
}

/** Collected during the pre-signup journey, then used to prefill registration
 *  and (currency/location) applied to the shop config after first login. */
export interface BusinessDraft {
  ownerName: string;
  shopName: string;
  phone: string;
  country: string;
  county: string;
  subCounty: string;
  currency: string;
}

const emptyAnswers: OnboardingAnswers = {
  businessType: null,
  productRange: null,
  paymentMethods: [],
  struggles: [],
};

const emptyDraft: BusinessDraft = {
  ownerName: '',
  shopName: '',
  phone: '',
  country: 'KE',
  county: '',
  subCounty: '',
  currency: 'KES',
};

export interface OnboardingState {
  /** True once someone finishes the journey, signs in, or claims an existing
   *  account on this device — the device is no longer "new" and cold starts
   *  skip the tour permanently. */
  completed: boolean;
  /** Getting-started checklist on the owner dashboard, hidden permanently
   *  once dismissed. */
  checklistDismissed: boolean;
  answers: OnboardingAnswers;
  draft: BusinessDraft;
  setAnswer: <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => void;
  setDraft: (patch: Partial<BusinessDraft>) => void;
  markCompleted: () => void;
  dismissChecklist: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      checklistDismissed: false,
      answers: emptyAnswers,
      draft: emptyDraft,
      setAnswer: (key, value) =>
        set((state) => ({ answers: { ...state.answers, [key]: value } })),
      setDraft: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
      markCompleted: () => set({ completed: true }),
      dismissChecklist: () => set({ checklistDismissed: true }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
