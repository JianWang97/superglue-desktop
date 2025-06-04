'use client'

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Button } from "@/src/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/src/components/ui/accordion";
import { composeUrl } from '@/src/lib/utils';
import { ApiConfig } from '@superglue/client';
import { useConfig } from '@/src/app/config-context';
import { SuperglueClient } from '@superglue/client';
import { Suspense } from "react";

const ApiConfigDetail = ({ id, onClose }: { id?: string; onClose?: () => void }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  id = id ?? searchParams.get('id') ?? '';
  const [config, setConfig] = React.useState<ApiConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const superglueConfig = useConfig();

  React.useEffect(() => {
    if (id) {
      const fetchConfig = async () => {
        try {
          setLoading(true);
          const superglueClient = new SuperglueClient({
            endpoint: superglueConfig.superglueEndpoint,
            apiKey: superglueConfig.superglueApiKey
          })      
          const foundConfig = await superglueClient.getApi(id);
          if (!foundConfig) {
            throw new Error('Configuration not found');
          }
          const transformedConfig = {
            ...foundConfig,
            headers: foundConfig.headers,
            createdAt: foundConfig.createdAt || new Date().toISOString(),
            updatedAt: foundConfig.updatedAt || new Date().toISOString(),
          };
          
          setConfig(transformedConfig as ApiConfig);
        } catch (error) {
          console.error('Error fetching config:', error);
          setError(error instanceof Error ? error.message : 'An error occurred');
        } finally {
          setLoading(false);
        }
      };

      fetchConfig();
    }
  }, [id, superglueConfig]);

  if (!id) {
    return <div>Configuration ID is required</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => router.push('/configs')}>
          Back to Configurations
        </Button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-gray-500 mb-4">Configuration not found</p>
        <Button onClick={() => router.push('/configs')}>
          Back to Configurations
        </Button>
      </div>
    );
  }

  const handleTestInPlayground = () => {
    router.push(`/playground?configId=${id}`);
  };

  const handleViewRuns = () => {
    router.push(`/run?id=${id}`);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.push('/configs');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{config.id}</h1>
          <p className="text-gray-600 mt-1">{config.instruction}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleTestInPlayground}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Test in Playground
          </Button>
          <Button 
            variant="outline"
            onClick={handleViewRuns}
          >
            View Runs
          </Button>
          <Button 
            variant="ghost"
            onClick={handleClose}
          >
            Close
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Basic Information
            </h3>
            <div className="mt-2 space-y-2">
              <div>
                <span className="font-medium">ID:</span> 
                <span className="ml-2 font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                  {config.id}
                </span>
              </div>
              <div>
                <span className="font-medium">Method:</span> 
                <span className="ml-2 font-mono text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {config.method}
                </span>
              </div>              <div>
                <span className="font-medium">URL:</span> 
                <span className="ml-2 break-all">{config.urlHost}{config.urlPath || ''}</span>
              </div>
              <div>
                <span className="font-medium">Created:</span> 
                <span className="ml-2">{new Date(config.createdAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="font-medium">Updated:</span> 
                <span className="ml-2">{new Date(config.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              Configuration Details
            </h3>
            <div className="mt-2">
              <Accordion type="single" collapsible className="w-full">
                {config.headers && Object.keys(config.headers).length > 0 && (
                  <AccordionItem value="headers">
                    <AccordionTrigger>Headers ({Object.keys(config.headers).length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {Object.entries(config.headers).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-mono text-sm text-gray-600">{key}:</span>
                            <span className="font-mono text-sm truncate ml-2">{value}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {config.body && (
                  <AccordionItem value="body">
                    <AccordionTrigger>Request Body</AccordionTrigger>
                    <AccordionContent>
                      <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                        {typeof config.body === 'string' 
                          ? config.body 
                          : JSON.stringify(config.body, null, 2)
                        }
                      </pre>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {config.queryParams && Object.keys(config.queryParams).length > 0 && (
                  <AccordionItem value="query">
                    <AccordionTrigger>Query Parameters ({Object.keys(config.queryParams).length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {Object.entries(config.queryParams).map(([key, value]) => (
                          <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="font-mono text-sm text-gray-600">{key}:</span>
                            <span className="font-mono text-sm truncate ml-2">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Test this API</h3>
            <p className="text-gray-600 text-sm">
              Use the playground to test this API configuration with different inputs.
            </p>
          </div>          <div className="flex gap-2">            <Button 
              onClick={() => window.open(composeUrl(config.urlHost, config.urlPath || ''), '_blank')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open URL
            </Button>
            <Button onClick={handleTestInPlayground}>
              Open in Playground
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

function ConfigPageContent() {
  return <ApiConfigDetail />;
}

export default function ConfigPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfigPageContent />
    </Suspense>
  );
}
