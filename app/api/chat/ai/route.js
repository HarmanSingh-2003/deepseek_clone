// app/api/chat/ai/route.js
// My code for AI Chat Backend, developed through debugging
// Provides conversation memory and robust error handling

export const maxDuration = 60; // Max duration for serverless function (60 seconds)

import connectDB from '@/config/db';
import Chat from '@/models/Chat'; // Assuming Chat model is defined here
import { getAuth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import OpenAI from 'openai'; // 'openai' npm package installed

// Initialize OpenAI client, configured for OpenRouter
const openai = new OpenAI({
    // Using OpenRouter's base URL for OpenAI-compatible API
    baseURL: "https://openrouter.ai/api/v1",
    // My OpenRouter API key from environment variables
    // Ensuring OPENROUTER_API_KEY is set in .env.local and Vercel settings
    apiKey: process.env.OPENROUTER_API_KEY,
    // Optional: Default headers for OpenRouter rankings/analytics
    defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://your-deepseek-clone-app.com", // My actual site URL
        "X-Title": "My DeepSeek Chat App", // My application's name
    },
});

export async function POST(req) {
    try {
        // Get authenticated user ID from Clerk (server-side)
        const { userId } = getAuth(req);

        // Extract chatId and prompt from the request body
        // Frontend (PromptBox.jsx) sends 'chatId' and 'prompt'
        const { chatId, prompt } = await req.json();

        // 1. Authentication Guard: Check if the user is logged in
        if (!userId) {
            return NextResponse.json(
                { success: false, message: "User not authenticated." },
                { status: 401 } // 401 Unauthorized
            );
        }

        // 2. Input Validation Guard: Check if prompt is empty
        if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
            return NextResponse.json(
                { success: false, message: "Prompt cannot be empty." },
                { status: 400 } // 400 Bad Request
            );
        }

        // 3. Database Connection
        await connectDB();

        // 4. Find Chat Document: Retrieve the existing chat from the database
        // Using findOne and ensuring userId matches for security
        const chat = await Chat.findOne({ userId, _id: chatId });

        // 5. Chat Existence Guard: Handle case where chat document is not found
        if (!chat) {
            return NextResponse.json(
                { success: false, message: "Chat session not found or does not belong to user." },
                { status: 404 } // 404 Not Found
            );
        }

        // Ensure chat.messages is an array (important for newly created chats or old data)
        if (!chat.messages || !Array.isArray(chat.messages)) {
            chat.messages = [];
        }

        // 6. Add User's Prompt to Chat History
        const userPromptMessage = {
            role: "user",
            content: prompt.trim(), // Trimming whitespace from user's message
            timestamp: Date.now()
        };
        chat.messages.push(userPromptMessage);

        // 7. Prepare Messages for LLM API Call (sending entire conversation history)
        // LLMs need the full context to remember previous turns.
        const messagesForApi = chat.messages.map(msg => ({
            role: msg.role,
            content: msg.content // Ensuring content is always a string
        }));

        // 8. Call the DeepSeek API
        const completion = await openai.chat.completions.create({
            model: "deepseek/deepseek-r1-0528:free", // My chosen DeepSeek model via OpenRouter
            messages: messagesForApi, // Sending the full conversation history
            temperature: 0.7, // Adjusting creativity (0.0 for deterministic, 1.0 for more creative)
            max_tokens: 1024, // Setting max number of tokens for AI's response
            // Removed 'store: true' as it was an invalid parameter and caused crashes
        });

        // 9. Extract and Process AI's Response
        // Ensuring message object has required properties from API response
        const assistantResponse = completion.choices[0]?.message; // Using optional chaining
        
        if (!assistantResponse || !assistantResponse.content) {
             console.error("DeepSeek API returned an invalid response structure:", assistantResponse);
             return NextResponse.json(
                { success: false, error: "AI returned an empty or invalid response." },
                { status: 500 }
            );
        }

        const assistantMessage = {
            role: assistantResponse.role,
            content: assistantResponse.content,
            timestamp: Date.now()
        };

        // 10. Add AI's Response to Chat History
        chat.messages.push(assistantMessage);

        // 11. Save Updated Chat Document to Database
        await chat.save(); // Awaiting the save operation to ensure data persistence

        // 12. Return AI's Response to Frontend
        return NextResponse.json({ success: true, data: assistantMessage }, { status: 200 }); // 200 OK status
    } catch (error) {
        // Centralized Error Logging and Response for debugging
        console.error("Error in /api/chat/ai:", error);
        
        // Differentiating common API errors for better debugging
        let errorMessage = "Internal Server Error";
        let statusCode = 500;

        if (error.response) { // Error from API call (e.g., OpenRouter returns 4xx/5xx)
            errorMessage = error.response.data?.error?.message || error.response.data?.message || error.message;
            statusCode = error.response.status;
            console.error("API Response Error Data:", error.response.data);
        } else if (error.request) { // Request made but no response received
            errorMessage = "No response from AI service (network error).";
            statusCode = 504; // Gateway Timeout
        } else { // Other errors (e.g., Mongoose validation, code errors)
            errorMessage = error.message;
            statusCode = 500;
        }

        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: statusCode }
        );
    }
}