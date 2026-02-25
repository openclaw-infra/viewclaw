import { config } from "@tamagui/config";
import { createTamagui } from "@tamagui/core";

const tamaguiConfig = createTamagui(config);

type AppConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
