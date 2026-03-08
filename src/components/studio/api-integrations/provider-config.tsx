"use client";

import type { ComponentType } from "react";
import { Cloud, Cpu, KeyRound, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Provider } from "@/lib/types";
import type { SettingsState, SettingsStore } from "@/store/settings";

type ProviderFieldKey = keyof SettingsState;

type ProviderSetterKey = keyof Pick<
  SettingsStore,
  | "setGoogleApiKey"
  | "setFalApiKey"
  | "setAimlApiKey"
  | "setAirforceApiKey"
  | "setVertexProjectId"
  | "setVertexLocation"
  | "setVertexAccessToken"
>;

export interface ProviderFieldConfig {
  key: ProviderFieldKey;
  setterKey: ProviderSetterKey;
  label: string;
  placeholder: string;
  description: string;
  secret: boolean;
  required: boolean;
  defaultValue?: string;
}

export interface ProviderDetailSlotProps {
  providerId: Provider;
}

export interface ProviderConfig {
  id: Provider;
  label: string;
  tagline: string;
  description: string;
  docsUrl: string;
  docsLabel: string;
  icon: LucideIcon;
  accentClassName: string;
  accentBackgroundClassName: string;
  fields: ProviderFieldConfig[];
  DetailSlot?: ComponentType<ProviderDetailSlotProps>;
}

function VertexProviderDetailSlot() {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
      <p className="text-[12px] font-medium text-foreground">
        Vertex requires both a GCP project ID and an access token.
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Keep the location aligned with the region where the model is enabled.
        The location defaults to <span className="font-mono">us-central1</span>,
        but you can override it when your project uses a different region.
      </p>
    </div>
  );
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "google",
    label: "Google AI",
    tagline: "Imagen 3 via AI Studio",
    description:
      "Use your Google AI Studio key for browser-local bring-your-own-key requests.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    docsLabel: "Docs",
    icon: KeyRound,
    accentClassName: "text-blue-600 dark:text-blue-400",
    accentBackgroundClassName: "bg-blue-500/10",
    fields: [
      {
        key: "googleApiKey",
        setterKey: "setGoogleApiKey",
        label: "API Key",
        placeholder: "AIza…",
        description: "Create an API key in Google AI Studio.",
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: "vertex",
    label: "Vertex AI",
    tagline: "Imagen 3 & 4 via GCP",
    description:
      "Configure the GCP identifiers Vertex needs in addition to the access token.",
    docsUrl:
      "https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview",
    docsLabel: "Docs",
    icon: Cloud,
    accentClassName: "text-emerald-600 dark:text-emerald-400",
    accentBackgroundClassName: "bg-emerald-500/10",
    DetailSlot: VertexProviderDetailSlot,
    fields: [
      {
        key: "vertexProjectId",
        setterKey: "setVertexProjectId",
        label: "Project ID",
        placeholder: "my-gcp-project",
        description: "The Google Cloud project that has Vertex AI enabled.",
        secret: false,
        required: true,
      },
      {
        key: "vertexLocation",
        setterKey: "setVertexLocation",
        label: "Location",
        placeholder: "us-central1",
        description:
          "Optional override for the Vertex region. Defaults to us-central1.",
        secret: false,
        required: false,
        defaultValue: "us-central1",
      },
      {
        key: "vertexAccessToken",
        setterKey: "setVertexAccessToken",
        label: "Access Token",
        placeholder: "ya29.…",
        description: "Short-lived OAuth access token used to authenticate requests.",
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: "fal",
    label: "Fal AI",
    tagline: "FLUX models",
    description: "Connect Fal AI for FLUX image generation using your own key.",
    docsUrl: "https://fal.ai/dashboard/keys",
    docsLabel: "Docs",
    icon: Sparkles,
    accentClassName: "text-violet-600 dark:text-violet-400",
    accentBackgroundClassName: "bg-violet-500/10",
    fields: [
      {
        key: "falApiKey",
        setterKey: "setFalApiKey",
        label: "API Key",
        placeholder: "fal_…",
        description: "Generate an API key from the Fal dashboard.",
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: "aiml",
    label: "AI/ML",
    tagline: "Multi-provider image API",
    description: "Bring an AI/ML API key for additional provider-backed models.",
    docsUrl: "https://docs.aimlapi.com/",
    docsLabel: "Docs",
    icon: Cpu,
    accentClassName: "text-orange-600 dark:text-orange-400",
    accentBackgroundClassName: "bg-orange-500/10",
    fields: [
      {
        key: "aimlApiKey",
        setterKey: "setAimlApiKey",
        label: "API Key",
        placeholder: "sk-…",
        description: "Use the API key issued by AI/ML API.",
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: "airforce",
    label: "Airforce API",
    tagline: "Multi-model image & video generation",
    description:
      "Connect Airforce API for Grok Imagine, FLUX, and video models.",
    docsUrl: "https://api.airforce",
    docsLabel: "API Docs",
    icon: Zap,
    accentClassName: "text-cyan-600 dark:text-cyan-400",
    accentBackgroundClassName: "bg-cyan-500/10",
    fields: [
      {
        key: "airforceApiKey",
        setterKey: "setAirforceApiKey",
        label: "API Key",
        placeholder: "af-…",
        description: "Use the API key issued by Airforce API.",
        secret: true,
        required: true,
      },
    ],
  },
];

export const PROVIDER_FIELDS = Object.fromEntries(
  PROVIDER_CONFIGS.map((provider) => [provider.id, provider.fields]),
) as Record<Provider, ProviderFieldConfig[]>;

export const PROVIDER_CONFIG_BY_ID = Object.fromEntries(
  PROVIDER_CONFIGS.map((provider) => [provider.id, provider]),
) as Record<Provider, ProviderConfig>;

export function getProviderConfig(providerId: Provider): ProviderConfig {
  return PROVIDER_CONFIG_BY_ID[providerId];
}
