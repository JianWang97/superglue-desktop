'use client'

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { ExtractPlayground } from "@/src/components/extract/ExtractPlayground";
import { Suspense } from "react";

function ExtractPlaygroundPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();

  if (!id) {
    return (
      <div className="mx-auto">
        <div className="lg:p-6">
          <p>Extract ID is required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto">
      <div className="lg:p-6">
        <div className="flex justify-between items-center my-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/configs')} 
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="max-w-full lg:-mx-6">
          <ExtractPlayground extractId={id} />
        </div>
      </div>
    </div>
  );
}

export default function ExtractPlaygroundPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExtractPlaygroundPageContent />
    </Suspense>
  );
}
