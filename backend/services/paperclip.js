import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import cron from 'node-cron'
import { supabase } from '../server.js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── Paperclip Agent Registry ─────────────────────────────
class PaperclipManager {
  constructor() {
    this.agents = new Map() // userId -> Map(agentId, agent)
    this.tasks = new Map()  // taskId -> task
    this.running = false
  }

  // Initialize all active agents from database
  async initializeAgents() {
    const { data: agents } = await supabase
      .from('paperclip_agents')
      .select('*')
      .eq('is_active', true)

    for (const agent of agents || []) {
      this.registerAgent(agent)
    }
  }

  // Register an agent in memory
  registerAgent(agent) {
    if (!this.agents.has(agent.user_id)) {
      this.agents.set(agent.user_id, new Map())
    }
    this.agents.get(agent.user_id).set(agent.id, agent)
  }

  // Get all agents for a user
  getUserAgents(userId) {
    return this.agents.get(userId) || new Map()
  }

  // Create and schedule heartbeat task for an agent
  async scheduleHeartbeat(agent) {
    const task = {
      agent_id: agent.id,
      user_id: agent.user_id,
      task_type: 'heartbeat',
      task_name: 'daily_checkin',
      payload: {},
      scheduled_for: new Date(),
    }

    const { data } = await supabase
      .from('agent_tasks')
      .insert(task)
      .select()
      .single()

    return data
  }

  // Process pending tasks
  async processTasks() {
    const { data: tasks } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50)

    for (const task of tasks || []) {
      // Atomic checkout
      const { data: updated } = await supabase
        .from('agent_tasks')
        .update({
          status: 'processing',
          checked_out_at: new Date().toISOString(),
          checked_out_by: process.env.WORKER_ID || 'worker-1',
        })
        .eq('id', task.id)
        .eq('status', 'pending')
        .select()
        .single()

      if (!updated) continue // Already taken by another worker

      try {
        await this.executeTask(updated)
      } catch (err) {
        console.error(`Task ${updated.id} failed:`, err)
        await supabase
          .from('agent_tasks')
          .update({
            status: 'failed',
            error: err.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', updated.id)
      }
    }
  }

  // Execute a single task
  async executeTask(task) {
    const agent = this.getAgent(task.agent_id)
    if (!agent) throw new Error('Agent not found')

    let result = {}

    switch (task.task_name) {
      case 'daily_checkin':
        result = await this.executeHeartbeat(agent, task)
        break
      case 'market_alert':
        result = await this.executeMarketAlert(agent, task)
        break
      default:
        result = { message: 'Unknown task type' }
    }

    // Mark task as done
    await supabase
      .from('agent_tasks')
      .update({
        status: 'done',
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', task.id)

    // Update agent heartbeat
    await supabase
      .from('paperclip_agents')
      .update({
        last_heartbeat: new Date().toISOString(),
        heartbeat_count: agent.heartbeat_count + 1,
      })
      .eq('id', agent.id)
  }

  // Execute heartbeat task
  async executeHeartbeat(agent, task) {
    const prompt = this.buildHeartbeatPrompt(agent)
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    return {
      response: response.content[0].text,
      timestamp: new Date().toISOString(),
    }
  }

  // Build heartbeat prompt
  buildHeartbeatPrompt(agent) {
    return `
You are ${agent.agent_role}, working for user ID: ${agent.user_id}.

Your goal: ${agent.agent_goal}

Current state: ${JSON.stringify(agent.state || {})}

Please:
1. Check if any action is needed based on your goal
2. Update your state if necessary
3. Respond with your status and any recommendations

Keep it concise and actionable.
`.trim()
  }

  // Get agent by ID
  getAgent(agentId) {
    for (const userAgents of this.agents.values()) {
      if (userAgents.has(agentId)) {
        return userAgents.get(agentId)
      }
    }
    return null
  }

  // Start the Paperclip engine
  start() {
    if (this.running) return
    this.running = true

    console.log('📋 Paperclip engine started')

    // Process tasks every minute
    cron.schedule('* * * * *', async () => {
      if (!this.running) return
      await this.processTasks()
    })

    // Schedule daily heartbeats at 9 AM
    cron.schedule('0 9 * * *', async () => {
      if (!this.running) return
      await this.scheduleDailyHeartbeats()
    })
  }

  // Stop the Paperclip engine
  stop() {
    this.running = false
    console.log('📋 Paperclip engine stopped')
  }

  // Schedule daily heartbeats for all active agents
  async scheduleDailyHeartbeats() {
    const { data: agents } = await supabase
      .from('paperclip_agents')
      .select('*')
      .eq('is_active', true)

    for (const agent of agents || []) {
      await this.scheduleHeartbeat(agent)
    }
  }
}

// ── Export singleton instance ─────────────────────────────
const paperclipManager = new PaperclipManager()

export async function startPaperclip() {
  await paperclipManager.initializeAgents()
  paperclipManager.start()
}

export { paperclipManager }
