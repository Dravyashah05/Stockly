import {
  getLiveInventoryContext,
  callOpencodeChat,
  generateLocalAiResponse,
} from "../services/aiService.js";
import logger from "../utils/logger.js";

/**
 * Extract client-provided or environment AI config
 */
function getAiConfig(req) {
  const apiKey =
    req.headers["x-opencode-api-key"] ||
    req.body?.apiKey ||
    process.env.OPENCODE_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY;

  const baseURL =
    req.headers["x-opencode-base-url"] ||
    req.body?.baseURL ||
    process.env.OPENCODE_BASE_URL ||
    process.env.OPENROUTER_BASE_URL ||
    "https://api.opencode.ai/v1";

  const model =
    req.headers["x-opencode-model"] ||
    req.body?.model ||
    process.env.OPENCODE_MODEL ||
    "deepseek/deepseek-chat";

  return { apiKey, baseURL, model };
}

/**
 * Real-time AI Copilot Chat with Live Inventory Context
 */
export async function chatCopilot(req, res) {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, message: "Prompt message is required" });
    }

    const { apiKey, baseURL, model } = getAiConfig(req);
    const context = await getLiveInventoryContext();

    // If an API key is available, call the real Opencode API with full warehouse system context
    if (apiKey) {
      const systemPrompt = `You are Stockly AI, an intelligent, concise, and expert inventory management copilot built into the Stockly OS application.
You help warehouse managers and operations teams optimize stock levels, track SKUs, analyze costs, and make reorder decisions.

LIVE WAREHOUSE CONTEXT:
- Total Unique Products: ${context?.totalProducts ?? 0}
- Total Inventory Units: ${context?.totalUnits ?? 0}
- Total Inventory Valuation: ₹${(context?.totalValue || 0).toLocaleString()}
- Active Categories: ${context?.categories?.join(", ") || "None"}
- Current Low Stock Alert Items (${context?.lowStockCount ?? 0}):
${(context?.lowStockItems || [])
  .map(
    (i) => `  * ${i.name} (SKU: ${i.sku}): ${i.quantity} ${i.unit} in stock (Min safety: ${i.minStock}, Category: ${i.category}, Unit Price: ₹${i.price})`
  )
  .join("\n") || "  None (all items healthy)"}

- Recent Stock Ledger History:
${(context?.recentMovements || [])
  .map((t) => `  * ${t.product} [${t.type} ${t.quantity}] Reason: ${t.reason} by ${t.by}`)
  .join("\n") || "  No recent transactions"}

GUIDELINES:
- Provide direct, concise, and actionable answers.
- Format responses cleanly with Markdown bullet points and bold highlights.
- If asked to calculate or recommend orders, use the numbers provided in the warehouse context.
- Keep tone professional, swift, and helpful for mobile and desktop screens.`;

      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-6).map((h) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content,
        })),
        { role: "user", content: message },
      ];

      try {
        const result = await callOpencodeChat({
          messages: formattedMessages,
          apiKey,
          baseURL,
          model,
        });

        return res.json({
          success: true,
          reply: result.content,
          model: result.model,
          provider: "opencode",
        });
      } catch (apiError) {
        logger.warn("Opencode API call failed, falling back to local heuristic:", apiError.message);
        // Fall back gracefully to local engine
        const fallbackReply = generateLocalAiResponse({ prompt: message, context });
        return res.json({
          success: true,
          reply: fallbackReply,
          model: "stockly-local-heuristic",
          provider: "local",
          fallbackNotice: apiError.message,
        });
      }
    }

    // No API key configured: use high-quality local intelligence engine
    const reply = generateLocalAiResponse({ prompt: message, context });
    return res.json({
      success: true,
      reply,
      model: "stockly-local-intelligence",
      provider: "local",
    });
  } catch (error) {
    logger.error("AI Copilot Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Auto-Generate Product Description & Metadata
 */
export async function generateProductDescription(req, res) {
  try {
    const { name, category, unit, currentDescription } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }

    const { apiKey, baseURL, model } = getAiConfig(req);

    if (apiKey) {
      const messages = [
        {
          role: "system",
          content:
            "You are an expert catalog specialist for industrial and retail warehouse management. Generate a concise, clear 2-3 sentence product description suitable for catalog inventory. Follow with 2 bullet points highlighting quality and usage specifications. Do not include introductory conversational filler.",
        },
        {
          role: "user",
          content: `Generate a product description for:\n- Name: ${name}\n- Category: ${category || "General"}\n- Unit: ${unit || "pcs"}\n${currentDescription ? `- Existing draft: ${currentDescription}` : ""}`,
        },
      ];

      try {
        const result = await callOpencodeChat({
          messages,
          apiKey,
          baseURL,
          model,
          temperature: 0.6,
          maxTokens: 350,
        });

        return res.json({
          success: true,
          description: result.content,
          model: result.model,
        });
      } catch (err) {
        logger.warn("AI Description API failed, using fallback:", err.message);
      }
    }

    // Local fallback
    const desc = generateLocalAiResponse({
      prompt: `${name} (${category || "General"})`,
      intent: "description",
    });

    return res.json({
      success: true,
      description: desc,
      model: "stockly-local-heuristic",
    });
  } catch (error) {
    logger.error("Generate Description Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * AI Restock & Demand Forecasting
 */
export async function getRestockForecast(req, res) {
  try {
    const { apiKey, baseURL, model } = getAiConfig(req);
    const context = await getLiveInventoryContext();

    if (apiKey && context?.lowStockItems?.length > 0) {
      const messages = [
        {
          role: "system",
          content:
            "You are an AI supply chain analyst. Analyze the following low-stock inventory data and output a JSON array of restock recommendations with fields: product, sku, currentStock, minStock, suggestedOrder, urgency (CRITICAL | HIGH | MEDIUM), reason.",
        },
        {
          role: "user",
          content: `Inventory items requiring restock:\n${JSON.stringify(context.lowStockItems, null, 2)}`,
        },
      ];

      try {
        const result = await callOpencodeChat({
          messages,
          apiKey,
          baseURL,
          model,
          temperature: 0.2,
          maxTokens: 800,
        });

        let parsed = null;
        try {
          // extract JSON array from output
          const jsonMatch = result.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          }
        } catch {}

        if (parsed && Array.isArray(parsed)) {
          return res.json({
            success: true,
            forecast: {
              summary: `AI analyzed ${context.lowStockItems.length} items requiring replenishment.`,
              recommendations: parsed,
            },
            model: result.model,
          });
        }
      } catch (err) {
        logger.warn("Forecast API failed, using local forecast:", err.message);
      }
    }

    const localForecast = generateLocalAiResponse({ context, intent: "forecast" });
    return res.json({
      success: true,
      forecast: localForecast,
      model: "stockly-local-forecast",
    });
  } catch (error) {
    logger.error("Restock Forecast Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Check AI status and configuration
 */
export async function getAiStatus(req, res) {
  const configured = Boolean(
    process.env.OPENCODE_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY
  );

  return res.json({
    success: true,
    configured,
    defaultBaseURL: process.env.OPENCODE_BASE_URL || "https://api.opencode.ai/v1",
    defaultModel: process.env.OPENCODE_MODEL || "deepseek/deepseek-chat",
    supportedModels: [
      { id: "deepseek/deepseek-chat", name: "DeepSeek Chat (Fast & Accurate)" },
      { id: "gpt-4o-mini", name: "OpenAI GPT-4o Mini" },
      { id: "anthropic/claude-3.5-sonnet", name: "Anthropic Claude 3.5 Sonnet" },
      { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Open Source)" },
      { id: "meta-llama/llama-3-8b-instruct:free", name: "Meta Llama 3 (Free)" },
    ],
  });
}
