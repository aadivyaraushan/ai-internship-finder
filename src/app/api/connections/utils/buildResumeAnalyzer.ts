export function buildResumeAspectAnalyzerPrompt(resumeContext: string) {
  return `<system>You are an agent specialized in analyzing resumes and career goals to find key aspects for networking connections. You MUST return ONLY valid JSON matching the schema below EXACTLY. Do not include any other text or explanation.</system>
<input>
Resume Content:
${resumeContext}
</input>
<rules>
1. Extract ALL information that could create meaningful connections, considering BOTH resume AND career goals:
   - Educational institutions, years, fields of study
   - Companies worked at (especially startups/small firms). Personal projects do NOT count here. 
   - Personal projects created. These are MUTUALLY EXCLUSIVE from companies worked in — a personal project is NOT a company. 
   - ALL clubs, organizations, and activities mentioned
   - ALL certifications and awards listed
   - Career transitions or pivots mentioned
   - Areas where the candidate shows interest in growth
   - Skills and experiences that align with stated career goals
2. For each aspect found:
   - Include EXACT names as they appear in the resume or goals
   - Include ALL instances found, not just the most recent
   - If a field has no information, use empty array [] or empty string ""
   - For growth areas, consider both current skills and goal aspirations
3. NEVER skip or omit information found in either resume or goals
4. ALWAYS return ALL fields in the schema, even if empty
5. Pay special attention to:
   - Skills mentioned in goals that relate to resume experience
   - Industries/sectors from goals that match resume background
   - Career transitions indicated by goals vs current experience
6. For education level:
   - Determine based on current or most recent education
   - "high_school" if in or recently completed high school
   - "undergraduate" if in or recently completed bachelor's degree
   - "graduate" if in or completed master's/PhD
   - If unclear, infer from context (age, work experience, etc.)
</rules>
`;
}
