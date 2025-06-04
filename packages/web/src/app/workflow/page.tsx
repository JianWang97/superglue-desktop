"use client";
import WorkflowPlayground from "@/src/components/workflow/WorkflowPlayground";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function WorkflowPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  if (!id) {
    return <WorkflowPlayground/>;
  }

  return <WorkflowPlayground id={id} />;
}

export default function WorkflowPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <WorkflowPageContent />
    </Suspense>
  );
}
