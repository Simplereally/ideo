# Code Review Findings

> Verify each finding against the current code and only fix it if needed.

---

## API Routes

### `@src/app/api/generate/aiml/route.ts`

**Around line 9-12:**
The AIML image-count handling is inconsistent: reuse resolveImageCount by turning it into a configurable helper (e.g., `resolveImageCount(value: any, max: number): number`) and call it from both branches so every branch uses the same numeric guard; ensure the helper first checks `typeof value === "number"` and `Number.isFinite(value)` before applying `Math.floor`, then clamps the result between 1 and the provided max (`Math.min(max, Math.max(1, Math.floor(value)))`); update the places that currently coerce arbitrary JSON (the `max===10` branch and the spots around lines 122-128) to call this helper instead of directly using `Math.floor` or loose coercion.

---

### `@src/app/api/generate/airforce/route.ts`

**Around line 17-18:**
VIDEO_MODELS is stale and misses models marked `kind:"video"` in the shared catalog (e.g., `airforce:sora-2` and `airforce:veo-3.1-fast`), causing video b64_json to be saved as PNG; update the code that determines media type to derive the video-model set from the shared Airforce model list instead of hardcoding `grok-imagine-video` (or add the missing IDs to VIDEO_MODELS). Specifically, import the shared model catalog (the exported model list/type in `src/lib/types.ts`), build VIDEO_MODELS by selecting entries where `model.kind === "video"` (or extend the existing VIDEO_MODELS to include `"airforce:sora-2"` and `"airforce:veo-3.1-fast"`), and use that set in the route handling logic that processes b64_json outputs (the code paths referenced by VIDEO_MODELS).

**Around line 109-130:**
The request body sent to UPSTREAM currently only includes `model`, `prompt`, `size`, and `n` (airforceBody) which drops supported controls like `seed` and `negativePrompt` advertised by `src/lib/types.ts`; update the logic that builds airforceBody to include `seed` when the target apiModelId supports it (e.g., for `airforce:grok-imagine` / `airforce:flux-2-pro`) and include `negativePrompt` when the model supports it (e.g., `airforce:wan-2.6`), sourcing values from `body.seed` and `body.negativePrompt` and only adding those keys conditionally so the proxy forwards all advertised controls for apiModelId (use the same model-capability checks you use for BATCH_MODELS/VIDEO_MODELS or add small capability sets like SEED_MODELS/NEGATIVE_PROMPT_MODELS keyed by apiModelId).

---

### `@src/app/api/generate/fal/route.ts`

**Around line 109-115:**
The code reads images from the raw `fal.subscribe` result object instead of its data payload, so images remain empty; update the code that sets images to access `result.data` (e.g., `const data = (result as any).data`) and then read `data.images` rather than `result.images` — adjust the mapping/filtering to use `data.images` and keep the same shape (`{ imageUrl }`) and the existing checks that filter undefined URLs; reference symbols: `fal.subscribe`, `result`, `falInput`, `images`.

---

## Store

### `@src/store/image-jobs.ts`

**Around line 99-120:**
`startJob` currently patches an existing ImageJob via `patchJob` but doesn't clear terminal-only fields, so retries can retain old error or resultUrl; update `startJob` to also clear/reset terminal fields by setting `error` to `undefined` (or `null`) and `resultUrl` to `undefined` (or `null`) when patching the job (in addition to setting `status: "generating"` and incrementing `attempts`) so each retry begins with a clean terminal state.

---

### `@src/store/settings.ts`

**Around line 46-53:**
DEFAULT_STATE currently includes `vertexAccessToken` and the persisted settings slice rehydrates it; remove `vertexAccessToken` from the persisted state and stop saving it to localStorage. Specifically, update DEFAULT_STATE (symbol: DEFAULT_STATE in settings.ts) to omit `vertexAccessToken`, and change any persistence/rehydration logic or the persisted slice (the code that serializes/deserializes the SettingsState around the persisted keys referenced later in the file) to exclude `"vertexAccessToken"` from the persisted keys so the token is kept only in-memory (or in a separate non-persisted field) and not written to or read from localStorage.

---

## Components - Studio

### `@src/components/studio/canvas.tsx`

**Around line 279-299:**
The canvas currently doesn't render anything when a selected video job has status `"error"`; add a render branch like the cancelled case to display an error UI so failed jobs don't fall through to a blank canvas. Specifically, where `showVideo` and `selectedVideoJob.status` are checked (the block using `showVideo` and `selectedVideoJob.status === "cancelled"` and the similar block at lines ~397-410), add a branch for `selectedVideoJob.status === "error"` that renders a VideoErrorState (or the existing error component) and pass the job and dismissal handler (e.g., `job={selectedVideoJob} onDismiss={handleVideoDismiss}`) so error state is shown and can be dismissed.

**Around line 136-190:**
Render the download action even when hover is false and give it an accessible name: move the `<Button>` that calls `onDownload` out of the conditional hover-only block so it is always in the DOM (but you can keep it visually subtle), ensure the surrounding overlay/motion.div or parent does not block pointer events (remove or adjust `pointer-events-none`), and add an accessible label to the Button (e.g., `aria-label="Download video"` and/or visible text like `"Download"`) and a `title` attribute so keyboard, touch, and screen-reader users can discover and activate the download; reference the existing hover state, the Button component, and `onDownload` handler when making these changes.

---

### `@src/components/studio/generation-actions.tsx`

**Around line 520-526:**
The cleanup callbacks in the useEffect are returning the result of `handle.cancel()`/`handle.abort()` (triggering `lint/suspicious/useIterableCallbackReturn`); update both `forEach` callbacks used on `pollHandlesRef.current` so they use block-bodied functions that call the method without returning its value (e.g. replace expression-bodied `handle => handle.cancel()` / `handle => handle.abort()` with `handle => { handle.cancel(); }` / `handle => { handle.abort(); }`); ensure you modify both occurrences (the cleanup at useEffect around `pollHandlesRef` and the similar block at the second location) so no value is implicitly returned.

**Around line 528-543:**
The current useEffect resumes all queued/generating image jobs by calling `executeImageJob`, which can re-issue chargeable POST requests; instead, change the logic in the useEffect that reads `useImageJobsStore.getState().jobs` (and uses `hasResumedImageJobs`) so that for every job with status `"queued"` or `"generating"` you do NOT call `executeImageJob`; if `job.attempts >= MAX_IMAGE_JOB_ATTEMPTS` keep the existing `markImageJobError(job.id, "Generation interrupted — exceeded retry limit")`, otherwise mark the job as interrupted/failed with `markImageJobError(job.id, "Generation interrupted — refresh requires manual retry")` (or equivalent message) to prevent automatic re-submission until an explicit retry or a proper idempotent resume mechanism is added.

**Around line 358-410:**
The current `isSubmittingVideo` state check in the submission handler can race on rapid clicks; replace the re-entry guard with a synchronous ref (e.g., `isSubmittingVideoRef`) that you check and set immediately at the top of the handler to block concurrent calls, while still keeping `setIsSubmittingVideo(true)` for UI rendering. Concretely: add a `useRef(false)` named `isSubmittingVideoRef`, change the early-return check to `if (isSubmittingVideoRef.current) return;` then set `isSubmittingVideoRef.current = true` before any await and call `setIsSubmittingVideo(true)` for UX; in the finally block set `isSubmittingVideoRef.current = false` and `setIsSubmittingVideo(false)`. Update any references to `isSubmittingVideo` in this function to use the ref for the re-entry guard and keep the state only for rendering.

---

### `@src/components/studio/generation-controls.tsx`

**Around line 722-735:**
PanelHeader renders an icon-only close button that lacks an accessible name; update the button in PanelHeader to include an accessible label (e.g., add `aria-label="Close settings"` or `aria-label="Close"`) or add visually hidden text inside the button so screen readers can announce it, keeping the existing `onClick` and X icon (component X) unchanged.

**Around line 919-933:**
The sidebar currently only hides visually (width/opacity) so interactive controls remain focusable; change it to be removed from the accessibility tree when closed by unmounting or marking it inert: wrap the motion.div/panelContent with an AnimatePresence or conditionally render panelContent based on `state.isControlsOpen` (instead of keeping it mounted at width:0), or at minimum set `aria-hidden="true"` and ensure all focusable descendants are not tabbable when `state.isControlsOpen` is false (e.g., set `tabIndex=-1` or use the inert polyfill). Target the motion.aside / motion.div and panelContent rendering logic around `state.isControlsOpen` to implement this.

---

### `@src/components/studio/history-panel.tsx`

**Around line 342-452:**
ImageJobItem renders no keyboard-focusable control when `canRetry` is false so the action buttons (ActionIconButton) never become reachable via keyboard; make the row itself keyboard-focusable or add a primary focusable button like HistoryItem/VideoJobItem so isVisible can flip on focus. Specifically, update ImageJobItem to apply containerProps to a focusable element (e.g., change the outer div to a button or insert a hidden primary button when `canRetry` is false), ensure that focus triggers the same visibility behavior used by `useRowActionVisibility` (`isVisible`) and that ActionIconButton instances respect that focus state so Copy/Cancel/Remove become reachable via keyboard for non-error jobs.

---

### `@src/components/studio/image-viewer/index.tsx`

**Around line 150-160:**
The download filename in `handleImageDownload` hardcodes `.png`, causing incorrect extensions; update `handleImageDownload` to derive the file extension from `image.imageUrl` (parse the pathname and extract the suffix after the last dot, validating against known image extensions like png/jpg/jpeg/webp/gif) and use that extension when setting `link.download` (fall back to a safe default like no extension or `.img` if none/invalid). Keep using `image.id` for the base name, ensure `image.imageUrl` is URL-decoded/sanitized before parsing, and preserve the existing behavior of appending the link to the document, calling `click()`, and removing it.

**Line 264:**
Replace the hard-coded 340px by extracting a shared constant (e.g., `INFO_PANEL_WIDTH = 340`) and use that constant where the InfoPanel sets `w-[340px]` and where ImageViewer sets max-w calc; update the InfoPanel component (where `w-[340px]` is declared) to import and use INFO_PANEL_WIDTH (build the className string using template interpolation to produce `w-[{INFO_PANEL_WIDTH}px]`) and update `src/components/studio/image-viewer/index.tsx` (the className with `max-w-[calc(100vw-340px-12px)]`) to import INFO_PANEL_WIDTH and interpolate it into the calc string (e.g., `` `max-w-[calc(100vw-${INFO_PANEL_WIDTH}px-12px)]` ``), exporting the constant from a shared module so both files can import it.

---

### `@src/components/studio/layout.tsx`

**Around line 136-153:**
The off-screen mobile panels still expose their inner controls to keyboard users; update the wrapper divs around HistoryPanel and GenerationControls to remove them from the tab order and AT once closed by toggling accessibility attributes based on state: when `state.isHistoryOpen` is false set `aria-hidden="true"` and `inert` (or add an inert polyfill) on the HistoryPanel wrapper, and likewise when `state.isControlsOpen` is false set `aria-hidden="true"` and `inert` on the GenerationControls wrapper; ensure these attributes are applied/removed in the JSX where the current className uses `state.isHistoryOpen` and `state.isControlsOpen` so the panels remain focusable only when open.

---

### `@src/components/studio/pending-image-jobs-strip.tsx`

**Around line 194-207:**
The cancel button currently has `tabIndex={-1}`, making it keyboard-unfocusable; update the button in pending-image-jobs-strip.tsx (the element that calls `handleCancel`) to be tabbable again by removing `tabIndex={-1}` or setting `tabIndex={0}` so keyboard users can focus and activate the cancel control; ensure the `aria-label="Cancel generation"` and `onClick={handleCancel}` remain unchanged.

---

### `@src/components/studio/prompt-composer.tsx`

**Around line 194-199:**
The footer is rendering image-only controls (ModelCombobox, AspectRatioCombobox, BatchSizePopover) unconditionally; update prompt-composer.tsx to conditionally render those components only when the selected model is an image model (e.g., check the model's media type / supportsImage flag from the same store/prop GenerationControls uses or the current model selection). Wrap ModelCombobox, AspectRatioCombobox and BatchSizePopover in a single conditional that checks the model type (image vs video) so that when a video model is active those controls are omitted.

**Around line 76-86:**
The window-level shortcut handler (`handleKeyDown` in the useEffect) can duplicate submits because the textarea already submits on Enter; update `handleKeyDown` to ignore events originating from editable elements so it only triggers when the keypress is global. Specifically, in `handleKeyDown` check `event.target` (e.g., if `event.target` is an HTMLTextAreaElement/HTMLInputElement or has `contentEditable=true` or `tagName` matches INPUT/TEXTAREA) and return early if so; keep the rest of the meta/ctrl+Enter logic calling `handleGenerate` only for non-editable targets. Apply the same guard in the other useEffect instance mentioned (lines ~124-130) to prevent double enqueuing.

---

### `@src/components/studio/batch-size-popover.tsx`

**Around line 40-42:**
The displayed batch size falls back to `batchSizeOptions[0]` when `state.numberOfImages` isn't valid but the store isn't updated; modify the component logic around `selectedBatchSize` so that when `state.numberOfImages` is not included in `batchSizeOptions` you also update the store (e.g., call the component's setter/dispatcher that changes `numberOfImages`) to `batchSizeOptions[0]`; reference the symbols `selectedBatchSize`, `batchSizeOptions`, and `state.numberOfImages` and ensure the update occurs once (on mount or render fallback) to keep displayed value and persisted state in sync.

---

### `@src/components/studio/api-integrations/provider-config.tsx`

**Around line 204-213:**
The current use of `"as Record<Provider,...>"` for PROVIDER_FIELDS and PROVIDER_CONFIG_BY_ID hides missing entries and lets `getProviderConfig(providerId: Provider)` return undefined later; fix by ensuring lookups fail fast: stop asserting the maps as exhaustive and instead construct PROVIDER_CONFIG_BY_ID (from PROVIDER_CONFIGS) without the blanket `"as"` and update `getProviderConfig` to validate the lookup (using `PROVIDER_CONFIG_BY_ID[providerId]`) and throw a clear error if undefined (mentioning the Provider id), or alternatively derive the maps from a true `Record<Provider,...>` source; key symbols: PROVIDER_CONFIGS, PROVIDER_FIELDS, PROVIDER_CONFIG_BY_ID, getProviderConfig, Provider.

---

## Components - Tests

### `@src/components/studio/__tests__/generation-actions.test.tsx`

**Around line 392-401:**
The test currently expects `mocks.completeGeneration` to be called in reverse order because the implementation uses `generatedImages.toReversed().forEach(...)`; add a concise inline comment next to the `toReversed()` call (or above the loop) explaining the intent (e.g., "reverse so newest images are completed/inserted first to preserve display/history order"), referencing the `generatedImages.toReversed().forEach` and `mocks.completeGeneration` symbols so future readers understand why the reverse iteration is required.

---

### `@src/components/studio/__tests__/integration.test.tsx`

**Around line 215-221:**
The tests hardcode a pre-Airforce provider list which skips new providers like `"airforce"`; update both tests to derive the provider list dynamically (e.g., use `getProviders()` or `Object.keys(PROVIDER_LABELS)`) instead of the literal array, and rename the stale test description ("every provider has a display label") if needed; ensure you replace references to the hardcoded array in the test file around the checks that assert `PROVIDER_LABELS[p]` to iterate over the dynamic provider list so new providers are automatically covered.

---

### `@src/components/studio/prompt-composer.test.tsx`

**Around line 137-165:**
The file contains a duplicated mock for `"./generation-actions"` (both blocks define `useGenerationActions` with `generateFromCurrentState`, `retryVideoJob`, `retryImageJob`, `isSubmittingVideo`); remove the redundant mock block so only a single `vi.mock("./generation-actions")` remains, keeping the intended implementation of `useGenerationActions` (with `generateFromCurrentState`, `retryVideoJob`, `retryImageJob`, `isSubmittingVideo`) to avoid confusion and accidental overrides.

**Around line 324-341:**
The `beforeEach` setup block is declared after the first test in the `describe("PromptComposer character limit")` suite, which is confusing; move the `beforeEach` that initializes `mockPrompt`, `mockModel`, `mockSetPrompt`, `mockOpenApiKeyDialog.mockClear`, and `mockToggleControls.mockClear` so it appears at the top of the describe block (i.e., before the `it("renders the batch size control alongside the composer selectors")` test) to ensure test setup is obvious and consistently applied.

---

## Hooks

### `@src/hooks/use-configured-providers.ts`

**Around line 20-29:**
`useConfiguredProviders` currently calls `useSettingsStore()` which returns the entire settings object and can trigger unnecessary recomputations; to fix, either (A) narrow the subscription by using a selector with `useSettingsStore(selector)` that returns only the specific settings keys needed by `getConfiguredProviders`/`readFieldValue` (derive the key list from your provider config) so useMemo only reruns when those specific fields change, or (B) if provider keys are dynamic and selector gains no benefit, keep the current call but add a brief code comment in `useConfiguredProviders` explaining why a full settings subscription is intentional to avoid premature selector optimization; reference `useConfiguredProviders`, `useSettingsStore`, `getConfiguredProviders`, and `readFieldValue` when making the change.

---

## Styles

### `@src/app/globals.css`

**Around line 221-227:**
The scrollbar hover rules use `!important` which masks competing ancestor-hover rules; update the selectors instead of using `!important`: remove the `!important` from `::-webkit-scrollbar-thumb:hover` and `.dark ::-webkit-scrollbar-thumb:hover` and make the dark-mode rule more specific so it wins when intended (for example target `.dark *:hover::-webkit-scrollbar-thumb` or an equivalent more-specific selector) so you preserve the intended hover behavior without forcing `!important`; update the selectors around `::-webkit-scrollbar-thumb:hover` and `.dark ::-webkit-scrollbar-thumb:hover` accordingly.

---

## Types

### `@src/lib/types.ts`

**Around line 62-63:**
The VideoRequestParams type currently widens the shot type back to string and loses the compile-time guard introduced by VideoShotType; update the VideoRequestParams definition (and any related properties within the same block, e.g., the `shotType` field) to use the VideoShotType union instead of string so the payload remains narrowed across storage, retry, and serialization paths; search for occurrences of `shotType` or the VideoRequestParams type (the block around lines 117–129) and change their types to VideoShotType to keep consistency.

---

### `@src/lib/types/generation.ts`

**Around line 49-59:**
The ImageGenerationResponse type currently allows an empty object; add runtime validation to ensure a valid response contains at least `imageUrl` or a non-empty `images` array. Implement a type guard/validator function (e.g., `isValidImageGenerationResponse` or `validateImageGenerationResponse`) that checks that either `imageUrl` is a non-empty string or `images` is an array with at least one GeneratedImageResult (and each GeneratedImageResult has expected minimal fields), and call this validator where responses are consumed (e.g., after provider calls that return ImageGenerationResponse) to throw or return a clear error when the shape is invalid.
