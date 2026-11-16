"use client";

import { useEffect } from "react";
import { recordTopicVisit } from "@/server/actions/platform";

/**
 * Records the visit after the reader is on the page. It deliberately does not
 * render anything and ignores failures: analytics should never block reading.
 */
export function TopicVisitTracker({ topicId }: { topicId: string }) {
  useEffect(() => {
    void recordTopicVisit(topicId).catch(() => undefined);
  }, [topicId]);
  return null;
}
