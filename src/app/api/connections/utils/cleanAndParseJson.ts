import { extractFirstJSON } from './extractFirstJson';

// Utility function to clean and parse JSON responses
export function cleanAndParseJSON(raw: string) {
  console.log('\n🔍 Starting JSON parsing of raw response:', raw);

  if (!raw || typeof raw !== 'string') {
    console.error('❌ Invalid input to cleanAndParseJSON:', raw);
    return null;
  }

  try {
    // First, clean up any markdown or code block markers
    let cleaned = raw
      // Remove any markdown code block markers
      .replace(/```(?:json)?\s*|\s*```/g, '')
      // Remove any XML/HTML-like tags
      .replace(/<\/?[^>]+(>|$)/g, '')
      // Trim whitespace
      .trim();

    console.log('🧹 Initial cleaning:', cleaned);

    // Try direct parse first
    try {
      const direct = JSON.parse(cleaned);
      console.log('✅ Direct parse successful');
      return direct;
    } catch (directError) {
      console.log('⚠️ Direct parse failed, trying extraction:', directError);
    }

    // Extract the first JSON substring (object or array)
    const jsonSubstring = extractFirstJSON(cleaned);
    if (!jsonSubstring) {
      // If no JSON found, try more aggressive cleaning
      cleaned = cleaned
        // Remove non-standard whitespace characters
        .replace(/[\u2028\u2029\u0085]/g, ' ')
        // Fix single quotes to double quotes
        .replace(/'/g, '"')
        // Remove trailing commas before } or ]
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing quotes around property names (best-effort)
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Remove any remaining non-JSON characters at start/end
        .replace(/^[^{[]+/, '')
        .replace(/[^}\]]+$/, '');

      console.log('🧹 Aggressive cleaning result:', cleaned);

      // Try parsing again after aggressive cleaning
      try {
        const parsed = JSON.parse(cleaned);
        console.log('✅ Parse successful after aggressive cleaning');
        return parsed;
      } catch (error) {
        console.error('❌ All parsing attempts failed:', error);
        console.error('Final cleaned version:', cleaned);
        throw new Error('Failed to parse JSON response after all attempts');
      }
    }

    console.log('➡️ Extracted JSON substring:', jsonSubstring);

    // Clean the extracted JSON
    let cleanedJson = jsonSubstring
      // Remove non-standard whitespace characters
      .replace(/[\u2028\u2029\u0085]/g, ' ')
      // Fix single quotes to double quotes
      .replace(/'/g, '"')
      // Remove trailing commas before } or ]
      .replace(/,(\s*[}\]])/g, '$1')
      // Fix missing quotes around property names (best-effort)
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    console.log('🧹 Cleaned JSON substring:', cleanedJson);

    try {
      const parsed = JSON.parse(cleanedJson);
      console.log('✅ Parse successful after extraction and cleaning');
      return parsed;
    } catch (error) {
      // Log the initial parsing error
      console.error('❌ Technical error - JSON parsing failed:', {
        error: error instanceof Error ? error.message : String(error),
        cleanedJson,
      });

      // One last attempt: try to fix any remaining issues
      cleanedJson = cleanedJson
        // Remove any non-JSON characters at the start
        .replace(/^[^{[]+/, '')
        // Remove any non-JSON characters at the end
        .replace(/[^}\]]+$/, '')
        // Ensure property names are quoted
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        // Fix potential unescaped quotes in strings
        .replace(/(?<!\\)"/g, '\\"')
        .replace(/^/, '"')
        .replace(/$/, '"')
        .replace(/\\"{/g, '{')
        .replace(/\\"}$/g, '}');

      console.log('🧹 Final cleaning attempt:', cleanedJson);

      try {
        const parsed = JSON.parse(cleanedJson);
        console.log('✅ Parse successful after final cleaning');
        return parsed;
      } catch (finalError) {
        console.error('❌ Technical error - All parsing attempts failed:', {
          error:
            finalError instanceof Error
              ? finalError.message
              : String(finalError),
          cleanedJson,
        });
        throw new Error(
          'We encountered an issue processing the response. Please try again.'
        );
      }
    }
  } catch (error) {
    console.error('❌ Technical error - JSON processing failed:', {
      error: error instanceof Error ? error.message : String(error),
      snippet: raw.slice(0, 500),
    });
    throw new Error(
      'We encountered an issue processing your request. Please try again.'
    );
  }
}
