import OpenAI from 'openai';
import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { ConnectionsResponse } from '../app/api/connections/utils/utils';
import { scrapeLinkedInProfile } from '@/app/api/connections/utils/urlFinding/people/scrapeLinkedInProfile';

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

// Helper function to transform tools for chat completions API
function transformToolsForChatCompletions(tools: any[]): any[] {
  return tools
    .map((tool) => {
      // If tool is already in correct format (has type: "function" and function object), return as-is
      if (
        tool.type === 'function' &&
        tool.function &&
        typeof tool.function === 'object'
      ) {
        return tool;
      }

      // Handle tools with type: 'function' but function details at top level (your current format)
      if (tool.type === 'function' && tool.name) {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            ...(tool.strict !== undefined && { strict: tool.strict }),
          },
        };
      }

      // Handle simple tools that need to be converted to function format
      if (tool.name) {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || `Execute ${tool.name} function`,
            parameters: tool.parameters || {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        };
      }

      // Skip tools that can't be converted (like web_search_preview)
      console.warn(
        'Skipping incompatible tool for Chat Completions API:',
        tool
      );
      return null;
    })
    .filter(Boolean); // Remove null entries
}

/**
 * Call OpenAI Chat Completions (defaults to gpt-4o-mini). The function name and
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
              if (item.name === 'access_linkedin_url') {
                console.log('🔗 Accessing LinkedIn URL...');
                try {
                  const args = JSON.parse(item.arguments);
                  // Extract the URL from the arguments object
                  const profileUrl = args.profile_url || args.url || args;
                  const profileData = await scrapeLinkedInProfile(profileUrl);

                  // Create function call output
                  toolCallOutputs.push({
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify(profileData),
                  });

                  console.log('✅ LinkedIn profile data retrieved');
                } catch (error: any) {
                  console.error('Error calling LinkedIn function:', error);
                  toolCallOutputs.push({
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({ error: error.message }),
                  });
                }
              }
              // Add other tool handlers here as needed
              else if (
                item.name === 'web_search_preview' ||
                item.name === 'web_search'
              ) {
                console.log('🔎 Web search tool called (handled by OpenAI)');
                // OpenAI handles web search internally, results will be in next response
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
              if (item.name === 'access_linkedin_url') {
                console.log('🔗 Accessing LinkedIn URL...');
                try {
                  const args = JSON.parse(item.arguments);
                  const profileData = await scrapeLinkedInProfile(args);

                  // Create function call output
                  toolCallOutputs.push({
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify(profileData),
                  });

                  console.log('✅ LinkedIn profile data retrieved');
                } catch (error: any) {
                  console.error('Error calling LinkedIn function:', error);
                  toolCallOutputs.push({
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({ error: error.message }),
                  });
                }
              }
              // Add other tool handlers here as needed
              else if (
                item.name === 'web_search_preview' ||
                item.name === 'web_search'
              ) {
                console.log('🔎 Web search tool called (handled by OpenAI)');
                // OpenAI handles web search internally, results will be in next response
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
            if (item.name === 'access_linkedin_url') {
              console.log('🔗 Accessing LinkedIn URL...');
              try {
                const args = JSON.parse(item.arguments);
                // Extract the URL from the arguments object
                const profileUrl = args.profile_url || args.url || args;
                const profileData = await scrapeLinkedInProfile(profileUrl);

                // Create function call output
                toolCallOutputs.push({
                  type: 'function_call_output',
                  call_id: item.call_id,
                  output: JSON.stringify(profileData),
                });

                console.log('✅ LinkedIn profile data retrieved');
              } catch (error: any) {
                console.error('Error calling LinkedIn function:', error);
                toolCallOutputs.push({
                  type: 'function_call_output',
                  call_id: item.call_id,
                  output: JSON.stringify({ error: error.message }),
                });
              }
            }
            // Add other tool handlers here as needed
            else if (
              item.name === 'web_search_preview' ||
              item.name === 'web_search'
            ) {
              console.log('🔎 Web search tool called (handled by OpenAI)');
              // OpenAI handles web search internally, results will be in next response
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
