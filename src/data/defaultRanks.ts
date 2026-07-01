import { Rank } from '../types';

export const defaultRanks: Rank[] = [
  {
    id: 1,
    title: 'سرباز سوم',
    emoji: '🥉',
    min_messages: 0,
    sort_order: 10
  },
  {
    id: 2,
    title: 'سرباز دوم',
    emoji: '🥈',
    min_messages: 50,
    sort_order: 20
  },
  {
    id: 3,
    title: 'سرباز اول',
    emoji: '🥇',
    min_messages: 150,
    sort_order: 30
  },
  {
    id: 4,
    title: 'سرلشکر',
    emoji: '🎖️',
    min_messages: 1000,
    sort_order: 40,
    group_choice_key: 'high1'
  },
  {
    id: 5,
    title: 'سپهبد',
    emoji: '🎖️',
    min_messages: 1000,
    sort_order: 50,
    group_choice_key: 'high1'
  },
  {
    id: 6,
    title: 'ارتشبد',
    emoji: '👑',
    min_messages: 2500,
    sort_order: 60
  },
  {
    id: 7,
    title: 'پادشاه',
    emoji: '🔱',
    min_messages: 5000,
    sort_order: 70
  }
];
