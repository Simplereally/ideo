import type {
  GeneratedImage,
  VideoGenerationStatus,
  VideoJob,
} from "@/lib/types";
import type { ImageJob, ImageJobStatus } from "@/store/image-jobs";

export type HistoryFilter = "all" | "complete" | "failures";

export const HISTORY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "complete", label: "Complete" },
  { value: "failures", label: "Failures" },
] as const satisfies ReadonlyArray<{
  value: HistoryFilter;
  label: string;
}>;

type HistoryBucket = "active" | "complete" | "failure";
type ImageJobBucket = Exclude<HistoryBucket, "complete">;

type HistorySectionId =
  | "active-images"
  | "active-videos"
  | "failures"
  | "completed-videos"
  | "images";

export type HistoryPanelItem =
  | {
      kind: "saved-image";
      key: string;
      image: GeneratedImage;
      isSelected: boolean;
    }
  | {
      kind: "video-job";
      key: string;
      job: VideoJob;
      isSelected: boolean;
    }
  | {
      kind: "image-job";
      key: string;
      job: ImageJob;
      isSelected: boolean;
    };

export interface HistoryPanelSection {
  id: HistorySectionId;
  label: string;
  items: HistoryPanelItem[];
  showDivider: boolean;
}

export interface HistoryPanelEmptyState {
  title: string;
  description: string;
}

export interface HistoryPanelViewModel {
  hasAnyItems: boolean;
  hasVisibleItems: boolean;
  sections: HistoryPanelSection[];
  emptyState: HistoryPanelEmptyState | null;
}

export interface BuildHistoryPanelViewModelInput {
  filter: HistoryFilter;
  savedImages: readonly GeneratedImage[];
  selectedImageId: string | null;
  videoJobs: readonly VideoJob[];
  selectedVideoJobId: string | null;
  imageJobs: readonly ImageJob[];
  selectedImageJobId: string | null;
}

function getItemCreatedAt(item: HistoryPanelItem): number {
  switch (item.kind) {
    case "saved-image":
      return item.image.createdAt;
    case "video-job":
      return item.job.createdAt;
    case "image-job":
      return item.job.createdAt;
    default:
      return 0;
  }
}

const ACTIVE_VIDEO_STATUSES: ReadonlySet<VideoGenerationStatus> = new Set([
  "queued",
  "generating",
]);

const FAILURE_VIDEO_STATUSES: ReadonlySet<VideoGenerationStatus> = new Set([
  "error",
  "cancelled",
]);

const ACTIVE_IMAGE_STATUSES: ReadonlySet<ImageJobStatus> = new Set([
  "queued",
  "generating",
]);

const FAILURE_IMAGE_STATUSES: ReadonlySet<ImageJobStatus> = new Set([
  "error",
  "cancelled",
]);

function getVideoBucket(status: VideoGenerationStatus): HistoryBucket {
  if (ACTIVE_VIDEO_STATUSES.has(status)) {
    return "active";
  }

  if (FAILURE_VIDEO_STATUSES.has(status)) {
    return "failure";
  }

  return "complete";
}

function getImageJobBucket(status: ImageJobStatus): ImageJobBucket | null {
  if (ACTIVE_IMAGE_STATUSES.has(status)) {
    return "active";
  }

  if (FAILURE_IMAGE_STATUSES.has(status)) {
    return "failure";
  }

  return null;
}

function isBucketVisible(filter: HistoryFilter, bucket: HistoryBucket): boolean {
  switch (filter) {
    case "all":
      return true;
    case "complete":
      return bucket === "complete";
    case "failures":
      return bucket === "failure";
    default:
      return false;
  }
}

function getEmptyState(filter: HistoryFilter): HistoryPanelEmptyState | null {
  if (filter === "complete") {
    return {
      title: "No completed items",
      description: "Completed images and videos will show up here.",
    };
  }

  if (filter === "failures") {
    return {
      title: "No failures",
      description: "Failed or cancelled jobs will show up here.",
    };
  }

  return null;
}

function withDividerFlags(
  sections: Array<Omit<HistoryPanelSection, "showDivider">>,
): HistoryPanelSection[] {
  return sections.map((section, index) => ({
    ...section,
    showDivider: section.id !== "images" || index > 0,
  }));
}

export function buildHistoryPanelViewModel({
  filter,
  savedImages,
  selectedImageId,
  videoJobs,
  selectedVideoJobId,
  imageJobs,
  selectedImageJobId,
}: BuildHistoryPanelViewModelInput): HistoryPanelViewModel {
  const videoItemsByBucket: Record<HistoryBucket, HistoryPanelItem[]> = {
    active: [],
    complete: [],
    failure: [],
  };

  for (const job of videoJobs) {
    const bucket = getVideoBucket(job.status);
    if (!isBucketVisible(filter, bucket)) {
      continue;
    }

    videoItemsByBucket[bucket].push({
      kind: "video-job",
      key: job.id,
      job,
      isSelected: selectedVideoJobId === job.id,
    });
  }

  const imageJobItemsByBucket: Record<ImageJobBucket, HistoryPanelItem[]> = {
    active: [],
    failure: [],
  };

  for (const job of imageJobs) {
    const bucket = getImageJobBucket(job.status);
    if (!bucket || !isBucketVisible(filter, bucket)) {
      continue;
    }

    imageJobItemsByBucket[bucket].push({
      kind: "image-job",
      key: job.id,
      job,
      isSelected: selectedImageJobId === job.id,
    });
  }

  const savedImageItems =
    filter === "failures"
      ? []
      : savedImages.map<HistoryPanelItem>((image) => ({
          kind: "saved-image",
          key: image.id,
          image,
          isSelected: selectedImageId === image.id,
        }));

  const sectionsInput: Array<Omit<HistoryPanelSection, "showDivider">> = [];

  if (imageJobItemsByBucket.active.length > 0) {
    sectionsInput.push({
      id: "active-images",
      label: "Active Images",
      items: imageJobItemsByBucket.active,
    });
  }

  if (videoItemsByBucket.active.length > 0) {
    sectionsInput.push({
      id: "active-videos",
      label: "Active Videos",
      items: videoItemsByBucket.active,
    });
  }

  const failureItems = [
    ...imageJobItemsByBucket.failure,
    ...videoItemsByBucket.failure,
  ].sort((left, right) => getItemCreatedAt(right) - getItemCreatedAt(left));
  if (failureItems.length > 0) {
    sectionsInput.push({
      id: "failures",
      label: filter === "failures" ? "Failures" : "Needs Attention",
      items: failureItems,
    });
  }

  if (videoItemsByBucket.complete.length > 0) {
    sectionsInput.push({
      id: "completed-videos",
      label: filter === "complete" ? "Completed Videos" : "Videos",
      items: videoItemsByBucket.complete,
    });
  }

  if (savedImageItems.length > 0) {
    sectionsInput.push({
      id: "images",
      label: "Images",
      items: savedImageItems,
    });
  }

  const sections = withDividerFlags(sectionsInput);

  const hasAnyItems =
    savedImages.length > 0 ||
    videoJobs.length > 0 ||
    imageJobs.some((job) => getImageJobBucket(job.status) !== null);

  return {
    hasAnyItems,
    hasVisibleItems: sections.length > 0,
    sections,
    emptyState: sections.length === 0 && hasAnyItems ? getEmptyState(filter) : null,
  };
}
