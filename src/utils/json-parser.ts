import { RoadmapData } from "../types/roadmap.types";

/**
 * Attempts to parse JSON with multiple repair strategies
 */
export function parseRoadmapJSON(content: string): RoadmapData {
  // Clean Markdown code blocks if present
  let jsonStr = content.trim();
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  // Attempt parsing with progressive repair strategies
  const strategies = [
    // Strategy 1: Parse as-is
    () => JSON.parse(jsonStr),

    // Strategy 2: Find last closing brace and truncate
    () => {
      const lastBrace = jsonStr.lastIndexOf("}");
      if (lastBrace === -1) throw new Error("No closing brace found");
      const truncated = jsonStr.substring(0, lastBrace + 1);
      return JSON.parse(truncated);
    },

    // Strategy 3: Remove trailing commas before closing braces/brackets
    () => {
      const noTrailing = jsonStr
        .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas before } or ]
        .replace(/,(\s*)$/g, "$1"); // Remove trailing comma at end
      return JSON.parse(noTrailing);
    },

    // Strategy 4: Combine truncation and comma removal
    () => {
      const lastBrace = jsonStr.lastIndexOf("}");
      if (lastBrace === -1) throw new Error("No closing brace found");
      const truncated = jsonStr.substring(0, lastBrace + 1);
      const noTrailing = truncated
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/,(\s*)$/g, "$1");
      return JSON.parse(noTrailing);
    },
  ];

  let lastError: Error | null = null;

  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (i > 0) {
        console.log(
          `[JSON-Parser] Successfully parsed using strategy ${i + 1}`
        );
      }
      return result;
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }

  // All strategies failed
  throw new Error(
    `Failed to parse roadmap JSON after ${strategies.length} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Validates that parsed data has required roadmap structure
 */
export function validateRoadmapData(data: any): data is RoadmapData {
  return (
    data &&
    typeof data === "object" &&
    Array.isArray(data.phases) &&
    data.phases.length > 0
  );
}

/**
 * Safely parses and validates roadmap JSON
 */
export function parseAndValidateRoadmap(content: string): RoadmapData | null {
  try {
    let parsed = parseRoadmapJSON(content) as any;

    // Auto-unwrap common wrappers
    if (parsed.roadmap && typeof parsed.roadmap === "object") {
      parsed = parsed.roadmap as any;
    } else if (parsed.data && typeof parsed.data === "object") {
      parsed = parsed.data as any;
    }

    if (!validateRoadmapData(parsed)) {
      console.error(
        "[JSON-Parser] Validation failed: Missing or invalid phases array. Keys found:",
        Object.keys(parsed)
      );
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("[JSON-Parser] Parse error:", error);
    return null;
  }
}
