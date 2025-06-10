import { ChatOpenAI } from "@langchain/openai";

export const POST = async (req: Request) => {
    try {
        const body = await req.json();
        const { goal } = body;

        if (!goal) {
            return new Response(JSON.stringify({ error: 'Goal is required' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                },
            });
        }

        const model = new ChatOpenAI({
            model: "gpt-4.1",
            temperature: 0,
        });
        
        const response = await model.invoke(`
            read between the lines and analyze what is the actual end goal that the person wants out of this. 
            do this by explicitly listing out actual end goals. 
            after you list them out, prioritize and pick three end goals that are likely the most significant. 
            this is the goal: ${goal}
            return the response in the following format:
            {
                "endGoals": [{title: "end goal 1", description: "description 1"}, {title: "end goal 2", description: "description 2"}, {title: "end goal 3", description: "description 3"}]
            }
            `);

        return new Response(JSON.stringify({ response }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}