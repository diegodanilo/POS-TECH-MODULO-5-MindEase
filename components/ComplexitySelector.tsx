import Colors from '@/constants/colors';
import { CognitiveComplexity } from '@/types/mindease';
import * as Haptics from 'expo-haptics';
import { Grid3x3, Layers, Minus } from 'lucide-react-native';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

interface ComplexitySelectorProps {
  value: CognitiveComplexity;
  onChange: (v: CognitiveComplexity) => void;
}

const levels: { value: CognitiveComplexity; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 1,
    label: 'Simples',
    description: 'Menos informação, mais espaço',
    icon: <Minus size={20} color={Colors.secondary} />,
  },
  {
    value: 2,
    label: 'Equilibrado',
    description: 'Balanço entre detalhe e clareza',
    icon: <Layers size={20} color={Colors.primary} />,
  },
  {
    value: 3,
    label: 'Detalhado',
    description: 'Máximo de informação disponível',
    icon: <Grid3x3 size={20} color={Colors.accent} />,
  },
];

export default function ComplexitySelector({ value, onChange }: ComplexitySelectorProps) {
  return (
    <View style={styles.container} testID="complexity-selector">
      {levels.map((level) => (
        <ComplexityOption
          key={level.value}
          level={level}
          isSelected={value === level.value}
          onSelect={() => onChange(level.value)}
        />
      ))}
    </View>
  );
}

function ComplexityOption({
  level,
  isSelected,
  onSelect,
}: {
  level: (typeof levels)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onSelect();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.option,
          isSelected && styles.optionSelected,
        ]}
        testID={`complexity-${level.value}`}
      >
        <View style={[styles.iconWrap, isSelected && styles.iconWrapSelected]}>
          {level.icon}
        </View>
        <View style={styles.optionText}>
          <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
            {level.label}
          </Text>
          <Text style={styles.optionDesc}>{level.description}</Text>
        </View>
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconWrapSelected: {
    backgroundColor: Colors.surface,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
});
