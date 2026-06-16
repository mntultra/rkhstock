/**
 * Multi-Agent Orchestrator with Database Integration
 * Demonstrates how to connect a Database Specialist Agent to Supabase
 * using Function Calling (Tools) to retrieve live inventory data.
 *
 * Requirements: npm install @supabase/supabase-js dotenv
 */

import { createClient } from '@supabase/supabase-js';
import process from 'process';

// Use Node's native env file loader
try {
  process.loadEnvFile('.env');
} catch (e) {
  // Ignore if file doesn't exist
}

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://icfbfhdfotxlgqdyxfav.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZmJmaGRmb3R4bGdxZHl4ZmF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MDc3ODEsImV4cCI6MjA5NTI4Mzc4MX0.UbveXlboVnWwo39Uj0OCj6Vv90ENgV5AAY0OYbkd32M';
const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not defined. Please set it in your environment or .env file.');
}

/**
 * Tool Definition for Gemini Function Calling
 */
const querySupabaseTableTool = {
  name: 'querySupabaseTable',
  description: 'Query data from a Supabase table by selecting columns, applying filters, and specifying limits.',
  parameters: {
    type: 'OBJECT',
    properties: {
      tableName: {
        type: 'STRING',
        description: 'The name of the table to query. Allowed tables: "products", "stock_balances", "lots", "warehouses".',
      },
      select: {
        type: 'STRING',
        description: 'Columns to select, comma separated. E.g. "id, drug_code, abbreviation". Defaults to "*".',
      },
      filters: {
        type: 'ARRAY',
        description: 'List of filters to apply to the query (optional).',
        items: {
          type: 'OBJECT',
          properties: {
            field: { type: 'STRING', description: 'Column name to filter on' },
            operator: { 
              type: 'STRING', 
              enum: ['eq', 'ilike', 'lt', 'gt'], 
              description: 'Comparison operator' 
            },
            value: { type: 'STRING', description: 'Value to compare' }
          },
          required: ['field', 'operator', 'value']
        }
      },
      limit: {
        type: 'INTEGER',
        description: 'Maximum number of records to return. Defaults to 5.',
      }
    },
    required: ['tableName']
  }
};

/**
 * Execute the database query on Supabase using the parameters decided by the LLM
 */
async function querySupabaseTable({ tableName, select = '*', filters = [], limit = 5 }) {
  console.log(`[Tool Executing] querySupabaseTable on "${tableName}"...`);
  
  // Safe list of allowed tables to prevent abuse
  const allowedTables = ['products', 'stock_balances', 'lots', 'warehouses'];
  if (!allowedTables.includes(tableName)) {
    throw new Error(`Table "${tableName}" is not accessible. Allowed tables: ${allowedTables.join(', ')}`);
  }

  try {
    let query = supabase.from(tableName).select(select);

    for (const filter of filters) {
      const { field, operator, value } = filter;
      if (operator === 'eq') {
        query = query.eq(field, value);
      } else if (operator === 'ilike') {
        query = query.ilike(field, value);
      } else if (operator === 'lt') {
        query = query.lt(field, value);
      } else if (operator === 'gt') {
        query = query.gt(field, value);
      }
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    return { result: data };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Call Gemini API using native fetch
 */
async function callGemini(model, systemInstruction, contents, tools = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: contents }] }],
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  };

  if (tools) {
    payload.tools = [{ functionDeclarations: tools }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  return await response.json();
}

/**
 * Orchestrator & Specialist Execution Flow
 */
export async function runMultiAgentSystem(userPrompt) {
  console.log(`\n==================================================`);
  console.log(`User Input: "${userPrompt}"`);
  console.log(`==================================================\n`);

  // --- Step 1: Routing Agent ---
  const routerInstruction = `You are the Router Agent. Categorize the user request.
Respond ONLY with a JSON in this format:
{
  "targetAgent": "database" | "writer" | "unknown",
  "refinedPrompt": "The specific task prompt for the specialist agent."
}`;

  console.log('[Router] Deciding agent...');
  const routerResponse = await callGemini('gemini-2.5-flash', routerInstruction, userPrompt);
  
  let routing;
  try {
    // Strip markdown formatting if the model outputs ```json ... ```
    let text = routerResponse.candidates[0].content.parts[0].text;
    text = text.replace(/```json/i, '').replace(/```/g, '').trim();
    routing = JSON.parse(text);
    console.log(`[Router] Routed to: ${routing.targetAgent}`);
  } catch (e) {
    console.error('Failed to parse router response:', routerResponse.candidates[0].content.parts[0].text);
    return;
  }

  if (routing.targetAgent !== 'database') {
    console.log(`[System] This demo only showcases the Database Agent tool calling. Target: ${routing.targetAgent}`);
    return;
  }

  // --- Step 2: Database Specialist Agent with Tools ---
  const dbInstruction = `You are the Database Specialist Agent.
You have access to the "querySupabaseTable" tool to query database records.
Database Schema Information:
1. "products" table has fields: "id", "drug_code", "generic_name", "abbreviation", "product_type_id"
2. "stock_balances" table has fields: "id", "warehouse_id", "product_id", "lot_id", "current_qty"
3. "lots" table has fields: "id", "lot_number", "expiry_date", "unit_price"

Your Goal: Search for the product or stock data requested by the user, query the tables step-by-step, and explain the result in Thai.`;

  console.log(`[Database Specialist] Analyzing query: "${routing.refinedPrompt}"`);
  
  // Create conversation history array
  const contents = [
    { role: 'user', parts: [{ text: routing.refinedPrompt }] }
  ];

  // Call specialist with tools
  let responseObj = await callGemini(
    'gemini-2.5-flash', 
    dbInstruction, 
    contents, 
    [querySupabaseTableTool]
  );

  const candidate = responseObj.candidates[0];
  const parts = candidate.content.parts;
  
  // Check if model wants to run a function
  const functionCallPart = parts.find(p => p.functionCall);

  if (functionCallPart) {
    const fnCall = functionCallPart.functionCall;
    console.log(`[Database Specialist] Decided to call function: ${fnCall.name}`);
    console.log(`Arguments:`, JSON.stringify(fnCall.args, null, 2));

    // Execute the tool
    let toolResult;
    if (fnCall.name === 'querySupabaseTable') {
      toolResult = await querySupabaseTable(fnCall.args);
    } else {
      toolResult = { error: `Function ${fnCall.name} not found.` };
    }

    console.log(`[Tool Response] Returned ${Array.isArray(toolResult.result) ? toolResult.result.length : 0} rows.`);

    // Add model's call and tool's response to contents history
    contents.push(candidate.content);
    contents.push({
      role: 'tool',
      parts: [{
        functionResponse: {
          name: fnCall.name,
          response: toolResult
        }
      }]
    });

    // Run the model again to let it summarize the tool output
    console.log(`[Database Specialist] Summarizing data for the user...`);
    const finalResponse = await callGemini('gemini-2.5-flash', dbInstruction, contents);
    
    console.log(`\n================ FINAL ANSWER ================`);
    console.log(finalResponse.candidates[0].content.parts[0].text);
    console.log(`==============================================\n`);
  } else {
    // No tool calling was needed
    console.log(`\n================ FINAL ANSWER ================`);
    console.log(parts[0].text);
    console.log(`==============================================\n`);
  }
}

// Self-test block
if (process.argv[1] && process.argv[1].endsWith('agentOrchestratorWithDb.mjs')) {
  // Test query
  const query = "ขอยอดคงเหลือในคลังของยารหัส TOCS120 หรือที่มีชื่อคล้ายกันหน่อยครับ";
  runMultiAgentSystem(query).catch(console.error);
}
