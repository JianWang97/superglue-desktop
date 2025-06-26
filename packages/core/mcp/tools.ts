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
import {
  getSchemaFromData,
  sample,
  applyJsonataWithValidation,
} from "../utils/tools.js";
import { JSON_SCHEMA_TEMPLATES, JsonSchemaTemplateName } from "./schema-templates.js";

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

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
  payload: z
    .string()
    .describe(
      '执行工作流的输入数据，JSON字符串格式，例如：\'{"A":["10","20"]}\''
    ),
  credentials: z.object({}).optional().describe("工作流执行的身份验证凭据"),
  jsonSchemaTemplate: z
    .string()
    .describe(
      `预设JSON Schema模板名称（如：${Object.keys(JSON_SCHEMA_TEMPLATES).join(", ")}等），用于生成符合特定结构的JSONata表达式`
    ),
});

const ValidateJsonataSchema = z.object({
  workflowId: z.string().describe("工作流ID，用于获取对应的数据样本"),
  jsonataExpression: z.string().describe("要验证的JSONata表达式"),
  targetSchema: z
    .object({})
    .optional()
    .describe("可选的目标schema用于验证输出结构"),
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
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [
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
        const {
          workflowId,
          payload: payloadString,
          credentials = {},
          jsonSchemaTemplate,
        } = validatedArgs;

        // 解析 JSON 字符串格式的 payload
        let payload: Record<string, any>;
        try {
          payload = JSON.parse(payloadString);
        } catch (error) {
          throw new Error(
            `无效的 payload JSON 格式: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        } // 1. 获取工作流配置
        const datastore = getDataStore();
        const workflow = await datastore.getWorkflow(workflowId, null);
        if (!workflow) {
          throw new Error(`未找到ID为 '${workflowId}' 的工作流`);
        }
        logMessage("info", `[MCP] 执行工作流以生成最终转换：${workflowId}`, {
          runId: crypto.randomUUID(),
          orgId: "default",
        });

        // 2. 执行工作流以获取示例数据
        const metadata = { orgId: "default", runId: crypto.randomUUID() };
        const executor = new WorkflowExecutor(workflow, metadata);

        const executionResult = await executor.execute(
          payload,
          credentials as Record<string, string>,
          { cacheMode: "DISABLED" as any },
          datastore
        );
        if (!executionResult.success) {
          throw new Error(`工作流执行失败：${executionResult.error}`);
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
        const templateInfo =
          jsonSchemaTemplate &&
          JSON_SCHEMA_TEMPLATES[jsonSchemaTemplate as JsonSchemaTemplateName]
            ? {
                name: jsonSchemaTemplate,
                schema:
                  JSON_SCHEMA_TEMPLATES[
                    jsonSchemaTemplate as JsonSchemaTemplateName
                  ],
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
          `[MCP] 工作流执行成功，为JSONata生成提供数据结构${
            templateInfo ? ` 使用模板：${jsonSchemaTemplate}` : ""
          }`,
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
            description: templateInfo
              ? `根据预设模板 "${templateInfo.name}" 创建JSONata表达式进行最终转换`
              : "使用提供的数据结构创建最终转换的JSONata表达式",
            instructions: [
              "可用数据包括原始payload和所有成功步骤的结果",
              "步骤结果可通过其stepId访问（例如：stepId.fieldName）",
              "原始payload字段在根级别可用",
              templateInfo
                ? `目标结构应符合 "${templateInfo.name}" 模板的要求`
                : "",
              '使用JSONata语法如：{ "result": stepId.data, "summary": payload.info }',
              '对于数组，使用如下表达式：stepId.items[*].{ "name": name, "value": value }',
              '可以组合多个步骤结果：{ "step1Data": step1.result, "step2Data": step2.result }',
              "生成JSONata后，使用validate_jsonata工具对示例数据进行测试",
            ].filter(Boolean),
            examples: templateInfo
              ? [
                  `根据 "${templateInfo.name}" 模板的字段结构生成对应的JSONata表达式`,
                  '示例：{ "patientId": step1.id, "name": step1.patient.name, "age": step1.patient.age }',
                ]
              : [
                  '简单字段映射：{ "name": step1.user.name, "email": step1.user.email }',
                  '数组转换：stepData.results[*].{ "id": id, "status": status }',
                  '条件逻辑：status = "active" ? step1.data : step2.fallback',
                  '聚合操作：{ "total": $sum(stepData.items[*].amount) }',
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
        const { workflowId, jsonataExpression, targetSchema } = validatedArgs; // 从缓存中获取工作流数据样本
        const cachedData = workflowSampleCache.get(workflowId);
        if (!cachedData) {
          throw new Error(
            `未找到工作流 '${workflowId}' 的示例数据。请先运行 generate_final_transform。`
          );
        }
        logMessage("info", `[MCP] 验证工作流的JSONata表达式：${workflowId}`, {
          runId: crypto.randomUUID(),
          orgId: "default",
        });

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
            result: validationResult.success
              ? validationResult.data
              : undefined,
            error: validationResult.error || undefined,
            sampleDataUsed: cachedData.sampleData,
            targetSchema: targetSchema || cachedData.templateInfo?.schema,
            templateUsed: cachedData.templateInfo?.name,
          },
          recommendations: validationResult.success
            ? [
                "JSONata表达式有效并生成预期输出",
                "表达式成功转换了示例数据",
                cachedData.templateInfo
                  ? `输出结构符合 "${cachedData.templateInfo.name}" 模板要求`
                  : "输出结构验证通过",
              ]
            : [
                "JSONata表达式验证失败",
                "请检查表达式语法和字段引用",
                "确保所有引用的字段在工作流数据中存在",
                "验证输出结构是否符合预期schema",
                validationResult.error
                  ? `错误详情：${validationResult.error}`
                  : "",
              ].filter(Boolean),
          generatedAt: new Date().toISOString(),
        };
        logMessage(
          validationResult.success ? "info" : "warn",
          `[MCP] 工作流 ${workflowId} 的JSONata验证${
            validationResult.success ? "通过" : "失败"
          }`,
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

      throw new Error(`未知工具：${name}`);
    } catch (error: any) {
      logMessage("error", `[MCP] 工具执行失败：${error.message}`, {
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
