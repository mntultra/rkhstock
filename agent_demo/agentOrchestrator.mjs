/**
 * Multi-Agent Orchestrator Template for Node.js (ES Modules)
 * Demonstrates a low-cost, token-optimized multi-agent architecture.
 *
 * Requirements: npm install @google/generative-ai dotenv
 */

import { GoogleGenAI } from '@google/genai'; // Modern Google Gen AI SDK
import dotenv from 'dotenv';

dotenv.config();

// Initialize the SDK (API Key defaults to process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI();

/**
 * Define our Agent configurations
 * By assigning specialized system instructions and selecting appropriate models,
 * we minimize token usage and maximize performance.
 */
const AGENT_REGISTRY = {
  router: {
    name: 'Router',
    model: 'gemini-2.5-flash', // Cheap and fast model for decision making
    systemInstruction: `You are the Router Agent. Your job is to analyze the user request and delegate it to the most suitable Specialist Agent.
You must respond ONLY with a JSON object in this format:
{
  "targetAgent": "database" | "calculator" | "writer" | "unknown",
  "refinedPrompt": "The exact prompt/sub-task optimized for the target agent",
  "reasoning": "Brief explanation of why you chose this agent"
}

Available Agents:
- "database": For querying database structure, SQL generation, stock matching, or data queries.
- "calculator": For complex mathematical calculations, formulas, or accounting algorithms.
- "writer": For generating user-friendly reports, explanations, summaries, or emails.
- "unknown": If the task does not fit any category.`,
    jsonMode: true, // Request JSON output
  },
  database: {
    name: 'Database Specialist',
    model: 'gemini-2.5-flash', // Flash is great for structured text tasks
    systemInstruction: `You are the Database Specialist. You write optimized SQL queries, design database schemas, and debug database issues.
Use standard PostgreSQL/Supabase dialect. Provide clean, commented code.`,
  },
  calculator: {
    name: 'Math & Logic Specialist',
    model: 'gemini-2.5-flash',
    systemInstruction: `You are the Math & Logic Specialist. You solve equations, design mathematical algorithms, and explain calculations step-by-step.`,
  },
  writer: {
    name: 'Writer & Translator Specialist',
    model: 'gemini-2.5-flash', // Flash is fast for creative/writing tasks
    systemInstruction: `You are the Writer & Translator Specialist. You write polite, professional, and clear summaries, reports, or translations in Thai and English.`,
  },
};

/**
 * Track token usage across the entire session to monitor costs.
 */
class TokenTracker {
  constructor() {
    this.promptTokens = 0;
    this.candidatesTokens = 0;
    this.totalTokens = 0;
  }

  add(usage) {
    if (!usage) return;
    this.promptTokens += usage.promptTokenCount || 0;
    this.candidatesTokens += usage.candidatesTokenCount || 0;
    this.totalTokens += usage.totalTokenCount || 0;
  }

  logSummary() {
    console.log('\n========= TOKEN USAGE REPORT =========');
    console.log(`Prompt Tokens:      ${this.promptTokens}`);
    console.log(`Candidates Tokens:  ${this.candidatesTokens}`);
    console.log(`Total Tokens:       ${this.totalTokens}`);
    // Rough estimate of cost (based on gemini-2.5-flash pricing)
    // Input: ~$0.075 / 1M tokens, Output: ~$0.30 / 1M tokens
    const cost = (this.promptTokens * 0.075 + this.candidatesTokens * 0.30) / 1000000;
    console.log(`Estimated Cost:     $${cost.toFixed(6)} USD`);
    console.log('======================================\n');
  }
}

/**
 * Execute an LLM call for a specific agent
 */
async function runAgent(agentKey, prompt, tracker) {
  const agent = AGENT_REGISTRY[agentKey];
  if (!agent) {
    throw new Error(`Agent "${agentKey}" not found in registry.`);
  }

  console.log(`[${agent.name}] Calling model ${agent.model}...`);

  try {
    const config = {
      model: agent.model,
      contents: prompt,
      config: {
        systemInstruction: agent.systemInstruction,
      }
    };

    // If the agent requires structured JSON output (e.g. Router)
    if (agent.jsonMode) {
      config.config.responseMimeType = 'application/json';
    }

    const response = await ai.models.generateContent(config);

    // Track usage
    tracker.add(response.usageMetadata);

    if (agent.jsonMode) {
      return JSON.parse(response.text);
    }
    return response.text;
  } catch (error) {
    console.error(`Error executing Agent ${agent.name}:`, error);
    throw error;
  }
}

/**
 * Orchestrator Main Workflow
 */
export async function handleUserTask(userRequest) {
  const tracker = new TokenTracker();
  console.log(`\n>>> User Request: "${userRequest}"`);

  // Step 1: Routing
  console.log('\nStep 1: Routing task...');
  const routingResult = await runAgent('router', userRequest, tracker);
  console.log('Routing Decision:', JSON.stringify(routingResult, null, 2));

  const targetAgent = routingResult.targetAgent;
  const refinedPrompt = routingResult.refinedPrompt;

  if (targetAgent === 'unknown' || !AGENT_REGISTRY[targetAgent]) {
    console.log('\nCould not determine which specialist should handle this. Falling back to default assistant.');
    // In real scenarios, you could fallback to a general agent or ask the user for clarification.
    tracker.logSummary();
    return {
      status: 'error',
      message: 'Unknown agent routing.',
      routingResult
    };
  }

  // Step 2: Delegate to Specialist
  console.log(`\nStep 2: Delegating to Specialist [${targetAgent}]...`);
  const specialistOutput = await runAgent(targetAgent, refinedPrompt, tracker);
  
  console.log(`\n[${AGENT_REGISTRY[targetAgent].name} Output]:\n`);
  console.log(specialistOutput);

  // Step 3: Log usage summary
  tracker.logSummary();

  return {
    status: 'success',
    routingResult,
    output: specialistOutput
  };
}

// Self-test block (runs if file is executed directly)
if (process.argv[1] && process.argv[1].endsWith('agentOrchestrator.mjs')) {
  // Test scenario 1: Database related
  const dbTask = "เขียนคำสั่ง SQL เพื่อดึงข้อมูลประวัติการทำรายการยา (stock_movement_items) ที่จำนวนเหลือน้อยกว่า 10 ชิ้น พร้อมชื่อยา";
  await handleUserTask(dbTask);

  // Test scenario 2: Calculations
  const mathTask = "ถ้ายอดเริ่มต้นมียา 100 ขวด มีจ่ายออก 25 ขวด นำเข้าเพิ่ม 50 ขวด และมีของเสียหาย 5 ขวด ช่วยคิดยอดคงเหลือพร้อมอธิบายทีละขั้นตอน";
  await handleUserTask(mathTask);
}
