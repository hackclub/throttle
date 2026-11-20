"use client";

import { useEffect } from "react";
import { claimSubmission } from "@/app/(workspace)/admin/reviews/actions";

/** Claims the submission for this reviewer once the page is open. Renders nothing. */
export function ClaimOnOpen({ submissionId }: { submissionId: string }) {
  useEffect(() => {
    claimSubmission(submissionId).catch(() => {
      // A failed claim only means the queue won't show us as reviewing it.
    });
  }, [submissionId]);
  return null;
}
