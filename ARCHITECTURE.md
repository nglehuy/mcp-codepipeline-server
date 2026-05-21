# MCP Server for AWS CodePipeline - Beginner's Guide

## 1. Project Overview

### What is an MCP Server?

A Model Context Protocol (MCP) server creates a bridge between Cascade (the AI assistant in Windsurf IDE) and external services like AWS. Think of it as a translator that converts natural language requests into API calls to specific services.

**Example**: When you ask Cascade "List all my CodePipeline pipelines," the MCP server translates this into an AWS API call and returns the results.

### Goals
- Create a Model Context Protocol (MCP) server that allows Cascade to interact with AWS CodePipeline
- Enable natural language control of pipeline operations through Windsurf
- Provide a secure and efficient bridge between the Windsurf IDE and AWS services

### What You'll Build
- A server that can list and manage AWS CodePipeline resources
- Functionality to view pipeline states, executions, and details
- Capability to trigger pipeline executions, approvals, and other operations
- AWS authentication via profile/SSO, IAM roles, or optional static keys (see `src/aws/create-aws-config.ts`)

### Key Technologies
- **TypeScript**: Type-safe development
- **Node.js**: Runtime
- **AWS SDK v2**: CodePipeline and CloudWatch APIs
- **Model Context Protocol SDK**: Stdio transport for IDE integration
- **ES Modules**: `import` / `export` with `.js` extensions in imports
- **Express** (optional): Only used by the legacy `src/mcp-server.ts` HTTP experiment

### Visual Overview

```
User → Windsurf → Cascade → MCP Server → AWS CodePipeline
    ↑                                         |
    |                                         |
    └─────────────── Results ────────────────┘
```

## 2. Getting Started: Step by Step

### Setting Up Your Project

1. **Create a new project folder**
   ```bash
   mkdir my-mcp-server
   cd my-mcp-server
   ```

2. **Initialize Node.js project**
   ```bash
   npm init -y
   ```

3. **Install dependencies**
   ```bash
   npm install @modelcontextprotocol/sdk express aws-sdk cors body-parser dotenv
   npm install --save-dev typescript @types/express @types/node @types/cors @types/body-parser
   ```

4. **Create TypeScript configuration**
   Create a file named `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "esModuleInterop": true,
       "outDir": "./dist",
       "strict": true
     },
     "include": ["src/**/*"]
   }
   ```

5. **Add scripts to package.json**
   Update your `package.json` to include:
   ```json
   "scripts": {
     "build": "tsc",
     "start": "node dist/index.js",
     "dev": "ts-node src/index.ts"
   }
   ```

### Folder Structure Overview

Actual layout of this repository:

```
mcp-codepipeline-server/
├── src/
│   ├── aws/
│   │   └── create-aws-config.ts   # Shared AWS SDK region + credentials
│   ├── config/
│   │   └── server-config.ts       # MCP server metadata
│   ├── tools/                     # One file per MCP tool (handlers + schemas)
│   ├── utils/
│   │   └── env.ts                 # .env loading and getEnv()
│   ├── types/
│   │   └── codepipeline.ts        # API response interfaces
│   ├── types.ts                   # CodePipelineManager (AWS client wrapper)
│   ├── index.ts                   # Primary entry — stdio MCP server
│   ├── services/                  # Legacy HTTP stack only
│   ├── controllers/               # Legacy HTTP stack
│   ├── routes/                    # Legacy HTTP stack
│   └── mcp-server.ts              # Legacy Express experiment (not started by index.ts)
├── .env.example
├── dist/                          # Compiled output (npm run build)
└── package.json
```

**Pro Tip**: New MCP tools go under `src/tools/`. Register each tool in `src/index.ts`.

### How the Files Work Together (current MCP path)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  index.ts   │────▶│  tools/*.ts      │────▶│ CodePipelineManager │────▶│ AWS CodePipeline │
│ (stdio MCP) │     │  (per operation) │     │  (types.ts)         │     │  + CloudWatch*   │
└─────────────┘     └──────────────────┘     └─────────────────────┘     └──────────────┘
       │                      │                          │
       │                      │                          └── uses create-aws-config.ts
       └── StdioServerTransport (Cursor / Windsurf)

* CloudWatch in get_pipeline_metrics.ts inherits global AWS.config from createAwsConfig().
```

### Legacy HTTP stack (optional)

`src/mcp-server.ts`, `routes/`, `controllers/`, and `services/codepipeline.service.ts` are from an earlier REST tutorial. `npm start` runs `dist/index.js` (stdio MCP only) and does **not** listen on `PORT`.

## 3. Building Your First MCP Server Components

### Core Concepts Made Simple

Let's break down each key component with simple explanations and examples:

### Step 1: Define Your Environment Helper

Create `src/utils/env.ts` to load environment variables:

```typescript
// src/utils/env.ts
import dotenv from 'dotenv';
import path from 'path';

export function loadEnv(): void {
  // Load .env file if it exists
  dotenv.config();
  console.log('Environment variables loaded');
}

// Helper to get environment variables
export function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}
```

### Step 2: Create Server Configuration

Create `src/config/server-config.ts` to define your server's metadata:

```typescript
// src/config/server-config.ts
export const serverConfig = {
  name: "my-aws-mcp-server",
  version: "1.0.0",
  displayName: "My AWS MCP Server",
  description: "MCP server for interacting with AWS services",
  publisher: "Your Name",
  license: "MIT"
};
```

### Step 3: Centralize AWS configuration

Create `src/aws/create-aws-config.ts` so every AWS client shares the same region and credential logic:

```typescript
// src/aws/create-aws-config.ts
import AWS from 'aws-sdk';
import { getEnv } from '../utils/env.js';

export function createAwsConfig() {
  const region = getEnv('AWS_REGION', 'us-west-2');
  const accessKeyId = getEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('AWS_SECRET_ACCESS_KEY');
  const sessionToken = getEnv('AWS_SESSION_TOKEN');

  const config: AWS.ConfigurationOptions = { region };

  // Static keys only when both env vars are set; otherwise use default provider chain
  if (accessKeyId && secretAccessKey) {
    config.credentials = new AWS.Credentials({
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    });
  }

  AWS.config.update(config);
  return { config, region };
}
```

**Credential modes** (see also README):

| Mode | What to set |
|------|-------------|
| Profile / SSO (recommended locally) | `AWS_PROFILE=my-profile` — omit access keys |
| Static keys | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |
| Temporary session | Above + `AWS_SESSION_TOKEN` |
| IAM role on AWS | Only `AWS_REGION` |

The default chain reads `~/.aws/credentials`, SSO sessions after `aws sso login`, and instance/task roles automatically.

### Step 3b: AWS client wrapper

`src/types.ts` defines `CodePipelineManager`, which calls `createAwsConfig()` and exposes `getCodePipeline()` to all tools:

```typescript
import AWS from 'aws-sdk';
import { createAwsConfig } from './aws/create-aws-config.js';

export class CodePipelineManager {
  private codepipeline: AWS.CodePipeline;

  constructor() {
    const { config, region } = createAwsConfig();
    this.codepipeline = new AWS.CodePipeline(config);
    console.log(`AWS CodePipeline manager initialized with region: ${region}`);
  }

  getCodePipeline(): AWS.CodePipeline {
    return this.codepipeline;
  }
}
```

### Step 4 (optional): Legacy HTTP controller

Skip this for the stdio MCP server. If you enable the legacy Express stack, create `src/controllers/aws-controller.ts` to handle HTTP requests:

```typescript
// src/controllers/aws-controller.ts
import { Request, Response } from 'express';
import { AWSService } from '../services/aws-service.js';

export class AWSController {
  private awsService: AWSService;

  constructor() {
    this.awsService = new AWSService();
  }

  // Example controller method
  listItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const items = await this.awsService.listItems();
      res.status(200).json({ items });
    } catch (error) {
      console.error('Error in listItems controller:', error);
      res.status(500).json({ error: 'Failed to list items' });
    }
  };
}
```

### Step 5 (optional): Legacy HTTP routes

Create `src/routes/aws-routes.ts` to define API endpoints (legacy stack only):

```typescript
// src/routes/aws-routes.ts
import { Router } from 'express';
import { AWSController } from '../controllers/aws-controller.js';

const router = Router();
const awsController = new AWSController();

// Define routes
router.get('/items', awsController.listItems);

export default router;
```

### Understanding MCP Interfaces

Here are the key interfaces you'll use, simplified:

#### Tool Interface
```typescript
// This is what Cascade sends to your MCP server
interface Tool {
  name: string;         // The name of the tool (e.g., "list_buckets")
  parameters: {         // The parameters the user provided
    [key: string]: any  // E.g., { "region": "us-west-2" }
  };
}
```

#### Tool Definition Interface
```typescript
// This tells Cascade what tools your MCP server provides
interface ToolDefinition {
  name: string;          // Tool name (e.g., "list_buckets")
  description: string;   // Human-readable description
  parameters: {          // What parameters this tool accepts
    type: "object",
    properties: {        // Define each parameter
      paramName: {
        type: "string",   // Parameter type
        description: "What this parameter does"
      }
      // More parameters...
    }
  }
}
```

## 4. Creating the MCP Server Implementation

### Step 6: Implement tools (one file per operation)

Each tool lives in `src/tools/`, for example `list_pipelines.ts`:

```typescript
// src/tools/list_pipelines.ts
import { CodePipelineManager } from "../types.js";

export const listPipelinesSchema = {
  name: "list_pipelines",
  description: "List all CodePipeline pipelines",
  inputSchema: { type: "object", properties: {} },
} as const;

export async function listPipelines(codePipelineManager: CodePipelineManager) {
  const codepipeline = codePipelineManager.getCodePipeline();
  const response = await codepipeline.listPipelines().promise();
  // Return MCP content block...
}
```

Add the schema to `ListToolsRequestSchema` and branch on `name` inside `CallToolRequestSchema` in `src/index.ts`.

### Step 7: Main entry point (stdio only)

`src/index.ts` is the production entry point:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadEnv } from './utils/env.js';
import { createAwsConfig, logAwsConfig } from './aws/create-aws-config.js';
import { CodePipelineManager } from "./types.js";
// import tool schemas + handlers from ./tools/*

loadEnv();

console.log('----- AWS CodePipeline MCP Server Configuration -----');
logAwsConfig(createAwsConfig());
console.log('Transport: stdio');
console.log('-----------------------------------------------------');

const codePipelineManager = new CodePipelineManager();
const server = new Server({ name: "aws-codepipeline-mcp-server", version: "1.0.0" }, { capabilities: { tools: {} } });

// Register ListTools / CallTool handlers that dispatch to src/tools/*
const transport = new StdioServerTransport();
await server.connect(transport);
```

There is no HTTP hop: tools call AWS directly through `CodePipelineManager`.

### How the processing flow works

```
1. User: "List my CodePipeline pipelines"
   ↓
2. IDE assistant calls MCP tool "list_pipelines"
   ↓
3. index.ts receives CallTool over StdioServerTransport
   ↓
4. Handler in src/tools/list_pipelines.ts runs
   ↓
5. CodePipelineManager → AWS CodePipeline API
   ↓
6. JSON result returned as MCP tool content
```

**Key point**: `npm start` runs **one** process — MCP over stdio. Do not assume `PORT` or Express unless you explicitly wire up `src/mcp-server.ts`.

## 5. Final Steps and Troubleshooting

### Step 8: Configure environment variables

Copy `.env.example` to `.env`. Recommended for local development:

```
AWS_REGION=us-west-2
AWS_PROFILE=your-aws-profile
```

Optional static keys (omit both to use the default credential chain):

```
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_SESSION_TOKEN=...   # temporary creds only
```

`PORT` is only relevant for the legacy HTTP server in `src/mcp-server.ts`, not for `npm start` / stdio MCP.

### Step 9: Create a .gitignore File

Create a `.gitignore` file to prevent sensitive information from being committed:

```
node_modules/
dist/
.env
*.log
.DS_Store
```

### Step 10: Build and Run Your Server

```bash
# Build your TypeScript code
npm run build

# Start your server
npm start
```

### Step 11: Configure Windsurf

Update your Windsurf MCP configuration (typically in `~/.codeium/windsurf/mcp_config.json`):

```json
{
  "mcpServers": {
    "your-service-name": {
      "command": "npx",
      "args": [
        "-y",
        "path/to/your-mcp-server/dist/index.js"
      ],
      "env": {
        "AWS_REGION": "your-region",
        "AWS_PROFILE": "your-aws-profile"
      }
    }
  }
}
```

### Adding a new CodePipeline operation

1. **Create** `src/tools/your_tool.ts` with `yourToolSchema` and `async function yourTool(codePipelineManager, input)`
2. **Import** schema and handler in `src/index.ts`
3. **Register** the schema in the `ListTools` handler array
4. **Add** a `case "your_tool":` branch in the `CallTool` handler
5. **Rebuild**: `npm run build`, then restart the MCP client

For the legacy HTTP stack only: also add service + controller + route methods (not required for stdio MCP).

### Common Issues and Solutions

#### 1. "Cannot find module" errors

**Problem**: TypeScript can't find imported modules

**Solution**: 
- Make sure you're using `.js` extensions in imports (ES modules requirement)  
- Check that the module is installed in package.json

#### 2. AWS SDK / credential errors

**Problem**: `ExpiredToken`, `UnrecognizedClientException`, or `AccessDenied`

**Solution**:
- **Profile / SSO**: set `AWS_PROFILE` and run `aws sso login --profile YOUR_PROFILE` if using SSO
- **Static keys**: verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (and `AWS_SESSION_TOKEN` for temp creds)
- Check startup logs: `AWS credentials: default provider chain` vs `static keys from environment variables`
- Confirm `AWS_REGION` matches where pipelines exist
- Ensure IAM permissions for CodePipeline (and CloudWatch for `get_pipeline_metrics`)

#### 3. MCP server not detected by the IDE

**Problem**: Assistant can't access tools

**Solution**:
- Check the path to `dist/index.js` in MCP config (run `npm run build` first)
- Verify tool schemas are registered in `ListTools` and handlers in `CallTool`
- Restart the IDE after config changes
- Stdio MCP does not use `PORT` — a "connection refused" on port 3000 usually means something else is wrong, not this server

#### 4. "TypeError: Cannot read property of undefined"

**Problem**: Trying to access properties that don't exist

**Solution**:
- Use optional chaining (`?.`) when accessing nested properties
- Add null checks before accessing properties
- Add console.log statements to debug object structures

### What Next?

Once you have your basic MCP server working:

1. **Expand functionality**: Add more AWS operations
2. **Refine error handling**: Provide detailed error messages
3. **Add validation**: Validate inputs before processing
4. **Implement testing**: Add unit and integration tests
5. **Improve documentation**: Add comments and API docs

---

By following this beginner-friendly guide, you can create your own MCP server for any AWS service. Start with something simple, get it working, and then gradually expand its capabilities. Good luck with your MCP development journey!
