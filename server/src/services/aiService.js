import Product from "../models/Product.js";
import Category from "../models/Category.js";
import StockTransaction from "../models/StockTransaction.js";

const DEFAULT_BASE_URL = process.env.OPENCODE_BASE_URL || process.env.OPENROUTER_BASE_URL || "https://api.opencode.ai/v1";
const DEFAULT_MODEL = process.env.OPENCODE_MODEL || "deepseek/deepseek-chat";

/**
 * Gather live context from the inventory database for the AI system prompt
 */
export async function getLiveInventoryContext() {
  try {
    const [totalProducts, lowStockProducts, categories, recentTransactions] = await Promise.all([
      Product.countDocuments(),
      Product.find({
        $expr: { $lte: ["$quantity", { $ifNull: ["$minimumStock", 5] }] },
      })
        .select("name sku quantity unit minimumStock price category")
        .populate("category", "name")
        .limit(15)
        .lean(),
      Category.find({ status: "active" }).select("name").lean(),
      StockTransaction.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("product", "name sku")
        .populate("user", "name")
        .lean(),
    ]);

    // calculate total inventory valuation
    const valuationAgg = await Product.aggregate([
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ["$quantity", { $ifNull: ["$price", 0] }] } },
          totalUnits: { $sum: "$quantity" },
        },
      },
    ]);

    const totalValue = valuationAgg[0]?.totalValue || 0;
    const totalUnits = valuationAgg[0]?.totalUnits || 0;

    return {
      totalProducts,
      totalUnits,
      totalValue,
      lowStockCount: lowStockProducts.length,
      lowStockItems: lowStockProducts.map((p) => ({
        name: p.name,
        sku: p.sku,
        quantity: p.quantity,
        unit: p.unit || "pcs",
        minStock: p.minimumStock || 5,
        price: p.price || 0,
        category: p.category?.name || "General",
      })),
      categories: categories.map((c) => c.name),
      recentMovements: recentTransactions.map((t) => ({
        product: t.product?.name || "Unknown",
        type: t.type,
        quantity: t.quantity,
        reason: t.reason || "Manual adjustment",
        by: t.user?.name || "User",
        date: t.createdAt,
      })),
    };
  } catch (error) {
    console.error("Error gathering inventory context for AI:", error.message);
    return null;
  }
}

/**
 * Call Opencode / OpenRouter / OpenAI compatible completion endpoint
 */
export async function callOpencodeChat({
  messages,
  apiKey,
  baseURL,
  model,
  temperature = 0.4,
  maxTokens = 800,
}) {
  const finalKey = apiKey || process.env.OPENCODE_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  let finalBaseURL = baseURL || process.env.OPENCODE_BASE_URL || DEFAULT_BASE_URL;
  if (!finalBaseURL.endsWith("/v1") && !finalBaseURL.endsWith("/v1/")) {
    finalBaseURL = finalBaseURL.replace(/\/+$/, "") + "/v1";
  }
  const finalModel = model || process.env.OPENCODE_MODEL || DEFAULT_MODEL;

  if (!finalKey) {
    throw new Error("No Opencode or OpenRouter API Key configured");
  }

  const endpoint = `${finalBaseURL.replace(/\/+$/, "")}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${finalKey}`,
        "HTTP-Referer": "https://stockly.app",
        "X-Title": "Stockly Inventory AI",
      },
      body: JSON.stringify({
        model: finalModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMsg = errorText;
      try {
        const errJson = JSON.parse(errorText);
        parsedMsg = errJson.error?.message || errJson.message || errorText;
      } catch {}
      throw new Error(`AI API error (${response.status}): ${parsedMsg}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("Empty response received from AI provider");
    }

    return {
      content: reply,
      model: data.model || finalModel,
      usage: data.usage || null,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("AI request timed out after 25 seconds");
    }
    throw err;
  }
}

/**
 * Intelligent deterministic fallback generator when no remote API key is supplied
 */
export function generateLocalAiResponse({ prompt, context, intent = "chat" }) {
  const p = (prompt || "").toLowerCase();

  if (intent === "description") {
    return `Premium high-grade ${prompt}. Engineered for optimal warehouse reliability, rigorous inventory durability, and industrial-standard material performance. Designed with standardized barcodes and catalog batch traceability.`;
  }

  if (intent === "forecast") {
    const items = context?.lowStockItems || [];
    if (!items.length) {
      return {
        summary: "All inventory thresholds are healthy. No urgent reorders required this week.",
        recommendations: [],
        daysToDepletion: 45,
      };
    }
    return {
      summary: `Found ${items.length} critical products below minimum safety threshold. Recommend placing immediate purchase orders.`,
      recommendations: items.map((it) => ({
        product: it.name,
        sku: it.sku,
        currentStock: it.quantity,
        minStock: it.minStock,
        suggestedOrder: Math.max(10, it.minStock * 3 - it.quantity),
        urgency: it.quantity === 0 ? "CRITICAL (Out of Stock)" : "HIGH",
      })),
      daysToDepletion: 3,
    };
  }

  // General inventory questions
  if (p.includes("low stock") || p.includes("reorder") || p.includes("out of stock")) {
    const items = context?.lowStockItems || [];
    if (!items.length) {
      return "✨ **Inventory Status:** All items currently meet or exceed safety thresholds! No active low-stock alerts detected.";
    }
    const list = items
      .map(
        (i) =>
          `- **${i.name}** (\`${i.sku}\`): **${i.quantity} ${i.unit}** remaining (Min safety threshold: ${i.minStock})`
      )
      .join("\n");
    return `⚠️ **Low Stock Alert (${items.length} Items):**\n\nThe following items require immediate restock attention:\n\n${list}\n\n*Recommendation:* Generate a purchase order to maintain buffer stocks.`;
  }

  if (p.includes("value") || p.includes("worth") || p.includes("valuation") || p.includes("total")) {
    return `📊 **Warehouse Inventory Valuation:**\n\n- **Total Products:** ${context?.totalProducts ?? 0}\n- **Total Stock Units:** ${context?.totalUnits?.toLocaleString() ?? 0} units\n- **Total Catalog Valuation:** ₹${(context?.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n- **Active Categories:** ${context?.categories?.join(", ") || "General"}`;
  }

  if (p.includes("recent") || p.includes("movement") || p.includes("history") || p.includes("ledger")) {
    const txs = context?.recentMovements || [];
    if (!txs.length) return "No recent stock transactions recorded in the ledger.";
    const list = txs
      .slice(0, 5)
      .map((t) => `- **${t.product}**: \`${t.type}\` **${t.quantity}** (${t.reason}) by ${t.by}`)
      .join("\n");
    return `📋 **Recent Stock Ledger Movements:**\n\n${list}`;
  }

  return `🤖 **Stockly AI Copilot:**\n\nI am monitoring your warehouse inventory in real time.\n\n- **Catalog Count:** ${context?.totalProducts ?? 0} items\n- **Low Stock Alerts:** ${context?.lowStockCount ?? 0} items\n- **Live Valuation:** ₹${(context?.totalValue || 0).toLocaleString()}\n\nYou can ask me to draft product descriptions, forecast restock schedules, analyze fast-moving SKUs, or review supplier orders!`;
}
