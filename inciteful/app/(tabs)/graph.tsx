import rawSimData from "../../assets/similarity_scores.json";
const simData: Record<string, Record<string, number>> = rawSimData;
import React, { useEffect, useState } from "react";
import {
  View,
  Dimensions,
  Text as RNText,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import Svg, { Circle, Line, G, Path, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { createClient } from "@supabase/supabase-js";
import { polygonHull } from "d3-polygon";
import { useRouter } from "expo-router";

// Import the Color constants
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

// Supabase client
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SIDEBAR_WIDTH = 380;
const BASE_RADIUS = 24;

interface Node {
  id: string;
  label: string;
  angle: number;
  radius: number;
  color: string;
  cluster: number;
}
interface Link {
  source: string;
  target: string;
  similarity: number;
}

const getStyles = (colors: any) => StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: colors.background,
  },
  header: { 
    height: 60, 
    flexDirection: 'row',
    alignItems: 'center', 
    borderBottomWidth: 1, 
    paddingHorizontal: 20,
    backgroundColor: colors.background,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '600',
    flex: 1,
    color: colors.text,
  },
  body: { 
    flex: 1, 
    flexDirection: 'row',
  },
  graphWrapper: { 
    width: Dimensions.get('window').width - SIDEBAR_WIDTH, 
    height: '100%', 
    backgroundColor: colors.background,
  },
  sidebar: { 
    width: SIDEBAR_WIDTH, 
    borderLeftWidth: 1, 
    padding: 30, 
    backgroundColor: colors.card,
    borderLeftColor: colors.cardBorder,
  },
  sidebarContent: { 
    paddingBottom: 40, 
    flexGrow: 1, 
  },
  sidebarTitle: { 
    fontSize: 28, 
    fontWeight: '700',
    marginBottom: 24,
    lineHeight: 32,
    color: colors.text,
  },
  nodeInfoSection: {
    marginBottom: 24,
  },
  connectionStats: {
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 16,
    // backgroundColor will be set dynamically
    // borderColor will be set dynamically
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 2,
    color: colors.icon,
  },
  divider: {
    height: 1,
    marginVertical: 24,
    backgroundColor: colors.divider,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '600', 
    marginBottom: 16,
    color: colors.text,
  },
  notesContainer: { 
    marginBottom: 24,
  },
  textArea: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 16, 
    minHeight: 160, 
    textAlignVertical: 'top', 
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.background,
    borderColor: colors.cardBorder,
    color: colors.text,
  },
  actionButton: {
    borderRadius: 8, 
    paddingVertical: 14, 
    marginTop: 16,
    backgroundColor: '#2F4F9A', // Use a deeper blue color
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: { 
    fontWeight: '600', 
    fontSize: 16,
    textAlign: 'center',
    color: colors.buttonText,
    marginLeft: 8,
  },
  placeholderContainer: { 
    flex: 1, 
    justifyContent: 'center',
    paddingVertical: 40,
    alignItems: 'center', // Ensure content is centered
  },
  placeholderHeading: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
    textAlign: 'center',
    color: colors.text,
  },
  placeholderDescription: {
    marginTop: 16,
    alignItems: 'center', // Ensure text within this container can be centered
  },
  placeholderText: { 
    fontSize: 16, 
    lineHeight: 24,
    textAlign: 'center',
    color: colors.icon,
    maxWidth: '90%', // Prevent text from being too wide
  },
});

export default function KnowledgeGraphScreen() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [theta, setTheta] = useState(0);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const styles = getStyles(colors); // Generate styles with current colors

  // animate rotation slower
  useEffect(() => {
    let raf: number;
    const loop = () => {
      setTheta((t) => t + 0.0005);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // fetch nodes and build links
  useEffect(() => {
    async function fetchPapers() {
      const { data: files, error } = await supabase.storage.from("pdfs").list("", { limit: 100 });
      if (error) return console.error(error.message);

      const paperNodes: Node[] = files.map((f, i) => ({
        id: f.name,
        label: f.name.replace(/\.pdf$/, ""),
        angle: 0,
        radius: 0,
        color: "#888", // Default color, will be overridden
        cluster: 0,      // Default cluster
      }));

      const paperLinks: Link[] = [];
      paperNodes.forEach((a) => {
        paperNodes.forEach((b) => {
          if (a.id < b.id) {
            const fwd = simData[a.id]?.[b.id];
            const rev = simData[b.id]?.[a.id];
            const s = fwd !== undefined ? fwd : rev;
            if (s !== undefined) paperLinks.push({ source: a.id, target: b.id, similarity: s });
          }
        });
      });

      const sims = paperLinks.map((l) => l.similarity);
      const minSim = Math.min(...sims, 0); // Ensure minSim is not Infinity if sims is empty
      const maxSim = Math.max(...sims, 1); // Ensure maxSim is not -Infinity and avoid division by zero

      const threshold = 0.4;
      const parent = new Map<string, string>();
      paperNodes.forEach((n) => parent.set(n.id, n.id));
      function find(u: string): string {
        const p = parent.get(u)!;
        if (p !== u) {
          const r = find(p);
          parent.set(u, r);
          return r;
        }
        return u;
      }
      function union(u: string, v: string) {
        const pu = find(u), pv = find(v);
        if (pu !== pv) parent.set(pu, pv);
      }
      paperLinks.forEach((l) => { if (l.similarity >= threshold) union(l.source, l.target); });
      
      const clusterMap = new Map<string, number>();
      let clusterCounter = 0;
      paperNodes.forEach((n) => {
        const root = find(n.id);
        if (!clusterMap.has(root)) {
          clusterMap.set(root, clusterCounter++);
        }
        n.cluster = clusterMap.get(root)!;
      });

      const numUniqueClusters = clusterMap.size;
      // Generate distinct base hues for each cluster, ensuring good visual separation
      const clusterBaseHues = Array.from({ length: numUniqueClusters }, (_, i) => (180 + i * (360 / (numUniqueClusters + 2))) % 360);

      const windowDims = Dimensions.get("window");
      const baseR = Math.min(windowDims.width, windowDims.height) / 2 - BASE_RADIUS * 2.5;
      const R = baseR * 0.8; // Slightly larger for better distribution
      
      // Better node distribution - arrange in more spaced clusters
      paperNodes.forEach((node, i) => {
        // Use cluster for better visual grouping
        const clusterAngleOffset = (node.cluster * Math.PI * 0.4) % (2 * Math.PI); // Distribute clusters around the circle
        node.angle = clusterAngleOffset + (i * 0.5) % (Math.PI * 0.5); // Add variety within clusters
        
        // Vary radius slightly based on cluster with a bit of randomness
        const clusterRadiusFactor = 0.8 + (node.cluster % 3) * 0.1; // Slightly different radius per cluster
        node.radius = R * clusterRadiusFactor + (Math.random() - 0.5) * baseR * 0.3;
        
        const related = paperLinks.filter((l) => l.source === node.id || l.target === node.id);
        const avgSim = related.reduce((sum, l) => sum + l.similarity, 0) / (related.length || 1);
        // Normalize avgSim for intra-cluster lightness variation (0 to 1)
        const t = (related.length && maxSim > minSim) ? (avgSim - minSim) / (maxSim - minSim) : 0.5;

        const clusterHue = clusterBaseHues[node.cluster % numUniqueClusters];
        // Vary lightness within a cluster, keep saturation relatively high for vibrancy
        const lightness = 55 + (t - 0.5) * 20; // e.g., 45% to 75%
        node.color = `hsl(${clusterHue}, 75%, ${Math.max(40, Math.min(75, lightness))}%)`;
      });

      setNodes(paperNodes);
      setLinks(paperLinks);
    }
    fetchPapers();
  }, []);

  const windowDims = Dimensions.get("window");
  const W = windowDims.width;
  const H = windowDims.height;
  const cx = W / 2;
  const cy = H / 2;

  const positioned = nodes.map((n) => {
    const rawX = cx + n.radius * Math.cos(n.angle + theta);
    const rawY = cy + n.radius * Math.sin(n.angle + theta);
    const maxW = W - SIDEBAR_WIDTH;
    const maxH = H - 80;
    const x = Math.min(Math.max(rawX, BASE_RADIUS), maxW - BASE_RADIUS);
    const y = Math.min(Math.max(rawY, BASE_RADIUS), maxH - BASE_RADIUS);
    return { ...n, x, y };
  });

  const hulls = Array.from(
    positioned.reduce((m, n) => {
      if (!m.has(n.cluster)) m.set(n.cluster, []);
      m.get(n.cluster)!.push([n.x, n.y]);
      return m;
    }, new Map<number, [number, number][]>())
  ).map(([, pts]) => polygonHull(pts));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <Pressable 
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path 
              d="M15 18l-6-6 6-6" // Changed to a chevron left
              stroke={colors.text} 
              strokeWidth={2} 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <RNText style={styles.headerTitle}>Knowledge Graph</RNText>
         <View style={{ width: 40 }} />{/* Spacer to balance back button */}
      </View>
      
      <View style={styles.body}>
        <View style={styles.graphWrapper}>
          <Svg width={W - SIDEBAR_WIDTH} height={H - 80}>
            <Defs>
              <SvgGradient id="linkGradient" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.gradientStart} stopOpacity="0.5" />
                <Stop offset="1" stopColor={colors.gradientEnd} stopOpacity="0.7" />
              </SvgGradient>
            </Defs>
            
            {hulls.map((hull, idx) => {
              if (!hull) return null;
              // Use a neutral, less prominent color for hulls
              const hullFillColor = colorScheme === 'dark' ? 'rgba(203, 213, 224, 0.08)' : 'rgba(100, 116, 139, 0.08)'; // Very subtle gray
              const hullStrokeColor = colorScheme === 'dark' ? 'rgba(203, 213, 224, 0.2)' : 'rgba(100, 116, 139, 0.2)';

              return (
                <Path
                  key={idx}
                  d={hull.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ') + ' Z'}
                  fill={hullFillColor}
                  opacity={1} // Opacity is now part of the color
                  stroke={hullStrokeColor}
                  strokeWidth={1} // Thinner stroke for hulls
                />
              );
            })}
            
            {links.map((l, idx) => {
              const s = positioned.find((n) => n.id === l.source);
              const t = positioned.find((n) => n.id === l.target);
              if (!s || !t) return null;
              return (
                <Line
                  key={idx}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={colors.text} // Changed to black/white based on theme
                  strokeOpacity={0.15 + l.similarity * 0.25} // Adjusted opacity for better visibility with solid color
                  strokeWidth={0.5 + l.similarity * 1.5} // Adjusted width for solid color
                />
              );
            })}
            
            {positioned.map((n) => {
              const isSel = selected?.id === n.id;
              const isHov = hovered === n.id;
              return (
                <G
                  key={n.id}
                  onPress={() => setSelected(n)}
                  onPressIn={() => setHovered(n.id)}
                  onPressOut={() => setHovered(null)}
                >
                  <Circle
                    cx={n.x}
                    cy={n.y}
                    r={isHov ? BASE_RADIUS * 1.25 : BASE_RADIUS} // Slightly larger hover
                    fill={n.color}
                    stroke={isSel ? colors.accentWarm : (colorScheme === 'dark' ? '#E2E8F0' : '#4A5568')}
                    strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.5}
                    opacity={isHov || isSel ? 1 : 0.9}
                  />
                  <SvgText
                    x={n.x}
                    y={n.y + BASE_RADIUS + 16} // Slightly increased spacing
                    fontSize={12} // Slightly smaller for a cleaner look
                    fontWeight="400" // Normal weight for less heavy text
                    fontFamily="Helvetica" // Explicitly set sans-serif font
                    fill={colors.text}
                    textAnchor="middle"
                    opacity={isSel || isHov ? 0.9 : 0.65} // Adjusted opacity
                  >
                    {n.label.length > 20 ? n.label.slice(0, 20) + '...' : n.label} 
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>
        
        <View style={styles.sidebar}>
          <ScrollView contentContainerStyle={styles.sidebarContent}>
            {selected ? (
              <>
                <RNText style={styles.sidebarTitle}>
                  {selected.label}
                </RNText>
                
                <View style={styles.nodeInfoSection}>
                  <View style={styles.connectionStats}>
                    <View style={styles.statItem}>
                      <View style={[styles.statIcon, { backgroundColor: selected.color }]} />
                      <View style={styles.statText}>
                        <RNText style={styles.statValue}>
                          {links.filter(l => l.source === selected.id || l.target === selected.id).length}
                        </RNText>
                        <RNText style={styles.statLabel}>Connections</RNText>
                      </View>
                    </View>
                    
                    <View style={styles.statItem}>
                      <View style={[styles.statIcon, { borderColor: colors.accentCool, backgroundColor: `${colors.accentCool}33` }]} />
                      <View style={styles.statText}>
                        <RNText style={styles.statValue}>
                          {selected.cluster + 1}
                        </RNText>
                        <RNText style={styles.statLabel}>Cluster</RNText>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.notesContainer}>
                  <RNText style={styles.sectionTitle}>Notes</RNText>
                  <TextInput
                    multiline
                    placeholder="Add notes or insights..."
                    placeholderTextColor={colors.placeholder}
                    style={styles.textArea}
                    value={notes[selected.id] || ""}
                    onChangeText={(t) => setNotes((p) => ({ ...p, [selected.id]: t }))}
                  />
                </View>
                
                <Pressable 
                  style={styles.actionButton} 
                  onPress={() => setSelected(null)}
                >
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.buttonText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 6L6 18M6 6l12 12" />
                  </Svg>
                  <RNText style={styles.actionButtonText}>
                    Close
                  </RNText>
                </Pressable>
              </>
            ) : (
              <View style={styles.placeholderContainer}>
                <Svg width={60} height={60} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 20, opacity: 0.8}} stroke={colors.icon} strokeWidth={1.2}>
                    <Path d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />{/* Arrow with graph-like element*/}
                    <Circle cx="17" cy="6" r="3" />
                    <Circle cx="17" cy="18" r="3" />
                    <Line x1="17" y1="9" x2="17" y2="15" />
                </Svg>
                <RNText style={styles.placeholderHeading}>
                  Graph Explorer
                </RNText>
                                
                <View style={styles.placeholderDescription}>
                  <RNText style={styles.placeholderText}>
                    Select a node to view its details and add notes.
                    Clusters indicate related documents. Connections show citation links.
                  </RNText>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}