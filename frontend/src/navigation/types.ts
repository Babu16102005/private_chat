export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Chat: { pairId: string; partner: any };
  Invite: { token?: string } | undefined;
  Profile: undefined;
  ChatSettings: { pairId: string; partner: any };
  CreateStory: undefined;
  StoryViewer: { story: any };
};
