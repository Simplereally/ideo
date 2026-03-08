"use client";

import type { Provider } from "@/lib/types";
import type { SettingsState, SettingsStore } from "@/store/settings";
import { getProviderConfig, type ProviderFieldConfig } from "./provider-config";

export type ProviderLocalState = "empty" | "partial" | "complete";

export interface ProviderConfigurationState {
  hasAnyLocalValue: boolean;
  hasCompleteLocalConfig: boolean;
  localState: ProviderLocalState;
  requiredFieldCount: number;
  completedRequiredFieldCount: number;
  isConnected: boolean;
}

function readFieldValue(settings: SettingsState, field: ProviderFieldConfig): string {
  return settings[field.key];
}

function hasEnteredValue(settings: SettingsState, field: ProviderFieldConfig): boolean {
  return readFieldValue(settings, field).trim().length > 0;
}

function hasMeaningfulLocalValue(
  settings: SettingsState,
  field: ProviderFieldConfig,
): boolean {
  const value = readFieldValue(settings, field).trim();
  if (value.length === 0) return false;
  if (field.defaultValue && value === field.defaultValue) return false;
  return true;
}

export function getProviderConfigurationState(
  providerId: Provider,
  settings: SettingsState,
  serverConnected: boolean,
): ProviderConfigurationState {
  const provider = getProviderConfig(providerId);
  const requiredFields = provider.fields.filter((field) => field.required);
  const completedRequiredFieldCount = requiredFields.filter((field) =>
    hasEnteredValue(settings, field),
  ).length;
  const hasAnyLocalValue = provider.fields.some((field) =>
    hasMeaningfulLocalValue(settings, field),
  );
  const hasCompleteLocalConfig =
    requiredFields.length > 0 &&
    completedRequiredFieldCount === requiredFields.length;

  return {
    hasAnyLocalValue,
    hasCompleteLocalConfig,
    localState: hasCompleteLocalConfig
      ? "complete"
      : hasAnyLocalValue
        ? "partial"
        : "empty",
    requiredFieldCount: requiredFields.length,
    completedRequiredFieldCount,
    isConnected: hasCompleteLocalConfig || serverConnected,
  };
}

export function getProviderFieldValue(
  settings: SettingsState,
  field: ProviderFieldConfig,
): string {
  return readFieldValue(settings, field);
}

export function setProviderFieldValue(
  store: SettingsStore,
  field: ProviderFieldConfig,
  value: string,
) {
  const setter = store[field.setterKey];
  setter(value);
}

export function clearProviderFields(store: SettingsStore, providerId: Provider) {
  const provider = getProviderConfig(providerId);

  for (const field of provider.fields) {
    setProviderFieldValue(store, field, field.defaultValue ?? "");
  }
}
