export type ChatBackgroundId = 'aurora' | 'midnight' | 'rose' | 'forest' | 'ocean';

export type ChatBackgroundPreset = {
  id: ChatBackgroundId;
  name: string;
  preview: readonly [string, string];
  gradient: readonly [string, string, string];
  glows: readonly [string, string, string];
};

export type ChatBackgroundSettings = {
  background_id: string;
  background_image_url?: string | null;
  background_opacity: number;
};

export const defaultChatBackgroundId: ChatBackgroundId = 'aurora';
export const defaultChatBackgroundOpacity = 0.38;

export const chatBackgroundPresets: ChatBackgroundPreset[] = [
  {
    id: 'aurora',
    name: 'Aurora Glass',
    preview: ['#B94CFF', '#25D6FF'],
    gradient: ['#120029', '#07030F', '#050009'],
    glows: ['rgba(185, 76, 255, 0.52)', 'rgba(37, 214, 255, 0.3)', 'rgba(255, 122, 92, 0.22)'],
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    preview: ['#123B7A', '#46D5FF'],
    gradient: ['#06162D', '#030814', '#010307'],
    glows: ['rgba(70, 213, 255, 0.36)', 'rgba(48, 94, 255, 0.28)', 'rgba(255, 255, 255, 0.1)'],
  },
  {
    id: 'rose',
    name: 'Rose Quartz',
    preview: ['#FF6B9A', '#FFC1A1'],
    gradient: ['#32111F', '#150713', '#050204'],
    glows: ['rgba(255, 107, 154, 0.42)', 'rgba(255, 193, 161, 0.28)', 'rgba(185, 76, 255, 0.18)'],
  },
  {
    id: 'forest',
    name: 'Emerald Mist',
    preview: ['#20E3B2', '#6DFB8D'],
    gradient: ['#062519', '#03100C', '#010504'],
    glows: ['rgba(32, 227, 178, 0.36)', 'rgba(109, 251, 141, 0.24)', 'rgba(37, 214, 255, 0.16)'],
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    preview: ['#0477BF', '#20E3FF'],
    gradient: ['#021F32', '#03101C', '#010407'],
    glows: ['rgba(4, 119, 191, 0.4)', 'rgba(32, 227, 255, 0.26)', 'rgba(185, 76, 255, 0.14)'],
  },
];

export const getChatBackgroundPreset = (id?: string | null) => (
  chatBackgroundPresets.find((preset) => preset.id === id) || chatBackgroundPresets[0]
);

export const normalizeBackgroundOpacity = (opacity?: number | null) => {
  if (typeof opacity !== 'number' || Number.isNaN(opacity)) return defaultChatBackgroundOpacity;
  return Math.min(0.85, Math.max(0.12, opacity));
};

export const defaultChatBackgroundSettings: ChatBackgroundSettings = {
  background_id: defaultChatBackgroundId,
  background_image_url: null,
  background_opacity: defaultChatBackgroundOpacity,
};
