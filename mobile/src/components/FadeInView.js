import React, { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export function FadeInView({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offsetY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(offsetY, {
        toValue: 0,
        duration: 260,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, offsetY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: offsetY }] }, style]}>
      {children}
    </Animated.View>
  );
}
