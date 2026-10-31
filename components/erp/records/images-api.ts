import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  parseImage,
  type ImageRecord,
  type RecordId,
} from "@/components/erp/records/records-api";

export type ImageInput = {
  url: string;
  pathname?: string | null;
  reference: string;
  thumbnail: string;
};

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchImage(id: string) {
  const payload = await apiFetch<unknown>(
    `/images/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const image = parseImage(payload);
  if (!image) throw new ApiError(500, null);
  return image;
}

export async function createImage(input: ImageInput) {
  const payload = await apiFetch<unknown>("/images", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const image = parseImage(payload);
  if (!image) throw new ApiError(500, null);
  return image;
}

export async function updateImage(id: RecordId, input: ImageInput) {
  const payload = await apiFetch<unknown>(
    `/images/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const image = parseImage(payload);
  if (!image) throw new ApiError(500, null);
  return image;
}

export function deleteImage(id: RecordId) {
  return apiFetch<void>(`/images/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export type { ImageRecord };
