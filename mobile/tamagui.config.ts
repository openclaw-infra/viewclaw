import { configWithoutAnimations } from "@tamagui/config";
import { createAnimations } from "@tamagui/animations-moti";
import { createTamagui } from "@tamagui/core";

const animations = createAnimations({
  quick: {
    type: "spring",
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  bouncy: {
    type: "spring",
    damping: 15,
    mass: 0.9,
    stiffness: 150,
  },
  lazy: {
    type: "spring",
    damping: 20,
    stiffness: 60,
  },
  breathe: {
    type: "timing",
    duration: 2000,
  },
} as const);

const tamaguiConfig = createTamagui({
  ...configWithoutAnimations,
  // @ts-expect-error Tamagui v2 RC AnimationDriver / AnimationsConfig type mismatch
  animations,
});

export default tamaguiConfig;
