// src/app/api/ai/recommendations/route.ts - IMPROVED VERSION
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has Premium tier access
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

  const { planId } = await request.json()

  if (!planId) {
    return NextResponse.json({ error: 'Plan ID required' }, { status: 400 })
  }

  try {
    // Get plan data with all shifts
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select(`
        *,
        shifts (
          id,
          date,
          shift_type,
          start_time,
          end_time,
          hours
        )
      `)
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    // Verify plan belongs to user
    if (plan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get law check results if they exist
    const { data: checks } = await supabase
      .from('law_checks')
      .select('*')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
      .limit(1)

    // Send to Claude for recommendations
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are an expert in Norwegian labor law (Arbeidsmiljøloven) and healthcare shift scheduling. Analyze this turnusplan and provide detailed recommendations for improvement.

**Current Plan:**
Name: ${plan.name}
Period: ${plan.start_date} to ${plan.end_date}
Total shifts: ${plan.shifts?.length || 0}

**Shifts:**
${JSON.stringify(plan.shifts, null, 2)}

${checks && checks.length > 0 ? `**Law Check Results:**
${JSON.stringify(checks[0], null, 2)}` : ''}

**Your task:**
Analyze the plan for:
1. **Legal compliance** (AML §§10-2 to 10-12, Tariffavtale requirements)
   - Maximum working hours (average 48h/week, max 13h/day)
   - Minimum rest periods (11 consecutive hours daily)
   - Weekend work regulations
   - Night shift regulations (max 10 consecutive nights)
   - Consecutive working days (max 6)

2. **Health & wellbeing optimization**
   - Sleep disruption from shift changes
   - Recovery time between shifts
   - Work-life balance
   - Consecutive night shifts

3. **Schedule quality**
   - Fair distribution of undesirable shifts
   - Rotation pattern effectiveness
   - Predictability and stability

**Return recommendations as JSON:**

{
  "overall_score": 7.5,
  "summary": {
    "total_issues": 8,
    "critical_violations": 2,
    "improvements_possible": 6,
    "estimated_impact": "Vil redusere lovbrot med 90% og forbetre kvaliteten på planen"
  },
  "recommendations": [
    {
      "category": "legal_violation" | "health_concern" | "optimization",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "Kort tittel på problemet",
      "issue": "Detaljert forklaring av problemet på norsk",
      "law_reference": "AML §10-8 (hvis relevant)",
      "affected_dates": ["2025-01-15", "2025-01-16"],
      "suggestion": "Konkret forslag til løysing",
      "proposed_changes": [
        {
          "date": "2025-01-15",
          "current_shift": "N",
          "proposed_shift": "F",
          "reason": "Reduserer samanhengande nattevakter frå 8 til 5"
        }
      ],
      "impact": "Reduserer risiko for utbrentheit og lovbrot"
    }
  ]
}

**Important guidelines:**
- Write all text in Norwegian (Nynorsk if possible, otherwise Bokmål)
- Be specific about dates and shift types
- Reference actual Norwegian laws when applicable
- Provide actionable, concrete suggestions
- Prioritize legal violations highest
- Consider the healthcare context (patient safety, staff wellbeing)
- Return ONLY valid JSON, no other text`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : ''

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response')
    }

    const recommendations = JSON.parse(jsonMatch[0])

    // Track AI usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      feature_type: 'recommendations',
      tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    })

    // Store recommendations
    const { error: insertError } = await supabase
      .from('ai_recommendations')
      .insert({
        plan_id: planId,
        recommendations: recommendations,
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      console.error('Error storing recommendations:', insertError)
      // Don't fail the request if storage fails
    }

    return NextResponse.json({
      success: true,
      data: recommendations,
    })

  } catch (error) {
    console.error('Recommendations error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate recommendations', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}