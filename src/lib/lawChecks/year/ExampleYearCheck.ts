// src/lib/lawChecks/year/ExampleYearCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * Example Year Plan Check
 * This is a template for creating checks specific to year plans
 */
export const exampleYearCheck: LawCheck = {
  id: 'example-year-check',
  name: 'Example Year Plan Check',
  description: 'This is an example check that only applies to year plans. Replace this with your actual check logic.',
  category: 'year',
  inputs: [
    {
      id: 'exampleParam',
      label: 'Example Parameter',
      type: 'number',
      defaultValue: 52,
      min: 1,
      max: 52,
      step: 1,
      unit: 'weeks'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const exampleParam = (inputs.exampleParam as number) || 52
    
    // Your check logic goes here
    // This is just a placeholder that always passes
    
    const result: LawCheckResult = {
      status: 'pass',
      message: `Example year plan check passed with parameter: ${exampleParam}`,
      details: [
        'This is an example check for year plans',
        'Replace with your actual logic',
        `Plan duration: ${plan.duration_weeks} weeks`,
        `Total rotations: ${rotations.length}`
      ],
      violations: []
    }

    return result
  }
}