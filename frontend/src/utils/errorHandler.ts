import { Alert } from 'react-native';

export const handleError = (error: any, defaultMessage: string = 'An unexpected error occurred.') => {
  console.error('Error:', error);

  let message = defaultMessage;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error.message === 'string') {
    message = error.message;
  }

  Alert.alert('Oops!', message);
};
