import { Stack } from "expo-router";

const Layout = () => {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ headerShown: false, animation: "none" }}
      />
      <Stack.Screen
        name="verify-otp"
        options={{ headerShown: false, animation: "none" }}
      />
    </Stack>
  );
};

export default Layout;
