import { GraphQLUpload } from "graphql-upload-minimal";
import fs from "node:fs";
import { callResolver } from "./resolvers/call.js";
import { deleteApiResolver, deleteExtractResolver, deleteTransformResolver } from "./resolvers/delete.js";
import { extractResolver } from "./resolvers/extract.js";
import { generateInstructionsResolver, generateSchemaResolver } from "./resolvers/generate.js";
import { getApiResolver, getExtractResolver, getRunResolver, getTransformResolver } from "./resolvers/get.js";
import { listApisResolver, listExtractsResolver, listRunsResolver, listTransformsResolver } from "./resolvers/list.js";
import { JSONResolver, JSONSchemaResolver, JSONataResolver } from "./resolvers/scalars.js";
import { getTenantInfoResolver, setTenantInfoResolver } from "./resolvers/tenant.js";
import { transformResolver } from "./resolvers/transform.js";
import { updateApiConfigIdResolver } from "./resolvers/update-id.js";
import { upsertApiResolver, upsertExtractResolver, upsertTransformResolver } from "./resolvers/upsert.js";
import {
  deleteWorkflowResolver,
  getWorkflowResolver,
  listWorkflowsResolver,
  upsertWorkflowResolver,
  executeWorkflowResolver,
  buildWorkflowResolver
} from "./resolvers/workflow.js";
import { logsResolver } from "./resolvers/logs.js";

export const resolvers = {
  Query: {
    listRuns: listRunsResolver,
    getRun: getRunResolver,
    listApis: listApisResolver,
    getApi: getApiResolver,
    listTransforms: listTransformsResolver,
    getTransform: getTransformResolver,
    listExtracts: listExtractsResolver,
    getExtract: getExtractResolver,
    generateSchema: generateSchemaResolver,
    getTenantInfo: getTenantInfoResolver,
    getWorkflow: getWorkflowResolver,
    listWorkflows: listWorkflowsResolver,
    generateInstructions: generateInstructionsResolver,
  },
  Mutation: {
    setTenantInfo: setTenantInfoResolver,
    call: callResolver,
    extract: extractResolver,
    transform: transformResolver,
    executeWorkflow: executeWorkflowResolver,
    buildWorkflow: buildWorkflowResolver,
    upsertWorkflow: upsertWorkflowResolver,
    deleteWorkflow: deleteWorkflowResolver,
    upsertApi: upsertApiResolver,
    deleteApi: deleteApiResolver,
    updateApiConfigId: updateApiConfigIdResolver,
    upsertExtraction: upsertExtractResolver,
    deleteExtraction: deleteExtractResolver,
    upsertTransformation: upsertTransformResolver,
    deleteTransformation: deleteTransformResolver,
  },
  Subscription: {
    logs: logsResolver,
  },
  JSON: JSONResolver,
  JSONSchema: JSONSchemaResolver,
  JSONata: JSONataResolver,
  Upload: GraphQLUpload,
  ConfigType: {
    __resolveType(obj: any, context: any, info: any) {
      // Get the parent field name from the path
      // we need to fix this at some point
      const parentField = info.path.prev.key;

      switch (parentField) {
        case "call":
          return "ApiConfig";
        case "extract":
          return "ExtractConfig";
        case "transform":
          return "TransformConfig";
        default:
          return "ApiConfig";
      }
    },
  },
};
export const typeDefs = `
scalar JSONSchema
scalar JSON
scalar JSONata
scalar DateTime
scalar Upload

interface BaseConfig {
  id: ID!
  version: String
  createdAt: DateTime
  updatedAt: DateTime
}

union ConfigType = ApiConfig | ExtractConfig | TransformConfig

type ApiConfig implements BaseConfig {
  # BaseConfig
  id: ID!
  version: String
  createdAt: DateTime
  updatedAt: DateTime

  # Specific implementation
  urlHost: String!
  urlPath: String
  instruction: String!
  method: HttpMethod
  queryParams: JSON
  headers: JSON
  body: String
  documentationUrl: String
  responseSchema: JSONSchema
  responseMapping: JSONata
  authentication: AuthType
  pagination: Pagination
  dataPath: String
}

type ExtractConfig implements BaseConfig {  
  # BaseConfig
  id: ID!
  version: String
  createdAt: DateTime
  updatedAt: DateTime

  # Specific implementation
  urlHost: String!
  urlPath: String
  queryParams: JSON
  instruction: String!
  method: HttpMethod
  headers: JSON
  body: String
  documentationUrl: String
  decompressionMethod: DecompressionMethod
  authentication: AuthType
  fileType: FileType
  dataPath: String
}

type TransformConfig implements BaseConfig {
  # BaseConfig
  id: ID!
  version: String
  createdAt: DateTime
  updatedAt: DateTime

  # Specific implementation
  instruction: String!
  responseSchema: JSONSchema
  responseMapping: JSONata
}

type RunResult {
  id: ID!
  success: Boolean!
  data: JSON
  error: String
  startedAt: DateTime!
  completedAt: DateTime!
  config: ConfigType
}

type Pagination {
  type: PaginationType!
  pageSize: String
  cursorPath: String
}

type RunList {
  items: [RunResult!]!
  total: Int!
}

type ApiList {
  items: [ApiConfig!]!
  total: Int!
}

type TransformList {
  items: [TransformConfig!]!
  total: Int!
}

type ExtractList {
  items: [ExtractConfig!]!
  total: Int!
}

enum AuthType {
  NONE
  HEADER
  QUERY_PARAM
  OAUTH2
}

enum DecompressionMethod {
  GZIP
  DEFLATE
  NONE
  AUTO
  ZIP
}

enum HttpMethod {
  GET
  POST
  PUT
  DELETE
  PATCH
  HEAD
  OPTIONS
}

enum CacheMode {
  ENABLED
  READONLY
  WRITEONLY
  DISABLED
}

enum PaginationType {
  OFFSET_BASED
  PAGE_BASED
  CURSOR_BASED
  DISABLED
}

enum FileType {
  CSV
  JSON
  XML
  AUTO
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
}

input PaginationInput {
  type: PaginationType!
  pageSize: String
  cursorPath: String
}

input ApiInput {
  id: ID!
  urlHost: String!
  urlPath: String
  instruction: String!
  queryParams: JSON
  method: HttpMethod
  headers: JSON
  body: String
  documentationUrl: String
  responseSchema: JSONSchema
  responseMapping: JSONata
  authentication: AuthType
  pagination: PaginationInput
  dataPath: String
  version: String
}

input ExtractInput {
  id: ID!
  urlHost: String!
  urlPath: String
  queryParams: JSON
  instruction: String!
  method: HttpMethod
  headers: JSON
  body: String
  documentationUrl: String
  decompressionMethod: DecompressionMethod
  fileType: FileType
  authentication: AuthType
  dataPath: String
  version: String
}

input TransformInput {
  id: ID!
  instruction: String!
  responseSchema: JSONSchema!
  responseMapping: JSONata
  version: String
}

input RequestOptions {
  cacheMode: CacheMode
  timeout: Int
  retries: Int
  retryDelay: Int
  webhookUrl: String
}

input ApiInputRequest @oneOf {
  endpoint: ApiInput
  id: ID
}

input ExtractInputRequest @oneOf {
  endpoint: ExtractInput
  file: Upload
  id: ID
}

input TransformInputRequest @oneOf {
  endpoint: TransformInput
  id: ID
}

input WorkflowInputRequest @oneOf {
  workflow: WorkflowInput
  id: ID
}

input SystemInput {
  id: String!
  urlHost: String!
  urlPath: String
  documentationUrl: String
  documentation: String
  credentials: JSON
}

type Log {
  id: ID!
  message: String!
  level: LogLevel!
  timestamp: DateTime!
  runId: ID
}

type Query {
  listRuns(limit: Int = 10, offset: Int = 0, configId: ID): RunList!
  listApis(limit: Int = 10, offset: Int = 0): ApiList!
  listTransforms(limit: Int = 10, offset: Int = 0): TransformList!
  listExtracts(limit: Int = 10, offset: Int = 0): ExtractList!
  listWorkflows(limit: Int = 10, offset: Int = 0): [Workflow!]!

  getRun(id: ID!): RunResult
  getApi(id: ID!): ApiConfig
  getTransform(id: ID!): TransformConfig
  getExtract(id: ID!): ExtractConfig
  getWorkflow(id: ID!): Workflow

  generateSchema(instruction: String!, responseData: String): JSONSchema!
  generateInstructions(systems: [SystemInput!]!): [String!]!
  getTenantInfo: TenantInfo
  
  # Workflow queries
}

type TenantInfo {
  email: String
  emailEntrySkipped: Boolean!
}

type ExecutionStep {
  id: String!
  apiConfig: ApiConfig!
  executionMode: String  # DIRECT | LOOP
  loopSelector: JSONata
  loopMaxIters: Int
  inputMapping: JSONata
  responseMapping: JSONata
}

input ExecutionStepInput {
  id: String!
  apiConfig: ApiInput!
  executionMode: String  # DIRECT | LOOP
  loopSelector: JSONata
  loopMaxIters: Int
  inputMapping: JSONata
  responseMapping: JSONata
}

type Workflow implements BaseConfig {
  # BaseConfig
  id: ID!
  version: String
  createdAt: DateTime
  updatedAt: DateTime

  # Specific implementation
  steps: [ExecutionStep!]!
  finalTransform: JSONata
  responseSchema: JSONSchema
}

type WorkflowStepResult {
  stepId: String!
  success: Boolean!
  rawData: JSON
  transformedData: JSON
  error: String
}

type WorkflowResult {
  success: Boolean!
  data: JSON!
  stepResults: [WorkflowStepResult!]!
  finalTransform: JSONata
  error: String
  startedAt: DateTime!
  completedAt: DateTime!
}

input WorkflowInput {
  id: String!
  steps: [ExecutionStepInput!]!
  finalTransform: JSONata
  responseSchema: JSONSchema
  version: String
}

type Mutation {
  setTenantInfo(email: String, emailEntrySkipped: Boolean): TenantInfo!
  
  call(
    input: ApiInputRequest!
    payload: JSON
    credentials: JSON
    options: RequestOptions
  ): RunResult!
  
  extract(
    input: ExtractInputRequest!
    payload: JSON
    credentials: JSON
    options: RequestOptions
  ): RunResult!
  
  transform(
    input: TransformInputRequest!
    data: JSON!
    options: RequestOptions
  ): RunResult!
  
  executeWorkflow(
    input: WorkflowInputRequest!
    payload: JSON
    credentials: JSON
    options: RequestOptions
  ): WorkflowResult!
  
  buildWorkflow(
    instruction: String!
    payload: JSON
    systems: [SystemInput!]!
    responseSchema: JSONSchema
  ): Workflow!

  upsertWorkflow(id: ID!, input: JSON!): Workflow!
  deleteWorkflow(id: ID!): Boolean!
  
  upsertApi(id: ID!, input: JSON!): ApiConfig!
  deleteApi(id: ID!): Boolean!

  updateApiConfigId(oldId: ID!, newId: ID!): ApiConfig!

  upsertExtraction(id: ID!, input: JSON!): ExtractConfig!
  deleteExtraction(id: ID!): Boolean!
  
  upsertTransformation(id: ID!, input: JSON!): TransformConfig!
  deleteTransformation(id: ID!): Boolean!
}

type Subscription {
  logs: Log!
}
`;
