"use client"

import { RunsTable } from "@/src/components/runs/RunsTable";
import { Button } from "@/src/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RunPageContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get('id');
    const router = useRouter();
    
    if (!id) {
        return (
            <div className="p-8 max-w-none w-full min-h-full">
                <p>Run ID is required</p>
            </div>
        );
    }
    
    return (
        <div className="p-8 max-w-none w-full min-h-full">
            <Button
                variant="ghost"
                onClick={() => router.push('/configs')}
                className="mb-4"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>
            <RunsTable id={id} />
        </div>
    );
}

export default function RunPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RunPageContent />
        </Suspense>
    );
}
