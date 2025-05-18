/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

/**
 * CitTrace color palette inspired by scientific/medical digital treatment interfaces
 * Includes a primary teal, accents, and supporting neutral & utility colors.
 */

// Core Palette
const primaryTeal = '#00C2B8';      // Main vibrant teal
const lightTeal = '#53E6DC';        // Lighter shade for highlights or secondary elements
const skyBlueAccent = '#39D5FF';   // Bright, energetic blue accent

// New Accent Colors
const warmCoral = '#FF8A65';       // A warm, inviting coral for contrast
const deepIndigo = '#4A00E0';     // A deeper, cool color for secondary actions or accents
const softGold = '#FFD700';        // A soft gold for highlights or status indicators

export const Colors = {
  light: {
    text: '#111111',
    background: '#FFFFFF',
    tint: primaryTeal,
    icon: '#4A5568', // Darker gray for better contrast on white
    tabIconDefault: '#999999',
    tabIconSelected: primaryTeal,
    card: '#FFFFFF',
    cardBorder: '#E2E8F0', // Slightly more visible border
    shadow: 'rgba(0, 0, 0, 0.07)',
    button: primaryTeal,
    buttonText: '#FFFFFF',
    secondaryButton: '#E0F2F1', // Very light teal for secondary button background
    secondaryButtonText: primaryTeal, // Teal text for secondary button
    gradientStart: primaryTeal,
    gradientEnd: skyBlueAccent,
    
    // Accents & Utility
    accentWarm: warmCoral,
    accentCool: deepIndigo,
    accentHighlight: softGold,
    danger: '#E53E3E',
    success: '#10B981',
    warning: '#F59E0B',
    divider: '#E2E8F0',
    placeholder: '#A0AEC0',
  },
  dark: {
    text: '#F8FAFC',
    background: '#1A202C', // Slightly lighter dark background for better depth
    tint: lightTeal,
    icon: '#CBD5E0', // Lighter gray for dark mode
    tabIconDefault: '#888888',
    tabIconSelected: lightTeal,
    card: '#2D3748', // Darker card for contrast
    cardBorder: '#4A5568',
    shadow: 'rgba(0, 0, 0, 0.25)',
    button: primaryTeal,
    buttonText: '#FFFFFF', 
    secondaryButton: '#2D3748', // Dark card color for secondary button background
    secondaryButtonText: lightTeal, // Light teal text
    gradientStart: primaryTeal,
    gradientEnd: skyBlueAccent,

    // Accents & Utility
    accentWarm: '#FFAB91', // Lighter coral for dark mode
    accentCool: '#9575CD', // Lighter indigo for dark mode
    accentHighlight: '#FFECB3', // Lighter gold
    danger: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    divider: '#4A5568',
    placeholder: '#718096',
  },
};
