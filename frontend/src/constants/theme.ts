export const theme = {
  colors: {
    // Primary Brand Colors
    primary: '#4F46E5',         // Professional indigo
    secondary: '#10B981',       // Success emerald
    tertiary: '#F59E0B',        // Warning amber

    // Background Colors
    background: '#FFFFFF',      // Clean white
    backgroundAlt: '#F8FAFC',   // Light gray alternative
    backgroundCard: '#FFFFFF',  // Card background

    // Text Colors
    textPrimary: '#1F2937',     // Dark gray for primary text
    textSecondary: '#6B7280',   // Medium gray for secondary text
    textMuted: '#9CA3AF',       // Light gray for muted text
    textOnPrimary: '#FFFFFF',   // White text on primary background

    // State Colors
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',

    // Border & Divider
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    divider: '#E5E7EB',

    // Interactive States
    hover: '#F3F4F6',
    pressed: '#E5E7EB',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.05)',
    shadowDark: 'rgba(0, 0, 0, 0.1)',
  },

  // Typography System
  fonts: {
    heading: 'Inter-Bold',
    subheading: 'Inter-SemiBold',
    body: 'Inter-Regular',
    caption: 'Inter-Light',
    mono: 'Courier New',
  },

  // Spacing System (8px grid)
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },

  // Border Radius
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    pill: 9999,
  },

  // Elevation/Shadow
  elevation: {
    level1: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
    level2: '0px 2px 4px -1px rgba(0, 0, 0, 0.1), 0px 4px 5px 0px rgba(0, 0, 0, 0.08), 0px 1px 10px 0px rgba(0, 0, 0, 0.06)',
    level3: '0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.08), 0px 8px 10px 0px rgba(0, 0, 0, 0.06)',
  },

  // Breakpoints for responsive design
  breakpoints: {
    sm: 320,
    md: 375,
    lg: 425,
    xl: 768,
  },
};
