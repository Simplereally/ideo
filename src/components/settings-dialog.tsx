"use client";

import { useState } from "react";
import { useSettingsStore } from "@/store/settings";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

export function SettingsDialog() {
  const { googleApiKey, falApiKey, setGoogleApiKey, setFalApiKey } = useSettingsStore();
  
  // Local state to avoid immediate updates on every keystroke
  const [localGoogle, setLocalGoogle] = useState(googleApiKey);
  const [localFal, setLocalFal] = useState(falApiKey);
  const [open, setOpen] = useState(false);

  // Sync state when opening dialog
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalGoogle(googleApiKey);
      setLocalFal(falApiKey);
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    setGoogleApiKey(localGoogle);
    setFalApiKey(localFal);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings & API Keys</DialogTitle>
          <DialogDescription>
            Enter your API keys to power the application. These keys are stored locally on your device and are never sent to our servers.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="google">Google AI Studio API Key</Label>
            <Input
              id="google"
              type="password"
              placeholder="AIzaSy..."
              value={localGoogle}
              onChange={(e) => setLocalGoogle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for Gemini text and vision tasks. Generate at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-primary">Google AI Studio</a>.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fal">Fal AI API Key</Label>
            <Input
              id="fal"
              type="password"
              placeholder="key_id:key_secret"
              value={localFal}
              onChange={(e) => setLocalFal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for fast image and media generation. Generate at <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">fal.ai Dashboard</a>.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
