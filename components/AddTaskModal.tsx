import Colors from '@/constants/colors';
import { useCognitiveProfile } from '@/contexts/CognitiveProfileContext';
import { TaskCognitiveLoad } from '@/types/mindease';
import * as Haptics from 'expo-haptics';
import { Plus, X, Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface AddTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (task: {
    title: string;
    description: string;
    cognitiveLoad: TaskCognitiveLoad;
    estimatedMinutes: number;
    tags: string[];
    status: 'pending';
  }) => void;
}

const loadOptions: { value: TaskCognitiveLoad; label: string; color: string }[] = [
  { value: 'low', label: 'Leve', color: Colors.cognitiveLoad.low },
  { value: 'medium', label: 'Moderado', color: Colors.cognitiveLoad.medium },
  { value: 'high', label: 'Intenso', color: Colors.cognitiveLoad.high },
];

const timeOptions = [10, 15, 25, 30, 45, 60];

export default function AddTaskModal({ visible, onClose, onAdd }: AddTaskModalProps) {
  const { tokens } = useCognitiveProfile();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cognitiveLoad, setCognitiveLoad] = useState<TaskCognitiveLoad>('low');
  const [estimatedMinutes, setEstimatedMinutes] = useState(25);

  const handleAdd = () => {
    if (!title.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd({
      title: title.trim(),
      description: description.trim(),
      cognitiveLoad,
      estimatedMinutes,
      tags: [],
      status: 'pending',
    });
    setTitle('');
    setDescription('');
    setCognitiveLoad('low');
    setEstimatedMinutes(25);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" testID="add-task-modal">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { fontSize: tokens.fontSize.subheading }]}>
            Nova Tarefa
          </Text>
          <Pressable onPress={onClose} style={styles.closeBtn} testID="close-add-task">
            <X size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
          <View style={styles.field}>
            <Text style={styles.label}>Título</Text>
            <TextInput
              style={[styles.input, { borderRadius: tokens.borderRadius }]}
              value={title}
              onChangeText={setTitle}
              placeholder="O que precisa fazer?"
              placeholderTextColor={Colors.textMuted}
              testID="task-title-input"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { borderRadius: tokens.borderRadius }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Detalhes adicionais..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              testID="task-desc-input"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Carga Cognitiva</Text>
            <View style={styles.loadOptions}>
              {loadOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCognitiveLoad(opt.value);
                  }}
                  style={[
                    styles.loadOption,
                    cognitiveLoad === opt.value && {
                      backgroundColor: opt.color + '18',
                      borderColor: opt.color,
                    },
                  ]}
                >
                  <Zap size={14} color={opt.color} fill={cognitiveLoad === opt.value ? opt.color : 'transparent'} />
                  <Text
                    style={[
                      styles.loadOptionText,
                      cognitiveLoad === opt.value && { color: opt.color },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tempo Estimado</Text>
            <View style={styles.timeOptions}>
              {timeOptions.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEstimatedMinutes(t);
                  }}
                  style={[
                    styles.timeOption,
                    estimatedMinutes === t && styles.timeOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      estimatedMinutes === t && styles.timeOptionTextSelected,
                    ]}
                  >
                    {t}min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleAdd}
            style={[styles.addButton, !title.trim() && styles.addButtonDisabled]}
            disabled={!title.trim()}
            testID="confirm-add-task"
          >
            <Plus size={20} color={Colors.textInverse} />
            <Text style={styles.addButtonText}>Adicionar Tarefa</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  form: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  loadOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  loadOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  loadOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  timeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  timeOptionSelected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  timeOptionText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  timeOptionTextSelected: {
    color: Colors.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
});
