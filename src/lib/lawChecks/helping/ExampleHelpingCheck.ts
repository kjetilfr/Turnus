// src/lib/lawChecks/helping/ExampleHelpingCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

/**
 * Example Helping Plan Check
 * This is a template for creating checks specific to helping plans
 */
export const exampleHelpingCheck: LawCheck = {
  id: 'example-helping-check',
  name: 'Example Helping Plan Check',
  description: 'This is an example check that only applies to helping plans. Replace this with your actual check logic.',
  category: 'helping',
  lawType: 'aml', // or 'hta'
  inputs: [
    {
      id: 'exampleParam',
      label: 'Example Parameter',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 20,
      step: 1,
      unit: 'units'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const exampleParam = (inputs.exampleParam as number) || 5
    
    // Your check logic goes here
    // This is just a placeholder that always passes
    
    const result: LawCheckResult = {
      status: 'pass',
      message: `Example helping plan check passed with parameter: ${exampleParam}`,
      details: [
        'This is an example check for helping plans',
        'Replace with your actual logic',
        `Base plan ID: ${plan.base_plan_id || 'None'}`,
        `Total rotations: ${rotations.length}`
      ],
      violations: []
    }

    return result
  }
}