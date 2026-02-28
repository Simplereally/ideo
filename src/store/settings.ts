import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  googleApiKey: string;
  falApiKey: string;
  vertexProjectId: string;
  vertexLocation: string;
  vertexAccessToken: string;
  setGoogleApiKey: (key: string) => void;
  setFalApiKey: (key: string) => void;
  setVertexProjectId: (id: string) => void;
  setVertexLocation: (loc: string) => void;
  setVertexAccessToken: (token: string) => void;
  clearKeys: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      googleApiKey: '',
      falApiKey: '',
      vertexProjectId: '',
      vertexLocation: 'us-central1',
      vertexAccessToken: '',
      setGoogleApiKey: (key) => set({ googleApiKey: key }),
      setFalApiKey: (key) => set({ falApiKey: key }),
      setVertexProjectId: (id) => set({ vertexProjectId: id }),
      setVertexLocation: (loc) => set({ vertexLocation: loc }),
      setVertexAccessToken: (token) => set({ vertexAccessToken: token }),
      clearKeys: () => set({
        googleApiKey: '',
        falApiKey: '',
        vertexProjectId: '',
        vertexLocation: 'us-central1',
        vertexAccessToken: '',
      }),
    }),
    {
      name: 'ideo-settings',
    }
  )
);
