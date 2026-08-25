import { Redirect } from "expo-router";

export default function RechargeRoute() {
  return (
    <Redirect
      href={{
        pathname: "/(tabs)/(tokens)",
        params: {
          recharge: `deep-link:${Date.now()}`,
          autoUnlock: "1",
        },
      }}
    />
  );
}
