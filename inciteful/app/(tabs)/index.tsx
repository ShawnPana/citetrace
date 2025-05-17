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
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from 'expo-router';


interface Paper { id: string; name: string; uri: string }

export default function HomeScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [papers, setPapers] = useState<Paper[]>([]);
  const router = useRouter();

  // pick PDF --> add to list
  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;
      setPapers((p) => [...p, { id: Date.now().toString(), name: asset.name ?? 'Untitled.pdf', uri: asset.uri }]);
    } catch { Alert.alert('Error', 'Failed to pick PDF'); }
  };

  // remove from list
  const remove = (id: string) => setPapers((p) => p.filter((n) => n.id !== id));

  // row with name + delete X icon
  const Row = ({ item }: { item: Paper }) => (
    <View style={styles.row}> 
      <RNText numberOfLines={1} style={styles.rowText}>{item.name}</RNText>
      <Pressable onPress={() => remove(item.id)}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none"><Path d="M18 6 6 18M6 6l12 12" stroke="#e63946" strokeWidth={2} strokeLinecap="round"/></Svg>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <RNText style={styles.h1}>My Papers</RNText>

      <Pressable style={styles.dropzone} onPress={pickPdf}>
        <Svg width={48} height={48} viewBox="0 0 24 24" fill="none"><Path d="M12 5v14M5 12h14" stroke="#888" strokeWidth={2} strokeLinecap="round"/></Svg>
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
        <RNText style={styles.graphBtnText}>Open Knowledge Graph</RNText>
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
});
