"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { useToast } from "../../hooks/use-toast";
import { useConfig } from "@/src/app/config-context";
import { useSearchParams, useRouter } from "next/navigation";
import { HelpTooltip } from "@/src/components/utils/HelpTooltip";
import { ExecutionStep, ApiConfig } from "@superglue/client"; // Added ApiConfig
import { SuperglueClient } from "@superglue/client";
import {
  parseCredentialsHelper,
  removeNullUndefined,
} from "@/src/lib/client-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Badge } from "../ui/badge";
import { Switch } from "../ui/switch";
import { Trash2, Edit, RotateCw, EyeOff, Eye, Play } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

// StepCard component for individual step display and editing
interface StepCardProps {
  step: any;
  index: number;
  isHidden: boolean;
  onUpdate: (step: any) => void;
  onDelete: () => void;
  onToggleHidden: (hidden: boolean) => void;
}

function StepCard({
  step,
  index,
  isHidden,
  onUpdate,
  onDelete,
  onToggleHidden,
}: StepCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const config = useConfig(); // Added to access Superglue client
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]); // Added to store API configs
  const { toast } = useToast(); // Added for showing toasts

  useEffect(() => {
    const fetchApiConfigs = async () => {
      try {
        const superglueClient = new SuperglueClient({
          endpoint: config.superglueEndpoint,
          apiKey: config.superglueApiKey,
        });
        const result = await superglueClient.listApis();
        setApiConfigs(result.items || []);
      } catch (error: any) {
        console.error("Error fetching API configs:", error);
        toast({
          title: "Error fetching API configs",
          description: error.message,
          variant: "destructive",
        });
      }
    };
    fetchApiConfigs();
  }, [config, toast]);
  // Check if the API config exists in the fetched configs
  const isApiConfigLocked =
    step.apiConfig?.id &&
    apiConfigs.some((config) => config.id === step.apiConfig.id);

  const updateField = (path: string, value: any) => {
    const keys = path.split(".");
    const updated = JSON.parse(JSON.stringify(step));
    let current = updated;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
    onUpdate(updated);
  };
  return (
    <Card
      className={`border-l-4 ${
        isHidden ? "border-l-gray-300 bg-gray-50/50" : "border-l-primary/30"
      } shadow-sm ${isHidden ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-mono">
              {index + 1}
            </Badge>
            {step.executionMode === "LOOP" && (
              <Badge variant="secondary" className="text-xs">
                <RotateCw className="w-3 h-3 mr-1" />
                LOOP
              </Badge>
            )}
            {isHidden && (
              <Badge
                variant="secondary"
                className="text-xs bg-gray-200 text-gray-600"
              >
                <EyeOff className="w-3 h-3 mr-1" />
                隐藏
              </Badge>
            )}
            <span className="font-mono text-sm font-medium text-primary">
              {step.id}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">参与执行</Label>
              <Switch
                checked={!isHidden}
                onCheckedChange={(checked) => onToggleHidden(!checked)}
                className="scale-75"
              />
            </div>{" "}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditDialogOpen(true)}
                    className="h-8 w-8 p-0"
                    title="编辑步骤配置"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-md">
                  <div className="space-y-1">
                    <div className="font-mono text-xs font-medium">
                      {step.apiConfig?.method || "GET"}{" "}
                      {step.apiConfig?.urlHost}
                      {step.apiConfig?.urlPath}
                    </div>
                    {step.apiConfig?.instruction && (
                      <div className="text-xs text-muted-foreground italic">
                        "{step.apiConfig.instruction}"
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>{" "}
        </div>
      </CardHeader>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑步骤配置 - {step.id}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium w-16 shrink-0">
                  Step ID
                </Label>
                <Input
                  value={step.id || ""}
                  onChange={(e) => updateField("id", e.target.value)}
                  className="text-xs h-8 flex-1"
                  placeholder="step1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-medium w-20 shrink-0">
                  Execution Mode
                </Label>
                <Select
                  value={step.executionMode || "DIRECT"}
                  onValueChange={(value) => updateField("executionMode", value)}
                >
                  <SelectTrigger className="text-xs h-8 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECT">DIRECT</SelectItem>
                    <SelectItem value="LOOP">LOOP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              className={`space-y-3 p-3 rounded-lg ${
                isApiConfigLocked
                  ? "bg-muted/50 border border-muted"
                  : "bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <Label className="text-sm font-semibold">
                    API Configuration
                  </Label>
                  {isApiConfigLocked && (
                    <Badge variant="secondary" className="text-xs">
                      导入的配置 (ID: {step.apiConfig.id})
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isApiConfigLocked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onUpdate({
                          ...step,
                          apiConfig: {
                            ...step.apiConfig,
                            id: undefined, // Remove the id to allow editing
                          },
                        });
                      }}
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                      title="清除导入的配置，允许手动编辑"
                    >
                      清除导入
                    </Button>
                  )}
                  {!isApiConfigLocked && (
                    <Select
                      onValueChange={(apiId) => {
                        const selectedConfig = apiConfigs.find(
                          (ac) => ac.id === apiId
                        );
                        if (selectedConfig) {
                          onUpdate({
                            ...step,
                            apiConfig: {
                              ...step.apiConfig,
                              id: selectedConfig.id, // Set the id when loading from existing config
                              urlHost: selectedConfig.urlHost,
                              urlPath: selectedConfig.urlPath,
                              method: selectedConfig.method,
                              instruction: selectedConfig.instruction,
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="text-xs h-8 w-[200px]">
                        <SelectValue placeholder="Load from existing API Config" />
                      </SelectTrigger>
                      <SelectContent>
                        {apiConfigs.map((api) => (
                          <SelectItem key={api.id} value={api.id}>
                            {api.id} ({api.method} {api.urlHost}
                            {api.urlPath})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {isApiConfigLocked && (
                <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border-l-2 border-blue-500">
                  此步骤使用了导入的 API
                  配置，字段已被锁定。点击"清除导入"按钮可重新编辑。
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-xs w-12 shrink-0">Method</Label>
                  <Select
                    value={step.apiConfig?.method || "GET"}
                    onValueChange={(value) =>
                      updateField("apiConfig.method", value)
                    }
                    disabled={isApiConfigLocked}
                  >
                    <SelectTrigger className="text-xs h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="text-xs w-8 shrink-0 ml-4">URL</Label>
                  <Input
                    value={step.apiConfig?.urlHost || ""}
                    onChange={(e) =>
                      updateField("apiConfig.urlHost", e.target.value)
                    }
                    className="text-xs h-8 flex-1"
                    placeholder="https://api.example.com"
                    disabled={isApiConfigLocked}
                  />
                  <Input
                    value={step.apiConfig?.urlPath || ""}
                    onChange={(e) =>
                      updateField("apiConfig.urlPath", e.target.value)
                    }
                    className="text-xs h-8 flex-1"
                    placeholder="/endpoint"
                    disabled={isApiConfigLocked}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs w-16 shrink-0">Instruction</Label>
                <Input
                  value={step.apiConfig?.instruction || ""}
                  onChange={(e) =>
                    updateField("apiConfig.instruction", e.target.value)
                  }
                  className="text-xs h-8 flex-1"
                  placeholder="Describe what this API call does"
                  disabled={isApiConfigLocked}
                />
              </div>

              {/* Headers */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Headers</Label>
                <div className="space-y-2">
                  {(step.apiConfig?.headers
                    ? Object.entries(step.apiConfig.headers)
                    : []
                  ).map(([key, value], index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={key}
                        onChange={(e) => {
                          const headers = {
                            ...(step.apiConfig?.headers || {}),
                          };
                          delete headers[key];
                          if (e.target.value) {
                            headers[e.target.value] = value;
                          }
                          updateField("apiConfig.headers", headers);
                        }}
                        className="text-xs h-8 flex-1"
                        placeholder="Header name"
                        disabled={isApiConfigLocked}
                      />
                      <Input
                        value={value as string}
                        onChange={(e) => {
                          const headers = {
                            ...(step.apiConfig?.headers || {}),
                          };
                          headers[key] = e.target.value;
                          updateField("apiConfig.headers", headers);
                        }}
                        className="text-xs h-8 flex-1"
                        placeholder="Header value"
                        disabled={isApiConfigLocked}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const headers = {
                            ...(step.apiConfig?.headers || {}),
                          };
                          delete headers[key];
                          updateField("apiConfig.headers", headers);
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={isApiConfigLocked}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const headers = { ...(step.apiConfig?.headers || {}) };
                      headers[""] = "";
                      updateField("apiConfig.headers", headers);
                    }}
                    className="h-8 text-xs"
                    disabled={isApiConfigLocked}
                  >
                    Add Header
                  </Button>
                </div>
              </div>

              {/* Request Body */}
              {(step.apiConfig?.method === "POST" ||
                step.apiConfig?.method === "PUT" ||
                step.apiConfig?.method === "PATCH") && (
                <div className="space-y-1">
                  <Label className="text-xs">Request Body</Label>
                  <Textarea
                    value={step.apiConfig?.body || ""}
                    onChange={(e) =>
                      updateField("apiConfig.body", e.target.value)
                    }
                    className="font-mono text-xs h-16 resize-none"
                    placeholder='{"key": "value", "param": "{variable}"}'
                    disabled={isApiConfigLocked}
                  />
                </div>
              )}
            </div>

            {step.executionMode === "LOOP" && (
              <div className="space-y-2 p-3 bg-muted border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-amber-600" />
                  <Label className="text-sm font-semibold text-amber-800">
                    Loop Configuration
                  </Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20 shrink-0">
                      Loop Selector
                    </Label>
                    <Input
                      value={step.loopSelector || ""}
                      onChange={(e) =>
                        updateField("loopSelector", e.target.value)
                      }
                      className="text-xs h-8 flex-1"
                      placeholder="e.g., getAllBreeds"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs w-20 shrink-0">
                      Max Iterations
                    </Label>
                    <Input
                      type="number"
                      value={step.loopMaxIters || ""}
                      onChange={(e) =>
                        updateField(
                          "loopMaxIters",
                          parseInt(e.target.value) || undefined
                        )
                      }
                      className="text-xs h-8 flex-1"
                      placeholder="∞"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 p-3 bg-muted border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <Label className="text-sm font-semibold text-green-800">
                  Data Transformation
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Input Mapping (JSONata)</Label>
                  <Textarea
                    value={step.inputMapping || "$"}
                    onChange={(e) =>
                      updateField("inputMapping", e.target.value)
                    }
                    className="font-mono text-xs h-16 resize-none"
                    placeholder="$"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Response Mapping (JSONata)</Label>
                  <Textarea
                    value={step.responseMapping || "$"}
                    onChange={(e) =>
                      updateField("responseMapping", e.target.value)
                    }
                    className="font-mono text-xs h-16 resize-none"
                    placeholder="$"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={() => setIsEditDialogOpen(false)}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function WorkflowPlayground({ id }: { id?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const config = useConfig();
  const [workflowId, setWorkflowId] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [finalTransform, setFinalTransform] = useState(`{
  "result": $
}`);
  const [credentials, setCredentials] = useState("");
  const [payload, setPayload] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [activeResultTab, setActiveResultTab] = useState("finalData");
  const [hiddenSteps, setHiddenSteps] = useState<Set<number>>(new Set());

  const updateWorkflowId = (id: string) => {
    const sanitizedId = id
      .replace(/ /g, "-") // Replace spaces with hyphens
      .replace(/[^a-zA-Z0-9-]/g, ""); // Remove special characters
    setWorkflowId(sanitizedId);
  };

  const loadWorkflow = async (idToLoad: string) => {
    try {
      if (!idToLoad) return;

      setLoading(true);
      setResult(null);
      const superglueClient = new SuperglueClient({
        endpoint: config.superglueEndpoint,
        apiKey: config.superglueApiKey,
      });
      const workflow = await superglueClient.getWorkflow(idToLoad);
      if (!workflow) {
        updateWorkflowId("");
        setStepsText("");
        setFinalTransform("");
        setHiddenSteps(new Set()); // 重置隐藏状态
        throw new Error(`Workflow with ID "${idToLoad}" not found.`);
      }
      // Recursively remove null/undefined values from the entire workflow object
      const cleanedWorkflow = removeNullUndefined(workflow);

      // Extract potentially cleaned steps and finalTransform
      const cleanedSteps = cleanedWorkflow.steps || []; // Default to empty array if steps were removed
      const cleanedFinalTransform =
        cleanedWorkflow.finalTransform || `{\n  "result": $\n}`; // Default transform      updateWorkflowId(cleanedWorkflow.id || ''); // Use cleaned ID, default to empty string
      setStepsText(JSON.stringify(cleanedSteps, null, 2));
      setFinalTransform(cleanedFinalTransform);
      setHiddenSteps(new Set()); // 重置隐藏状态
      updateWorkflowId(cleanedWorkflow.id || ""); // Use cleaned ID, default to empty string
      toast({
        title: "Workflow loaded",
        description: `Loaded "${cleanedWorkflow.id}" successfully`,
      });
    } catch (error: any) {
      console.error("Error loading workflow:", error);
      toast({
        title: "Error loading workflow",
        description: error.message,
        variant: "destructive",
      });
      updateWorkflowId("");
      setStepsText("");
      setFinalTransform("");
      setHiddenSteps(new Set()); // 重置隐藏状态
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadWorkflow(id);
    }
  }, [id]);

  const fillDogExample = () => {
    updateWorkflowId("Dog Breed Workflow");
    setStepsText(
      JSON.stringify(
        [
          {
            id: "getAllBreeds",
            apiConfig: {
              urlPath: "/breeds/list/all",
              instruction: "Get all dog breeds",
              urlHost: "https://dog.ceo/api",
              method: "GET",
            },
            executionMode: "DIRECT",
            inputMapping: "$",
            responseMapping: "$keys($.message)",
          },
          {
            id: "getBreedImage",
            apiConfig: {
              urlPath: "/breed/{value}/images/random",
              instruction: "Get a random image for a specific dog breed",
              urlHost: "https://dog.ceo/api",
              method: "GET",
            },
            executionMode: "LOOP",
            loopSelector: "getAllBreeds",
            loopMaxIters: 5,
            inputMapping: "$",
            responseMapping: "$",
          },
        ],
        null,
        2
      )
    );
    setFinalTransform(`$.getBreedImage.(
  {"breed": loopValue, "image": message}
)`);
    setHiddenSteps(new Set()); // 重置隐藏状态

    toast({
      title: "Example loaded",
      description: "Dog breed example has been loaded",
    });
  };

  const saveWorkflow = async () => {
    try {
      if (!workflowId.trim()) {
        updateWorkflowId(`wf-${Date.now()}`);
      }

      setSaving(true);

      const input = {
        id: workflowId,
        steps: JSON.parse(stepsText).map((step: ExecutionStep) => ({
          ...step,
          apiConfig: {
            id: step.apiConfig.id || step.id,
            ...step.apiConfig,
            pagination: step.apiConfig.pagination || null,
          },
        })),
        finalTransform,
      };

      const superglueClient = new SuperglueClient({
        endpoint: config.superglueEndpoint,
        apiKey: config.superglueApiKey,
      });
      const savedWorkflow = await superglueClient.upsertWorkflow(
        workflowId,
        input
      );

      if (!savedWorkflow) {
        throw new Error("Failed to save workflow");
      }
      updateWorkflowId(savedWorkflow.id);

      toast({
        title: "Workflow saved",
        description: `"${savedWorkflow.id}" saved successfully`,
      });      router.push(`/workflow?id=${savedWorkflow.id}`);
    } catch (error) {
      console.error("Error saving workflow:", error);
      toast({
        title: "Error saving workflow",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const executeWorkflow = async () => {
    try {
      setLoading(true);
      const allSteps = JSON.parse(stepsText);
      // 过滤掉隐藏的步骤
      const activeSteps = allSteps.filter(
        (_: any, index: number) => !hiddenSteps.has(index)
      );

      if (activeSteps.length === 0) {
        toast({
          title: "无法执行工作流",
          description: "没有激活的步骤可以执行，请确保至少有一个步骤是显示状态",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!workflowId) {
        updateWorkflowId(`wf-${Date.now()}`);
      }
      const workflowInput = {
        id: workflowId,
        steps: activeSteps.map((step: ExecutionStep) => ({
          ...step,
          apiConfig: {
            id: step.apiConfig.id || step.id,
            ...step.apiConfig,
          },
        })),
        finalTransform,
      };
      const parsedCredentials = parseCredentialsHelper(credentials);
      const parsedPayload = JSON.parse(payload || "{}");
      const superglueClient = new SuperglueClient({
        endpoint: config.superglueEndpoint,
        apiKey: config.superglueApiKey,
      });
      const workflowResult = await superglueClient.executeWorkflow({
        workflow: workflowInput,
        credentials: parsedCredentials,
        payload: parsedPayload,
      });
      if (!workflowResult.success) {
        throw new Error(workflowResult.error);
      }
      setResult(workflowResult);
      setLoading(false);
    } catch (error) {
      console.error("Error executing workflow:", error);
      toast({
        title: "Error executing workflow",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-none w-full">
      <h1 className="text-2xl font-bold mb-3 flex-shrink-0">Workflows</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Workflow Configuration */}
        <Card className="flex flex-col">
          <CardContent className="p-4 overflow-auto flex-grow">
            {/* Workflow name and example/load buttons */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="workflowId">Workflow ID</Label>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="workflowId"
                  value={workflowId}
                  onChange={(e) => updateWorkflowId(e.target.value)}
                  placeholder="Enter workflow ID to load or save"
                  className="flex-grow"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadWorkflow(workflowId)}
                  disabled={loading || saving || !workflowId}
                  className="flex-shrink-0"
                >
                  {loading && !saving ? "Loading..." : "Load"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fillDogExample}
                  disabled={loading || saving}
                  className="flex-shrink-0"
                >
                  Example
                </Button>
              </div>
            </div>
            {/* Add Credentials Input */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="credentials">Credentials (Optional)</Label>
                <HelpTooltip text="Enter API keys/tokens needed for steps in this workflow. Can be a single string or a JSON object for multiple keys." />
              </div>
              <Input
                id="credentials"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder="Enter API key, token, or JSON object"
              />
            </div>
            {/* Add Payload Input */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <Label htmlFor="payload">Payload (Optional)</Label>
                <HelpTooltip text="Enter JSON payload to be used as input data for the workflow" />
              </div>
              <Input
                id="payload"
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                placeholder="Enter JSON payload"
                className="font-mono text-xs"
              />
            </div>{" "}
            {/* Steps and Final Transform */}
            <div className="space-y-3 flex flex-col flex-grow">
              <div className="flex-1 flex flex-col min-h-0 max-h-[500px]">
                {" "}
                <div className="flex items-center justify-between mb-2">
                  {" "}
                  <Label className="block">
                    Workflow Steps (
                    {(() => {
                      try {
                        const allSteps = JSON.parse(stepsText || "[]");
                        const activeSteps = allSteps.filter(
                          (_: any, index: number) => !hiddenSteps.has(index)
                        );
                        return `${activeSteps.length}/${allSteps.length} 激活`;
                      } catch {
                        return "0/0 激活";
                      }
                    })()}
                    )
                  </Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const modal = document.createElement("div");
                        modal.className =
                          "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
                        modal.innerHTML = `
                          <div class="bg-muted  rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
                            <div class="flex justify-between items-center mb-4">
                              <h3 class="text-lg font-semibold">Steps JSON</h3>
                              <button class="text-gray-500 hover:text-gray-700" onclick="this.closest('.fixed').remove()">✕</button>
                            </div>
                            <pre class="bg-muted p-4 rounded text-sm overflow-auto font-mono">${JSON.stringify(
                              JSON.parse(stepsText || "[]"),
                              null,
                              2
                            )}</pre>
                          </div>
                        `;
                        document.body.appendChild(modal);
                      }}
                    >
                      View JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        try {
                          const steps = JSON.parse(stepsText || "[]");
                          const newStep = {
                            id: `step${steps.length + 1}`,
                            apiConfig: {
                              urlPath: "",
                              instruction: "",
                              urlHost: "",
                              method: "GET",
                            },
                            executionMode: "DIRECT",
                            inputMapping: "$",
                            responseMapping: "$",
                          };
                          setStepsText(
                            JSON.stringify([...steps, newStep], null, 2)
                          );
                          // 新步骤默认不隐藏，不需要更新隐藏状态
                        } catch {
                          setStepsText(
                            JSON.stringify(
                              [
                                {
                                  id: "step1",
                                  apiConfig: {
                                    urlPath: "",
                                    instruction: "",
                                    urlHost: "",
                                    method: "GET",
                                  },
                                  executionMode: "DIRECT",
                                  inputMapping: "$",
                                  responseMapping: "$",
                                },
                              ],
                              null,
                              2
                            )
                          );
                          setHiddenSteps(new Set()); // 重置隐藏状态
                        }
                      }}
                    >
                      Add Step
                    </Button>
                  </div>{" "}
                </div>
                <div
                  className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-1 max-h-60"
                >
                  {(() => {
                    try {
                      const steps = JSON.parse(stepsText || "[]");
                      if (steps.length === 0) {
                        return (
                          <div className="text-center py-8 text-muted-foreground">
                            <p>No steps defined yet.</p>
                            <p className="text-sm">
                              Click "Add Step" to get started.
                            </p>
                          </div>
                        );
                      }
                      return steps.map((step: any, index: number) => (
                        <StepCard
                          key={index}
                          step={step}
                          index={index}
                          isHidden={hiddenSteps.has(index)}
                          onUpdate={(updatedStep) => {
                            const updatedSteps = [...steps];
                            updatedSteps[index] = updatedStep;
                            setStepsText(JSON.stringify(updatedSteps, null, 2));
                          }}
                          onDelete={() => {
                            const updatedSteps = steps.filter(
                              (_: any, i: number) => i !== index
                            );
                            setStepsText(JSON.stringify(updatedSteps, null, 2));
                            // 更新隐藏步骤的索引
                            const newHiddenSteps = new Set<number>();
                            hiddenSteps.forEach((hiddenIndex) => {
                              if (hiddenIndex < index) {
                                newHiddenSteps.add(hiddenIndex);
                              } else if (hiddenIndex > index) {
                                newHiddenSteps.add(hiddenIndex - 1);
                              }
                            });
                            setHiddenSteps(newHiddenSteps);
                          }}
                          onToggleHidden={(hidden) => {
                            const newHiddenSteps = new Set(hiddenSteps);
                            if (hidden) {
                              newHiddenSteps.add(index);
                            } else {
                              newHiddenSteps.delete(index);
                            }
                            setHiddenSteps(newHiddenSteps);
                          }}
                        />
                      ));
                    } catch {
                      return (
                        <div className="p-4 border border-destructive rounded-md">
                          <p className="text-destructive text-sm">
                            Invalid JSON format in steps
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setStepsText("[]");
                              setHiddenSteps(new Set()); // 重置隐藏状态
                            }}
                          >
                            Reset Steps
                          </Button>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <Label htmlFor="finalTransform" className="mb-1 block">
                  Final Transformation (JSONata)
                </Label>
                <Textarea
                  id="finalTransform"
                  value={finalTransform}
                  onChange={(e) => setFinalTransform(e.target.value)}
                  placeholder="Enter final transform expression"
                  className="font-mono resize-none flex-1 min-h-[180px] overflow-auto w-full text-xs"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2 p-3 flex-shrink-0 border-t">
            <Button
              variant="outline"
              onClick={saveWorkflow}
              disabled={saving || loading}
              className="w-full"
            >
              {saving ? "Saving..." : "Save Workflow"}
            </Button>
            <Button
              onClick={executeWorkflow}
              disabled={loading || saving}
              className="w-full"
            >
              {loading ? "Running..." : "Run Workflow"}
            </Button>
          </CardFooter>
        </Card>

        {/* Right Column - Results */}
        <Card className="flex flex-col">
          <CardHeader className="py-3 px-4 flex-shrink-0">
            <CardTitle>Results</CardTitle>
          </CardHeader>

          <CardContent className="p-0 flex-grow flex flex-col overflow-hidden">
            {result ? (
              <>
                {/* Status Bar */}
                <div className="p-3 bg-muted border-b flex-shrink-0">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center">
                      <span className="font-semibold mr-2">Status:</span>
                      <span
                        className={
                          result.success ? "text-green-600" : "text-red-600"
                        }
                      >
                        {result.success ? "Success" : "Failed"}
                      </span>
                    </div>

                    <div className="flex items-center">
                      <span className="font-semibold mr-2">Time:</span>
                      <span className="text-sm">
                        Started: {new Date(result.startedAt).toLocaleString()}
                        {result.completedAt &&
                          ` • Duration: ${(
                            (new Date(result.completedAt).getTime() -
                              new Date(result.startedAt).getTime()) /
                            1000
                          ).toFixed(2)}s`}
                      </span>
                    </div>

                    {result.error && (
                      <div className="text-red-600">
                        <span className="font-semibold mr-2">Error:</span>
                        <span>{result.error}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Tab Implementation */}
                <div className="flex-grow flex flex-col overflow-hidden">
                  <div className="flex border-b px-4 pt-2 pb-0 bg-background flex-shrink-0">
                    <button
                      type="button"
                      className={`px-4 py-2 mr-2 ${
                        activeResultTab === "finalData"
                          ? "border-b-2 border-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => setActiveResultTab("finalData")}
                    >
                      Final Data
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 ${
                        activeResultTab === "stepResults"
                          ? "border-b-2 border-primary font-medium"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => setActiveResultTab("stepResults")}
                    >
                      Step Results
                    </button>
                  </div>

                  <div className="flex-grow overflow-auto relative">
                    <div
                      className={`absolute inset-0 overflow-auto transition-opacity duration-200 ${
                        activeResultTab === "finalData"
                          ? "opacity-100 z-10"
                          : "opacity-0 z-0"
                      }`}
                    >
                      <pre className="bg-muted/50 p-4 font-mono text-xs min-h-full">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>

                    <div
                      className={`absolute inset-0 overflow-auto transition-opacity duration-200 ${
                        activeResultTab === "stepResults"
                          ? "opacity-100 z-10"
                          : "opacity-0 z-0"
                      }`}
                    >
                      <pre className="bg-muted/50 p-4 font-mono text-xs min-h-full">
                        {JSON.stringify(result.stepResults, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-gray-500 italic">
                  No results yet. Execute a workflow to see results here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
