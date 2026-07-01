export interface Rank {
  id: number;
  title: string;
  emoji: string;
  min_messages: number;
  sort_order: number;
  group_choice_key?: string; // e.g. "high1" if there is a choice
}

export interface User {
  user_id: number;
  first_name: string;
  username?: string;
  message_count: number;
  current_rank_id: number | null;
  last_message_at: number;
  is_owner?: boolean;
}

export interface SimulatedMessage {
  id: string;
  user_id: number;
  first_name: string;
  username?: string;
  text: string;
  timestamp: number;
  is_bot: boolean;
  reply_to_message_id?: string;
  inline_buttons?: Array<{ text: string; callback_data: string }>;
  tag?: string; // Tag shown next to user name
}

export interface SqlLog {
  id: string;
  timestamp: string;
  query: string;
  params?: string;
  type: 'select' | 'insert' | 'update' | 'delete' | 'schema';
}
