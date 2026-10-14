import type { Analysis, Channel, ChatTurn, LeadInput, Tone } from "./schemas";
import type { PriorityResult } from "./scoring";

export interface StoredAnalysis {
  data: Analysis;
  priority: PriorityResult;
  model: string;
  analyzedAt: number;
  /** Fingerprint of the lead input the analysis was produced from. */
  inputHash: string;
}

export interface ChatMessage extends ChatTurn {
  id: string;
  at: number;
}

export interface FollowUpDraftRecord {
  message: string;
  subject: string;
  addresses: string[];
  tone: Tone;
  channel: Channel;
  model: string;
  generatedAt: number;
}

export interface FollowUp {
  id: string;
  title: string;
  channel: Channel;
  dueAt: number;
  status: "pending" | "done";
  /** "ai" = accepted from the AI's recommended next action; "user" = added by the salesperson. */
  origin: "ai" | "user";
  createdAt: number;
  completedAt?: number;
  outcome?: string;
  draft?: FollowUpDraftRecord;
}

export interface Lead {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Seeded demo data, not a real customer. */
  isSample: boolean;
  input: LeadInput;
  analysis?: StoredAnalysis;
  chat: ChatMessage[];
  followUps: FollowUp[];
}

export type FollowUpState = "done" | "overdue" | "due_today" | "upcoming";
