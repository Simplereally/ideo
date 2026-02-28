"use client";

export function FilmGrain() {
  return (
    <>
      <div
        className="film-grain pointer-events-none fixed inset-0 z-50"
        aria-hidden="true"
      />
      <div className="darkroom-glow" aria-hidden="true" />
    </>
  );
}
