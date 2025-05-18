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
  StatusBar,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Svg, { Path, Rect, Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { createClient } from "@supabase/supabase-js";
import { LinearGradient as ExpoGradient } from "expo-linear-gradient";

// Constants and styles
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

// Logo import
const logoAsset = require("../../assets/images/citetrace_logo_trans.png");

const { width, height } = Dimensions.get("window");
const BUTTON_WIDTH = width * 0.85;
const CARD_WIDTH = width * 0.9;
const CARD_PADDING = 20;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Paper {
  id: string;
  name: string;
  uri: string;
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'flex-start',
    paddingTop: height * 0.1,
    paddingBottom: height * 0.06,
    paddingHorizontal: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    opacity: 0.04,
  },
  decorativeElement: {
    position: 'absolute',
    top: -30,
    right: -100,
    width: width * 0.6,
    height: height * 0.4,
    opacity: 0.2,
  },
  logo: {
    width: width * 0.4,
    height: 110,
    marginBottom: 28,
    alignSelf: 'center',
  },
  mainTitle: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: colors.text,
    marginBottom: 12,
    alignSelf: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: colors.icon,
    maxWidth: '85%',
    alignSelf: 'center',
  },
  mainContent: {
    paddingHorizontal: 32,
    paddingTop: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 40,
    color: colors.text,
    opacity: 0.9,
  },
  buttonContainer: {
    marginBottom: 60,
  },
  uploadButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#2F4F9A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F4F9A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  graphBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    borderColor: '#2F4F9A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 10,
  },
  papersSection: {
    paddingHorizontal: 32,
    paddingBottom: 50,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionIcon: {
    marginRight: 12,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: CARD_PADDING,
    borderRadius: 12,
    marginBottom: 14,
    width: '100%',
    shadowColor: colors.shadow, 
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  cardText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 20,
  },
  emptyContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  emptyIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.text,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '80%',
    color: colors.placeholder,
  }
});

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [papers, setPapers] = useState<Paper[]>([]);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const styles = getStyles(colors);

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
      Alert.alert("Upload Successful", "Your PDF has been uploaded.");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Upload Failed", err.message);
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
      Alert.alert("Error", "Failed to pick or upload PDF.");
    }
  };

  const remove = (id: string) => setPapers((p) => p.filter((n) => n.id !== id));

  const Row = ({ item }: { item: Paper }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <View style={styles.fileIconContainer}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path 
              d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" 
              stroke={colors.accentCool}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path 
              d="M14 2V8H20M16 13H8M16 17H8M10 9H8" 
              stroke={colors.accentCool}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <RNText numberOfLines={1} style={styles.cardText}>
          {item.name}
        </RNText>
      </View>
      <Pressable 
        onPress={() => remove(item.id)} 
        style={[styles.deleteBtn, { backgroundColor: `${colors.danger}15` }]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"> 
          <Path d="M18 6 6 18M6 6l12 12" stroke={colors.danger} strokeWidth={1.8} strokeLinecap="round"/>
        </Svg>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>  
        <View style={styles.header}>
          <ExpoGradient
            colors={[colors.button, colors.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          />
          
          <Svg height={height * 0.4} width={width * 0.6} style={styles.decorativeElement}>
            <Defs>
              <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0" stopColor={colors.gradientStart} stopOpacity="0.9" />
                <Stop offset="1" stopColor={colors.gradientEnd} stopOpacity="0.9" />
              </LinearGradient>
            </Defs>
            <Circle cx={width * 0.15} cy={height * 0.15} r={width * 0.1} fill="url(#grad)" opacity={0.3} />
            <Circle cx={width * 0.35} cy={height * 0.2} r={width * 0.08} fill="url(#grad)" opacity={0.2} />
            <Circle cx={width * 0.25} cy={height * 0.3} r={width * 0.12} fill="url(#grad)" opacity={0.15} />
          </Svg>
          
          <View style={{ width: '100%', alignItems: 'center' }}>
            <Image source={logoAsset} style={styles.logo} resizeMode="contain" />
            <RNText style={styles.mainTitle}>
              CiteTrace
            </RNText>
            <RNText style={styles.subtitle}>
              Intelligent Research. Visualized Connections.
            </RNText>
          </View>
        </View>

        <View style={styles.mainContent}>
          <RNText style={styles.description}>
            Analyze research papers, generate interactive citation graphs, and uncover knowledge patterns.
          </RNText>

          <View style={styles.buttonContainer}>
            <Pressable 
              style={styles.uploadButton} 
              onPress={pickPdf}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.buttonText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <Path d="M17 8l-5-5-5 5" />
                <Path d="M12 3v12" />
              </Svg>
              <RNText style={[styles.buttonText, { color: colors.buttonText }]}>
                Upload PDF
              </RNText>
            </Pressable>

            <Pressable 
              style={styles.graphBtn} 
              onPress={() => router.push("/graph")}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={'#2F4F9A'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 3v18M3 12h18M12 3v18" />
                <Circle cx="17" cy="17" r="3" fill="none" />
                <Circle cx="17" cy="7" r="3" fill="none" />
                <Circle cx="7" cy="17" r="3" fill="none" />
              </Svg>
              <RNText style={[styles.buttonText, { color: '#2F4F9A' }]}>
                View Knowledge Graph
              </RNText>
            </Pressable>
          </View>
        </View>

        <View style={styles.papersSection}>
          <View style={styles.sectionHeader}>
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={styles.sectionIcon}>
              <Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </Svg>
            <RNText style={styles.sectionTitle}>Your Documents</RNText>
          </View>
          
          <FlatList
            data={papers}
            renderItem={Row}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Svg width={35} height={35} viewBox="0 0 24 24" fill="none" stroke={colors.placeholder} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M2 12h5M17 12h5" />
                    <Path d="M9 5.5A8.5 8.5 0 1 0 9 18.5" />
                    <Circle cx="9" cy="12" r="2" />
                  </Svg>
                </View>
                <RNText style={styles.emptyTitle}>
                  No Documents Yet
                </RNText>
                <RNText style={styles.emptyText}>
                  Upload a PDF to begin building your knowledge graph.
                </RNText>
              </View>
            }
            contentContainerStyle={{ paddingVertical: 10 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
