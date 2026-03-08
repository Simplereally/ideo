"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SecretInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  isSecret: boolean;
}

export function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  isSecret,
}: SecretInputProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={isSecret && !revealed ? "password" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 rounded-xl border-border bg-muted/40 pr-10 font-mono text-[12px]"
        autoComplete="off"
      />
      {isSecret ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-8 w-8 rounded-lg p-0"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? "Hide value" : "Reveal value"}
        >
          {revealed ? (
            <EyeOff className="size-4 text-muted-foreground" />
          ) : (
            <Eye className="size-4 text-muted-foreground" />
          )}
        </Button>
      ) : null}
    </div>
  );
}
