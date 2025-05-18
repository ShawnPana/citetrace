import React from 'react';
import { View, StyleSheet, Dimensions, SafeAreaView } from 'react-native';
import ChatComponent from './ChatComponent';
import KnowledgeGraphScreen from './graph';

// This component combines both the chat and graph components
export default function ChatAndGraphScreen() {
  // The screen is divided: chat on the left, graph on the right
  const windowWidth = Dimensions.get('window').width;
  
  // Determine the optimal split (40% chat, 60% graph)
  const CHAT_WIDTH_PERCENT = 0.4;
  const chatWidth = windowWidth * CHAT_WIDTH_PERCENT;
  const graphWidth = windowWidth * (1 - CHAT_WIDTH_PERCENT);

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.chatContainer, { width: chatWidth }]}>
        <ChatComponent />
      </View>
      <View style={[styles.graphContainer, { width: graphWidth }]}>
        <KnowledgeGraphScreen standAlone={false} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f5f7fa',
  },
  chatContainer: {
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  graphContainer: {
    flex: 1,
  },
});
