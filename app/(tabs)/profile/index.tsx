import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Brain,
  Timer,
  Shield,
  Eye,
  Sparkles,
  Info,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { CognitiveCondition } from '@/types/mindease';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { useCognitiveEngine } from '@/contexts/CognitiveEngineContext';
import ComplexitySelector from '@/components/ComplexitySelector';

const conditionOptions: { value: CognitiveCondition; label: string; emoji: string }[] = [
  { value: 'adhd', label: 'TDAH', emoji: '⚡' },
  { value: 'asd', label: 'TEA', emoji: '🧩' },
  { value: 'dyslexia', label: 'Dislexia', emoji: '📖' },
  { value: 'burnout', label: 'Burnout', emoji: '🔥' },
  { value: 'anxiety', label: 'Ansiedade', emoji: '💭' },
  { value: 'sensory_overload', label: 'Sobrecarga Sensorial', emoji: '🎧' },
  { value: 'retention_difficulty', label: 'Dificuldade de Retenção', emoji: '🧠' },
];

export default function ProfileScreen() {
  const { profile, tokens, updateProfile, setComplexity, toggleCondition } = useCognitiveProfile();
  const { state } = useCognitiveEngine();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(profile.name);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    setNameInput(profile.name);
  }, [profile.name]);

  const handleSaveName = () => {
    updateProfile({ name: nameInput.trim() });
    setEditingName(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { fontSize: tokens.fontSize.heading }]}>Perfil</Text>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.content, { padding: tokens.spacing.section }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.profileCard, { borderRadius: tokens.borderRadius }]}>
            <View style={styles.avatarCircle}>
              <User size={28} color={Colors.primary} />
            </View>
            {editingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Seu nome"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  onSubmitEditing={handleSaveName}
                  testID="name-input"
                />
                <Pressable onPress={handleSaveName} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>Salvar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} style={styles.nameRow}>
                <Text style={[styles.profileName, { fontSize: tokens.fontSize.subheading }]}>
                  {profile.name || 'Definir nome'}
                </Text>
                <ChevronRight size={16} color={Colors.textMuted} />
              </Pressable>
            )}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{state.currentStreak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{Math.round(state.focusScore)}%</Text>
                <Text style={styles.statLabel}>Foco</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profile.focusGoalMinutes}m</Text>
                <Text style={styles.statLabel}>Meta</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Brain size={18} color={Colors.primary} />
              <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                Complexidade da Interface
              </Text>
            </View>
            <ComplexitySelector
              value={profile.complexity}
              onChange={setComplexity}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Sparkles size={18} color={Colors.primary} />
              <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                Perfil Cognitivo
              </Text>
            </View>
            <Text style={styles.sectionDesc}>
              Selecione as condições que se aplicam a você para personalizar a experiência
            </Text>
            <View style={styles.conditionsGrid}>
              {conditionOptions.map((cond) => {
                const isActive = profile.conditions.includes(cond.value);
                return (
                  <Pressable
                    key={cond.value}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleCondition(cond.value);
                    }}
                    style={[
                      styles.conditionChip,
                      isActive && styles.conditionChipActive,
                    ]}
                    testID={`condition-${cond.value}`}
                  >
                    <Text style={styles.conditionEmoji}>{cond.emoji}</Text>
                    <Text
                      style={[
                        styles.conditionLabel,
                        isActive && styles.conditionLabelActive,
                      ]}
                    >
                      {cond.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Timer size={18} color={Colors.primary} />
              <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                Tempo de Foco
              </Text>
            </View>
            <View style={styles.timeGrid}>
              {[15, 20, 25, 30, 45].map((min) => (
                <Pressable
                  key={min}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateProfile({ focusGoalMinutes: min, breakIntervalMinutes: min });
                  }}
                  style={[
                    styles.timeChip,
                    profile.focusGoalMinutes === min && styles.timeChipActive,
                  ]}
                  testID={`focus-time-${min}`}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      profile.focusGoalMinutes === min && styles.timeChipTextActive,
                    ]}
                  >
                    {min}min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield size={18} color={Colors.primary} />
              <Text style={[styles.sectionTitle, { fontSize: tokens.fontSize.subheading }]}>
                Acessibilidade
              </Text>
            </View>
            <View style={[styles.settingCard, { borderRadius: tokens.borderRadius }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Eye size={18} color={Colors.textSecondary} />
                  <Text style={styles.settingLabel}>Movimento Reduzido</Text>
                </View>
                <Switch
                  value={profile.reducedMotion}
                  onValueChange={(v) => updateProfile({ reducedMotion: v })}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={Colors.surface}
                  testID="reduced-motion-switch"
                />
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Eye size={18} color={Colors.textSecondary} />
                  <Text style={styles.settingLabel}>Alto Contraste</Text>
                </View>
                <Switch
                  value={profile.highContrast}
                  onValueChange={(v) => updateProfile({ highContrast: v })}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={Colors.surface}
                  testID="high-contrast-switch"
                />
              </View>
            </View>
          </View>

          <View style={[styles.infoCard, { borderRadius: tokens.borderRadius }]}>
            <Info size={16} color={Colors.primary} />
            <Text style={styles.infoText}>
              Seus dados são armazenados localmente no seu dispositivo. Nenhuma informação
              pessoal é compartilhada.
            </Text>
          </View>
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  content: {
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    width: '100%',
    paddingHorizontal: 12,
  },
  nameInput: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
  profileName: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '500' as const,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderLight,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sectionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 19,
  },
  conditionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  conditionChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  conditionEmoji: {
    fontSize: 16,
  },
  conditionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  conditionLabelActive: {
    color: Colors.primary,
  },
  timeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  timeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  timeChipActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  timeChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  timeChipTextActive: {
    color: Colors.primary,
  },
  settingCard: {
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 16,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: Colors.primarySoft,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 19,
  },
});
