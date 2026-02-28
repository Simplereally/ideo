"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ImageIcon, Cloud } from "lucide-react";
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
  const {
    googleApiKey,
    falApiKey,
    vertexProjectId,
    vertexLocation,
    vertexAccessToken,
    setGoogleApiKey,
    setFalApiKey,
    setVertexProjectId,
    setVertexLocation,
    setVertexAccessToken,
  } = useSettingsStore();
  
  const [localGoogle, setLocalGoogle] = useState(googleApiKey);
  const [localFal, setLocalFal] = useState(falApiKey);
  const [localVertexProject, setLocalVertexProject] = useState(vertexProjectId || "");
  const [localVertexLocation, setLocalVertexLocation] = useState(vertexLocation || "us-central1");
  const [localVertexToken, setLocalVertexToken] = useState(vertexAccessToken || "");
  
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showFalKey, setShowFalKey] = useState(false);
  const [showVertexToken, setShowVertexToken] = useState(false);

  const hasAnyKey = !!googleApiKey || !!falApiKey || !!vertexAccessToken;

  function handleOpen(open: boolean) {
    if (open) {
      setLocalGoogle(googleApiKey);
      setLocalFal(falApiKey);
      setLocalVertexProject(vertexProjectId || "");
      setLocalVertexLocation(vertexLocation || "us-central1");
      setLocalVertexToken(vertexAccessToken || "");
      setShowGoogleKey(false);
      setShowFalKey(false);
      setShowVertexToken(false);
    } else {
      closeApiKeyDialog();
    }
  }

  function handleSave() {
    setGoogleApiKey(localGoogle.trim());
    setFalApiKey(localFal.trim());
    setVertexProjectId(localVertexProject.trim());
    setVertexLocation(localVertexLocation.trim() || "us-central1");
    setVertexAccessToken(localVertexToken.trim());
    closeApiKeyDialog();
  }

  function handleRemove() {
    setGoogleApiKey("");
    setFalApiKey("");
    setVertexProjectId("");
    setVertexLocation("us-central1");
    setVertexAccessToken("");
    setLocalGoogle("");
    setLocalFal("");
    setLocalVertexProject("");
    setLocalVertexLocation("us-central1");
    setLocalVertexToken("");
    closeApiKeyDialog();
  }

  return (
    <Dialog open={state.isApiKeyDialogOpen} onOpenChange={handleOpen}>
      <DialogContent className="glass-panel border-black/5 sm:max-w-md rounded-[2rem] p-8 gap-6">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="font-serif text-3xl font-normal text-black">
            Integrations
          </DialogTitle>
          <DialogDescription className="text-neutral-500 font-sans text-sm">
            Provide your API keys to enable generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          {/* Google AI Studio Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-blue-50 text-brand-blue">
                  <KeyRound className="size-3" strokeWidth={2.5} />
                </div>
                <Label className="font-sans text-sm font-semibold text-black">
                  Google AI Studio
                </Label>
              </div>
              {googleApiKey ? (
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-600">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-medium text-neutral-400">Not set</span>
              )}
            </div>
            
            <div className="relative">
              <Input
                type={showGoogleKey ? "text" : "password"}
                value={localGoogle}
                onChange={(e) => setLocalGoogle(e.target.value)}
                placeholder="AIzaSy..."
                className="rounded-xl border-0 bg-black/5 px-4 py-5 text-sm text-black placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:bg-white transition-all pr-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400 hover:text-black hover:bg-transparent"
                onClick={() => setShowGoogleKey(!showGoogleKey)}
              >
                {showGoogleKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-neutral-400 pl-1">
              For Imagen 3 models. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-medium">Get a key</a>
            </p>
          </div>

          {/* Vertex AI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <Cloud className="size-3" strokeWidth={2.5} />
                </div>
                <Label className="font-sans text-sm font-semibold text-black">
                  Google Vertex AI
                </Label>
              </div>
              {vertexAccessToken && vertexProjectId ? (
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-600">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-medium text-neutral-400">Not set</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Project ID */}
              <div className="space-y-1.5">
                <Label htmlFor="vertex-project" className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider pl-1">
                  Project ID
                </Label>
                <Input
                  id="vertex-project"
                  type="text"
                  value={localVertexProject}
                  onChange={(e) => setLocalVertexProject(e.target.value)}
                  placeholder="my-project"
                  className="rounded-xl border-0 bg-black/5 px-3 py-4 text-sm text-black placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:bg-white transition-all"
                />
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label htmlFor="vertex-location" className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider pl-1">
                  Location
                </Label>
                <Input
                  id="vertex-location"
                  type="text"
                  value={localVertexLocation}
                  onChange={(e) => setLocalVertexLocation(e.target.value)}
                  placeholder="us-central1"
                  className="rounded-xl border-0 bg-black/5 px-3 py-4 text-sm text-black placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:bg-white transition-all"
                />
              </div>
            </div>

            {/* Access Token */}
            <div className="space-y-1.5">
              <Label htmlFor="vertex-token" className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider pl-1">
                Access Token
              </Label>
              <div className="relative">
                <Input
                  id="vertex-token"
                  type={showVertexToken ? "text" : "password"}
                  value={localVertexToken}
                  onChange={(e) => setLocalVertexToken(e.target.value)}
                  placeholder="ya29.a0..."
                  className="rounded-xl border-0 bg-black/5 px-4 py-5 text-sm text-black placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:bg-white transition-all pr-10"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400 hover:text-black hover:bg-transparent"
                  onClick={() => setShowVertexToken(!showVertexToken)}
                >
                  {showVertexToken ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 pl-1 leading-relaxed">
              For Imagen 4 models. Run <code className="rounded-md bg-black/5 px-1 py-0.5 text-black font-mono">gcloud auth print-access-token</code> to get a temporary token.
            </p>
          </div>

          {/* Fal AI Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                  <ImageIcon className="size-3" strokeWidth={2.5} />
                </div>
                <Label className="font-sans text-sm font-semibold text-black">
                  Fal AI
                </Label>
              </div>
              {falApiKey ? (
                <span className="flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-green-600">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  Connected
                </span>
              ) : (
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-medium text-neutral-400">Not set</span>
              )}
            </div>
            
            <div className="relative">
              <Input
                type={showFalKey ? "text" : "password"}
                value={localFal}
                onChange={(e) => setLocalFal(e.target.value)}
                placeholder="key_id:key_secret"
                className="rounded-xl border-0 bg-black/5 px-4 py-5 text-sm text-black placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-brand-blue/30 focus-visible:bg-white transition-all pr-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-neutral-400 hover:text-black hover:bg-transparent"
                onClick={() => setShowFalKey(!showFalKey)}
              >
                {showFalKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-neutral-400 pl-1">
              For FLUX models. <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline font-medium">Get a key</a>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-3 sm:gap-3 mt-4 pt-4 border-t border-black/5">
          {hasAnyKey && (
            <Button
              variant="ghost"
              size="default"
              onClick={handleRemove}
              className="mr-auto text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl px-4 font-medium"
            >
              Clear All
            </Button>
          )}
          <Button
            variant="ghost"
            size="default"
            onClick={() => closeApiKeyDialog()}
            className="rounded-xl px-4 text-neutral-600 hover:text-black hover:bg-black/5 font-medium"
          >
            Cancel
          </Button>
          <Button
            size="default"
            onClick={handleSave}
            disabled={!localGoogle.trim() && !localFal.trim() && !localVertexToken.trim()}
            className="rounded-xl px-6 bg-brand-blue text-white hover:bg-blue-600 shadow-md shadow-blue-500/20 font-medium"
          >
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
