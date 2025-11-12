// src/app/api/ai/improve-rotation/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

type AIModel = 'auto' | 'claude' | 'gpt4o' | 'gemini-flash' | 'gemini-pro'

// Shared prompt builder
function buildPrompt(userPrompt: string, planDetails: any, rotations: any[], shifts: any[], rules: any) {
  return `You are an expert in Norwegian healthcare shift scheduling and labor law (Arbeidsmiljøloven). 

**KRITISKE NORSKE TURNUSREGLAR:**

1. **Arbeidshelg-frekvens:**
   - Med vanlege vakter (7-7.5t): Arbeidshelg er typisk kvar 3. helg
   - Med langvakter (12.5t eller lengre): Arbeidshelg er typisk kvar 4. helg
   - Sjekk turnusen for å identifisere faktisk arbeidshelg-frekvens

2. **F1 (Fridag 1) plassering:**
   - F1 skal ALLTID ligge til søndag UNNTATT når det er arbeidshelg
   - Når det er arbeidshelg, skal F1 ikkje ligge til søndag
   - Dette er SVÆRT viktig for kviletid og helgestruktur

3. **Endringar som IKKJE tel:**
   - Å bytte ein vakt mot seg sjølv (eks: L1 → L1) er IKKJE ein endring
   - Dersom det ikkje er faktisk endring, skal det IKKJE bli nemnt i proposed_changes
   - Berre REELLE endringar skal rapporterast

4. **Reglar frå brukar:**
   - Kviletid før F1: ${rules?.rest_period_f1 || 35} timar (AML § 10-8 (5))
   - Kviletid mellom vakter: ${rules?.rest_between_shifts || 9} timar (AML § 10-8 (1))
   - Maks vaktlengde: ${rules?.max_shift_length || 12.5} timar (AML § 10-4 (2))

**User's request:**
${userPrompt}

**Current Plan Details:**
${JSON.stringify(planDetails, null, 2)}

**Current Rotation (all shifts):**
${JSON.stringify(rotations, null, 2)}

**Available Shifts:**
${JSON.stringify(shifts, null, 2)}

**Your task:**
Analyze the current rotation and propose specific changes to meet the user's request. 

**VIKTIG ANALYSESTEG:**
1. Identifiser arbeidshelg-frekvens (kvar 3. eller 4. helg)
2. Sjekk at F1 ligg riktig i forhold til arbeidshelg
3. Identifiser BERRE reelle endringar (ikkje L1→L1 osv)
4. Følg brukar sine reglar for kviletid og vaktlengde
5. Respekter norsk arbeidsmiljølov og tariffavtalar

**Return your response as JSON in this exact format:**

{
  "summary": "Brief summary of what changes you're proposing in Norwegian (Nynorsk preferred). Mention arbeidshelg-frekvens if relevant.",
  "changes_count": 5,
  "improvements": [
    "Improvement 1 description in Norwegian",
    "Improvement 2 description in Norwegian"
  ],
  "proposed_changes": [
    {
      "week_index": 0,
      "day_of_week": 0,
      "current_shift_id": "shift-id-or-null",
      "proposed_shift_id": "new-shift-id-or-null",
      "reason": "Brief reason for this change in Norwegian"
    }
  ],
  "new_rotation": [
    {
      "week_index": 0,
      "day_of_week": 0,
      "shift_id": "shift-id-or-null",
      "overlay_shift_id": null,
      "overlay_type": null
    }
  ]
}

**Important guidelines:**
- Write all text in Norwegian (Nynorsk if possible, otherwise Bokmål)
- ONLY propose changes that directly address the user's request
- Use shift IDs from the available shifts list
- If proposing to remove a shift, use null for proposed_shift_id
- If adding a shift to an empty day, use null for current_shift_id
- Be specific about which week and day you're changing
- Provide clear reasons for each change
- Consider the entire rotation pattern, not just individual days
- The new_rotation array should contain the COMPLETE updated rotation (all weeks, all days)
- Include entries for empty days with shift_id: null
- NEVER include changes where current and proposed are identical
- Mention arbeidshelg pattern if it affects F1 placement
- Return ONLY valid JSON, no other text`
}

async function callClaude(prompt: string) {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' 
    ? message.content[0].text 
    : ''

  return {
    responseText,
    tokensUsed: message.usage.input_tokens + message.usage.output_tokens
  }
}

async function callGPT4o(prompt: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 16000,
  })

  return {
    responseText: response.choices[0].message.content || '',
    tokensUsed: response.usage?.total_tokens || 0
  }
}

async function callGemini(prompt: string, model: 'gemini-2.0-flash-exp' | 'gemini-2.5-pro') {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
  
  const geminiModel = genAI.getGenerativeModel({ 
    model,
    generationConfig: {
      responseMimeType: 'application/json'
    }
  })

  const result = await geminiModel.generateContent(prompt)
  const responseText = result.response.text()

  return {
    responseText,
    tokensUsed: 0 // Gemini doesn't provide token counts in the same way
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
    const { planId, userPrompt, rotations, shifts, planDetails, rules, aiModel } = await request.json()

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

    // Build the prompt
    const prompt = buildPrompt(userPrompt, planDetails, rotations, shifts, rules)

    // Determine which model to use
    let selectedModel: AIModel = aiModel || 'auto'
    if (selectedModel === 'auto') {
      // Default to Claude for Norwegian labor law understanding
      selectedModel = 'claude'
    }

    console.log(`🤖 Calling ${selectedModel} for rotation improvements...`)
    const startTime = Date.now()

    let responseText = ''
    let tokensUsed = 0
    let actualModel = selectedModel

    try {
      switch (selectedModel) {
        case 'claude':
          if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('Claude API key ikkje konfigurert')
          }
          const claudeResult = await callClaude(prompt)
          responseText = claudeResult.responseText
          tokensUsed = claudeResult.tokensUsed
          actualModel = 'claude'
          break

        case 'gpt4o':
          if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key ikkje konfigurert')
          }
          const gptResult = await callGPT4o(prompt)
          responseText = gptResult.responseText
          tokensUsed = gptResult.tokensUsed
          actualModel = 'gpt4o'
          break

        case 'gemini-flash':
          if (!process.env.GOOGLE_AI_API_KEY) {
            throw new Error('Google AI API key ikkje konfigurert')
          }
          const geminiFlashResult = await callGemini(prompt, 'gemini-2.0-flash-exp')
          responseText = geminiFlashResult.responseText
          tokensUsed = geminiFlashResult.tokensUsed
          actualModel = 'gemini-flash'
          break

        case 'gemini-pro':
          if (!process.env.GOOGLE_AI_API_KEY) {
            throw new Error('Google AI API key ikkje konfigurert')
          }
          const geminiProResult = await callGemini(prompt, 'gemini-2.5-pro')
          responseText = geminiProResult.responseText
          tokensUsed = geminiProResult.tokensUsed
          actualModel = 'gemini-pro'
          break

        default:
          throw new Error('Ugyldig AI-modell valgt')
      }
    } catch (error) {
      console.error(`❌ Error with ${selectedModel}:`, error)
      
      // If selected model fails and it's not Claude, fallback to Claude
      if (selectedModel !== 'claude' && process.env.ANTHROPIC_API_KEY) {
        console.log('🔄 Falling back to Claude...')
        const claudeResult = await callClaude(prompt)
        responseText = claudeResult.responseText
        tokensUsed = claudeResult.tokensUsed
        actualModel = 'claude'
      } else {
        throw error
      }
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✅ ${actualModel} responded in ${elapsedTime}s`)

    // Extract JSON from response
    let jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Try to find JSON in code blocks
      const codeBlockMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/)
      if (codeBlockMatch) {
        jsonMatch = [codeBlockMatch[1]]
      }
    }
    
    if (!jsonMatch) {
      throw new Error('Kunne ikkje ekstrahere JSON frå AI sitt svar')
    }

    const improvements = JSON.parse(jsonMatch[0])

    // Filter out non-changes (where current_shift_id === proposed_shift_id)
    if (improvements.proposed_changes) {
      improvements.proposed_changes = improvements.proposed_changes.filter(
        (change: any) => change.current_shift_id !== change.proposed_shift_id
      )
      improvements.changes_count = improvements.proposed_changes.length
    }

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: `rotation_improvements_${actualModel}`,
      tokens_used: tokensUsed,
    })

    return NextResponse.json({
      success: true,
      ai_model: actualModel,
      data: improvements,
    })

  } catch (error) {
    console.error('💥 Rotation improvements error:', error)
    return NextResponse.json(
      { 
        error: 'Kunne ikkje generere forbetringsforslag', 
        details: error instanceof Error ? error.message : 'Ukjend feil' 
      },
      { status: 500 }
    )
  }
}