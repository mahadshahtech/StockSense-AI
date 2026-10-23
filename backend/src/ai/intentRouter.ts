import { executeTool } from './tools.js';
import type { AuthUser } from '../middleware/auth.js';

export type RoutedResult = {
  handled: boolean;
  reply?: string;
  proposals?: unknown[];
  toolResults?: unknown[];
  /** True when message is outside inventory scope */
  offTopic?: boolean;
};

function formatStockLine(name: string, stock: number, unit?: string): string {
  return `**${name}**: ${stock}${unit ? ` ${unit}` : ''}`;
}

const INVENTORY_SCOPE =
  /\b(stock|inventory|product|products|sku|supplier|suppliers|sell|sale|sold|damage|damaged|reorder|warehouse|shelf|quantity|qty|units?|bags?|pcs|profit|margin|revenue|cost|valuation|department|grocery|electronics|clothing|household|low[- ]?stock|out of stock|restock|stock[- ]?in|stock[- ]?out|ali traders|type-?c|keyboard|mouse|sugar|rice|flour|headphones?|charger|detergent)\b/i;

const OFF_TOPIC =
  /\b(haiku|poem|joke|story|weather|recipe|homework|code for me|write (a |an )?(essay|email|song)|girlfriend|boyfriend|dating|politics|sports score|crypto tip|horoscope)\b/i;

function isInventoryRelated(text: string): boolean {
  // Creative / unrelated asks are out of scope even if they mention "warehouse"
  if (OFF_TOPIC.test(text)) return false;
  if (INVENTORY_SCOPE.test(text)) return true;
  // Inventory action openers
  if (
    /^(add|sell|remove|record|show|list|check|find|get|how many|how much|what('s| is)|which)\b/i.test(
      text.trim()
    )
  ) {
    return true;
  }
  return false;
}

async function answerProductStock(user: AuthUser, query: string): Promise<RoutedResult> {
  const result = await executeTool('get_product_stock', { query }, user);
  const toolResults = [{ tool: 'get_product_stock', result }];
  if ((result as { error?: string }).error) {
    return { handled: true, reply: (result as { error: string }).error, toolResults, proposals: [] };
  }
  if ((result as { ambiguous?: boolean }).ambiguous) {
    const matches = (result as { matches: Array<{ name: string; currentStock: number }> }).matches;
    return {
      handled: true,
      reply: `Multiple products match "${query}". Please clarify:\n${matches
        .map((m) => `- ${m.name} (${m.currentStock})`)
        .join('\n')}`,
      toolResults,
      proposals: [],
    };
  }
  const p = (result as { product: { name: string; currentStock: number; unit: string; sku: string } }).product;
  return {
    handled: true,
    reply: `**${p.name}** (${p.sku}) has **${p.currentStock}** ${p.unit} in stock.`,
    toolResults,
    proposals: [],
  };
}

async function searchFallback(user: AuthUser, text: string): Promise<RoutedResult> {
  // Strip question fluff and search remaining words as product query
  const query = text
    .replace(/[?!.]/g, ' ')
    .replace(
      /\b(please|can you|could you|tell me|show me|what is|what's|whats|check|find|get|the|a|an|our|we|have|available|quantity of|qty of|number of|count of|status of|info on|about|for|me)\b/gi,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (query.length < 2) return { handled: false };

  const search = await executeTool('search_products', { query, limit: 5 }, user);
  const toolResults = [{ tool: 'search_products', result: search }];
  const products = (search as { products: Array<{ name: string; sku: string; currentStock: number; unit: string }> })
    .products;

  if (!products?.length) {
    return {
      handled: true,
      reply: `I couldn't find an inventory item matching "${query}". Try the product name or SKU (e.g. Type-C Cable, Sugar, EL-KB-01).`,
      toolResults,
      proposals: [],
    };
  }

  if (products.length === 1) {
    const p = products[0];
    return {
      handled: true,
      reply: `**${p.name}** (${p.sku}) has **${p.currentStock}** ${p.unit} in stock.`,
      toolResults,
      proposals: [],
    };
  }

  const lines = products.map((p) => `- **${p.name}** (${p.sku}): ${p.currentStock} ${p.unit}`);
  return {
    handled: true,
    reply: `I found several matching products:\n${lines.join('\n')}\nAsk about one by exact name for a single stock answer.`,
    toolResults,
    proposals: [],
  };
}

/**
 * Inventory-only assistant router.
 * Answers custom inventory questions from real DB tools.
 * Refuses off-topic requests.
 */
export async function tryRouteIntent(user: AuthUser, message: string): Promise<RoutedResult> {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (!text) {
    return {
      handled: true,
      reply: 'Ask me about stock levels, sales, low stock, suppliers, or stock changes.',
      proposals: [],
      toolResults: [],
    };
  }

  // Explicit off-topic refusal
  if (!isInventoryRelated(text)) {
    return {
      handled: true,
      offTopic: true,
      reply:
        "I'm StockSense AI — I only help with **inventory for Nowshera Shopping Mall** (stock levels, sales, low stock, suppliers, stock-in/out, and manager reports). Please ask an inventory-related question.",
      proposals: [],
      toolResults: [],
    };
  }

  // Profit / valuation
  if (/\b(profit|margin)\b/i.test(lower)) {
    const result = await executeTool('get_profit_summary', {}, user);
    const toolResults = [{ tool: 'get_profit_summary', result }];
    if ((result as { denied?: boolean }).denied) {
      return { handled: true, reply: (result as { message: string }).message, toolResults, proposals: [] };
    }
    const r = result as { revenue?: string; cost?: string; profit?: string; unitsSold?: number };
    return {
      handled: true,
      reply: `This week's profit summary:\n- Revenue: ${r.revenue}\n- Cost: ${r.cost}\n- Profit: **${r.profit}**\n- Units sold: ${r.unitsSold}`,
      toolResults,
      proposals: [],
    };
  }

  if (/\b(inventory value|valuation|total.*value|worth of inventory)\b/i.test(lower)) {
    const result = await executeTool('get_inventory_summary', {}, user);
    const toolResults = [{ tool: 'get_inventory_summary', result }];
    const r = result as { inventoryValuation?: string; totalProducts?: number; totalStockUnits?: number };
    if (!r.inventoryValuation) {
      return {
        handled: true,
        reply: 'Inventory valuation is only available to managers.',
        toolResults,
        proposals: [],
      };
    }
    return {
      handled: true,
      reply: `Inventory summary:\n- Products: ${r.totalProducts}\n- Stock units: ${r.totalStockUnits}\n- Valuation: **${r.inventoryValuation}**`,
      toolResults,
      proposals: [],
    };
  }

  // Low stock
  if (/\b(low[- ]?stock|running low|need.*reorder|below reorder)\b/i.test(lower)) {
    const result = await executeTool('get_low_stock_products', { limit: 15 }, user);
    const toolResults = [{ tool: 'get_low_stock_products', result }];
    const r = result as {
      count: number;
      products: Array<{ name: string; currentStock: number; reorderLevel: number }>;
    };
    if (!r.count) {
      return { handled: true, reply: 'No low-stock products right now.', toolResults, proposals: [] };
    }
    const lines = r.products.map(
      (p) => `- ${p.name}: ${p.currentStock} (reorder at ${p.reorderLevel})`
    );
    return {
      handled: true,
      reply: `Found **${r.count}** low-stock products:\n${lines.join('\n')}`,
      toolResults,
      proposals: [],
    };
  }

  // Out of stock
  if (/\b(out of stock|zero stock|no stock|empty stock)\b/i.test(lower)) {
    const result = await executeTool('get_out_of_stock_products', { limit: 20 }, user);
    const toolResults = [{ tool: 'get_out_of_stock_products', result }];
    const r = result as { count: number; products: Array<{ name: string }> };
    if (!r.count) {
      return { handled: true, reply: 'Nothing is out of stock.', toolResults, proposals: [] };
    }
    return {
      handled: true,
      reply: `**${r.count}** products are out of stock:\n${r.products.map((p) => `- ${p.name}`).join('\n')}`,
      toolResults,
      proposals: [],
    };
  }

  // Top selling
  if (/\b(sold the most|top[- ]?selling|best[- ]?seller|most sold|weekly sales|sales this week)\b/i.test(lower)) {
    const result = await executeTool('get_top_selling_products', { limit: 5 }, user);
    const toolResults = [{ tool: 'get_top_selling_products', result }];
    const r = result as { topSelling: Array<{ name: string; quantity: number }>; message?: string };
    if (!r.topSelling?.length) {
      return { handled: true, reply: 'No sales recorded this week yet.', toolResults, proposals: [] };
    }
    const lines = r.topSelling.map((p, i) => `${i + 1}. **${p.name}** — ${p.quantity} sold`);
    return {
      handled: true,
      reply: `${r.message || 'Top sellers this week:'}\n${lines.join('\n')}`,
      toolResults,
      proposals: [],
    };
  }

  // Recent movements
  if (/\b(recent stock|stock (changes|movements|history)|latest (movements|changes)|activity)\b/i.test(lower)) {
    const result = await executeTool('get_stock_movements', { limit: 10 }, user);
    const toolResults = [{ tool: 'get_stock_movements', result }];
    const r = result as {
      movements: Array<{
        type: string;
        quantity: number;
        product: string;
        performedBy: string;
        createdAt: string;
      }>;
    };
    if (!r.movements?.length) {
      return { handled: true, reply: 'No recent stock movements found.', toolResults, proposals: [] };
    }
    const lines = r.movements.map(
      (m) =>
        `- ${m.type} **${m.quantity}** ${m.product} by ${m.performedBy} (${new Date(m.createdAt).toLocaleString()})`
    );
    return {
      handled: true,
      reply: `Recent stock changes:\n${lines.join('\n')}`,
      toolResults,
      proposals: [],
    };
  }

  // Inventory summary
  if (/\b(inventory summary|how many products|stock summary|overview)\b/i.test(lower)) {
    const result = await executeTool('get_inventory_summary', {}, user);
    const toolResults = [{ tool: 'get_inventory_summary', result }];
    const r = result as Record<string, unknown>;
    return {
      handled: true,
      reply: `Inventory summary:\n- Products: ${r.totalProducts}\n- Stock units: ${r.totalStockUnits}\n- Low stock: ${r.lowStockCount}\n- Out of stock: ${r.outOfStockCount}${
        r.inventoryValuation ? `\n- Valuation: ${r.inventoryValuation}` : ''
      }`,
      toolResults,
      proposals: [],
    };
  }

  // Sales summary
  if (/\b(sales summary|units sold|how many.*sold)\b/i.test(lower) && !/\bsell\s+\d+/i.test(lower)) {
    const result = await executeTool('get_sales_summary', {}, user);
    const toolResults = [{ tool: 'get_sales_summary', result }];
    const r = result as { unitsSold?: number; saleEvents?: number; revenue?: string };
    return {
      handled: true,
      reply: `This week's sales:\n- Sale events: ${r.saleEvents}\n- Units sold: **${r.unitsSold}**${
        r.revenue ? `\n- Revenue: ${r.revenue}` : ''
      }`,
      toolResults,
      proposals: [],
    };
  }

  // Stock-in
  if (/(?:add|stock\s*in|receive|restock)\s+\d+/i.test(text)) {
    const cleaned = text.replace(/[?.!]+$/g, '').trim();
    const m =
      cleaned.match(/(?:add|stock\s*in|receive|restock)\s+(\d+)\s+(.+?)(?:\s+from\s+(.+))$/i) ||
      cleaned.match(/(?:add|stock\s*in|receive|restock)\s+(\d+)\s+(.+)/i);
    if (m) {
      const quantity = Number(m[1]);
      let productQuery = (m[2] || '').replace(/\s+from\s+.+$/i, '').trim();
      productQuery = productQuery.replace(/\b(pcs|units|bags|items)\b/gi, '').trim();
      const supplierQuery = (m[3] || '').trim() || undefined;
      const result = await executeTool(
        'prepare_stock_in',
        { productQuery, quantity, supplierQuery },
        user
      );
      const toolResults = [{ tool: 'prepare_stock_in', result }];
      if ((result as { error?: string }).error) {
        return { handled: true, reply: (result as { error: string }).error, toolResults, proposals: [] };
      }
      if ((result as { ambiguous?: boolean }).ambiguous) {
        return { handled: true, reply: (result as { message: string }).message, toolResults, proposals: [] };
      }
      if ((result as { denied?: boolean }).denied) {
        return { handled: true, reply: (result as { message: string }).message, toolResults, proposals: [] };
      }
      const proposal = (result as { proposal: unknown }).proposal;
      return {
        handled: true,
        reply:
          'I prepared a stock-in proposal. Review the card below — stock will not change until you confirm.',
        toolResults,
        proposals: proposal ? [proposal] : [],
      };
    }
  }

  // Sell / damaged / stock out
  const outMatch = text.match(/(?:sell|sold|record\s+sale\s+of|sale\s+of)\s+(\d+)\s+(.+)/i);
  const dmgMatch =
    text.match(/(?:record\s+)?(\d+)\s+damaged\s+(.+)/i) || text.match(/damaged\s+(\d+)\s+(.+)/i);
  const outStockMatch = text.match(/(?:stock\s*out|remove|take out)\s+(\d+)\s+(.+)/i);

  if (outMatch || dmgMatch || outStockMatch) {
    let quantity = 0;
    let productQuery = '';
    let actionType: 'SALE' | 'DAMAGED' | 'STOCK_OUT' = 'SALE';
    if (outMatch) {
      quantity = Number(outMatch[1]);
      productQuery = outMatch[2].trim();
      actionType = 'SALE';
    } else if (dmgMatch) {
      quantity = Number(dmgMatch[1]);
      productQuery = dmgMatch[2].trim();
      actionType = 'DAMAGED';
    } else if (outStockMatch) {
      quantity = Number(outStockMatch[1]);
      productQuery = outStockMatch[2].trim();
      actionType = 'STOCK_OUT';
    }
    productQuery = productQuery.replace(/\b(pcs|units|bags|items)\b/gi, '').replace(/\.$/, '').trim();
    const result = await executeTool(
      'prepare_stock_out',
      { productQuery, quantity, actionType },
      user
    );
    const toolResults = [{ tool: 'prepare_stock_out', result }];
    if ((result as { error?: string }).error) {
      return { handled: true, reply: (result as { error: string }).error, toolResults, proposals: [] };
    }
    if ((result as { ambiguous?: boolean }).ambiguous) {
      return { handled: true, reply: (result as { message: string }).message, toolResults, proposals: [] };
    }
    const proposal = (result as { proposal: unknown }).proposal;
    return {
      handled: true,
      reply:
        'I prepared a stock update proposal. Review the card below — stock will not change until you confirm.',
      toolResults,
      proposals: proposal ? [proposal] : [],
    };
  }

  // Quantity / stock left questions (custom phrasing)
  const stockAsk =
    /\b(how many|how much|stock (of|for|left|level)|quantity|qty|do we have|available|left in stock|in stock|check stock|what.?s the stock)\b/i.test(
      lower
    );

  if (stockAsk) {
    let chunk = text
      .replace(/^.*?\b(?:how many|how much|stock (?:of|for|level)|quantity of|qty of|do we have|check stock(?: of)?|what'?s the stock(?: of)?)\b/i, '')
      .replace(/\b(are left|left|do we have|in stock|available|currently)\b/gi, '')
      .replace(/[?!.]/g, '')
      .trim();

    const parts = chunk
      .split(/\s*(?:,|&|\band\b)\s*/i)
      .map((p) =>
        p
          .replace(/\b(bags?|pcs|units|items|cartons|bottles|packs?)\b/gi, '')
          .replace(/\bhow many\b/gi, '')
          .trim()
      )
      .filter((p) => p.length > 1 && !/^(of|the|a|an|we|have|for|our)$/i.test(p));

    if (parts.length >= 2) {
      const result = await executeTool('get_multiple_product_stocks', { queries: parts }, user);
      const toolResults = [{ tool: 'get_multiple_product_stocks', result }];
      const r = result as {
        results: Array<{
          query: string;
          found: boolean;
          name?: string;
          currentStock?: number;
          unit?: string;
          ambiguous?: boolean;
          matches?: Array<{ name: string }>;
        }>;
      };
      const lines = r.results.map((row) => {
        if (row.found) return `- ${formatStockLine(row.name!, row.currentStock!, row.unit)}`;
        if (row.ambiguous) {
          return `- "${row.query}": multiple matches (${row.matches?.map((m) => m.name).join(', ')})`;
        }
        return `- "${row.query}": not found`;
      });
      return {
        handled: true,
        reply: `Current stock levels:\n${lines.join('\n')}`,
        toolResults,
        proposals: [],
      };
    }

    const query = (parts[0] || chunk)
      .replace(/\b(bags?|pcs|units|items|of)\b/gi, '')
      .trim();
    if (query.length > 1) {
      return answerProductStock(user, query);
    }
  }

  // Custom inventory question → product search fallback (still on-topic)
  return searchFallback(user, text);
}
