import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  googleApiKey: string;
  falApiKey: string;
  setGoogleApiKey: (key: string) => void;
  setFalApiKey: (key: string) => void;
  clearKeys: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      googleApiKey: '',
      falApiKey: '',
      setGoogleApiKey: (key) => set({ googleApiKey: key }),
      setFalApiKey: (key) => set({ falApiKey: key }),
      clearKeys: () => set({ googleApiKey: '', falApiKey: '' }),
    }),
    {
      name: 'ideo-settings',
    }
  )
);
