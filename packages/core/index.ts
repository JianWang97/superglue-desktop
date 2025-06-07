import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import cors from 'cors';
import express from 'express';
import { graphqlUploadExpress } from 'graphql-upload-minimal';
import http from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createDataStore } from './datastore/datastore.js';
import { resolvers, typeDefs } from './graphql/graphql.js';
import { createTelemetryPlugin, telemetryMiddleware } from './utils/telemetry.js';
import { logMessage } from "./utils/logs.js";
import { authMiddleware, validateToken, extractToken } from './auth/auth.js';

// Server instances for restart functionality
let currentServer: {
  apolloServer: ApolloServer;
  httpServer: http.Server;
  serverCleanup: { dispose: () => void | Promise<void> };
} | null = null;

// Constants
export function init() {
  const PORT = process.env.GRAPHQL_PORT || 3000;

  const DEFAULT_QUERY = `
  query Query {
    listRuns(limit: 10) {
      items {
        id
        status
        createdAt
      }
      total
    }
  }`;
  const datastore = createDataStore({ type: process.env.DATASTORE_TYPE as any });

  // Create the schema, which will be used separately by ApolloServer and useServer
  const schema = makeExecutableSchema({ typeDefs, resolvers });


// Context Configuration (can be shared or adapted for WS context)
  const getHttpContext = async ({ req }) => {
    return {
      datastore: datastore,
      orgId: req.orgId || ''
    };
  };

  return { PORT, DEFAULT_QUERY, datastore, schema, getHttpContext };
}

function validateEnvironment() {
  if(!process.env.GRAPHQL_PORT) {
    throw new Error('GRAPHQL_PORT is not set.');
  }

  if((process.env.LLM_PROVIDER !== 'GEMINI') && !process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  if((process.env.LLM_PROVIDER === 'GEMINI') && !process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  if(process.env.DATASTORE_TYPE === 'redis' && !process.env.REDIS_HOST) {
    throw new Error('REDIS_HOST is not set.');
  }

  if (!process.env.AUTH_TOKEN && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('AUTH_TOKEN is not set and no other authentication provider is configured.');
  }
}

// Server Setup
export async function startServer() {
  const { PORT, DEFAULT_QUERY, datastore, schema, getHttpContext } = init();

  validateEnvironment();

  // Express App Setup
  const app = express();
  // Create HTTP server
  const httpServer = http.createServer(app);

  // WebSocket Server Setup
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/', // Specify the path for WebSocket connections
  });

  // Setup graphql-ws server
  const serverCleanup = useServer({
    schema,
    context: async (ctx: any, msg, args) => {
      const token = extractToken(ctx);
      const authResult = await validateToken(token);

      if (!authResult.success) {
        logMessage('warn', `Subscription authentication failed for token: ${token}`);
        return false;
      }

      logMessage('info', `Subscription connected`);
      return { datastore, orgId: authResult.orgId };
    },
    onDisconnect(ctx, code, reason) {
      logMessage('info', `Subscription disconnected. code=${code} reason=${reason}`);
    },
  }, wsServer);


  // Apollo Server Configuration
  const server = new ApolloServer({
    schema, // Use the combined schema
    introspection: true,
    csrfPrevention: false,
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),
      // Proper shutdown for the WebSocket server.
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
      ApolloServerPluginLandingPageLocalDefault({
        footer: false,
        embed: true,
        document: DEFAULT_QUERY
      }),
      createTelemetryPlugin()
    ],
  });

  // Start Apollo Server (needed for HTTP middleware)
  await server.start();


  // Apply Middleware
  app.use(cors<cors.CorsRequest>()); // Use cors() directly
  app.use(express.json({ limit: '1024mb' }));
  app.use(authMiddleware); // Apply auth after CORS and JSON parsing
  app.use(telemetryMiddleware);
  app.use(graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 1 })); // Consider if needed before auth

  // Apply Apollo middleware *after* other middlewares
  // Ensure the path matches your desired GraphQL endpoint for HTTP
  app.use('/', expressMiddleware(server, { context: getHttpContext }));
  // Modified server startup
  await new Promise<void>((resolve) => httpServer.listen({ port: PORT }, resolve));

  // Store server instances for restart functionality
  currentServer = {
    apolloServer: server,
    httpServer,
    serverCleanup
  };

  logMessage('info', `🚀 Superglue server ready at http://localhost:${PORT}/ and ws://localhost:${PORT}/`);
  
  return currentServer;
}

/**
 * 优雅地停止服务器
 */
export async function stopServer(): Promise<void> {
  if (!currentServer) {
    logMessage('info', 'No server instance to stop');
    return;
  }

  try {
    logMessage('info', 'Stopping Superglue server...');
    
    // 停止 Apollo Server - 忽略"server not running"错误
    try {
      await currentServer.apolloServer.stop();
    } catch (error: any) {
      if (error.message?.includes('not running')) {
        logMessage('info', 'Apollo Server was already stopped');
      } else {
        throw error;
      }
    }
    
    // 清理 WebSocket 服务器
    try {
      await currentServer.serverCleanup.dispose();
    } catch (error: any) {
      logMessage('warn', `WebSocket cleanup warning: ${error.message}`);
    }
    
    // 关闭 HTTP 服务器
    try {
      await new Promise<void>((resolve, reject) => {
        // 检查服务器是否正在监听
        if (!currentServer!.httpServer.listening) {
          logMessage('info', 'HTTP Server was already closed');
          resolve();
          return;
        }
        
        currentServer!.httpServer.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (error: any) {
      logMessage('warn', `HTTP server close warning: ${error.message}`);
    }

    currentServer = null;
    logMessage('info', '✅ Superglue server stopped successfully');
  } catch (error) {
    logMessage('error', `Failed to stop server: ${error}`);
    // 即使出错也清理引用，避免下次重启时出现问题
    currentServer = null;
    throw error;
  }
}

/**
 * 检查服务器是否正在运行
 */
export function isServerRunning(): boolean {
  return currentServer !== null && currentServer.httpServer.listening;
}

/**
 * 获取当前服务器状态信息
 */
export function getServerStatus(): {
  isRunning: boolean;
  port?: number;
  hasApolloServer: boolean;
  hasHttpServer: boolean;
  hasWebSocketCleanup: boolean;
} {
  if (!currentServer) {
    return {
      isRunning: false,
      hasApolloServer: false,
      hasHttpServer: false,
      hasWebSocketCleanup: false
    };
  }

  const address = currentServer.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : undefined;

  return {
    isRunning: currentServer.httpServer.listening,
    port,
    hasApolloServer: !!currentServer.apolloServer,
    hasHttpServer: !!currentServer.httpServer,
    hasWebSocketCleanup: !!currentServer.serverCleanup
  };
}

/**
 * 重启服务器
 */
export async function restartServer(): Promise<void> {
  try {
    logMessage('info', 'Restarting Superglue server...');
    
    const status = getServerStatus();
    logMessage('info', `Server status before restart: ${JSON.stringify(status)}`);
    
    // 如果服务器正在运行，先停止
    if (status.isRunning || currentServer) {
      await stopServer();
    }
    
    // 等待一小段时间确保端口释放
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 重新启动服务器
    await startServer();
    
    logMessage('info', '🔄 Superglue server restarted successfully');
  } catch (error) {
    logMessage('error', `Failed to restart server: ${error}`);
    throw error;
  }
}

if (!process.versions.electron) {
  startServer().catch((error) => {
    logMessage('error', `Failed to start server: ${error}`);
    process.exit(1);
  });
}

export * from './utils/logs.js';
