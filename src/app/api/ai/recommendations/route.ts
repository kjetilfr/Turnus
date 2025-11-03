// src/app/api/ai/recommendations/route.ts
export async function POST(request: Request) {
  const { planId } = await request.json()
  
  // Get plan data
  const { data: plan } = await supabase
    .from('plans')
    .select('*, shifts(*)')
    .eq('id', planId)
    .single()

  // Get law check results
  const { data: checks } = await supabase
    .from('law_checks')
    .select('*')
    .eq('plan_id', planId)

  // Send to Claude for recommendations
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Analyze this Norwegian turnusplan and suggest improvements.

Current plan:
${JSON.stringify(plan, null, 2)}

Law check results (violations):
${JSON.stringify(checks.filter(c => !c.compliant), null, 2)}

User preferences:
- Minimize night shifts
- Prefer weekends off
- Maximize consecutive days off

Provide recommendations in this JSON format:

{
  "recommendations": [
    {
      "issue": "Description of the problem",
      "severity": "high" | "medium" | "low",
      "suggestion": "How to fix it",
      "affected_dates": ["YYYY-MM-DD"],
      "proposed_changes": [
        {
          "date": "YYYY-MM-DD",
          "current_shift": "N",
          "proposed_shift": "F",
          "reason": "Reduces consecutive night shifts"
        }
      ]
    }
  ],
  "summary": {
    "total_issues": 5,
    "high_priority": 2,
    "estimated_improvement": "Reduces violations by 80%"
  }
}

Focus on:
1. Fixing law violations (AML, tariffavtale)
2. Improving work-life balance
3. Optimizing rest periods
4. Respecting user preferences

Return ONLY the JSON, no other text.`,
      },
    ],
  })

  const responseText = message.content[0].type === 'text' 
    ? message.content[0].text 
    : ''

  const recommendations = JSON.parse(responseText)

  // Store recommendations
  await supabase.from('ai_recommendations').insert({
    plan_id: planId,
    recommendations: recommendations,
    created_at: new Date().toISOString(),
  })

  return NextResponse.json({
    success: true,
    data: recommendations,
  })
}