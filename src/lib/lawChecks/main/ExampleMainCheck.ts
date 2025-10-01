// src/lib/lawChecks/main/ExampleMainCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * Example Main Plan Check
 * This is a template for creating checks specific to main plans
 */
export const exampleMainCheck: LawCheck = {
  id: 'example-main-check',
  name: 'Example Main Plan Check',
  description: 'This is an example check that only applies to main plans. Replace this with your actual check logic.',
  category: 'main',
  lawType: 'aml', // or 'hta'
  inputs: [
    {
      id: 'exampleParam',
      label: 'Example Parameter',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 50,
      step: 1,
      unit: 'units'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const exampleParam = (inputs.exampleParam as number) || 10
    
    // Your check logic goes here
    // This is just a placeholder that always passes
    
    const result: LawCheckResult = {
      status: 'pass',
      message: `Example check passed with parameter: ${exampleParam}`,
      details: [
        'This is an example check',
        'Replace with your actual logic',
        `Total rotations: ${rotations.length}`,
        `Total shifts: ${shifts.length}`
      ],
      violations: []
    }

    return result
  }
}