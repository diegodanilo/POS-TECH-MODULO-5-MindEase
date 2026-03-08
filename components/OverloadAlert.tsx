import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { AlertTriangle, Coffee, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface OverloadAlertProps {
  visible: boolean;
  onTakeBreak: () => void;
  onDismiss: () => void;
}

export default function OverloadAlert({ visible, onTakeBreak, onDismiss }: OverloadAlertProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -100, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={20} color={Colors.accent} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>Hora de uma pausa</Text>
          <Text style={styles.subtitle}>Detectamos sinais de sobrecarga cognitiva</Text>
        </View>
        <Pressable onPress={onDismiss} style={styles.closeBtn} testID="overload-dismiss">
          <X size={18} color={Colors.textMuted} />
        </Pressable>
      </View>
      <Pressable onPress={onTakeBreak} style={styles.breakBtn} testID="overload-break">
        <Coffee size={16} color={Colors.textInverse} />
        <Text style={styles.breakText}>Fazer pausa</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadowStrong,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 100,
    borderWidth: 1,
    borderColor: Colors.accentSoft,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  breakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  breakText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
});
