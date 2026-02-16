import { randomUUID } from "crypto";

export function baseParseJSON(content: string): any {
  if (!content) throw new Error("Empty input");
  let jsonStr = content.trim();

  // 1. Initial Markdown Cleanup
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  else if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);

  // 2. Pre-escape Markdown Code Blocks BEFORE any other processing
  // (Must run before sanitizeControlCharacters to avoid double-escaping newlines)
  jsonStr = escapeMarkdownCodeBlocks(jsonStr);

  // 3. Robust Extraction (Find outermost object OR array)
  // FIX Bug 5: Also handle array-root JSON like [{ ... }]
  const firstBrace = jsonStr.indexOf("{");
  const firstBracket = jsonStr.indexOf("[");
  const lastBrace = jsonStr.lastIndexOf("}");
  const lastBracket = jsonStr.lastIndexOf("]");

  const hasObject =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
  const hasArray =
    firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

  if (hasObject && hasArray) {
    // Pick whichever root container starts first
    if (firstBrace < firstBracket) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    } else {
      jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
    }
  } else if (hasObject) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  } else if (hasArray) {
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
  }

  // 4. Strip Comments
  jsonStr = stripComments(jsonStr);

  // 5. Sanitize Control Characters (Fix streaming issues)
  jsonStr = sanitizeControlCharacters(jsonStr);

  // 6. Handle Double Braces (Common LLM Hallucination)
  if (jsonStr.startsWith("{{")) {
    jsonStr = jsonStr.replace("{{", "{");
  }
  if (jsonStr.endsWith("}}")) {
    jsonStr = jsonStr.substring(0, jsonStr.length - 2) + "}";
  }

  // 7. Fix Bad Escapes — scoped to string values only
  // FIX Bug 7: Apply only inside string values, not globally
  jsonStr = fixBadEscapes(jsonStr);

  // 8. Attempt Parsing with Strategies
  const strategies = [
    // A: Clean Parse
    () => JSON.parse(jsonStr),

    // B: Remove Trailing Commas (Enhanced)
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

    // D: Repair Incomplete JSON Structure (with trailing comma fix)
    () => {
      let repaired = repairIncompleteJSON(jsonStr);
      repaired = repaired.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(repaired);
    },

    // E: Aggressive Cleanup (for "Expected property name" error)
    () => {
      const aggressive = jsonStr.replace(/[^"0-9a-zA-Z\s]+(\s*[}])/g, "$1");
      return JSON.parse(aggressive);
    },

    // F: Fix "Expected property name or '}'" - aggressive trailing comma removal
    () => {
      // Remove commas followed by any whitespace (including newlines) and then }
      let fixed = jsonStr.replace(/,\s*}/g, "}");
      // Remove commas followed by any whitespace and then ]
      fixed = fixed.replace(/,\s*]/g, "]");
      // Remove any orphaned commas at the end of lines before closing braces
      fixed = fixed.replace(/,(\s*[\r\n]+\s*[}\]])/g, "$1");
      return JSON.parse(fixed);
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

// ============================================================================
// HELPER: isEscaped
// Checks whether the character at position `index` in `str` is preceded by an
// odd number of backslashes (i.e. it IS escaped).
// ============================================================================
function isEscaped(str: string, index: number): boolean {
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && str[i] === "\\") {
    backslashCount++;
    i--;
  }
  return backslashCount % 2 !== 0;
}

// ============================================================================
// FIX Bug 7: fixBadEscapes — scoped to string values only
// Fixes bad escaped characters inside JSON string values.
// e.g., "path": "C:\Windows" -> "path": "C:\\Windows"
// ============================================================================
function fixBadEscapes(str: string): string {
  let result = "";
  let inString = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    // Toggle string tracking using the robust isEscaped helper
    if (char === '"' && !isEscaped(str, i)) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (inString && char === "\\") {
      const next = str[i + 1];
      // Valid JSON escape sequences: " \ / b f n r t u
      if (next && /["\\/bfnrtu]/.test(next)) {
        // Valid escape — keep as-is
        result += char;
      } else {
        // Invalid escape — double the backslash
        result += "\\\\";
      }
      i++;
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

// ============================================================================
// FIX Bug 4 + Bug 6: escapeMarkdownCodeBlocks
// Escapes newlines and ONLY unescaped quotes inside ``` blocks.
// Must be called BEFORE sanitizeControlCharacters to prevent double-escaping.
// ============================================================================
function escapeMarkdownCodeBlocks(str: string): string {
  return str.replace(/```[\s\S]*?```/g, (match) => {
    let content = match;
    // Escape newlines and carriage returns
    content = content.replace(/\n/g, "\\n");
    content = content.replace(/\r/g, "\\r");
    // FIX Bug 4: Only escape unescaped quotes to avoid double-escaping \"
    content = content.replace(/(?<!\\)"/g, '\\"');
    return content;
  });
}

// ============================================================================
// FIX Bug 1 + Bug 2: stripComments
// Strips // and /* */ comments, correctly tracking escape sequences in strings.
// ============================================================================
function stripComments(str: string): string {
  let result = "";
  let i = 0;
  const len = str.length;
  let inString = false;

  while (i < len) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (!inString) {
      // Detect start of string
      if (char === '"') {
        inString = true;
        result += char;
        i++;
        continue;
      }
      // Detect // line comment
      if (char === "/" && nextChar === "/") {
        i += 2;
        while (i < len && str[i] !== "\n" && str[i] !== "\r") i++;
        continue;
      }
      // Detect /* block comment */
      if (char === "/" && nextChar === "*") {
        i += 2;
        while (i < len && !(str[i] === "*" && str[i + 1] === "/")) i++;
        i += 2; // skip closing */
        continue;
      }
      result += char;
    } else {
      // Inside a string — use isEscaped to correctly detect end of string
      // FIX Bug 2: replaced `str[i-1] !== "\\"` with proper escaped-backslash check
      if (char === '"' && !isEscaped(str, i)) {
        inString = false;
      }
      result += char;
    }

    i++;
  }

  return result;
}

// ============================================================================
// FIX Bug 3: sanitizeControlCharacters
// Escapes unescaped control characters inside JSON string values.
// Uses isEscaped() for reliable quote and escape tracking.
// ============================================================================
function sanitizeControlCharacters(str: string): string {
  let result = "";
  let inString = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    // FIX Bug 3: Use isEscaped() instead of fragile prevChar check
    if (char === '"' && !isEscaped(str, i)) {
      inString = !inString;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      const code = char.charCodeAt(0);
      // Only escape truly raw (unescaped) control characters
      if (char === "\n") {
        result += "\\n";
      } else if (char === "\r") {
        result += "\\r";
      } else if (char === "\t") {
        result += "\\t";
      } else if (code < 32) {
        result += "\\u" + code.toString(16).padStart(4, "0");
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

// ============================================================================
// fixUnterminatedStrings — unchanged, logic was correct
// ============================================================================
function fixUnterminatedStrings(str: string): string {
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

  if (quoteCount % 2 !== 0) {
    const lastQuote = str.lastIndexOf('"');
    if (lastQuote !== -1) {
      let insertPos = str.length;
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

// ============================================================================
// FIX Bug 8: repairIncompleteJSON
// Removed unused openBraces / openBrackets counters.
// ============================================================================
function repairIncompleteJSON(str: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

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
      if (char === "{") {
        stack.push("}");
      } else if (char === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "}") stack.pop();
      } else if (char === "[") {
        stack.push("]");
      } else if (char === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "]") stack.pop();
      }
    }

    escaped = false;
  }

  // Close any unclosed string first
  if (inString) {
    str += '"';
  }

  // Handle hanging comma or colon
  const trimmed = str.trimEnd();
  if (trimmed.endsWith(",")) {
    str = trimmed.slice(0, -1);
  } else if (trimmed.endsWith(":")) {
    str = trimmed + "null";
  }

  // Close unclosed brackets/braces in reverse order
  while (stack.length > 0) {
    str += stack.pop();
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
  if (!data || typeof data !== "object") return false;

  // Check for new structure (sections object)
  if (data.sections && typeof data.sections === "object") {
    const hasIntroduction =
      data.sections.introduction &&
      typeof data.sections.introduction.markdown === "string";
    return typeof data.title === "string" && hasIntroduction;
  }

  // Fallback check for old structure (backward compatibility)
  return (
    typeof data.title === "string" &&
    (typeof data.overview === "string" ||
      (typeof data.sections === "object" && data.sections !== null))
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
