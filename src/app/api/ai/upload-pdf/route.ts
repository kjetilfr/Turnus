// src/app/api/ai/upload-pdf/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get the uploaded PDF file
  const formData = await request.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  // Convert PDF to base64 for Claude
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  // Send to Claude for extraction
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Analyze this Norwegian turnusplan (shift schedule) PDF.

Extract all shifts and return as JSON in this exact format:

{
  "plan_name": "Name of the turnusplan",
  "start_date": "YYYY-MM-DD",
  "shifts": [
    {
      "date": "YYYY-MM-DD",
      "shift_type": "D" | "A" | "N" | "F",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "hours": 7.5
    }
  ]
}

Shift types:
- D = Dag (day shift, usually 07:00-15:00)
- A = Aften (evening shift, usually 15:00-23:00)
- N = Natt (night shift, usually 23:00-07:00)
- F = Fri (day off)

Return ONLY the JSON, no other text.`,
          },
        ],
      },
    ],
  })

  // Parse Claude's response
  const responseText = message.content[0].type === 'text' 
    ? message.content[0].text 
    : ''

  const extracted = JSON.parse(responseText)

  return NextResponse.json({
    success: true,
    data: extracted,
  })
}