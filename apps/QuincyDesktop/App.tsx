import { StatusBar } from "expo-status-bar"
import { StyleSheet, Text, View } from "react-native"

export default function App() {
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>Quincy</Text>
        <Text style={styles.title}>Expo Desktop port</Text>
        <Text style={styles.body}>
          This target is wired for macOS and Windows through expo-desktop. The
          existing Electrobun editor remains the source implementation while
          React Native-compatible feature slices are ported.
        </Text>
      </View>
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#09090d",
    padding: 24,
  },
  panel: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    padding: 28,
  },
  kicker: {
    marginBottom: 10,
    color: "#7c6af7",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "rgba(255, 255, 255, 0.94)",
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  body: {
    marginTop: 14,
    color: "rgba(255, 255, 255, 0.66)",
    fontSize: 16,
    lineHeight: 24,
  },
})
