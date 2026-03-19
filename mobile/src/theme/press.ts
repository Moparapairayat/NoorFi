import { ViewStyle } from 'react-native';

export type PressPreset = 'soft' | 'medium' | 'strong';

// Change this single value to switch global press feedback.
export const PRESS_PRESET: PressPreset = 'medium';

type PressToken = {
  opacity: number;
  scale: number;
};

type PressPresetTokens = {
  button: PressToken;
  chip: PressToken;
  row: PressToken;
  icon: PressToken;
  micro: PressToken;
  card: PressToken;
  swatch: PressToken;
  textOpacity: number;
};

const pressPresetTokens: Record<PressPreset, PressPresetTokens> = {
  soft: {
    button: { opacity: 0.94, scale: 0.992 },
    chip: { opacity: 0.94, scale: 0.995 },
    row: { opacity: 0.94, scale: 0.996 },
    icon: { opacity: 0.92, scale: 0.975 },
    micro: { opacity: 0.9, scale: 0.975 },
    card: { opacity: 0.97, scale: 0.998 },
    swatch: { opacity: 0.94, scale: 0.985 },
    textOpacity: 0.82,
  },
  medium: {
    button: { opacity: 0.9, scale: 0.985 },
    chip: { opacity: 0.9, scale: 0.992 },
    row: { opacity: 0.9, scale: 0.992 },
    icon: { opacity: 0.88, scale: 0.96 },
    micro: { opacity: 0.84, scale: 0.96 },
    card: { opacity: 0.95, scale: 0.997 },
    swatch: { opacity: 0.9, scale: 0.97 },
    textOpacity: 0.76,
  },
  strong: {
    button: { opacity: 0.86, scale: 0.975 },
    chip: { opacity: 0.86, scale: 0.985 },
    row: { opacity: 0.86, scale: 0.985 },
    icon: { opacity: 0.82, scale: 0.94 },
    micro: { opacity: 0.78, scale: 0.93 },
    card: { opacity: 0.9, scale: 0.99 },
    swatch: { opacity: 0.86, scale: 0.955 },
    textOpacity: 0.66,
  },
};

const tokens = pressPresetTokens[PRESS_PRESET];

function makePressStyle(token: PressToken): ViewStyle {
  return {
    opacity: token.opacity,
    transform: [{ scale: token.scale }],
  };
}

export const pressStyles = {
  button: makePressStyle(tokens.button),
  chip: makePressStyle(tokens.chip),
  row: makePressStyle(tokens.row),
  icon: makePressStyle(tokens.icon),
  micro: makePressStyle(tokens.micro),
  card: makePressStyle(tokens.card),
  swatch: makePressStyle(tokens.swatch),
  text: {
    opacity: tokens.textOpacity,
  } as ViewStyle,
};
