import React from "react";
import { AppRegistry, Platform, View, Text } from "react-native";

// Error boundary to catch render errors
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string | null}> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return React.createElement(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 20 } },
        React.createElement(Text, { style: { color: "red", fontSize: 16, fontWeight: "bold" } }, "RENDER ERROR:"),
        React.createElement(Text, { style: { marginTop: 10 } }, this.state.error)
      );
    }
    return this.props.children;
  }
}

let AppComponent: React.ComponentType;
try {
  AppComponent = require("./App").default;
} catch (e: any) {
  const msg = e?.message ?? "Unknown import error";
  AppComponent = () => React.createElement(View, { style: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 20 } },
    React.createElement(Text, { style: { color: "red", fontSize: 16, fontWeight: "bold" } }, "IMPORT ERROR:"),
    React.createElement(Text, { style: { marginTop: 10 } }, msg)
  );
}

function Root() {
  return React.createElement(ErrorBoundary, null, React.createElement(AppComponent));
}

AppRegistry.registerComponent("main", () => Root);

if (Platform.OS === "web") {
  AppRegistry.runApplication("main", {
    rootTag: document.getElementById("root"),
  });
}
