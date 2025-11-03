// src/components/pricing/FeatureComparison.tsx
'use client'

interface Feature {
  name: string
  description?: string
  pro: boolean | string
  premium: boolean | string
}

const features: Feature[] = [
  {
    name: 'Ubegrensa turnusplanar',
    pro: true,
    premium: true,
  },
  {
    name: 'Automatisk lovkontroll (AML)',
    description: 'Sjekk om planen din følgjer Arbeidsmiljølova',
    pro: true,
    premium: true,
  },
  {
    name: 'Eksport til PDF og Excel',
    pro: true,
    premium: true,
  },
  {
    name: 'Rotation-mønster',
    description: 'Definer ein gjentagande mønster for vaktene',
    pro: true,
    premium: true,
  },
  {
    name: 'Statistikk og rapportar',
    pro: true,
    premium: true,
  },
  {
    name: 'Mobilapp (iOS & Android)',
    pro: true,
    premium: true,
  },
  {
    name: 'AI: Last opp PDF → Auto-generert plan',
    description: 'Last opp din noverande plan som PDF, AI ekstraher og lagar plan',
    pro: false,
    premium: true,
  },
  {
    name: 'AI: Smarte forbetringsforslag',
    description: 'AI analyserer planen og gir konkrete forslag til forbetringar',
    pro: false,
    premium: true,
  },
  {
    name: 'AI: Automatisk fylle rotation',
    description: 'AI fyller automatisk inn vaktar basert på rotation-mønster',
    pro: false,
    premium: true,
  },
  {
    name: 'AI: Personaliserte anbefallingar',
    description: 'AI lærer dine preferansar og gir skreddarsydde forslag',
    pro: false,
    premium: true,
  },
  {
    name: 'Prioritert support',
    pro: 'Standard',
    premium: 'Prioritert',
  },
]

export default function FeatureComparison() {
  const renderValue = (value: boolean | string) => {
    if (value === true) {
      return (
        <svg
          className="w-6 h-6 text-green-600 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      )
    }
    if (value === false) {
      return (
        <svg
          className="w-6 h-6 text-gray-300 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      )
    }
    return (
      <span className="text-sm text-gray-600 font-medium">{value}</span>
    )
  }

  return (
    <div className="max-w-4xl mx-auto mt-16">
      <h2 className="text-3xl font-bold text-center mb-8">
        Samanlikning av funksjonar
      </h2>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                Funksjon
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                Pro
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 bg-red-50">
                Premium
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {features.map((feature, idx) => (
              <tr
                key={idx}
                className={feature.name.startsWith('AI:') ? 'bg-red-50/30' : ''}
              >
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {feature.name}
                    </div>
                    {feature.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {feature.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  {renderValue(feature.pro)}
                </td>
                <td className="px-6 py-4 text-center bg-red-50/50">
                  {renderValue(feature.premium)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">
              Kvifor velje Premium?
            </h3>
            <p className="text-sm text-blue-800">
              Premium er perfekt for deg som vil spare tid og få ei betre plan. 
              I staden for å manuelt legge inn alle vakter, kan du laste opp din 
              noverande plan som PDF, og AI lagar automatisk ein digital versjon. 
              Du får også smarte forslag til korleis du kan forbetre planen din 
              for å følgje lova betre og få betre balanse i livet.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}