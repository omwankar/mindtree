/** Whisper often mangles data-engineering terms. Fix before the LLM sees the question. */
export function clarifyInterviewerQuestion(raw: string): string {
  let t = raw.trim()
  if (!t) return t

  const replacements: [RegExp, string][] = [
    [/\ba\.?\s*d\.?\s*f\.?\b/gi, 'Azure Data Factory'],
    [/\bazure data factory\b/gi, 'Azure Data Factory'],
    [/\bdata verse\b/gi, 'Dataverse'],
    [/\bdataverse\b/gi, 'Dataverse'],
    [/\bdynamics three sixty five\b/gi, 'Dynamics 365'],
    [/\bdynamic 365\b/gi, 'Dynamics 365'],
    [/\bd 365\b/gi, 'Dynamics 365'],
    [/\bpower platform\b/gi, 'Power Platform'],
    [/\bdata lake\b/gi, 'ADLS'],
    [/\ba d l s\b/gi, 'ADLS'],
    [/\bpy spark\b/gi, 'PySpark'],
    [/\bdelta live tables?\b/gi, 'Delta Live Tables'],
    [/\bazure a\.?i\.? search\b/gi, 'Azure AI Search'],
    [/\bcognitive search\b/gi, 'Azure AI Search'],
    [/\be t l\b/gi, 'ETL'],
    [/\be l t\b/gi, 'ELT'],
    [/\bsynapse\b/gi, 'Synapse'],
    [/\bfabric\b/gi, 'Microsoft Fabric'],
    [/\bevent hubs?\b/gi, 'Event Hubs'],
    [/\bci[\s._-]?0+\s*2\s*5\s*\d*\b/gi, 'CI/CD'],
    [/\bci[\s._-]?0251\b/gi, 'CI/CD'],
    [/\bci[\s._-]cd\b/gi, 'CI/CD']
  ]

  for (const [re, to] of replacements) t = t.replace(re, to)
  return t.replace(/\s+/g, ' ').trim()
}

/** Drop lecture/hedge format if the model ignores the cue-card rules. */
export function normalizeInterviewAnswer(text: string): string {
  let out = text.replace(/\*\*Answer:\*\*\s*/gi, '').trim()

  const probe = out.search(/\n\s*\*\*If they probe:\*\*/i)
  if (probe !== -1) out = out.slice(0, probe).trim()

  const hedge =
    /^(sorry[^.!?\n]*[.!?]\s*)?(i didn't quite catch|i am not sure|i'm not sure|if you mean|i don't think there's)[\s\S]*?(?=\n- |\n\*\*Q:\*\*|\nCI\/CD|\nETL|$)/i
  out = out.replace(hedge, '').trim()

  out = out.replace(/^if you mean[^.!?\n]*[.!?]\s*/i, '').trim()

  return out
}
