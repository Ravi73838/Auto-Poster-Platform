import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/(auth)/login" style={styles.link}>
          <Text style={styles.linkText}>Go to login screen!</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 16,
    color: '#2563EB',
    fontWeight: '600',
  },
});

