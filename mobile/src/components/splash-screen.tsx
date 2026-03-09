import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, Image, Easing } from "react-native";
import { YStack } from "tamagui";
import { useTheme } from "../theme/theme-context";

const LOGO = require("../../assets/logo-icon.png");

const FADE_OUT_DURATION = 400;
const MIN_DISPLAY_MS = 1500;

type Props = {
  ready: boolean;
  onFinish: () => void;
};

export function SplashScreen({ ready, onFinish }: Props) {
  const { colors } = useTheme();
  const fadeOut = useRef(new Animated.Value(1)).current;
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready || !minTimePassed) return;
    Animated.timing(fadeOut, {
      toValue: 0,
      duration: FADE_OUT_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [ready, minTimePassed, fadeOut, onFinish]);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.bg.primary, opacity: fadeOut },
      ]}
    >
      <View style={styles.content}>
        <YStack
          animation="lazy"
          scale={1}
          opacity={1}
          enterStyle={{ scale: 1.03, opacity: 0 }}
        >
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </YStack>

        <View style={styles.brandRow}>
          <YStack animation="lazy" opacity={1} enterStyle={{ opacity: 0 }}>
            <Animated.Text
              style={[styles.brandText, { color: colors.brand.blue }]}
            >
              Claw
            </Animated.Text>
          </YStack>
          <YStack animation="lazy" opacity={1} enterStyle={{ opacity: 0 }}>
            <Animated.Text
              style={[styles.brandText, { color: colors.brand.purple }]}
            >
              Flow
            </Animated.Text>
          </YStack>
        </View>

        <YStack animation="lazy" opacity={1} enterStyle={{ opacity: 0 }}>
          <Animated.Text
            style={[styles.tagline, { color: colors.text.muted }]}
          >
            AI Agent, at your fingertips
          </Animated.Text>
        </YStack>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  content: {
    alignItems: "center",
    gap: 16,
  },
  logo: {
    width: 80,
    height: 80,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 8,
  },
  brandText: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
