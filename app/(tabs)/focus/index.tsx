import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Headphones, Volume2, VolumeX, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import FocusTimer from '@/components/FocusTimer';
import BreathingWidget from '@/components/BreathingWidget';

const ambientModes = [
  { id: 'silent', label: 'Silêncio', icon: VolumeX },
  { id: 'nature', label: 'Natureza', icon: Volume2 },
  { id: 'focus', label: 'Foco', icon: Headphones },
  { id: 'calm', label: 'Calma', icon: Moon },
] as const;

export default function FocusScreen() {
  const { tokens, profile } = useCognitiveProfile();
  const { state, startFocusMode, endFocusMode } = useCognitiveEngine();
  const [selectedAmbient, setSelectedAmbient] = useState('silent');
  const [showBreathing, setShowBreathing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleStart = useCallback(() => {
    startFocusMode();
  }, [startFocusMode]);

  const handleComplete = useCallback((success: boolean) => {
    endFocusMode(success);
  }, [endFocusMode]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { fontSize: tokens.fontSize.heading }]}>Modo Foco</Text>
          {state.isInFocusMode && (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Ativo</Text>
            </View>
          )}
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.content, { padding: tokens.spacing.section }]}
          showsVerticalScrollIndicator={false}
        >
          <FocusTimer onStart={handleStart} onComplete={handleComplete} />

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
              Ambiente
            </Text>
            <View style={styles.ambientGrid}>
              {ambientModes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = selectedAmbient === mode.id;
                return (
                  <Pressable
                    key={mode.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedAmbient(mode.id);
                    }}
                    style={[
                      styles.ambientCard,
                      { borderRadius: tokens.borderRadius },
                      isSelected && styles.ambientCardSelected,
                    ]}
                    testID={`ambient-${mode.id}`}
                  >
                    <Icon
                      size={22}
                      color={isSelected ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.ambientLabel,
                        isSelected && styles.ambientLabelSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {profile.complexity >= 2 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                Dicas de Foco
              </Text>
              <View style={[styles.tipCard, { borderRadius: tokens.borderRadius }]}>
                <Text style={styles.tipEmoji}>🧠</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Técnica Pomodoro</Text>
                  <Text style={styles.tipDesc}>
                    Foque por {profile.focusGoalMinutes} minutos, depois faça uma pausa de 5
                    minutos. A cada 4 ciclos, faça uma pausa maior.
                  </Text>
                </View>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => setShowBreathing(!showBreathing)}
            style={[styles.breathingToggle, { borderRadius: tokens.borderRadius }]}
          >
            <Text style={styles.breathingToggleText}>
              {showBreathing ? 'Ocultar Respiração' : 'Exercício de Respiração'}
            </Text>
          </Pressable>

          {showBreathing && <BreathingWidget />}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.secondary,
  },
  content: {
    paddingBottom: 40,
  },
  section: {
    marginTop: 28,
  },
  sectionTitle: {
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  ambientGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  ambientCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: Colors.surface,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  ambientCardSelected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  ambientLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  ambientLabelSelected: {
    color: Colors.primary,
  },
  tipCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tipEmoji: {
    fontSize: 28,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  breathingToggle: {
    marginTop: 28,
    backgroundColor: Colors.primarySoft,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight + '40',
  },
  breathingToggleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
