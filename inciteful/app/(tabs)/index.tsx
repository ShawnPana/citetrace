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
  Dimensions,
  Image,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { createClient } from "@supabase/supabase-js";

// Logo import
const logo = require("../../assets/images/citetrace_logo_trans.png");

const { width } = Dimensions.get("window");
const BUTTON_WIDTH = width * 0.6;
const CARD_WIDTH = width * 0.85;
const CARD_PADDING = 16;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Paper {
  id: string;
  name: string;
  uri: string;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [papers, setPapers] = useState<Paper[]>([]);
  const router = useRouter();

  const uploadPdf = async (paper: Paper) => {
    try {
      const response = await fetch(paper.uri);
      const fileBlob = await response.blob();
      const { error: uploadError } = await supabase
        .storage
        .from("pdfs")
        .upload(paper.name, fileBlob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase
        .storage
        .from("pdfs")
        .getPublicUrl(paper.name);
      Alert.alert("Upload successful", urlData.publicUrl);
    } catch (err: any) {
      console.error(err);
      Alert.alert("Upload failed", err.message);
    }
  };

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      const newPaper = {
        id: Date.now().toString(),
        name: asset.name ?? "Untitled.pdf",
        uri: asset.uri,
      };
      setPapers((prev) => [newPaper, ...prev]);
      await uploadPdf(newPaper);
    } catch {
      Alert.alert("Error", "Failed to pick or upload PDF");
    }
  };

  const remove = (id: string) => setPapers((p) => p.filter((n) => n.id !== id));

  const Row = ({ item }: { item: Paper }) => (
    <View style={styles.card}>
      <RNText numberOfLines={1} style={styles.cardText}>{item.name}</RNText>
      <Pressable onPress={() => remove(item.id)} style={styles.deleteBtn}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M18 6 6 18M6 6l12 12" stroke="#E53E3E" strokeWidth={2} strokeLinecap="round"/>
        </Svg>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>  
        {/* Header */}
        <View style={styles.header}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <RNText style={styles.subtitle}>
            Welcome to your research hub.
          </RNText>
        </View>

        {/* Feature Highlights */}
        <View style={styles.featuresContainer}>
          <RNText style={styles.featuresText}>• Store and manage your PDFs securely.</RNText>
          <RNText style={styles.featuresText}>• Generate interactive knowledge graphs.</RNText>
          <RNText style={styles.featuresText}>• Share insights and collaborate easily.</RNText>
        </View>

        {/* Upload Button */}
        <Pressable style={styles.dropzone} onPress={pickPdf}>
          <View style={styles.iconWrapper}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke="#4A5568" strokeWidth={2} strokeLinecap="round"/>
            </Svg>
          </View>
          <RNText style={styles.dropText}>
            Tap to upload PDF{Platform.OS === "web" && " or drag & drop"}
          </RNText>
        </Pressable>

        {/* Uploaded Papers */}
        <FlatList
          data={papers}
          renderItem={Row}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<RNText style={styles.empty}>No PDFs yet. Tap above to start.</RNText>}
          contentContainerStyle={{ paddingVertical: 10 }}
        />

        {/* Graph Button */}
        <Pressable style={styles.graphBtn} onPress={() => router.push("/graph")}>
          <RNText style={styles.graphBtnText}>View Graph</RNText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F9',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    width: width * 0.35,
    height: 100,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '500',
    color: '#4A5568',
    textAlign: 'center',
  },
  featuresContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    width: CARD_WIDTH,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  featuresText: {
    fontSize: 15,
    color: '#2D3748',
    marginVertical: 4,
    lineHeight: 20,
  },
  dropzone: {
    alignSelf: 'center',
    width: BUTTON_WIDTH,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E0',
    borderRadius: 12,
    backgroundColor: '#FFF',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  iconWrapper: {
    backgroundColor: '#E2E8F0',
    padding: 10,
    borderRadius: 50,
    marginBottom: 8,
  },
  dropText: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '400',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: CARD_PADDING,
    borderRadius: 12,
    marginBottom: 12,
    width: CARD_WIDTH,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardText: {
    flex: 1,
    fontSize: 16,
    color: '#2D3748',
    fontWeight: '500',
  },
  deleteBtn: {
    marginLeft: 12,
    padding: 6,
  },
  empty: {
    textAlign: 'center',
    color: '#A0AEC0',
    marginTop: 20,
    fontSize: 16,
  },
  graphBtn: {
    alignSelf: 'center',
    width: BUTTON_WIDTH,
    backgroundColor: '#3182CE',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  graphBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
