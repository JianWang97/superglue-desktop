// MCP Server for Superglue - Generate Final Transformation
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createDataStore } from "../datastore/datastore.js";
import { logMessage } from "../utils/logs.js";
import { WorkflowExecutor } from "../workflow/workflow-executor.js";
import { getSchemaFromData, sample } from "../utils/tools.js";

// 创建数据存储实例
const datastore = createDataStore({ type: process.env.DATASTORE_TYPE as any });

// 创建 MCP 服务器实例
const server = new Server(
  {
    name: "superglue-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_final_transform",
        description:
          "Generate Final Transformation (JSONata) for a workflow. This tool executes the workflow and provides data structure information that you can use to create a JSONata expression.",
        inputSchema: {
          type: "object",
          properties: {
            workflowId: {
              type: "string",
              description:
                "The ID of the workflow to generate Final Transformation for",
            },
            payload: {
              type: "object",
              description:
                "Input data to execute the workflow and generate sample data",
              default: {},
            },
            credentials: {
              type: "object",
              description: "Authentication credentials for workflow execution",
              default: {},
            },
          },
          required: ["workflowId"],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_final_transform": {
        const {
          workflowId,
          payload = {},
          credentials = {},
        } = args as {
          workflowId: string;
          payload?: any;
          credentials?: any;
        };

        // 1. 获取工作流配置
        const workflow = await datastore.getWorkflow(workflowId, "default");
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
          "default"
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

        logMessage(
          "info",
          `Workflow executed successfully, providing data structure for JSONata generation`,
          {
            runId: metadata.runId,
            orgId: metadata.orgId,
          }
        );

        // 5. 返回结果，包含详细的数据结构信息和指导
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
          jsonataGuide: {
            description:
              "Use the provided data structure to create a JSONata expression for Final Transformation",
            instructions: [
              "The available data includes original payload and all successful step results",
              "Step results are available by their stepId (e.g., stepId.fieldName)",
              "Original payload fields are available at root level",
              'Use JSONata syntax like: { "result": stepId.data, "summary": payload.info }',
              'For arrays, use expressions like: stepId.items[*].{ "name": name, "value": value }',
              'You can combine multiple step results: { "step1Data": step1.result, "step2Data": step2.result }',
            ],
            examples: [
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

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
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

// 启动 MCP 服务器
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logMessage(
    "info",
    "🤖 Superglue MCP Server started - Generate Final Transformation only"
  );
}

// 如果直接运行此文件，启动服务器
// 支持多种 Node.js 入口检测方式
const isMainModule = 
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('mcp/index.js') ||
  process.argv[1]?.includes('mcp\\index.js');

if (isMainModule) {
  console.log('🚀 Starting MCP Server...');
  startMcpServer().catch((error) => {
    console.error(`❌ Failed to start MCP server: ${error.message}`);
    logMessage("error", `Failed to start MCP server: ${error.message}`);
    process.exit(1);
  });
}
