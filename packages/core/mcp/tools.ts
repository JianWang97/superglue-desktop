// MCP Server for Superglue - Generate Final Transformation
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import crypto from "node:crypto";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createDataStore } from "../datastore/datastore.js";
import { logMessage } from "../utils/logs.js";
import { WorkflowExecutor } from "../workflow/workflow-executor.js";
import { getSchemaFromData, sample, applyJsonataWithValidation } from "../utils/tools.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// 预设的 JSON Schema 模板
const JSON_SCHEMA_TEMPLATES = {
  "患者信息": {
    type: "object",
    properties: {
      patientName: { type: "string", description: "患者姓名" },
      sex: { type: "string", description: "性别" },
      telephoneNumber: { type: "string", description: "联系电话" },
      liveAddress:{ type: "string", description: "居住地址" },
      registeredAddress: { type: "string", description: "户籍地址" },
      identityNumber: { type: "string", description: "证件号码" },
      medicalTreatmentNumber: { type: "string", description: "病历号" },
      hisPatientId: { type: "string", description: "HIS患者ID" },
    },
    required: ["patientName", "hisPatientId"],
  }
} as const;

type JsonSchemaTemplateName = keyof typeof JSON_SCHEMA_TEMPLATES;

// 延迟初始化数据存储实例
let datastore: ReturnType<typeof createDataStore> | null = null;

// 内存缓存存储工作流数据样本（用于JSONata验证）
const workflowSampleCache = new Map<string, any>();

function getDataStore() {
  if (!datastore) {
    datastore = createDataStore({ type: process.env.DATASTORE_TYPE as any });
  }
  return datastore;
}

const GenerateFinalTransformSchema = z.object({
  workflowId: z.string().describe("要生成最终转换的工作流ID"),
  payload: z.object({}).optional().describe("执行工作流的输入数据"),
  credentials: z.object({}).optional().describe("工作流执行的身份验证凭据"),
  jsonSchemaTemplate: z.string().optional().describe("预设JSON Schema模板名称（如：患者信息、订单数据、用户档案等），用于生成符合特定结构的JSONata表达式"),
});

const ValidateJsonataSchema = z.object({
  workflowId: z.string().describe("工作流ID，用于获取对应的数据样本"),
  jsonataExpression: z.string().describe("要验证的JSONata表达式"),
  targetSchema: z.object({}).optional().describe("可选的目标schema用于验证输出结构"),
});

// 工具名称枚举
enum ToolName {
  GENERATE_FINAL_TRANSFORM = "generate_final_transform",
  VALIDATE_JSONATA = "validate_jsonata",
}

export function createMcpServerInstance() {
  const server = new Server(
    {
      name: "superglue-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  setupServerHandlers(server);

  return { server, cleanup: () => {} };
}

export function createSimpleServer() {
  return createMcpServerInstance();
}

// 设置服务器处理器的函数
function setupServerHandlers(server: Server) {
  // 注册工具列表处理器
  server.setRequestHandler(ListToolsRequestSchema, async () => {    const tools: Tool[] = [
      {
        name: ToolName.GENERATE_FINAL_TRANSFORM,
        description:
          "此工具执行工作流并提供数据结构信息，您可以使用这些信息创建JSONata表达式。",
        inputSchema: zodToJsonSchema(GenerateFinalTransformSchema) as ToolInput,
      },
      {
        name: ToolName.VALIDATE_JSONATA,
        description:
          "验证JSONata表达式是否能正确处理工作流生成的数据样本。使用此工具测试LLM生成的JSONata表达式。",
        inputSchema: zodToJsonSchema(ValidateJsonataSchema) as ToolInput,
      },
    ];

    return { tools };
  });
  
  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === ToolName.GENERATE_FINAL_TRANSFORM) {
        const validatedArgs = GenerateFinalTransformSchema.parse(args);
        const { workflowId, payload = {}, credentials = {}, jsonSchemaTemplate } = validatedArgs;// 1. 获取工作流配置
        const datastore = getDataStore();
        const workflow = await datastore.getWorkflow(workflowId, null);
        if (!workflow) {
          throw new Error(`Workflow with ID '${workflowId}' not found`);
        }

        logMessage(
          "info",
          `Executing workflow for Final Transformation generation: ${workflowId}`,
          {
            runId: crypto.randomUUID(),
            orgId: "default",
          }
        );

        // 2. 执行工作流以获取示例数据
        const metadata = { orgId: "default", runId: crypto.randomUUID() };
        const executor = new WorkflowExecutor(workflow, metadata);

        const executionResult = await executor.execute(
          payload,
          credentials as Record<string, string>,
          { cacheMode: "DISABLED" as any },
          datastore,
        );

        if (!executionResult.success) {
          throw new Error(
            `Workflow execution failed: ${executionResult.error}`
          );
        }

        // 3. 准备步骤结果数据
        const stepData = executionResult.stepResults.reduce(
          (acc, stepResult) => {
            if (stepResult.success && stepResult.transformedData) {
              acc[stepResult.stepId] = stepResult.transformedData;
            }
            return acc;
          },
          {} as Record<string, unknown>
        );

        // 添加原始 payload 数据
        const combinedData = {
          ...payload,
          ...stepData,
        };
        // 4. 生成数据结构信息供 LLM 使用
        const dataStructure = getSchemaFromData(combinedData);
        const sampleData = sample(combinedData, 2);

        // 5. 获取预设模板信息（如果指定了）
        const templateInfo = jsonSchemaTemplate && JSON_SCHEMA_TEMPLATES[jsonSchemaTemplate as JsonSchemaTemplateName] 
          ? {
              name: jsonSchemaTemplate,
              schema: JSON_SCHEMA_TEMPLATES[jsonSchemaTemplate as JsonSchemaTemplateName],
              description: `预设模板: ${jsonSchemaTemplate}`,
            }
          : null;
        // 6. 将数据样本存储到缓存以供验证使用
        const storedSampleData = {
          dataStructure,
          sampleData,
          templateInfo,
          workflowId,
          executionTime: new Date().toISOString(),
        };
        
        // 存储到内存缓存中
        workflowSampleCache.set(workflowId, storedSampleData);

        logMessage(
          "info",
          `Workflow executed successfully, providing data structure for JSONata generation${templateInfo ? ` with template: ${jsonSchemaTemplate}` : ''}`,
          {
            runId: metadata.runId,
            orgId: metadata.orgId,
          }
        );

        // 7. 返回结果，包含详细的数据结构信息和指导
        const result = {
          success: true,
          workflowId,
          executionSummary: {
            totalSteps: executionResult.stepResults.length,
            successfulSteps: executionResult.stepResults.filter(
              (s) => s.success
            ).length,
            stepResults: executionResult.stepResults.map((step) => ({
              stepId: step.stepId,
              success: step.success,
              hasData: !!step.transformedData,
              dataType: step.transformedData
                ? typeof step.transformedData
                : null,
            })),
          },
          dataStructure: {
            schema: dataStructure,
            sampleData: sampleData,
            availableFields: Object.keys(combinedData),
            stepDataFields: Object.keys(stepData),
          },
          templateInfo,
          jsonataGuide: {
            description:
              templateInfo 
                ? `根据预设模板 "${templateInfo.name}" 创建JSONata表达式进行最终转换`
                : "Use the provided data structure to create a JSONata expression for Final Transformation",
            instructions: [
              "The available data includes original payload and all successful step results",
              "Step results are available by their stepId (e.g., stepId.fieldName)",
              "Original payload fields are available at root level",
              templateInfo 
                ? `目标结构应符合 "${templateInfo.name}" 模板的要求`
                : '',
              'Use JSONata syntax like: { "result": stepId.data, "summary": payload.info }',
              'For arrays, use expressions like: stepId.items[*].{ "name": name, "value": value }',
              'You can combine multiple step results: { "step1Data": step1.result, "step2Data": step2.result }',
              'After generating JSONata, use the validate_jsonata tool to test it against the sample data',
            ].filter(Boolean),
            examples: templateInfo 
              ? [
                  `根据 "${templateInfo.name}" 模板的字段结构生成对应的JSONata表达式`,
                  'Example: { "patientId": step1.id, "name": step1.patient.name, "age": step1.patient.age }',
                ]
              : [
                  'Simple field mapping: { "name": step1.user.name, "email": step1.user.email }',
                  'Array transformation: stepData.results[*].{ "id": id, "status": status }',
                  'Conditional logic: status = "active" ? step1.data : step2.fallback',
                  'Aggregation: { "total": $sum(stepData.items[*].amount) }',
                ],
          },
          generatedAt: new Date().toISOString(),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
      if (name === ToolName.VALIDATE_JSONATA) {
        const validatedArgs = ValidateJsonataSchema.parse(args);
        const { workflowId, jsonataExpression, targetSchema } = validatedArgs;

        // 从缓存中获取工作流数据样本
        const cachedData = workflowSampleCache.get(workflowId);
        if (!cachedData) {
          throw new Error(`No sample data found for workflow '${workflowId}'. Please run generate_final_transform first.`);
        }

        logMessage(
          "info",
          `Validating JSONata expression for workflow: ${workflowId}`,
          {
            runId: crypto.randomUUID(),
            orgId: "default",
          }
        );

        // 使用缓存的样本数据验证 JSONata 表达式
        const validationResult = await applyJsonataWithValidation(
          cachedData.sampleData,
          jsonataExpression,
          targetSchema || cachedData.templateInfo?.schema
        );

        const result = {
          success: validationResult.success,
          workflowId,
          jsonataExpression,
          validation: {
            isValid: validationResult.success,
            result: validationResult.success ? validationResult.data : undefined,
            error: validationResult.error || undefined,
            sampleDataUsed: cachedData.sampleData,
            targetSchema: targetSchema || cachedData.templateInfo?.schema,
            templateUsed: cachedData.templateInfo?.name,
          },
          recommendations: validationResult.success 
            ? [
                "JSONata expression is valid and produces the expected output",
                "The expression successfully transforms the sample data",
                cachedData.templateInfo 
                  ? `Output structure matches the "${cachedData.templateInfo.name}" template requirements`
                  : "Output structure validation passed",
              ]
            : [
                "JSONata expression validation failed",
                "Please check the expression syntax and field references",
                "Ensure all referenced fields exist in the workflow data",
                "Verify the output structure matches the expected schema",
                validationResult.error ? `Error details: ${validationResult.error}` : "",
              ].filter(Boolean),
          generatedAt: new Date().toISOString(),
        };

        logMessage(
          validationResult.success ? "info" : "warn",
          `JSONata validation ${validationResult.success ? 'passed' : 'failed'} for workflow: ${workflowId}`,
          {
            runId: crypto.randomUUID(),
            orgId: "default",
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
      logMessage("error", `MCP tool execution failed: ${error.message}`, {
        runId: crypto.randomUUID(),
        orgId: "default",
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  });
}

// 创建默认的 MCP 服务器实例
export const server = createMcpServerInstance();
