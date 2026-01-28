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

  // 4. Handle Double Braces (Common LLM Hallucination)
  // Logic: If it starts with "{{", replace with "{". Same for end "}}".
  if (jsonStr.startsWith("{{")) {
    jsonStr = jsonStr.replace("{{", "{");
  }
  if (jsonStr.endsWith("}}")) {
    jsonStr = jsonStr.substring(0, jsonStr.length - 2) + "}";
  }

  // 4. Attempt Parsing with Strategies
  const strategies = [
    // A: Clean Parse
    () => JSON.parse(jsonStr),

    // B: Remove Trailing Commas (Common LLM error)
    () => {
      const noTrailing = jsonStr
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/,(\s*)$/g, "$1");
      return JSON.parse(noTrailing);
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

// Deprecated alias for backward compatibility (can remove if verified unused)
export const robustJsonParse = baseParseJSON;
