// Cosmos' OnboardingNavigator (useOnboardingFlowPlan) as far as an account that already exists goes: 年龄 → 性别 → 感兴趣的
// 内容. Near Cosmos: its email, password, full name and username steps come before these in the app, and here the account
// is made on the computer (a phone may not sign up, HANDOFF 6.138); ONBOARDING_ADD_FRIENDS needs the phone's contacts
// and the server has none, as on the web page (6.106).
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AgeScreen, GenderScreen, OnboardingInterestsScreen } from '../screens/onboarding/OnboardingScreens';
import { Routes } from './routes';

const Stack = createNativeStackNavigator();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator initialRouteName={Routes.AGE} screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Routes.AGE} component={AgeScreen} />
      <Stack.Screen name={Routes.GENDER} component={GenderScreen} />
      <Stack.Screen name={Routes.ONBOARDING_INTERESTS} component={OnboardingInterestsScreen} />
    </Stack.Navigator>
  );
}
