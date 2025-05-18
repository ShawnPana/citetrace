import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Text as RNText,
  Pressable,
  FlatList,
  Alert,
  SafeAreaView,
  ActivityIndicator, // Added
  Modal, // Added
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from 'expo-router';
import { createClient } from '@supabase/supabase-js';
import { initializeRagApi } from './ChatComponent'; // Import the function

// Get Supabase credentials from environment variables
// Environment variables are now loaded from the root .env file
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Paper { id: string; name: string; uri: string }

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [papers, setPapers] = useState<Paper[]>([]);
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false); // Added state for loading

  const handleOpenChatAndGraph = async () => {
    console.log("[index.tsx] handleOpenChatAndGraph triggered"); // New log
    setIsInitializing(true); // Show loading screen
    try {
      console.log("[index.tsx] Attempting to call initializeRagApi..."); // New log
      await initializeRagApi();
      console.log("[index.tsx] initializeRagApi call completed (or threw error handled below)."); // New log
      router.push('/chat-and-graph');
    } catch (error) {
      console.error("[index.tsx] Error in handleOpenChatAndGraph after initializeRagApi call:", error); // Modified log
      Alert.alert('Initialization Failed', 'Could not initialize the Research Assistant. Please try again.');
    } finally {
      console.log("[index.tsx] handleOpenChatAndGraph finally block."); // New log
      setIsInitializing(false); // Hide loading screen
    }
  };

  // Upload a PDF to Supabase storage and show its public URL
  const uploadPdf = async (paper: Paper) => {
    try {
      const response = await fetch(paper.uri);
      const fileBlob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('pdfs')
        .upload(paper.name, fileBlob, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/pdf',
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase
        .storage
        .from('pdfs')
        .getPublicUrl(paper.name);

      Alert.alert(
        'Upload successful',
        `Public URL:\n${urlData.publicUrl}`
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert('Upload or URL generation failed', err.message);
    }
  };

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (res.canceled) return;
      
      const asset = res.assets?.[0];
      if (!asset) return;
      
      const newPaper = {
        id: Date.now().toString(),
        name: asset.name ?? 'Untitled.pdf',
        uri: asset.uri,
      };
      setPapers((prev) => [...prev, newPaper]);
      await uploadPdf(newPaper);
    } catch (err) {
      Alert.alert('Error', 'Failed to pick or upload PDF');
    }
  };

  const remove = (id: string) => setPapers((p) => p.filter((n) => n.id !== id));

  const Row = ({ item }: { item: Paper }) => (
    <View style={styles.row}>
      <RNText numberOfLines={1} style={styles.rowText}>{item.name}</RNText>
      <Pressable onPress={() => remove(item.id)}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6 6 18M6 6l12 12" stroke="#e63946" strokeWidth={2} strokeLinecap="round"/>
        </Svg>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        transparent={true}
        animationType="none"
        visible={isInitializing}
        onRequestClose={() => {}} // Required for Android
      >
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#1a535c" />
          <RNText style={styles.loadingText}>Initializing Research Assistant...</RNText>
        </View>
      </Modal>

      <RNText style={styles.h1}>My Papers</RNText>

      <Pressable style={styles.dropzone} onPress={pickPdf}>
        <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#888" strokeWidth={2} strokeLinecap="round"/>
        </Svg>
        <RNText style={styles.dropText}>Tap to upload PDF{Platform.OS==='web' && ' or drag & drop'}</RNText>
      </Pressable>

      <FlatList
        data={papers}
        renderItem={Row}
        keyExtractor={(i)=>i.id}
        ListEmptyComponent={<RNText style={styles.empty}>No PDFs yet.</RNText>}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      />

      <Pressable
        style={[styles.graphBtn, { bottom: insets.bottom + 24 }]}
        onPress={() => router.push('/graph')}
      >
        <RNText style={styles.graphBtnText}>Open Inciteful Graph</RNText>
      </Pressable>
      
      <Pressable
        style={[styles.graphBtn, { bottom: insets.bottom + 84 }]}
        onPress={handleOpenChatAndGraph} // Updated onPress handler
      >
        <RNText style={styles.graphBtnText}>Open Graph with Research Assistant</RNText>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f9f9f9',paddingHorizontal:24},
  h1:{fontSize:24,fontWeight:'700',marginVertical:16},
  dropzone:{borderWidth:2,borderStyle:'dashed',borderColor:'#bbb',borderRadius:16,paddingVertical:40,alignItems:'center',justifyContent:'center',marginBottom:16},
  dropText:{marginTop:8,color:'#666'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff',paddingHorizontal:16,paddingVertical:14,borderRadius:10,marginTop:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4},
  rowText:{flex:1,fontSize:15,fontWeight:'500',marginRight:12},
  empty:{textAlign:'center',color:'#666',marginTop:24},
  graphBtn:{position:'absolute',left:24,right:24,backgroundColor:'#1a535c',borderRadius:16,alignItems:'center',justifyContent:'center',paddingVertical:14},
  graphBtnText:{color:'#fff',fontSize:16,fontWeight:'600'},
  loadingOverlay: { // Added style for loading overlay
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // Semi-transparent white background
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10, // Ensure it's on top
  },
  loadingText: { // Added style for loading text
    marginTop: 10,
    fontSize: 16,
    color: '#1a535c',
  },
});