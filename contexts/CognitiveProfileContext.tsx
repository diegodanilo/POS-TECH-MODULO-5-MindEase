import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { CognitiveProfile, CognitiveComplexity, CognitiveCondition } from '@/types/mindease';
import { getTokens } from '@/constants/cognitive-tokens';

const PROFILE_KEY = 'mindease_cognitive_profile';

const defaultProfile: CognitiveProfile = {
  name: '',
  complexity: 2,
  conditions: [],
  focusGoalMinutes: 25,
  breakIntervalMinutes: 25,
  reducedMotion: false,
  highContrast: false,
  onboardingComplete: false,
};

export const [CognitiveProfileProvider, useCognitiveProfile] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<CognitiveProfile>(defaultProfile);

  const profileQuery = useQuery({
    queryKey: ['cognitiveProfile'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      if (stored) {
        return JSON.parse(stored) as CognitiveProfile;
      }
      return defaultProfile;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (updated: CognitiveProfile) => {
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['cognitiveProfile'], data);
    },
  });

  useEffect(() => {
    if (profileQuery.data) {
      setProfile(profileQuery.data);
    }
  }, [profileQuery.data]);

  const { mutate } = saveMutation;

  const updateProfile = useCallback((updates: Partial<CognitiveProfile>) => {
    const updated = { ...profile, ...updates };
    setProfile(updated);
    mutate(updated);
  }, [profile, mutate]);

  const setComplexity = useCallback((complexity: CognitiveComplexity) => {
    updateProfile({ complexity });
  }, [updateProfile]);

  const toggleCondition = useCallback((condition: CognitiveCondition) => {
    const conditions = profile.conditions.includes(condition)
      ? profile.conditions.filter((c) => c !== condition)
      : [...profile.conditions, condition];
    updateProfile({ conditions });
  }, [profile.conditions, updateProfile]);

  const completeOnboarding = useCallback((name: string, complexity: CognitiveComplexity, conditions: CognitiveCondition[]) => {
    updateProfile({ name, complexity, conditions, onboardingComplete: true });
  }, [updateProfile]);

  const tokens = getTokens(profile.complexity);

  return {
    profile,
    tokens,
    isLoading: profileQuery.isLoading,
    updateProfile,
    setComplexity,
    toggleCondition,
    completeOnboarding,
  };
});
