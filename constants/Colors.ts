export interface Theme {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  border: string;
  danger: string;
  success: string;
}

export const Colors: Record<'light' | 'dark', Theme> = {
  light: {
    background: '#FFFFFF',
    surface: '#F4F4F7',
    text: '#16161A',
    textMuted: '#6B6B76',
    primary: '#6C5CE7',
    onPrimary: '#FFFFFF',
    border: '#E2E2E8',
    danger: '#D64545',
    success: '#2E9E5B',
  },
  dark: {
    background: '#000000',
    surface: '#17171C',
    text: '#FFFFFF',
    textMuted: '#9A9AA5',
    primary: '#8B7CF7',
    onPrimary: '#FFFFFF',
    border: '#2A2A32',
    danger: '#E06666',
    success: '#4CBF7A',
  },
};
