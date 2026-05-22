"use client";

import dynamic from "next/dynamic";

const ClueReviewContent = dynamic(() => import("./ClueReviewContent"), {
  ssr: false,
});

export default function ClueReviewPage() {
  return <ClueReviewContent />;
}
