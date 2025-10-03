# Law Checks

This directory contains all law compliance checks for the nurse scheduling application.

## Structure

All law checks are stored in this single directory (`/lib/lawChecks/`). Each check is in its own file and follows the `LawCheck` interface.

## Creating a New Check

1. Create a new file in this directory (e.g., `MyNewCheck.ts`)
2. Import necessary types
3. Export your check following this template:

```typescript
// src/lib/lawChecks/MyNewCheck.ts

import { LawCheck, LawCheckResult } from '@/types/lawCheck'
import { Rotation } from '@/types/rotation'
import { Shift } from '@/types/shift'

export const myNewCheck: LawCheck = {
  id: 'my-new-check',
  name: 'My New Check Name',
  description: 'Description of what this check does',
  category: 'main', // 'main', 'helping', 'year', or 'shared'
  lawType: 'aml', // 'aml' or 'hta'
  lawReferences: [ // Optional: Link to official laws
    {
      title: 'AML §10-8',
      url: 'https://lovdata.no/...'
    }
  ],
  applicableTo: ['main', 'helping', 'year'], // For shared checks only
  inputs: [ // Optional: User-configurable parameters
    {
      id: 'myParam',
      label: 'My Parameter',
      type: 'number',
      defaultValue: 10,
      min: 1,
      max: 100,
      step: 1,
      unit: 'hours'
    }
  ],
  
  run: ({ rotations, shifts, plan, inputs = {} }) => {
    const myParam = (inputs.myParam as number) || 10
    
    const result: LawCheckResult = {
      status: 'pass', // 'pass', 'fail', 'warning', or 'not_run'
      message: 'Check passed',
      details: [
        'Detail 1',
        'Detail 2'
      ],
      violations: [] // Optional: Specific violations
    }

    // Your check logic here

    return result
  }
}
```

4. Add your check to `index.ts`:

```typescript
import { myNewCheck } from './MyNewCheck'

export const LAW_CHECKS: LawCheck[] = [
  f1RestPeriodCheck,
  myNewCheck, // Add here
]
```

## Check Categories

- **`main`**: Checks that only apply to main plans
- **`helping`**: Checks that only apply to helping plans  
- **`year`**: Checks that only apply to year plans
- **`shared`**: Checks that can apply to multiple plan types (use `applicableTo` array)

## Law Types

- **`aml`**: Arbeidsmiljøloven (Working Environment Act)
- **`hta`**: Hovedtariffavtalen (Main Collective Agreement)

## Input Types

Checks can have configurable inputs:

- **`number`**: Numeric input with min/max/step
- **`text`**: Text input
- **`boolean`**: Checkbox

## Result Status

- **`pass`**: Check passed without issues
- **`fail`**: Check found violations
- **`warning`**: Check found potential issues
- **`not_run`**: Check hasn't been executed yet

## Examples

See `F1RestPeriodCheck.ts` for a complete example of a shared check with configurable inputs and comprehensive violation tracking.

## Best Practices

1. **Clear naming**: Use descriptive IDs and names
2. **Helpful descriptions**: Explain what the check does
3. **Detailed results**: Provide specific details about violations
4. **Link to laws**: Include `lawReferences` when applicable
5. **Test thoroughly**: Verify your check works with edge cases
6. **Document inputs**: Explain what each parameter controls