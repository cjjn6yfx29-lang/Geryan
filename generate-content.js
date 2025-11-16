// This file runs on Vercel/Netlify as a serverless function, 
// protecting your API key from public view.
const fetch = require('node-fetch');

// The Gemini Model to use for text generation
const TEXT_MODEL = "gemini-2.5-flash-preview-09-2025";

// --- IMPORTANT ---
// The API Key is securely retrieved from the environment variables configured in Vercel.
// You MUST set an environment variable named GEMINI_API_KEY in your Vercel project settings.
const GEMINI_API_KEY = process.process.env.GEMINI_API_KEY; // Note: For Vercel, access is via process.env

const COMPANY_INFO = "کومپانیا es ل سالا 2025 هاتیە دروستکرن. کومپانیەکە حەتا نها ج بنگەه نینن تنێ online ئانکو ل سەر ئینتەرنێتێ یا هەی و یا هاریکارە بو پێشڤە برنا گەنجاو هزرێت وان.";

// System instruction to guide the Gemini Model
const systemPrompt = `تۆ هاریکارێ گەڕینێ یێ شارەزای و هوشمەندی. وەڵامەکێ **تێر و تەسەل و بەرفرەهـ** ل سەر پرسیارا بکارهێنەری پێشکێشکە. زانیاریێن خۆ ژ ئەنجامێن گەڕینا وێبێ پشتڕاست بکە.
    
**یا گرنگ:** ئەگەر پرسیارا بکارهێنەری ل سەر ناسنامە یان چاوانیا دروستبوونا 'کۆمپانیای es' بوو (وەکی: کیە خودان، ل کیڤەیە، جیە، یان چەوا دروست بیە), تەنها بێژە:
    
${COMPANY_INFO}
    
بۆ پرسیارێن دی، زانیاریێن وێبێ ب کاربینە. هەمی وەڵامێن خۆ ب زمانێ کوردییا بەهدینی بنڤیسە. ژێدەرێن خۆ ب ئاشکەرایی لێدەکە. تەنها تێکستێ ب کاربهینە و باژێرێن مارکداون وەک هێلێن ستێرەی یان کارەکتەرێن لیستا خشتەی بۆ زێدەکرنا دیزاینی ژێببە.`;


// The Serverless Handler function
module.exports = async (req, res) => {
    // 1. Security Check: Ensure API key is set
    if (!GEMINI_API_KEY) {
        res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
        return;
    }

    // 2. Validate Request Method and Body
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Only POST requests are allowed.' });
        return;
    }
    
    // Parse the incoming prompt from the frontend
    const { prompt } = req.body;
    if (!prompt) {
        res.status(400).json({ error: 'Prompt is missing in the request body.' });
        return;
    }

    // 3. Construct the API Payload
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    // 4. Call the Gemini API
    try {
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await geminiResponse.json();

        // Handle API errors (e.g., 400, 500 status codes from Google)
        if (!geminiResponse.ok) {
            console.error("Gemini API Error:", result.error);
            res.status(geminiResponse.status).json({ 
                error: result.error?.message || `Gemini API returned status ${geminiResponse.status}` 
            });
            return;
        }

        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            const text = candidate.content.parts[0].text;
            let sources = [];

            // Extract grounding sources
            const groundingMetadata = candidate.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingAttributions) {
                sources = groundingMetadata.groundingAttributions
                    .map(attribution => ({
                        uri: attribution.web?.uri,
                        title: attribution.web?.title,
                    }))
                    .filter(source => source.uri && source.title)
                    .slice(0, 5);
            }

            // 5. Send the safe and processed result back to the frontend
            res.status(200).json({ text: text, sources: sources });

        } else {
            // Handle cases where the response is missing content (e.g., safety block)
            const safetyError = candidate?.safetyRatings?.[0]?.blockReason ? `Blocked by Safety: ${candidate.safetyRatings[0].blockReason}` : 'No content generated.';
            res.status(400).json({ error: safetyError });
        }

    } catch (error) {
        console.error("Serverless Function Execution Error:", error);
        res.status(500).json({ error: "Internal server error during API call." });
    }
};


