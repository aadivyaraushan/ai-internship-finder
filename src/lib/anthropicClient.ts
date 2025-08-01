import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ConnectionsResponse } from '../app/api/connections/utils/utils';

// Helper function to handle Perplexity API calls
async function callPerplexityAPI(query: string) {
  // Check if API key exists
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }

  console.log('🔍 Using Perplexity API for search:', { query });

  // Calculate date from 6 months ago for filtering
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const filterDate = `${
    sixMonthsAgo.getMonth() + 1
  }/${sixMonthsAgo.getDate()}/${sixMonthsAgo.getFullYear()}`;

  const perplexityResponse = await fetch(
    'https://api.perplexity.ai/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'user',
            content: `Find relevant sources and URLs for: ${query}. Focus on finding specific information about people, companies, programs, or opportunities. Include LinkedIn profiles, company websites, and program pages when available. Provide URLs and explain why each source is relevant for making professional connections.`,
          },
        ],
        search_after_date_filter: filterDate,
      }),
    }
  );

  console.log('Perplexity response status:', perplexityResponse.status);
  console.log(
    'Perplexity response headers:',
    Object.fromEntries(perplexityResponse.headers.entries())
  );

  if (!perplexityResponse.ok) {
    const errorText = await perplexityResponse.text();
    console.error('Perplexity API error response:', errorText);
    throw new Error(
      `Perplexity API error (${perplexityResponse.status}): ${errorText}`
    );
  }

  const responseText = await perplexityResponse.text();
  console.log(
    'Perplexity raw response:',
    responseText.substring(0, 500) + '...'
  );

  const perplexityData = JSON.parse(responseText);

  // Check if we got actual search results
  if (!perplexityData.search_results || perplexityData.search_results.length === 0) {
    console.warn('⚠️ Perplexity returned no search results for query:', query);
    return {
      query,
      answer: 'No search results found. Try alternative search terms like: removing specific keywords, using broader company names, searching for similar roles, or trying different combinations of the person/company name.',
      search_results: [],
      sources: [],
      urls: [],
      relevance_explanation: `No search results found for: ${query}. Suggest trying alternative search queries with different keywords or broader terms.`,
    };
  }

  // Transform Perplexity response to include sources and explanations
  const transformedData = {
    query,
    answer: perplexityData.choices?.[0]?.message?.content || 'No answer found',
    search_results: perplexityData.search_results || [],
    sources:
      perplexityData.search_results?.map((result: any) => ({
        title: result.title,
        url: result.url,
        date: result.date,
        last_updated: result.last_updated,
      })) || [],
    urls:
      perplexityData.search_results
        ?.map((result: any) => result.url)
        .filter(Boolean) || [],
    relevance_explanation: `Search results for: ${query}. Found ${
      perplexityData.search_results?.length || 0
    } sources with URLs and explanations for connection-finding.`,
  };

  console.log('✅ Perplexity search completed');
  return transformedData;
}

// Helper function to handle Perplexity errors consistently
function handlePerplexityError(error: any, query: string, callId: string) {
  console.error('Error with Perplexity API:', error);
  console.error('API Key present:', !!process.env.PERPLEXITY_API_KEY);
  console.error('API Key length:', process.env.PERPLEXITY_API_KEY?.length || 0);
  console.error('Query:', query);

  // If it's a JSON parsing error, it means we got HTML instead of JSON
  if (error.message.includes('Unexpected token')) {
    console.error(
      '🚨 Received HTML instead of JSON - likely API key issue or endpoint problem'
    );
  }

  return {
    type: 'function_call_output',
    call_id: callId,
    output: JSON.stringify({
      error: error.message,
      query,
      fallback_message: 'Unable to perform web search at this time',
      debug_info: 'Check API key and endpoint configuration',
    }),
  };
}

// Singleton OpenAI client

export interface ClaudeCallOptions {
  tools?: any[];
  maxTokens?: number;
  model?: string;
  schema?: z.ZodType<any>;
  schemaLabel?: string;
  effort?: 'low' | 'medium' | 'high';
  isReasoning?: boolean;
  isStreamingResponse?: boolean;
}

/**
 * Convert the legacy prompt format that may include a <system>...</system> block
 * into OpenAI Chat Completion messages. If a <system> block is present it will
 * be sent as the system message and the remainder will be sent as the user
 * message. Otherwise, the entire prompt is sent as a single user message.
 */
function buildMessages(prompt: string): Array<any> {
  const systemTagRegex = /<system>([\s\S]*?)<\/system>/i;
  const match = prompt.match(systemTagRegex);

  if (match) {
    const systemContent = match[1].trim();
    const userContent = prompt.replace(systemTagRegex, '').trim();
    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent },
    ];
  }

  return [{ role: 'user', content: prompt }];
}

/**
 * Call OpenAI Responses API. The function name and
 * signature are preserved so that the rest of the codebase continues to work
 * without modification.
 */
export async function callClaude(
  prompt: string,
  {
    tools = [],
    maxTokens = 1024,
    model = 'gpt-4.1-mini',
    schema,
    schemaLabel,
    effort,
    isReasoning = false,
    isStreamingResponse = false,
  }: ClaudeCallOptions
): Promise<any> {
  const client = new OpenAI();
  const messages = buildMessages(prompt);

  const completionOptions: any = {
    model,
    input: messages,
    max_output_tokens: maxTokens,
    text: {},
  } as any;

  if (isReasoning) {
    completionOptions.reasoning = {};
  }

  // If an array of tools was provided, pass it through to OpenAI. The OpenAI
  // web-search tool expects objects of the form `{ type: 'web_search' }`.
  if (tools && tools.length > 0) {
    console.log('✅ Tool used!');
    completionOptions.tools = tools;
    // Let the model decide when to call a tool.
    completionOptions.tool_choice = 'required';
  }
  if (isReasoning) {
    completionOptions.reasoning.effort = effort;
    completionOptions.reasoning.summary = 'detailed';
  }

  if (schema && schemaLabel) {
    completionOptions.text.format = zodTextFormat(schema, schemaLabel);
  }
  if (isStreamingResponse) {
    completionOptions.stream = true;
  }
  if (schema) {
    // Only considering case here because streaming is usually only necessary if the procedure is complex enough to require a schema
    // In this case, looping function calls (in the way that's necessary for this app) is impossible.
    if (isStreamingResponse && isReasoning) {
      console.log('✅ Starting generation with reasoning!');
      let jsonString = '';

      const response = await client.responses.create(completionOptions);
      const responseStream = response as any; // Cast to any to bypass TypeScript error
      for await (const event of responseStream) {
        console.log('Event:', event.type);
        if (event.type === 'response.output_item.done') {
          if (event.item.type === 'message') {
            jsonString += event.item.content.text;
          }

          if (event.item.type === 'reasoning') {
            console.log('🧠 Thinking: ', event.item.summary);
          }

          if (event.item.type === 'web_search_call') {
            console.log('🔎 Searching the web...');
          }
        }
      }

      // This will be perfect JSON
      return JSON.parse(jsonString);
    }

    // Here, function calls are infinitely looped appropriately. Only possible when there's no streaming.
    if (isReasoning) {
      console.log('✅ Starting generation with reasoning (non-streaming)!');

      let currentInput = [...messages]; // Start with original messages
      let response;
      let iterationCount = 0;
      const maxIterations = 20; // Safety limit to prevent infinite loops

      while (true) {
        iterationCount++;
        console.log(`🔄 API call iteration ${iterationCount}`);

        // Make API call
        response = await client.responses.create({
          model,
          input: currentInput,
          max_output_tokens: maxTokens,
          text:
            schema && schemaLabel
              ? { format: zodTextFormat(schema, schemaLabel) }
              : {},
          tools,
          tool_choice: 'auto',
          reasoning: {
            effort: effort,
            summary: 'detailed',
          },
        });

        // Log chain of thought available
        console.log('🧠 Thinking processes:');
        for (let item of response.output) {
          console.log('💭 Step in thinking process: ', item);
        }

        // Check if the model made any tool calls
        let hasToolCalls = false;
        const toolCallOutputs = [];

        if (response.output) {
          // First, append all output items from the response
          currentInput = currentInput.concat(response.output);

          for (const item of response.output) {
            if (item.type === 'function_call') {
              hasToolCalls = true;

              // Handle different tool types
              // LinkedIn access removed - functionality not working reliably
              // Add other tool handlers here as needed
              if (item.name === 'search_web' || item.name === 'web_search') {
                const args = JSON.parse(item.arguments);
                try {
                  const transformedData = await callPerplexityAPI(args.query);
                  toolCallOutputs.push({
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify(transformedData),
                  });
                } catch (error: any) {
                  toolCallOutputs.push(
                    handlePerplexityError(error, args.query, item.call_id)
                  );
                }
              }
              // Add more tool handlers as needed
            }
          }
        }

        // Append tool outputs if any
        if (toolCallOutputs.length > 0) {
          currentInput = currentInput.concat(toolCallOutputs);
        }

        // If no tool calls were made, we're done
        if (!hasToolCalls) {
          console.log('✅ No more tool calls needed, finalizing response');
          break;
        }

        // Safety check to prevent infinite loops
        if (iterationCount > maxIterations) {
          console.warn(
            `⚠️ Reached maximum iterations (${maxIterations}), stopping`
          );
          break;
        }
      }

      // Return the final parsed response
      if (response.output_text) {
        try {
          return JSON.parse(response.output_text);
        } catch (error) {
          console.error('Failed to parse response:', error);
          return response.output_text;
        }
      }
    }

    // NEW CODE: Handle function calls for non-reasoning models with schema
    if (!isReasoning && !isStreamingResponse) {
      console.log('✅ Starting generation (non-reasoning, non-streaming)!');

      let currentInput = [...messages]; // Start with original messages
      let response;
      let iterationCount = 0;
      const maxIterations = 20; // Safety limit to prevent infinite loops

      while (true) {
        iterationCount++;
        console.log(`🔄 API call iteration ${iterationCount}`);

        // Make API call
        response = await client.responses.create({
          model,
          input: currentInput,
          max_output_tokens: maxTokens,
          text:
            schema && schemaLabel
              ? { format: zodTextFormat(schema, schemaLabel) }
              : {},
          tools,
          tool_choice: 'auto',
        });

        // Check if the model made any tool calls
        let hasToolCalls = false;
        const toolCallOutputs = [];

        if (response.output) {
          // First, append all output items from the response
          currentInput = currentInput.concat(response.output);

          for (const item of response.output) {
            if (item.type === 'function_call') {
              hasToolCalls = true;

              // Handle different tool types
              // LinkedIn access removed - functionality not working reliably
              // Add other tool handlers here as needed
              if (item.name === 'search_web' || item.name === 'web_search') {
                const args = JSON.parse(item.arguments);
                try {
                  const transformedData = await callPerplexityAPI(args.query);
                  toolCallOutputs.push({
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify(transformedData),
                  });
                } catch (error: any) {
                  toolCallOutputs.push(
                    handlePerplexityError(error, args.query, item.call_id)
                  );
                }
              }
              // Add more tool handlers as needed
            }
          }
        }

        // Append tool outputs if any
        if (toolCallOutputs.length > 0) {
          currentInput = currentInput.concat(toolCallOutputs);
        }

        // If no tool calls were made, we're done
        if (!hasToolCalls) {
          console.log('✅ No more tool calls needed, finalizing response');
          break;
        }

        // Safety check to prevent infinite loops
        if (iterationCount > maxIterations) {
          console.warn(
            `⚠️ Reached maximum iterations (${maxIterations}), stopping`
          );
          break;
        }
      }

      // Return the final parsed response
      if (response.output_text) {
        try {
          return JSON.parse(response.output_text);
        } catch (error) {
          console.error('Failed to parse response:', error);
          return response.output_text;
        }
      }
    }

    // For streaming non-reasoning models (if needed in the future)
    if (!isReasoning && isStreamingResponse) {
      console.log('✅ Starting generation (non-reasoning, streaming)!');
      // Note: Function calls with streaming + schema is complex and may not be fully supported
      // This is a placeholder for future implementation if needed
      const response = await client.responses.create(completionOptions);
      // Handle streaming response here
      return response;
    }

    const response = await client.responses.parse(completionOptions);
    console.log('Response data structure: ', response);
    return response.output_parsed as z.infer<typeof ConnectionsResponse>;
  }

  // Handle cases without schema
  if (!isReasoning && tools && tools.length > 0) {
    console.log(
      '✅ Starting generation with tools (non-reasoning, no schema)!'
    );

    let currentInput = [...messages];
    let response;
    let iterationCount = 0;
    const maxIterations = 20;

    while (true) {
      iterationCount++;
      console.log(`🔄 API call iteration ${iterationCount}`);

      // Make API call
      response = await client.responses.create({
        model,
        input: currentInput,
        max_output_tokens: maxTokens,
        tools,
        tool_choice: 'auto',
      });

      // Check if the model made any tool calls
      let hasToolCalls = false;
      const toolCallOutputs = [];

      if (response.output) {
        // First, append all output items from the response
        currentInput = currentInput.concat(response.output);

        for (const item of response.output) {
          if (item.type === 'function_call') {
            hasToolCalls = true;

            // Handle different tool types
            // LinkedIn access removed - functionality not working reliably
            // Add other tool handlers here as needed
            if (item.name === 'search_web' || item.name === 'web_search') {
              const args = JSON.parse(item.arguments);
              try {
                const transformedData = await callPerplexityAPI(args.query);
                toolCallOutputs.push({
                  type: 'function_call_output',
                  call_id: item.call_id,
                  output: JSON.stringify(transformedData),
                });
              } catch (error: any) {
                toolCallOutputs.push(
                  handlePerplexityError(error, args.query, item.call_id)
                );
              }
            }
            // Add more tool handlers as needed
          }
        }
      }

      // Append tool outputs if any
      if (toolCallOutputs.length > 0) {
        currentInput = currentInput.concat(toolCallOutputs);
      }

      // If no tool calls were made, we're done
      if (!hasToolCalls) {
        console.log('✅ No more tool calls needed, finalizing response');
        break;
      }

      // Safety check to prevent infinite loops
      if (iterationCount > maxIterations) {
        console.warn(
          `⚠️ Reached maximum iterations (${maxIterations}), stopping`
        );
        break;
      }
    }

    // Return the final response text
    return response.output_text || '';
  }

  // Default case: no tools, just create response
  const response = await client.responses.create(completionOptions);
  return response.output_text;
}
