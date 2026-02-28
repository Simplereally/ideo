"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudio } from "@/lib/store";
import { useSettingsStore } from "@/store/settings";
import { cn } from "@/lib/utils";

export function ApiKeyDialog() {
  const { state, closeApiKeyDialog } = useStudio();
  const { googleApiKey, falApiKey, setGoogleApiKey, setFalApiKey } = useSettingsStore();
  
  const [localGoogle, setLocalGoogle] = useState(googleApiKey);
  const [localFal, setLocalFal] = useState(falApiKey);
  
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showFalKey, setShowFalKey] = useState(false);

  const hasAnyKey = !!googleApiKey || !!falApiKey;

  function handleOpen(open: boolean) {
    if (open) {
      setLocalGoogle(googleApiKey);
      setLocalFal(falApiKey);
      setShowGoogleKey(false);
      setShowFalKey(false);
    } else {
      closeApiKeyDialog();
    }
  }

  function handleSave() {
    setGoogleApiKey(localGoogle.trim());
    setFalApiKey(localFal.trim());
    closeApiKeyDialog();
  }

  function handleRemove() {
    setGoogleApiKey("");
    setFalApiKey("");
    setLocalGoogle("");
    setLocalFal("");
    closeApiKeyDialog();
  }

  return (
    <Dialog open={state.isApiKeyDialogOpen} onOpenChange={handleOpen}>
      <DialogContent className="glass-panel border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-normal">
            Connect AI Providers
          </DialogTitle>
          <DialogDescription>
            Enter your API keys to enable image generation models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Google AI Studio Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-blue-500/20 text-blue-500">
                <KeyRound className="size-3.5" />
              </div>
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Google AI Studio
              </Label>
            </div>
            
            <div className={cn("amber-focus relative rounded-lg")}>
              <Input
                type={showGoogleKey ? "text" : "password"}
                value={localGoogle}
                onChange={(e) => setLocalGoogle(e.target.value)}
                placeholder="AIzaSy..."
                className="border-border bg-input pr-10 focus-visible:border-amber focus-visible:ring-amber/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowGoogleKey(!showGoogleKey)}
              >
                {showGoogleKey ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Required for Imagen models. Generate at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline">aistudio.google.com</a>.
            </p>
          </div>

          {/* Fal AI Key */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-fuchsia-500/20 text-fuchsia-500">
                <ImageIcon className="size-3.5" />
              </div>
              <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Fal AI
              </Label>
            </div>
            
            <div className={cn("amber-focus relative rounded-lg")}>
              <Input
                type={showFalKey ? "text" : "password"}
                value={localFal}
                onChange={(e) => setLocalFal(e.target.value)}
                placeholder="key_id:key_secret"
                className="border-border bg-input pr-10 focus-visible:border-amber focus-visible:ring-amber/30"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowFalKey(!showFalKey)}
              >
                {showFalKey ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Required for FLUX models. Generate at <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="text-amber hover:underline">fal.ai/dashboard/keys</a>.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 mt-2">
          {hasAnyKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Remove Keys
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => closeApiKeyDialog()}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!localGoogle.trim() && !localFal.trim()}
            className="bg-amber text-background hover:bg-amber/90"
          >
            Save Keys
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
