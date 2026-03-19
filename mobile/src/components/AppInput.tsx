import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, pressStyles, radius, spacing, typography } from '../theme';

type AppInputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  wrapperStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  hintText?: string;
  errorText?: string | null;
  required?: boolean;
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  onRightAdornmentPress?: () => void;
};

export function AppInput({
  label,
  wrapperStyle,
  inputStyle,
  hintText,
  errorText,
  required = false,
  leftAdornment,
  rightAdornment,
  onRightAdornmentPress,
  editable = true,
  onBlur,
  onFocus,
  ...props
}: AppInputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(errorText);

  const rightNode = rightAdornment ? (
    onRightAdornmentPress ? (
      <Pressable
        onPress={onRightAdornmentPress}
        style={({ pressed }) => [styles.adornmentButton, pressed && pressStyles.icon]}
      >
        {rightAdornment}
      </Pressable>
    ) : (
      <View style={styles.adornment}>{rightAdornment}</View>
    )
  ) : null;

  return (
    <View style={wrapperStyle}>
      {label ? (
        <View style={styles.labelRow}>
          <View style={styles.labelDot} />
          <Text style={styles.label}>{label}</Text>
          {required ? <Text style={styles.requiredMark}>*</Text> : null}
        </View>
      ) : null}
      <View
        style={[
          styles.inputShell,
          focused && styles.inputShellFocused,
          hasError && styles.inputShellError,
          !editable && styles.inputShellDisabled,
        ]}
      >
        {leftAdornment ? <View style={styles.adornment}>{leftAdornment}</View> : null}
        <TextInput
          editable={editable}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            Boolean(leftAdornment) && styles.inputWithLeftAdornment,
            Boolean(rightAdornment) && styles.inputWithRightAdornment,
            inputStyle,
          ]}
          {...props}
        />
        {rightNode}
      </View>
      {hasError ? <Text style={styles.errorText}>{errorText}</Text> : null}
      {!hasError && hintText ? <Text style={styles.hintText}>{hintText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  labelDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.bodyMedium,
    fontSize: 13,
  },
  requiredMark: {
    color: colors.danger,
    fontFamily: typography.bodyBold,
    fontSize: 13,
    marginLeft: 4,
  },
  inputShell: {
    backgroundColor: '#FCFEFC',
    borderColor: colors.stroke,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  inputShellFocused: {
    backgroundColor: '#F8FCF9',
    borderColor: '#8FC3A8',
  },
  inputShellError: {
    borderColor: '#D06456',
  },
  inputShellDisabled: {
    backgroundColor: '#F0F4F1',
  },
  adornment: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  adornmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    color: colors.textPrimary,
    fontFamily: typography.body,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
    flex: 1,
  },
  inputWithLeftAdornment: {
    paddingLeft: spacing.md,
  },
  inputWithRightAdornment: {
    paddingRight: spacing.sm,
  },
  hintText: {
    color: colors.textMuted,
    fontFamily: typography.body,
    fontSize: 12,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
});
