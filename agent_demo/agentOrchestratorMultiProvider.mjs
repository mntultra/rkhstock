/**
 * Multi-Agent Multi-Provider Orchestrator
 * Demonstrates routing tasks to different LLM providers (Gemini, OpenAI, Anthropic Claude)
 * using native fetch calls. No external SDK dependencies needed!
 *
 * How to run:
 * Add GEMINI_API_KEY, OPENAI_API_KEY, and ANTHROPIC_API_KEY to your .env file.
 * Run with: node agent_demo/agentOrchestratorMultiProvider.mjs
 */

import process from 'process';

// Load environmental variables from .env
try {
  process.loadEnvFile('.env');
} catch (e) {
  // Ignore if .env doesn't exist
}

// Read API keys
const KEYS = {
  gemini: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};

/**
 * Registry defining which Agent uses which Provider and Model.
 * This is the core of our token and cost optimization strategy.
 */
const AGENT_REGISTRY = {
  router: {
    name: 'Router Agent',
    provider: 'gemini',
    model: 'gemini-2.5-flash', // Flash is cheapest and fastest for routing
    systemInstruction: `You are the Router Agent. Analyze the user request and delegate it to the best agent.
Respond ONLY with a JSON object in this format:
{
  "targetAgent": "ui_designer" | "coder" | "unknown",
  "refinedPrompt": "The specific task instructions for the specialist agent."
}

Available Agents:
- "ui_designer": For requests about UI design, components layout, colors, UX and CSS styling.
- "coder": For requests about programming logic, refactoring, algorithms, database operations, or bug fixing.
- "unknown": If the task does not fit either.`
  },
  ui_designer: {
    name: 'UI/UX Design Specialist',
    provider: 'gemini', 
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are a UI/UX design expert. You design modern, beautiful, and accessible web components. Focus on styling and user experience.'
  },
  coder: {
    name: 'Software Engineer Specialist',
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    systemInstruction: 'You are an elite Software Engineer. You write clean, performant, and well-structured code. Follow clean code principles.'
  }
};

/**
 * Unified API Call Handler
 */
async function callLLM(agentKey, promptText) {
  const agent = AGENT_REGISTRY[agentKey];
  if (!agent) throw new Error(`Agent ${agentKey} not found.`);

  const key = KEYS[agent.provider];
  if (!key) {
    console.warn(`[Warning] API key for provider "${agent.provider}" is missing. Execution might fail.`);
  }

  console.log(`[${agent.name}] Forwarding to [${agent.provider.toUpperCase()} : ${agent.model}]...`);

  switch (agent.provider) {
    case 'gemini':
      return await callGeminiAPI(agent.model, agent.systemInstruction, promptText, key);
    case 'openai':
      return await callOpenAIAPI(agent.model, agent.systemInstruction, promptText, key);
    case 'anthropic':
      return await callAnthropicAPI(agent.model, agent.systemInstruction, promptText, key);
    default:
      throw new Error(`Unsupported provider: ${agent.provider}`);
  }
}

/**
 * Call Gemini API using native fetch
 */
async function callGeminiAPI(model, systemInstruction, prompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] }
    })
  });
  if (!response.ok) throw new Error(`Gemini API Error: ${await response.text()}`);
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Call OpenAI API using native fetch
 */
async function callOpenAIAPI(model, systemInstruction, prompt, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`OpenAI API Error: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Call Anthropic API using native fetch
 */
async function callAnthropicAPI(model, systemInstruction, prompt, apiKey) {
  const url = 'https://api.anthropic.com/v1/messages';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 4000,
      system: systemInstruction,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!response.ok) throw new Error(`Anthropic API Error: ${await response.text()}`);
  const data = await response.json();
  return data.content[0].text;
}

/**
 * Orchestrator Flow
 */
export async function orchestrateTask(userQuery) {
  console.log(`\nUser Task: "${userQuery}"`);
  console.log('--------------------------------------------------');

  // Step 1: Route query using Gemini Flash (Cheap & Fast)
  let routingResultText;
  try {
    routingResultText = await callLLM('router', userQuery);
  } catch (error) {
    console.error('Routing failed:', error.message);
    return;
  }

  // Parse routing decision
  let routing;
  try {
    const cleanText = routingResultText.replace(/```json/i, '').replace(/```/g, '').trim();
    routing = JSON.parse(cleanText);
    console.log(`Routing Result:`, JSON.stringify(routing, null, 2));
  } catch (e) {
    console.error('Failed to parse router output:', routingResultText);
    return;
  }

  const targetAgent = routing.targetAgent;
  const refinedPrompt = routing.refinedPrompt;

  if (targetAgent === 'unknown' || !AGENT_REGISTRY[targetAgent]) {
    console.log('[System] Could not assign specialist. Running general response fallback...');
    return;
  }

  // Step 2: Delegate to selected specialist (OpenAI or Anthropic)
  console.log(`\nDelegating to Specialist: ${AGENT_REGISTRY[targetAgent].name}`);
  try {
    const output = await callLLM(targetAgent, refinedPrompt);
    console.log(`\n================= RESPONSE =================`);
    console.log(output);
    console.log(`============================================\n`);
  } catch (error) {
    console.error(`Execution failed for ${targetAgent}:`, error.message);
    console.log('\n[Suggestion] Ensure you have set the correct API keys in your .env file.');
  }
}

// Self-test block
if (process.argv[1] && process.argv[1].endsWith('agentOrchestratorMultiProvider.mjs')) {
  // Scenario 1: UI Request
  console.log('\n--- SCENARIO 1: UI Design Request ---');
  await orchestrateTask("ออกแบบปุ่มและหน้าจอสำหรับประวัติการเคลื่อนไหวสต๊อกยา (Stock Movement History) ของแอป RKHSTOCK ให้ดูล้ำสมัยและสวยงาม");

  // Scenario 2: Coding Request
  console.log('\n--- SCENARIO 2: Complex Logic Request ---');
  await orchestrateTask("ช่วยเขียนฟังก์ชันคำนวณ FEFO (First-Expire, First-Out) ใน TypeScript สำหรับตัดสต๊อกยาตามวันหมดอายุของ Lot ต่างๆ");
}
