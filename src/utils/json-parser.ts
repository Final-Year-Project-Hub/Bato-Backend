// ============================================================================
// CORE PARSING LOGIC
// ============================================================================

/**
 * The Master Parser: Handles all LLM quirks in one place.
 * 1. Markdown code blocks
 * 2. Preambles/Postscripts (finding outer braces)
 * 3. C-style comments (// and / * ... * /)
 * 4. Trailing commas (via regex strategy)
 */
import { randomUUID } from "crypto";

export function baseParseJSON(content: string): any {
  if (!content) throw new Error("Empty input");

  let jsonStr = content.trim();

  // 1. Initial Markdown Cleanup
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

  // 2. Robust Extraction (Find outer braces)
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }

  // 3. Strip Comments (Crucial for "jsx" or commented lines)
  jsonStr = stripComments(jsonStr);

  // 4. Sanitize Control Characters (Fix streaming issues)
  jsonStr = sanitizeControlCharacters(jsonStr);

  // 5. Handle Double Braces (Common LLM Hallucination)
  if (jsonStr.startsWith("{{")) {
    jsonStr = jsonStr.replace("{{", "{");
  }
  if (jsonStr.endsWith("}}")) {
    jsonStr = jsonStr.substring(0, jsonStr.length - 2) + "}";
  }

  // 6. Attempt Parsing with Strategies
  const strategies = [
    // A: Clean Parse
    () => JSON.parse(jsonStr),

    // B: Remove Trailing Commas
    () => {
      const noTrailing = jsonStr
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/,(\s*)$/g, "$1");
      return JSON.parse(noTrailing);
    },

    // C: Fix Unterminated Strings (streaming cutoff)
    () => {
      const fixed = fixUnterminatedStrings(jsonStr);
      return JSON.parse(fixed);
    },

    // D: Repair Incomplete JSON Structure
    () => {
      const repaired = repairIncompleteJSON(jsonStr);
      return JSON.parse(repaired);
    },
  ];

  let lastError: Error | null = null;
  for (const strategy of strategies) {
    try {
      return strategy();
    } catch (e) {
      lastError = e as Error;
    }
  }

  throw new Error(`JSON Parse failed: ${lastError?.message}`);
}

/**
 * Strips C-style comments from a string, preserving strings and regex literals.
 */
function stripComments(str: string): string {
  let result = "";
  let i = 0;
  const len = str.length;
  let inString = false;
  let stringChar = ""; // ' or "
  let inComment = false; // // or /*

  while (i < len) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (!inString && !inComment) {
      if (char === '"') {
        inString = true;
        stringChar = '"';
        result += char;
        i++;
        continue;
      }
      if (char === "/" && nextChar === "/") {
        i += 2;
        while (i < len && str[i] !== "\n" && str[i] !== "\r") i++;
        continue;
      }
      if (char === "/" && nextChar === "*") {
        i += 2;
        while (i < len && !(str[i] === "*" && str[i + 1] === "/")) i++;
        i += 2;
        continue;
      }
    } else if (inString) {
      if (char === stringChar && str[i - 1] !== "\\") inString = false;
    }

    if (!inComment) result += char;
    i++;
  }
  return result;
}

/**
 * Sanitize control characters in JSON strings
 * Escapes unescaped newlines, tabs, and other control characters
 */
function sanitizeControlCharacters(str: string): string {
  let result = "";
  let inString = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];
    const prevChar = i > 0 ? str[i - 1] : "";

    // Track if we're inside a string
    if (char === '"' && prevChar !== "\\") {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    // If inside a string, escape control characters
    if (inString) {
      if (char === "\n" && prevChar !== "\\") {
        result += "\\n";
      } else if (char === "\r" && prevChar !== "\\") {
        result += "\\r";
      } else if (char === "\t" && prevChar !== "\\") {
        result += "\\t";
      } else if (char.charCodeAt(0) < 32 && prevChar !== "\\") {
        // Other control characters
        result += "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0");
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    i++;
  }

  return result;
}

/**
 * Fix unterminated strings by closing them properly
 */
function fixUnterminatedStrings(str: string): string {
  // Count quotes to see if we have an unterminated string
  let quoteCount = 0;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (str[i] === '"' && !escaped) {
      quoteCount++;
    }
    escaped = false;
  }

  // If odd number of quotes, we have an unterminated string
  if (quoteCount % 2 !== 0) {
    // Find the last quote and close the string
    const lastQuote = str.lastIndexOf('"');
    if (lastQuote !== -1) {
      // Add closing quote before any trailing braces
      let insertPos = str.length;
      // Find where to insert the closing quote (before } or ])
      for (let i = str.length - 1; i > lastQuote; i--) {
        if (str[i] === "}" || str[i] === "]") {
          insertPos = i;
        }
      }
      str = str.substring(0, insertPos) + '"' + str.substring(insertPos);
    }
  }

  return str;
}

/**
 * Repair incomplete JSON by closing unclosed braces/brackets
 */
function repairIncompleteJSON(str: string): string {
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === "\\" && !escaped) {
      escaped = true;
      continue;
    }

    if (char === '"' && !escaped) {
      inString = !inString;
    }

    if (!inString) {
      if (char === "{") openBraces++;
      if (char === "}") openBraces--;
      if (char === "[") openBrackets++;
      if (char === "]") openBrackets--;
    }

    escaped = false;
  }

  // Close any unclosed strings first
  if (inString) {
    str += '"';
  }

  // Close unclosed brackets and braces
  while (openBrackets > 0) {
    str += "]";
    openBrackets--;
  }
  while (openBraces > 0) {
    str += "}";
    openBraces--;
  }

  return str;
}

// ============================================================================
// TYPE-SPECIFIC WRAPPERS
// ============================================================================

import { RoadmapData } from "../types/roadmap.types";
import { TopicDetail } from "../types/topic.types";

export function parseRoadmapJSON(content: string): RoadmapData {
  const parsed = baseParseJSON(content);
  // Optional: Add specific roadmap validation if needed here,
  // currently we return strict type but validRoadmapData is called by consumer usually?
  // Use parseAndValidateRoadmap for full safety.
  return parsed as RoadmapData;
}

export function validateRoadmapData(data: any): data is RoadmapData {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.phases) &&
    data.phases.length > 0
  );
}

export function parseAndValidateRoadmap(content: string): RoadmapData | null {
  try {
    let parsed = baseParseJSON(content);

    // Auto-unwrap common wrappers
    if (parsed.roadmap && typeof parsed.roadmap === "object") {
      parsed = parsed.roadmap;
    } else if (parsed.data && typeof parsed.data === "object") {
      parsed = parsed.data;
    }

    if (!validateRoadmapData(parsed)) {
      console.error("[JSON-Parser] Roadmap Validation Failed");
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("[JSON-Parser] Roadmap Parse Error:", error);
    return null;
  }
}

export function validateTopicDetail(data: any): data is TopicDetail {
  return (
    data &&
    typeof data === "object" &&
    typeof data.title === "string" && // Strict check
    typeof data.overview === "string"
  );
}

export function parseAndValidateTopicDetail(
  content: string,
): TopicDetail | null {
  try {
    const parsed = baseParseJSON(content);
    if (!validateTopicDetail(parsed)) {
      console.error("[JSON-Parser] Topic Validation Failed");
      return null;
    }
    return parsed;
  } catch (error) {
    console.error(
      `[JSON-Parser] Topic Parse Error: ${(error as Error).message}`,
    );
    return null;
  }
}

export function ensureRoadmapIds(roadmapData: any) {
  if (!roadmapData?.phases || !Array.isArray(roadmapData.phases))
    return roadmapData;

  roadmapData.phases = roadmapData.phases.map((phase: any, pIndex: number) => {
    const phaseId = phase.id || randomUUID();

    const topics = Array.isArray(phase.topics) ? phase.topics : [];
    const topicsWithIds = topics.map((topic: any, tIndex: number) => ({
      ...topic,
      id: topic.id || randomUUID(),
      order: topic.order ?? tIndex + 1,
    }));

    return {
      ...phase,
      id: phaseId,
      phase_number: phase.phase_number ?? pIndex + 1,
      topics: topicsWithIds,
    };
  });

  return roadmapData;
}

// Deprecated alias for backward compatibility (can remove if verified unused)
export const robustJsonParse = baseParseJSON;
