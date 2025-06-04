"use client"

import React from 'react';
import { Button } from "@/src/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/src/components/ui/dialog";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Label } from "@/src/components/ui/label";
import { Input } from "@/src/components/ui/input";
import { useToast } from '@/src/hooks/use-toast';
import { useConfig } from '@/src/app/config-context';
import { SuperglueClient, Workflow } from '@superglue/client';
import { Upload, Download } from "lucide-react";

interface WorkflowImportExportProps {
  workflows: Workflow[];
  onImportComplete?: () => void;
  onExportComplete?: () => void;
}

export const WorkflowImportExport: React.FC<WorkflowImportExportProps> = ({
  workflows,
  onImportComplete,
  onExportComplete
}) => {
  const { toast } = useToast();
  const config = useConfig();
  
  // Import/Export states
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [selectedWorkflows, setSelectedWorkflows] = React.useState<Set<string>>(new Set());
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleImportWorkflows = async () => {
    if (!importFile) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        try {
          const json = JSON.parse(text);
          // Assuming the JSON is an array of workflow objects
          const workflowsToImport = Array.isArray(json) ? json : [json];

          const superglueClient = new SuperglueClient({
            endpoint: config.superglueEndpoint,
            apiKey: config.superglueApiKey
          });

          // Import each workflow
          for (const workflow of workflowsToImport) {
            await superglueClient.upsertWorkflow(workflow.id, workflow);
          }

          toast({
            title: 'Success',
            description: `Successfully imported ${workflowsToImport.length} workflow(s).`,
          });

          setShowImportDialog(false);
          setImportFile(null);
          onImportComplete?.();
        } catch (error) {
          console.error('Error importing workflows:', error);
          toast({
            title: 'Error',
            description: 'Failed to import workflows. Please check the file format.',
            variant: 'destructive',
          });
        } finally {
          setIsImporting(false);
        }
      }
    };

    reader.readAsText(importFile);
  };

  const handleExportWorkflows = async () => {
    setIsExporting(true);
    try {
      // Export selected workflows or all if none selected
      const workflowsToExport = selectedWorkflows.size > 0
        ? workflows.filter(workflow => selectedWorkflows.has(workflow.id))
        : workflows;

      if (workflowsToExport.length === 0) {
        toast({
          title: 'Warning',
          description: 'No workflows to export.',
          variant: 'destructive',
        });
        return;
      }

      // Convert to JSON
      const json = JSON.stringify(workflowsToExport, null, 2);

      // Create a blob and download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workflows_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: `Successfully exported ${workflowsToExport.length} workflow(s).`,
      });

      setShowExportDialog(false);
      setSelectedWorkflows(new Set());
      onExportComplete?.();
    } catch (error) {
      console.error('Error exporting workflows:', error);
      toast({
        title: 'Error',
        description: 'Failed to export workflows.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedWorkflows(new Set(workflows.map(w => w.id)));
    } else {
      setSelectedWorkflows(new Set());
    }
  };

  const handleSelectWorkflow = (workflowId: string, checked: boolean) => {
    const newSelected = new Set(selectedWorkflows);
    if (checked) {
      newSelected.add(workflowId);
    } else {
      newSelected.delete(workflowId);
    }
    setSelectedWorkflows(newSelected);
  };

  return (
    <>
      {/* Import/Export Buttons */}
      <Button
        variant="outline"
        onClick={() => setShowImportDialog(true)}
      >
        <Upload className="mr-2 h-4 w-4" />
        Import Workflows
      </Button>
      <Button
        variant="outline"
        onClick={() => setShowExportDialog(true)}
      >
        <Download className="mr-2 h-4 w-4" />
        Export Workflows
      </Button>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Import Workflows</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="import-file" className="block text-sm font-medium mb-2">
                选择JSON文件
              </Label>
              <Input
                id="import-file"
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                disabled={isImporting}
              />
              <p className="text-sm text-muted-foreground mt-2">
                支持单个workflow或workflow数组的JSON格式
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false);
                setImportFile(null);
              }}
              disabled={isImporting}
            >
              取消
            </Button>
            <Button
              onClick={handleImportWorkflows}
              disabled={isImporting || !importFile}
            >
              {isImporting ? "导入中..." : "导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Workflows</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label className="block text-sm font-medium mb-2">
                选择要导出的Workflows
              </Label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                {workflows.length > 0 ? (
                  <>
                    {/* Select All option */}
                    <div className="flex items-center space-x-2 pb-2 border-b">
                      <Checkbox
                        id="select-all-workflows"
                        checked={selectedWorkflows.size === workflows.length && workflows.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                      <Label htmlFor="select-all-workflows" className="font-medium">
                        全选 ({workflows.length} 个workflows)
                      </Label>
                    </div>
                    
                    {/* Individual workflows */}
                    {workflows.map(workflow => (
                      <div key={workflow.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`export-workflow-${workflow.id}`}
                          checked={selectedWorkflows.has(workflow.id)}
                          onCheckedChange={(checked) => handleSelectWorkflow(workflow.id, !!checked)}
                        />
                        <Label htmlFor={`export-workflow-${workflow.id}`} className="flex-1">
                          <div className="truncate">
                            <span className="font-medium">{workflow.id}</span>
                            {workflow.steps && workflow.steps.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {workflow.steps.length} 步骤
                              </div>
                            )}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    没有可用的workflows
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {selectedWorkflows.size === 0 ? '未选择时将导出所有workflows' : `已选择 ${selectedWorkflows.size} 个workflows`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExportDialog(false);
                setSelectedWorkflows(new Set());
              }}
              disabled={isExporting}
            >
              取消
            </Button>
            <Button
              onClick={handleExportWorkflows}
              disabled={isExporting || workflows.length === 0}
            >
              {isExporting ? "导出中..." : "导出"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkflowImportExport;
