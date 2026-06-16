/**
 * Interactive Multi-Agent Demo CLI
 * Allows you to run custom queries and see which agent they get routed to.
 *
 * Usage:
 * node agent_demo/interactive_demo.mjs "ของคุณที่ต้องการให้ AI ทำงาน"
 *
 * Example:
 * node agent_demo/interactive_demo.mjs "ช่วยออกแบบ Navbar แบบ Glassmorphism ให้หน่อย"
 */

import { orchestrateTask } from './agentOrchestratorMultiProvider.mjs';
import process from 'process';

const defaultQuery = "ช่วยออกแบบการ์ดแสดงผลสต๊อกยาต่ำ (Low Stock Alert Card) ที่ใช้ CSS สวยงาม";
const userQuery = process.argv.slice(2).join(' ') || defaultQuery;

console.log(`Starting Multi-Agent System...`);
await orchestrateTask(userQuery);
