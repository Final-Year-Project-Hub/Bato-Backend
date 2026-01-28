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

export interface TopicDetail {
  title: string;
  phase_number: number;
  phase_title: string;
  overview: string;
  why_important: string;
  key_concepts: string[];
  prerequisites: string[];
  learning_objectives: string[];
  learning_resources: LearningResource[];
  practice_exercises: PracticeExercise[];
  related_topics: string[];
  next_topic?: string;
  estimated_hours: number;
  difficulty_level: string;
  doc_links: string[];
}
