/**
 * Topic-related types matching Bato-Ai's TopicDetail schema
 */

export interface LearningResource {
  title: string;
  type: string; // article, video, tutorial, documentation
  url?: string;
  estimated_time?: string;
}

export interface PracticeExercise {
  title: string;
  description: string;
  difficulty: string; // beginner, intermediate, advanced
  estimated_time: string;
}

// New nested section interfaces
export interface IntroductionSection {
  markdown: string;
}

export interface DetailedCoreConcept {
  title: string;
  markdown: string;
  key_points: string[];
}

export interface CodeExample {
  title: string;
  language: string; // jsx, ts, js, python, etc
  code: string;
  explanation_markdown: string;
}

export interface RealWorldExample {
  title: string;
  markdown: string;
}

export interface HypotheticalScenario {
  title: string;
  markdown: string;
}

export interface TopicSections {
  introduction: IntroductionSection;
  detailed_core_concepts: DetailedCoreConcept[];
  code_examples: CodeExample[];
  real_world_examples: RealWorldExample[];
  hypothetical_scenario?: HypotheticalScenario;
  key_characteristics: string[];
}

export interface TopicDetail {
  // Basic info
  title: string;
  phase_number: number;
  phase_title: string;

  // Main content sections (nested structure)
  sections: TopicSections;

  // Supporting content
  why_important: string;
  key_concepts: string[];

  // Learning path
  learning_objectives: string[];
  learning_resources: LearningResource[];
  practice_exercises: PracticeExercise[];

  // Next steps
  related_topics: string[];
  next_topic?: string;

  // Metadata
  estimated_hours: number;
  difficulty_level: string;
  doc_links: string[];
}
