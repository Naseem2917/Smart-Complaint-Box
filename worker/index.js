/**
 * Smart Complaint Box - Cloudflare Worker
 * 
 * Multi-model Gemini AI proxy with intelligent fallback chain,
 * header authentication, and per-model timeout handling.
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Model constants (exact PromptWise models) ─────────────────────────────────

const MODEL_LITE = 'gemini-3.5-flash-lite';
const MODEL_MID  = 'gemini-3.6-flash';
const MODEL_HIGH = 'gemini-3.7-flash';

/**
 * Single, optimized fallback chain:
 * 1. Fast & responsive: gemini-3.5-flash-lite (~900ms)
 * 2. Overload / rate-limit fallback: gemini-3.6-flash
 * 3. High reasoning fallback: gemini-3.7-flash
 */
const FALLBACK_MODELS = [MODEL_LITE, MODEL_MID, MODEL_HIGH];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if the HTTP status code signals a transient/overload error
 * that warrants trying the next model in the fallback chain.
 * Non-retryable errors (401, 403, 400, etc.) will NOT trigger a model switch.
 */
function isRetryableStatus(status) {
    return [429, 500, 502, 503, 504].includes(status);
}

// Parse JSON safely from markdown or plain text response
function parseJSON(text) {
    try {
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return null;
    } catch {
        return null;
    }
}

// ── Core Gemini caller (single model, with timeout & header auth) ─────────────

const REQUEST_TIMEOUT_MS = 20_000; // 20 s per-model timeout

async function callGemini(apiKey, model, userPrompt, systemPrompt = '') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
        const bodyPayload = {
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
                temperature: 0.3,
            },
        };

        if (systemPrompt) {
            bodyPayload.systemInstruction = { parts: [{ text: systemPrompt }] };
        }

        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey, // Key in header, NOT in URL query string
            },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const errBody = await response.text().catch(() => response.statusText);
        const err = new Error(`Gemini ${response.status}: ${errBody}`);
        err.status = response.status;
        throw err;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

// ── Multi-model caller with immediate fallback ───────────────────────────────

async function callWithModelList(apiKey, models, userPrompt, systemPrompt = '') {
    let lastError = new Error('No models available');

    for (const model of models) {
        const start = Date.now();
        try {
            const text = await callGemini(apiKey, model, userPrompt, systemPrompt);
            return { text, modelUsed: model, latencyMs: Date.now() - start };
        } catch (err) {
            lastError = err;

            // Abort = timeout → try next model immediately
            if (err.name === 'AbortError') {
                console.warn(`[Gemini] ${model} timed out. Trying next model…`);
                continue;
            }

            // Retryable server/overload error → try next model immediately
            if (err.status !== undefined && isRetryableStatus(err.status)) {
                console.warn(`[Gemini] ${model} returned ${err.status}. Trying next model…`);
                continue;
            }

            // Non-retryable (401 bad key, 400 bad request, etc.) → stop immediately
            console.error(`[Gemini] ${model} returned non-retryable error ${err.status ?? 'unknown'}. Aborting fallback.`);
            throw err;
        }
    }

    throw lastError;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS,
            });
        }

        // ── GET Health Check ─────────────────────────────────────────────────
        if (request.method === 'GET') {
            return Response.json(
                {
                    success: true,
                    status: 'ok',
                    service: 'Smart Complaint Box AI Worker',
                    models: FALLBACK_MODELS,
                },
                { headers: CORS_HEADERS }
            );
        }

        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', {
                status: 405,
                headers: CORS_HEADERS,
            });
        }

        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return Response.json(
                { error: 'Configuration Error: Missing GEMINI_API_KEY in Cloudflare Worker' },
                { status: 500, headers: CORS_HEADERS }
            );
        }

        try {
            const body = await request.json().catch(() => ({}));
            const pathname = url.pathname.replace(/^\/+/, '');

            // ── Route: /live-analyze ─────────────────────────────────────────
            if (pathname === 'live-analyze' || pathname.endsWith('/live-analyze')) {
                const text = body.text || body.prompt || '';
                const prompt = `Analyze this complaint text:
"${text}"

First check if this is a VALID complaint (meaningful text about an issue).
If it's gibberish, random characters, test text, or not a real complaint, set isValid to false.

Respond with JSON only:
{
  "isValid": true/false,
  "category": "one of: Water Supply, Electricity, Roads & Infrastructure, Sanitation, Security, Classroom, General, Other",
  "priority": "one of: Low, Medium, High, Critical",
  "suggestedImage": "brief suggestion for what photo would help, or empty string"
}`;
                const systemPrompt = `You are a complaint analyzer. Analyze the text and respond ONLY with valid JSON, no other text.`;
                const { text: resultText, modelUsed, latencyMs } = await callWithModelList(apiKey, FALLBACK_MODELS, prompt, systemPrompt);
                const parsed = parseJSON(resultText);

                return Response.json(
                    parsed || { isValid: false, category: 'General', priority: 'Medium', suggestedImage: '', modelUsed, latencyMs },
                    { headers: CORS_HEADERS }
                );
            }

            // ── Route: /analyze ──────────────────────────────────────────────
            if (pathname === 'analyze' || pathname.endsWith('/analyze')) {
                const { description, imageUrl } = body;
                const prompt = `Analyze this complaint:
Description: "${description || body.prompt || ''}"
${imageUrl ? `Image attached: yes` : 'No image attached'}

Respond with JSON only:
{
  "category": "one of: Water Supply, Electricity, Roads & Infrastructure, Sanitation, Security, Classroom, General, Other",
  "urgency": "one of: Low, Medium, High, Critical",
  "priorityScore": number 0-100,
  "priorityReason": ["reason1", "reason2"],
  "aiSummary": "1-2 sentence summary",
  "suggestedAssignment": "department or role",
  "statusExplanation": "reassuring message for user"
}`;
                const systemPrompt = `You are an AI complaint analyzer for a college/society complaint management system. Analyze complaints and respond ONLY with valid JSON.`;
                const { text: resultText, modelUsed, latencyMs } = await callWithModelList(apiKey, FALLBACK_MODELS, prompt, systemPrompt);
                const parsed = parseJSON(resultText);

                return Response.json(
                    parsed || {
                        category: 'General',
                        urgency: 'Medium',
                        priorityScore: 50,
                        priorityReason: ['Standard complaint'],
                        aiSummary: (description || '').slice(0, 100),
                        suggestedAssignment: 'General Support',
                        statusExplanation: 'Your complaint has been received and will be reviewed shortly.',
                        modelUsed,
                        latencyMs,
                    },
                    { headers: CORS_HEADERS }
                );
            }

            // ── Route: /user-chat or /chat ────────────────────────────────────
            if (pathname === 'user-chat' || pathname.endsWith('/chat')) {
                const userQuery = body.query || body.prompt || '';
                const complaintsContext = body.complaints
                    ?.slice(0, 5)
                    .map(c => `- ${c.category}: ${c.status} (${c.aiSummary || c.description?.slice(0, 50)})`)
                    .join('\n') || 'No complaints';

                const prompt = `User's recent complaints:
${complaintsContext}

User asks: "${userQuery}"

Provide a helpful, friendly response (2-4 sentences max). If you don't have information, say so politely.`;
                const systemPrompt = `You are a helpful AI assistant for a complaint management system. Be friendly and concise.`;

                const { text: resultText, modelUsed, latencyMs } = await callWithModelList(apiKey, FALLBACK_MODELS, prompt, systemPrompt);
                return Response.json(
                    { success: true, text: resultText, response: resultText, modelUsed, latencyMs },
                    { headers: CORS_HEADERS }
                );
            }

            // ── Generic AI Endpoint (Default for frontend callAI & /api/generate) ──
            const prompt = body.prompt || body.query || body.userPrompt || body.text || '';
            const systemPrompt = body.systemInstruction || body.systemPrompt || '';

            if (!prompt.trim()) {
                return Response.json(
                    { error: 'Prompt is required.' },
                    { status: 400, headers: CORS_HEADERS }
                );
            }

            const { text, modelUsed, latencyMs } = await callWithModelList(
                apiKey,
                FALLBACK_MODELS,
                prompt,
                systemPrompt
            );

            console.log(`[Complaint AI] model=${modelUsed} latency=${latencyMs}ms`);

            return Response.json(
                {
                    success: true,
                    text,
                    response: text,
                    modelUsed,
                    latencyMs,
                    // Backward-compatible candidates field for legacy callers:
                    candidates: [
                        {
                            content: {
                                parts: [{ text }],
                            },
                        },
                    ],
                },
                { headers: CORS_HEADERS }
            );

        } catch (err) {
            const msg = err?.message || String(err);
            console.error('[Worker Error]', msg);
            return Response.json(
                { error: `AI Service Error: ${msg}` },
                { status: 500, headers: CORS_HEADERS }
            );
        }
    },
};
