import { CognitiveComplexity, CognitiveTokens } from '@/types/mindease';

const tokensByComplexity: Record<CognitiveComplexity, CognitiveTokens> = {
  1: {
    spacing: { base: 20, card: 20, section: 28 },
    fontSize: { body: 18, heading: 28, subheading: 20, caption: 14 },
    borderRadius: 20,
    maxItemsVisible: 3,
    animationDuration: 0,
    lineHeight: 1.8,
    cardElevation: 1,
  },
  2: {
    spacing: { base: 16, card: 16, section: 24 },
    fontSize: { body: 16, heading: 24, subheading: 18, caption: 13 },
    borderRadius: 16,
    maxItemsVisible: 5,
    animationDuration: 250,
    lineHeight: 1.6,
    cardElevation: 2,
  },
  3: {
    spacing: { base: 12, card: 14, section: 20 },
    fontSize: { body: 15, heading: 22, subheading: 16, caption: 12 },
    borderRadius: 12,
    maxItemsVisible: 8,
    animationDuration: 200,
    lineHeight: 1.5,
    cardElevation: 3,
  },
};

export function getTokens(complexity: CognitiveComplexity): CognitiveTokens {
  return tokensByComplexity[complexity];
}

export default tokensByComplexity;
