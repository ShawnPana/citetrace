import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import { createClient } from '@supabase/supabase-js';

// Supabase client and storage bucket
// Environment variables are now loaded from the root .env file
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET_NAME = "pdfs";

// RAG API endpoint
const RAG_API_BASE_URL = 'http://127.0.0.1:5000'; // Changed to local backend
const RAG_API_ENDPOINT = `${RAG_API_BASE_URL}/api/query-rag`;

// Function to be called to initialize RAG, can be exported or passed as prop
export const initializeRagApi = async () => {
  console.log("[ChatComponent.tsx] initializeRagApi function entered"); // New log
  try {
    // This currently reuses the processAllPDFs logic for initialization.
    // If there's a dedicated /api/initialize-rag endpoint, call that instead.
    // For example:
    const response = await fetch(`${RAG_API_BASE_URL}/api/initialize-rag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        // If response is not JSON, use text
        const errorText = await response.text();
        throw new Error(errorText || `Failed to initialize RAG. Status: ${response.status}`);
      }
      throw new Error(errorData.message || `Failed to initialize RAG. Status: ${response.status}`);
    }

    // Log successful hit
    console.log(`Backend /api/initialize-rag hit successfully with status: ${response.status}`);

    const result = await response.json();
    // Log the full response from the backend
    console.log('RAG Initialization response from backend:', result);

    // Optionally, log the specific message if it exists
    if (result && result.message) {
      console.log('RAG Initialization message from backend:', result.message);
    }
    
    // Optionally, display a success message to the user via an alert or toast
    // Alert.alert('Success', result.message);
    return result;
  } catch (error) {
    console.error('Error initializing RAG:', error);
    // Optionally, display an error message to the user
    // Alert.alert('Error', `Failed to initialize RAG: ${error.message}`);
    throw error;
  }
};

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  sources?: {
    content: string;
    source: string;
  }[];
}

export default function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! How can I help you with your research papers today?',
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Auto scroll to bottom on new messages
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  // Process all PDFs in the database to update the RAG system
  const processAllPDFs = async () => {
    setIsProcessing(true);
    try {
      // We'll make a request to process each PDF
      const response = await supabase.storage.from(BUCKET_NAME).list();
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const pdfNames = response.data
        .filter((file: { name: string }) => file.name.endsWith('.pdf'))
        .map((file: { name: string }) => file.name);
      
      // Add a system message
      const processingMessage: Message = {
        id: Date.now().toString(),
        text: `Processing ${pdfNames.length} PDFs to update research knowledge...`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, processingMessage]);
      
      // Process each PDF
      for (const pdfName of pdfNames) {
        await fetch(`${RAG_API_BASE_URL}/api/process-pdf`, { // Use RAG_API_BASE_URL
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pdf_name: pdfName }),
        });
      }
      
      // Add success message
      const successMessage: Message = {
        id: Date.now().toString(),
        text: `Successfully processed ${pdfNames.length} PDFs. I'm now up to date with all your research!`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, successMessage]);
    } catch (error) {
      console.error('Error processing PDFs:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: 'Sorry, I encountered an error while processing your PDFs. Please try again later.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessage = async () => {
    if (inputMessage.trim() === '') return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    // Add user message to chat
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Add a temporary "thinking" message
      const tempBotMessageId = (Date.now() + 1).toString();
      setMessages(prevMessages => [
        ...prevMessages, 
        {
          id: tempBotMessageId,
          text: '',
          sender: 'bot',
          timestamp: new Date()
        }
      ]);

      // Call the RAG API endpoint
      const response = await fetch(RAG_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.text,
          top_k: 5,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from RAG API');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let accumulatedText = '';
      let sources: { content: string; source: string }[] = [];

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert Uint8Array to string
        const text = new TextDecoder().decode(value);
        const lines = text.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.status === 'generating' && data.chunk) {
              accumulatedText += data.chunk;
              
              // Update the bot message with the accumulated text
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === tempBotMessageId 
                    ? { ...msg, text: accumulatedText } 
                    : msg
                )
              );
            } else if (data.status === 'complete' && data.sources) {
              sources = data.sources;
              
              // Update the message one last time with sources
              setMessages(prevMessages => 
                prevMessages.map(msg => 
                  msg.id === tempBotMessageId 
                    ? { ...msg, text: accumulatedText, sources } 
                    : msg
                )
              );
            }
          } catch (e) {
            console.error('Error parsing stream data:', e);
          }
        }
      }

    } catch (error) {
      console.error('Error calling RAG API:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error while processing your request. Please try again later.',
        sender: 'bot',
        timestamp: new Date()
      };
      
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to save chat history to database
  const saveChatHistory = async () => {
    try {
      const { error } = await supabase
        .from('chat_histories')
        .insert({
          messages: messages,
          user_id: 'USER_ID', // Replace with actual user ID
          timestamp: new Date().toISOString()
        });

      if (error) throw error;
      // Show success toast or notification
    } catch (error) {
      console.error('Error saving chat history:', error);
      // Show error toast or notification
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Research Assistant</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, isProcessing && styles.actionButtonDisabled]} 
            onPress={processAllPDFs}
            disabled={isProcessing}
          >
            <Text style={styles.actionButtonText}>
              {isProcessing ? 'Processing...' : 'Update Knowledge'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={saveChatHistory}>
            <Text style={styles.actionButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'user'
                ? styles.userBubble
                : styles.botBubble
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
            
            {message.sources && message.sources.length > 0 && (
              <View style={styles.sourcesContainer}>
                <Text style={styles.sourcesTitle}>Sources:</Text>
                {message.sources.slice(0, 3).map((source, index) => (
                  <Text key={index} style={styles.sourceItem}>
                    • {source.source.replace(/\.pdf$/, '')}
                  </Text>
                ))}
                {message.sources.length > 3 && (
                  <Text style={styles.sourceMore}>
                    +{message.sources.length - 3} more
                  </Text>
                )}
              </View>
            )}
            
            <Text style={styles.timestamp}>
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        ))}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#4a90e2" />
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder="Ask about your research papers..."
          placeholderTextColor="#aaa"
          multiline
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 8,
  },
  actionButtonDisabled: {
    backgroundColor: '#aaa',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messagesContent: {
    paddingBottom: 10,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#4a90e2',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
  },
  timestamp: {
    fontSize: 10,
    color: '#888',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#4a90e2',
    borderRadius: 20,
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 8,
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  sourcesContainer: {
    marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 8,
  },
  sourcesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  sourceItem: {
    fontSize: 11,
    color: '#444',
    marginBottom: 2,
  },
  sourceMore: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
