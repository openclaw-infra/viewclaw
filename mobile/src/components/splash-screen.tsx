import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View, Image, Easing } from "react-native";
import { useTheme } from "../theme/theme-context";

const LOGO = require("../../assets/logo-icon.png");

const BREATH_DURATION = 2000;
const FADE_OUT_DURATION = 400;
const MIN_DISPLAY_MS = 1500;

type Props = {
  ready: boolean;
  onFinish: () => void;
};

export function SplashScreen({ ready, onFinish }: Props) {
  const { colors } = useTheme();
  const breathAnim = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(breathAnim, {
        toValue: 1,
        duration: BREATH_DURATION,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  useEffect(() => {
    if (!ready || !minTimePassed) return;
    Animated.timing(fadeOut, {
      toValue: 0,
      duration: FADE_OUT_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => onFinish());
  }, [ready, minTimePassed, fadeOut, onFinish]);

  const scale = breathAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.06, 1],
  });

  const opacity = breathAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.85, 1, 0.85],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.bg.primary, opacity: fadeOut },
      ]}
    >
      <View style={styles.content}>
        <Animated.View style={{ transform: [{ scale }], opacity }}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <View style={styles.brandRow}>
          <Animated.Text
            style={[styles.brandText, { color: colors.brand.blue, opacity }]}
          >
            Claw
          </Animated.Text>
          <Animated.Text
            style={[styles.brandText, { color: colors.brand.purple, opacity }]}
          >
            Flow
          </Animated.Text>
        </View>

        <Animated.Text
          style={[styles.tagline, { color: colors.text.muted, opacity }]}
        >
          AI Agent, at your fingertips
        </Animated.Text>
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
