// src/app/api/ai/improve-rotation/route.ts - FIXED: Only use selected model, no fallbacks
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Set max duration to 5 minutes for AI processing
export const maxDuration = 300

type AIModel = 'auto' | 'claude' | 'gpt4o' | 'gemini-flash' | 'gemini-pro'

interface SimplifiedRotation {
  w: number
  d: number
  s: string | null
  o: string | null
}

interface SimplifiedShift {
  id: string
  name: string
  start: string
  end: string
}

interface PlanDetails {
  name: string
  duration_weeks: number
  type: string
  work_percent?: number
  tariffavtale?: string
  date_started?: string
}

interface Rules {
  rest_period_f1?: number
  rest_between_shifts?: number
  max_shift_length?: number
}

interface ProposedChange {
  week_index: number
  day_of_week: number
  current_shift_id: string | null
  proposed_shift_id: string | null
  reason: string
}

interface ImprovementsResponse {
  summary: string
  changes_count: number
  improvements: string[]
  proposed_changes: ProposedChange[]
  new_rotation?: unknown[]
}

// Shared prompt builder - SIMPLIFIED to reduce token usage
function buildPrompt(
  userPrompt: string, 
  planDetails: PlanDetails, 
  rotations: { week_index: number; day_of_week: number; shift_id: string | null; overlay_shift_id: string | null }[], 
  shifts: { id: string; name: string; start_time: string; end_time: string }[], 
  rules: Rules
): string {
  // Calculate shift hours for the AI to use (before simplification)
  const calculateShiftHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0
    const start = startTime.split(':').map(Number)
    const end = endTime.split(':').map(Number)
    let hours = end[0] - start[0] + (end[1] - start[1]) / 60
    if (hours < 0) hours += 24 // Handle overnight shifts
    return hours
  }

  const shiftHoursMap: Record<string, number> = {}
  shifts.forEach(s => {
    shiftHoursMap[s.id] = calculateShiftHours(s.start_time, s.end_time)
  })

  // Calculate current total hours
  const currentTotalHours = rotations.reduce((sum, r) => {
    if (r.shift_id && shiftHoursMap[r.shift_id]) {
      return sum + shiftHoursMap[r.shift_id]
    }
    return sum
  }, 0)

  return `You are an expert in Norwegian healthcare shift scheduling and labor law (Arbeidsmiljøloven). 

**KRITISKE NORSKE TURNUSREGLAR:**

1. **Arbeidshelg-definisjon:**
   - Ein arbeidshelg består av ALLE TRE dagane: fredag, laurdag OG søndag
   - Dersom du flyttar arbeidshelg, må du flytte ALLE tre dagane (fredag, laurdag, søndag)
   - Med vanlege vakter (7-7.5t): Arbeidshelg er typisk kvar 3. helg
   - Med langvakter (12.5t eller lengre): Arbeidshelg er typisk kvar 4. helg

2. **Vakttypar:**
   - Vanlege vakter: 7-7.5 timar
   - Nattevakter: Vakter som krysser midnatt (t.d. 23:00-07:00)
   - Langvakter: 12.5 timar eller meir

3. **F1 (Fridag 1) plassering:**
   - F1 skal ALLTID ligge til søndag
   - UNNTAKET: Når det er arbeidshelg (fredag+laurdag+søndag med vakter) skal F1 IKKJE ligge til søndag
   - Dette er SVÆRT viktig for kviletid og helgestruktur

4. **Reglar frå brukar:**
   - Kviletid før F1: ${rules?.rest_period_f1 || 35} timar (AML § 10-8 (5))
   - Kviletid mellom vakter: ${rules?.rest_between_shifts || 11} timar (AML § 10-8 (1))
   - Maks vaktlengde: ${rules?.max_shift_length || 12.5} timar (AML § 10-4 (2))

**User's request:**
${userPrompt}

**Current Plan:**
Name: ${planDetails.name}
Duration: ${planDetails.duration_weeks} weeks
Type: ${planDetails.type}
Current total hours: ${currentTotalHours.toFixed(1)} hours

**Current Rotation (w=week, d=day, s=shift_id, o=overlay):**
${JSON.stringify(rotations.map(r => ({
  w: r.week_index,
  d: r.day_of_week,
  s: r.shift_id,
  o: r.overlay_shift_id
}))).slice(0, 3000)}

**Available Shifts with hours:**
${JSON.stringify(shifts.map(s => ({ 
  id: s.id, 
  name: s.name, 
  start: s.start_time, 
  end: s.end_time,
  hours: shiftHoursMap[s.id] 
})))}

**CRITICAL INSTRUCTIONS:**

1. **IDENTIFY RECURRING PATTERNS:** 
   - If a problem occurs in week X, check if the same pattern repeats in other weeks
   - The rotation typically has a pattern that repeats (e.g., every 4 weeks, every 12 weeks)
   - You MUST fix ALL occurrences of the problem, not just one instance
   - For a ${planDetails.duration_weeks}-week plan, look for patterns that repeat throughout

2. **ARBEIDSHELG FLYTTING:**
   - Dersom du må flytte ein arbeidshelg, må du flytte ALLE TRE dagane
   - Ein arbeidshelg = fredag + laurdag + søndag (alle tre må ha vakter)
   - Eksempel: Dersom du flyttar arbeidshelg frå veke 2 til veke 3, må du:
     * Fjerne vakter på fredag, laurdag OG søndag i veke 2
     * Legge til vakter på fredag, laurdag OG søndag i veke 3

3. **MAINTAIN TOTAL WORKING HOURS:**
   - Current total hours: ${currentTotalHours.toFixed(1)} hours
   - When changing a 7.5h shift to 12.5h shift (+5h), you MUST remove 5h elsewhere
   - When changing a 12.5h shift to 7.5h shift (-5h), you MUST add 5h elsewhere
   - The final total hours MUST be approximately the same (within ±2 hours)
   - Options to balance hours:
     * Remove a short shift elsewhere in the same week or nearby
     * Change a long shift to a shorter one
     * Remove a shift entirely (set to null)
   - ALWAYS include compensating changes to balance the hours

4. **ANALYZE THE FULL ROTATION:**
   - Look at the ENTIRE ${planDetails.duration_weeks}-week rotation
   - Count how many times the problem occurs
   - Fix every instance of the problem
   - Remember: F1 skal alltid ligge til søndag UTANOM arbeidshelger

**CRITICAL: Return ONLY valid JSON. No markdown, no extra text.**

Required JSON structure:
{
  "summary": "Brief summary in Norwegian mentioning how many weeks were affected",
  "changes_count": 0,
  "improvements": ["List of benefits in Norwegian"],
  "proposed_changes": [
    {
      "week_index": 0,
      "day_of_week": 0,
      "current_shift_id": "uuid-or-null",
      "proposed_shift_id": "uuid-or-null",
      "reason": "Reason in Norwegian (mention if this balances hours)"
    }
  ]
}

**IMPORTANT:**
- Return ONLY the JSON object
- Do NOT include "new_rotation" field (too large)
- Only include changes that differ from current
- Include ALL instances of recurring problems
- ALWAYS include hour-balancing changes when you change shift lengths
- In your summary, mention: "Endra X veker" or "Fann Y tilfelle av problemet"
- Maximum 50 proposed_changes (increased from 20 to handle recurring patterns)
`
}

// Helper to attempt JSON repair for truncated responses
function attemptJSONRepair(text: string): ImprovementsResponse | null {
  try {
    // Try direct parse first
    return JSON.parse(text) as ImprovementsResponse
  } catch (e) {
    // Try to find complete JSON objects
    const jsonMatch = text.match(/\{[\s\S]*?\}(?=\s*$)/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as ImprovementsResponse
      } catch (e2) {
        // Try to repair truncated JSON
        let cleaned = text.trim()
        
        // Remove any trailing incomplete strings
        cleaned = cleaned.replace(/,\s*"[^"]*$/, '')
        
        // Close any open objects/arrays
        const openBraces = (cleaned.match(/\{/g) || []).length
        const closeBraces = (cleaned.match(/\}/g) || []).length
        const openBrackets = (cleaned.match(/\[/g) || []).length
        const closeBrackets = (cleaned.match(/\]/g) || []).length
        
        for (let i = 0; i < openBrackets - closeBrackets; i++) {
          cleaned += ']'
        }
        for (let i = 0; i < openBraces - closeBraces; i++) {
          cleaned += '}'
        }
        
        try {
          return JSON.parse(cleaned) as ImprovementsResponse
        } catch (e3) {
          return null
        }
      }
    }
  }
  return null
}

async function callClaude(prompt: string, retryCount = 0): Promise<{ responseText: string; tokensUsed: number }> {
  const maxRetries = 2
  
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120000,
      maxRetries: 2,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    return {
      responseText,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens
    }
  } catch (error) {
    console.error(`Claude attempt ${retryCount + 1} failed:`, error)
    
    if (retryCount < maxRetries) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000)
      console.log(`Retrying Claude in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return callClaude(prompt, retryCount + 1)
    }
    
    throw error
  }
}

async function callGPT4o(prompt: string, retryCount = 0): Promise<{ responseText: string; tokensUsed: number }> {
  const maxRetries = 2
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 120000,
      maxRetries: 2,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.7,
    })

    return {
      responseText: response.choices[0].message.content || '',
      tokensUsed: response.usage?.total_tokens || 0
    }
  } catch (error) {
    console.error(`GPT-4o attempt ${retryCount + 1} failed:`, error)
    
    if (retryCount < maxRetries) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000)
      console.log(`Retrying GPT-4o in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return callGPT4o(prompt, retryCount + 1)
    }
    
    throw error
  }
}

async function callGemini(
  prompt: string, 
  model: 'gemini-2.0-flash-exp' | 'gemini-2.5-flash' | 'gemini-2.5-pro', 
  retryCount = 0
): Promise<{ responseText: string; tokensUsed: number }> {
  const maxRetries = 2
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
    
    const geminiModel = genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 4096,
      }
    })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Gemini timeout')), 120000)
    })

    const result = await Promise.race([
      geminiModel.generateContent(prompt),
      timeoutPromise
    ])

    // Type guard for result
    if (!result || typeof result !== 'object' || !('response' in result)) {
      throw new Error('Invalid Gemini response')
    }

    const responseText = (result as { response: { text: () => string } }).response.text()

    return {
      responseText,
      tokensUsed: 0
    }
  } catch (error) {
    console.error(`Gemini ${model} attempt ${retryCount + 1} failed:`, error)
    
    const is503 = error instanceof Error && error.message.includes('503')
    const is429 = error instanceof Error && error.message.includes('429')
    const isTimeout = error instanceof Error && error.message.includes('timeout')
    
    if (retryCount < maxRetries && (is503 || is429 || isTimeout)) {
      const waitTime = Math.min(1000 * Math.pow(2, retryCount), 5000)
      console.log(`Retrying Gemini ${model} in ${waitTime}ms...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return callGemini(prompt, model, retryCount + 1)
    }
    
    throw error
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check Premium access
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  if (!subscription || subscription.tier !== 'premium' || subscription.status !== 'active') {
    return NextResponse.json(
      { error: 'Premium tier subscription required' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { planId, userPrompt, rotations, shifts, planDetails, rules, aiModel } = body

    if (!planId || !userPrompt || !rotations || !shifts || !planDetails) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify plan belongs to user
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('user_id')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Build the prompt with ORIGINAL data (not simplified)
    const prompt = buildPrompt(userPrompt, planDetails, rotations, shifts, rules)

    // Determine which model to use
    let selectedModel: AIModel = aiModel || 'auto'
    if (selectedModel === 'auto') {
      selectedModel = 'gpt4o' // Default to GPT-4o
    }

    console.log(`🤖 Using ${selectedModel} for rotation improvements...`)
    const startTime = Date.now()

    let responseText = ''
    let tokensUsed = 0

    // Call the selected model only - NO FALLBACKS
    try {
      switch (selectedModel) {
        case 'claude':
          if (!process.env.ANTHROPIC_API_KEY) {
            return NextResponse.json(
              { error: 'Claude API-nøkkel er ikkje konfigurert. Kontakt administrator.' },
              { status: 503 }
            )
          }
          const claudeResult = await callClaude(prompt)
          responseText = claudeResult.responseText
          tokensUsed = claudeResult.tokensUsed
          break

        case 'gpt4o':
          if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
              { error: 'OpenAI API-nøkkel er ikkje konfigurert. Kontakt administrator.' },
              { status: 503 }
            )
          }
          const gptResult = await callGPT4o(prompt)
          responseText = gptResult.responseText
          tokensUsed = gptResult.tokensUsed
          break

        case 'gemini-flash':
          if (!process.env.GOOGLE_AI_API_KEY) {
            return NextResponse.json(
              { error: 'Google AI API-nøkkel er ikkje konfigurert. Kontakt administrator.' },
              { status: 503 }
            )
          }
          const geminiFlashResult = await callGemini(prompt, 'gemini-2.0-flash-exp')
          responseText = geminiFlashResult.responseText
          tokensUsed = geminiFlashResult.tokensUsed
          break

        case 'gemini-pro':
          if (!process.env.GOOGLE_AI_API_KEY) {
            return NextResponse.json(
              { error: 'Google AI API-nøkkel er ikkje konfigurert. Kontakt administrator.' },
              { status: 503 }
            )
          }
          const geminiProResult = await callGemini(prompt, 'gemini-2.5-pro')
          responseText = geminiProResult.responseText
          tokensUsed = geminiProResult.tokensUsed
          break

        default:
          return NextResponse.json(
            { error: `Ukjend AI-modell: ${selectedModel}` },
            { status: 400 }
          )
      }
    } catch (error) {
      console.error(`❌ ${selectedModel} failed:`, error)
      
      // Return specific error message based on the error type
      let errorMessage = `${selectedModel.toUpperCase()} kunne ikkje generere svar.`
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage += ' Tidsavbrot (timeout).'
        } else if (error.message.includes('429')) {
          errorMessage += ' For mange førespurnader. Prøv igjen om litt.'
        } else if (error.message.includes('503')) {
          errorMessage += ' Tenesta er mellombels utilgjengeleg.'
        } else if (error.message.includes('401') || error.message.includes('403')) {
          errorMessage += ' API-nøkkel er ugyldig eller mangler tilgang.'
        } else {
          errorMessage += ` Feilmelding: ${error.message}`
        }
      }
      
      return NextResponse.json(
        { 
          error: errorMessage,
          model: selectedModel,
          details: error instanceof Error ? error.message : 'Ukjend feil'
        },
        { status: 500 }
      )
    }

    if (!responseText) {
      return NextResponse.json(
        { 
          error: `${selectedModel.toUpperCase()} returnerte eit tomt svar.`,
          model: selectedModel
        },
        { status: 500 }
      )
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ ${selectedModel} responded in ${elapsedTime}s`)
    console.log(`📊 Response length: ${responseText.length} characters`)

    // Extract and repair JSON
    let improvements: ImprovementsResponse | null = null

    // Strategy 1: Direct parse
    improvements = attemptJSONRepair(responseText)
    
    if (!improvements) {
      // Strategy 2: Extract from code blocks
      const codeBlockMatch = responseText.match(/```json?\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        improvements = attemptJSONRepair(codeBlockMatch[1].trim())
      }
    }
    
    if (!improvements) {
      console.error('Failed to parse response (first 800 chars):', responseText.substring(0, 800))
      console.error('Response end (last 200 chars):', responseText.substring(responseText.length - 200))
      return NextResponse.json(
        { 
          error: 'Kunne ikkje ekstrahere JSON frå AI sitt svar',
          model: selectedModel,
          rawResponse: responseText.substring(0, 500)
        },
        { status: 500 }
      )
    }

    console.log('✅ JSON parsed successfully')

    // Validate and fix the response structure
    if (!improvements.proposed_changes) {
      improvements.proposed_changes = []
    }

    // Filter out non-changes
    if (improvements.proposed_changes) {
      const originalCount = improvements.proposed_changes.length
      improvements.proposed_changes = improvements.proposed_changes.filter(
        (change: ProposedChange) => change.current_shift_id !== change.proposed_shift_id
      )
      const filteredCount = improvements.proposed_changes.length
      if (filteredCount < originalCount) {
        console.log(`🔍 Filtered out ${originalCount - filteredCount} non-changes`)
      }
      improvements.changes_count = improvements.proposed_changes.length
    }

    // Limit to 50 changes max (increased to handle recurring patterns)
    if (improvements.proposed_changes.length > 50) {
      console.log(`⚠️ Limiting changes from ${improvements.proposed_changes.length} to 50`)
      improvements.proposed_changes = improvements.proposed_changes.slice(0, 50)
      improvements.changes_count = 50
    }

    // Log hour balance analysis
    const shiftHours: Record<string, number> = {}
    shifts.forEach((s: { id: string; start_time: string; end_time: string }) => {
      if (!s.start_time || !s.end_time) {
        shiftHours[s.id] = 0
        return
      }
      const start = s.start_time.split(':').map(Number)
      const end = s.end_time.split(':').map(Number)
      let hours = end[0] - start[0] + (end[1] - start[1]) / 60
      if (hours < 0) hours += 24
      shiftHours[s.id] = hours
    })

    let totalHourChange = 0
    improvements.proposed_changes.forEach((change: ProposedChange) => {
      const currentHours = change.current_shift_id ? (shiftHours[change.current_shift_id] || 0) : 0
      const proposedHours = change.proposed_shift_id ? (shiftHours[change.proposed_shift_id] || 0) : 0
      totalHourChange += proposedHours - currentHours
    })

    console.log(`📊 Total hour change: ${totalHourChange > 0 ? '+' : ''}${totalHourChange.toFixed(1)}h`)
    
    if (Math.abs(totalHourChange) > 2) {
      console.warn(`⚠️ Warning: Large hour imbalance detected (${totalHourChange.toFixed(1)}h)`)
    }

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: `rotation_improvements_${selectedModel}`,
      tokens_used: tokensUsed,
    })

    return NextResponse.json({
      success: true,
      ai_model: selectedModel,
      data: improvements,
    })

  } catch (error) {
    console.error('💥 Rotation improvements error:', error)
    console.error('Error details:', error instanceof Error ? error.stack : error)
    
    return NextResponse.json(
      { 
        error: 'Kunne ikkje generere forbetringsforslag', 
        details: error instanceof Error ? error.message : 'Ukjend feil' 
      },
      { status: 500 }
    )
  }
}