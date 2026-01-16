/**
 * Roadmap phase structure
 */
export interface RoadmapPhase {
  phase_number: number;
  phase_title: string;
  description: string;
  duration: string;
  topics: RoadmapTopic[];
}

/**
 * Roadmap topic structure
 */
export interface RoadmapTopic {
  topic_name: string;
  description: string;
  resources: RoadmapResource[];
  practice_projects?: string[];
}

/**
 * Roadmap resource structure
 */
export interface RoadmapResource {
  title: string;
  url: string;
  type: "documentation" | "tutorial" | "video" | "article" | "course" | "other";
}

/**
 * Complete roadmap data structure
 */
export interface RoadmapData {
  goal: string;
  intent?: string; // Fix: was missing
  proficiency: string;
  total_duration: string;
  phases: RoadmapPhase[];
}

/**
 * User context for roadmap generation
 */
export interface UserContext {
  user_id: string;
  user_name: string;
  known_technologies: string[];
}

/**
 * FastAPI stream request payload
 */
export interface FastAPIStreamPayload {
  message: string;
  conversation_history: ConversationMessage[];
  user_context: UserContext;
  strict_mode?: boolean; // Matches Python snake_case
}

/**
 * Conversation message structure
 */
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * SSE event types
 */
export interface SSETokenEvent {
  event: "token";
  data: string;
}

export interface SSEErrorEvent {
  event: "error";
  data: string;
}

export type SSEEvent = SSETokenEvent | SSEErrorEvent;
