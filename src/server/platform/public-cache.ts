import { revalidateTag } from "next/cache";

export const PUBLIC_CONTENT_TAG = "public-exam-content";

export function invalidatePublicContent() {
  revalidateTag(PUBLIC_CONTENT_TAG, { expire: 0 });
}
